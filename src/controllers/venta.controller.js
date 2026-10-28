import pool from "../data/db.js";
import { METODOS_PUERTA, crearCompra, entradasDe, liberarVencidas, puedeVerDni, sincronizarAgotadas, validarContacto, validarItems } from "../utils/compras.js";
import { confirmarCompra } from "../utils/pagos.js";
import { despacharPendientes } from "../utils/notificaciones.js";
import { parseId } from "../utils/validaciones.js";
import { responderErrorDeBase } from "../utils/usuarios.js";
import { datosCompra } from "./compra.controller.js";

// Ventas de un evento vistas desde el panel, pago manual, cancelación y venta en la puerta.

const eventoDelBoliche = async (req, res) => {
    const idEvento = parseId(req.params.idEvento);
    if (idEvento === null) {
        res.status(400).json({ mensaje: "el id del evento no es valido" });
        return null;
    }
    const evento = (await pool.query(`SELECT id_evento, id_boliche, nombre, estado FROM evento WHERE id_boliche = $1 AND id_evento = $2`, [req.boliche.id_boliche, idEvento])).rows[0];
    if (!evento) {
        res.status(404).json({ mensaje: "ese evento no existe" });
        return null;
    }

    return evento;
};

// Qué ventas ve cada rol: el admin y el superadmin todas; el manager las de su equipo; el RRPP solo las suyas.
const filtroDeVentas = (usuario, idxParam) => {
    if (usuario.rol === "rrpp") return { sql: `AND c.id_rrpp = $${idxParam}`, params: [usuario.id] };
    if (usuario.rol === "rrpp_manager") {
        return { sql: `AND (c.id_vendedor = $${idxParam} OR c.id_rrpp IN (SELECT id_usuario FROM boliche_equipo WHERE id_boliche = c.id_boliche AND id_manager = $${idxParam}))`, params: [usuario.id] };
    }

    return { sql: "", params: [] };
};

// GET /boliches/:id/eventos/:idEvento/ventas[?estado=pendiente|pagada|cancelada]
export const listarVentas = async (req, res) => {
    try {
        const evento = await eventoDelBoliche(req, res);
        if (!evento) return;
        await liberarVencidas(pool);

        const filtro = filtroDeVentas(req.usuario, 4);
        const estado = ["pendiente", "pagada", "cancelada"].includes(req.query.estado) ? req.query.estado : null;
        const compras = (await pool.query(`
            SELECT c.*, u.nombre_completo AS vendedor, r.nombre_completo AS rrpp
              FROM compra c
              LEFT JOIN usuario u ON u.id_usuario = c.id_vendedor
              LEFT JOIN usuario r ON r.id_usuario = c.id_rrpp
             WHERE c.id_boliche = $1 AND c.id_evento = $2 AND ($3::text IS NULL OR c.estado = $3) ${filtro.sql}
             ORDER BY c.creada_en DESC`, [req.boliche.id_boliche, evento.id_evento, estado, ...filtro.params])).rows;

        const verDni = puedeVerDni(req.usuario.rol);
        const salida = [];
        for (const c of compras) {
            salida.push({ ...datosCompra(c, await entradasDe(pool, c.id_compra, { verDni })), vendedor: c.vendedor, rrpp: c.rrpp, id_rrpp: c.id_rrpp });
        }
        const pagadas = salida.filter((c) => c.estado === "pagada");
        const resumen = {
            compras: salida.length,
            entradas_pagadas: pagadas.reduce((t, c) => t + c.entradas.length, 0),
            entradas_pendientes: salida.filter((c) => c.estado === "pendiente").reduce((t, c) => t + c.entradas.length, 0),
            recaudado: pagadas.reduce((t, c) => t + c.subtotal - c.descuento, 0),
        };

        res.json({ evento: evento.nombre, resumen, compras: salida });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "no se pudieron obtener las ventas" });
    }
};

const compraDelBoliche = async (req, res) => {
    const idCompra = parseId(req.params.idCompra);
    if (idCompra === null) {
        res.status(400).json({ mensaje: "el id de la compra no es valido" });
        return null;
    }
    const compra = (await pool.query(`SELECT * FROM compra WHERE id_boliche = $1 AND id_compra = $2`, [req.boliche.id_boliche, idCompra])).rows[0];
    if (!compra) {
        res.status(404).json({ mensaje: "esa compra no existe" });
        return null;
    }

    return compra;
};

const enviarAvisos = () => despacharPendientes(pool).catch((error) => console.error("No se pudieron enviar los avisos:", error.message));

// PUT /boliches/:id/compras/:idCompra/pagar {metodo_pago?} — confirma a mano que el pago llegó (si no, lo confirma solo el aviso del banco).
export const pagarCompra = async (req, res) => {
    const cliente = await pool.connect();
    try {
        const compra = await compraDelBoliche(req, res);
        if (!compra) return;
        await liberarVencidas(pool);
        const metodo = req.body?.metodo_pago ?? "transferencia";
        if (!["transferencia", "efectivo", "qr"].includes(metodo)) return res.status(400).json({ mensaje: "el metodo de pago debe ser transferencia, efectivo o qr" });

        await cliente.query("BEGIN");
        const pagada = await confirmarCompra(cliente, compra.id_compra, { metodo, origen: "manual", idUsuario: req.usuario.id });
        if (!pagada) {
            await cliente.query("ROLLBACK");
            const actual = (await pool.query(`SELECT estado FROM compra WHERE id_compra = $1`, [compra.id_compra])).rows[0].estado;
            return res.status(409).json({ mensaje: actual === "cancelada" ? "la compra venció o fue cancelada: el cliente tiene que comprar de nuevo" : "esa compra ya estaba paga" });
        }
        await cliente.query("COMMIT");
        enviarAvisos();

        res.json(datosCompra(pagada, await entradasDe(pool, pagada.id_compra, { verDni: puedeVerDni(req.usuario.rol) })));
    } catch (error) {
        await cliente.query("ROLLBACK");
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo confirmar el pago" });
    } finally {
        cliente.release();
    }
};

// PUT /boliche/:id/compras/:idCompra/cancelar — solo las que todavía no se pagaron: una entrada pagada no se devuelve.
export const cancelarCompra = async (req, res) => {
    const cliente = await pool.connect();
    try {
        const compra = await compraDelBoliche(req, res);
        if (!compra) return;
        if (compra.estado === "pagada") return res.status(409).json({ mensaje: "una entrada ya pagada no se devuelve" });

        await cliente.query("BEGIN");
        await cliente.query(`UPDATE compra SET estado = 'cancelada', vence_en = NULL WHERE id_compra = $1 AND estado = 'pendiente'`, [compra.id_compra]);
        await cliente.query(`UPDATE entrada SET estado = 'anulada' WHERE id_compra = $1 AND estado = 'pendiente'`, [compra.id_compra]);
        await sincronizarAgotadas(cliente, compra.id_boliche, compra.id_evento);
        await cliente.query("COMMIT");

        res.json({ mensaje: "compra cancelada" });
    } catch (error) {
        await cliente.query("ROLLBACK");
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo cancelar la compra" });
    } finally {
        cliente.release();
    }
};

// POST /boliches/:id/eventos/:idEvento/venta-puerta
// {items: [{id_tipo_entrada, nombre, apellido, dni}], metodo_pago: "efectivo"|"qr"|"transferencia", contacto_email?, contacto_telefono?}
// Se cobra el precio de puerta y la entrada queda válida enseguida. Si vende un RRPP, la venta es suya (con su comisión).
export const ventaPuerta = async (req, res) => {
    const cliente = await pool.connect();
    try {
        const evento = await eventoDelBoliche(req, res);
        if (!evento) return;
        if (evento.estado !== "publicado") return res.status(409).json({ mensaje: "el evento no está publicado" });
        const { error, items } = validarItems(req.body?.items);
        if (error) return res.status(400).json({ mensaje: error });
        if (!METODOS_PUERTA.includes(req.body?.metodo_pago)) return res.status(400).json({ mensaje: `el metodo de pago debe ser uno de: ${METODOS_PUERTA.join(", ")}` });
        const contacto = validarContacto(req.body, false);
        if (contacto.error) return res.status(400).json({ mensaje: contacto.error });

        await liberarVencidas(pool);
        await cliente.query("BEGIN");
        const compra = await crearCompra(cliente, {
            boliche: req.boliche, evento, items, canal: "puerta", metodo: req.body.metodo_pago, contacto,
            idVendedor: req.usuario.id, idRrpp: req.usuario.rol === "rrpp" ? req.usuario.id : null,
        });
        const pagada = await confirmarCompra(cliente, compra.id_compra, { metodo: req.body.metodo_pago, origen: "puerta", idUsuario: req.usuario.id });
        await sincronizarAgotadas(cliente, req.boliche.id_boliche, evento.id_evento);
        await cliente.query("COMMIT");
        enviarAvisos();

        res.status(201).json(datosCompra(pagada, await entradasDe(pool, pagada.id_compra, { verDni: puedeVerDni(req.usuario.rol), conCodigo: true })));
    } catch (error) {
        await cliente.query("ROLLBACK");
        if (error.estado) return res.status(error.estado).json({ mensaje: error.mensaje });
        if (responderErrorDeBase(error, res)) return;
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo registrar la venta" });
    } finally {
        cliente.release();
    }
};
