import pool from "../data/db.js";
import { crearCompra, entradasDe, liberarVencidas, sincronizarAgotadas, validarContacto, validarItems } from "../utils/compras.js";
import { parseId } from "../utils/validaciones.js";
import { descuentoPara } from "./descuento.controller.js";
import { responderErrorDeBase } from "../utils/usuarios.js";

// Compra de entradas desde la página pública (sin cuenta obligatoria) y consulta de la compra con su QR.

// Forma en que se muestra una compra a quien la hizo.
export const datosCompra = (c, entradas) => ({
    id_compra: c.id_compra,
    token_publico: c.token_publico,
    referencia: c.referencia,
    estado: c.estado,
    canal: c.canal,
    metodo_pago: c.metodo_pago,
    subtotal: c.subtotal,
    descuento: c.descuento,
    descuento_nombre: c.descuento_nombre,
    cargo_plataforma: c.cargo_plataforma,
    total: c.total,
    vence_en: c.vence_en,
    creada_en: c.creada_en,
    pagada_en: c.pagada_en,
    contacto_email: c.contacto_email,
    contacto_telefono: c.contacto_telefono,
    entradas,
});

// Un evento se puede comprar si es de un boliche activo, está publicado y no terminó (la noche sigue unas horas después del inicio).
const eventoVendible = async (subdominio, idEvento) => (await pool.query(`
    SELECT b.id_boliche, b.nombre AS boliche, b.subdominio, e.id_evento, e.nombre AS evento, e.fecha_hora
      FROM boliche b JOIN evento e ON e.id_boliche = b.id_boliche
     WHERE b.subdominio = $1 AND b.activo AND e.id_evento = $2 AND e.estado = 'publicado' AND e.fecha_hora >= now() - interval '6 hours'`,
    [String(subdominio).toLowerCase(), idEvento])).rows[0];

// POST /publico/boliches/:subdominio/eventos/:idEvento/comprar
// {items: [{id_tipo_entrada, nombre, apellido, dni}], contacto_email?, contacto_telefono?, talonario?: código del link de un RRPP}
// Se paga el precio virtual más el cargo de la plataforma; la compra queda pendiente hasta que llegue el pago.
export const comprar = async (req, res) => {
    const cliente = await pool.connect();
    try {
        const idEvento = parseId(req.params.idEvento);
        if (idEvento === null) return res.status(400).json({ mensaje: "el id del evento no es valido" });
        const { error, items } = validarItems(req.body?.items);
        if (error) return res.status(400).json({ mensaje: error });
        const contacto = validarContacto(req.body, true);
        if (contacto.error) return res.status(400).json({ mensaje: contacto.error });

        await liberarVencidas(pool);
        const evento = await eventoVendible(req.params.subdominio, idEvento);
        if (!evento) return res.status(404).json({ mensaje: "ese evento no existe o ya no está a la venta" });
        // Sin una cuenta donde cobrar, el cliente no tendría a dónde transferir: ese boliche vende solo en la puerta.
        if ((await pool.query(`SELECT 1 FROM boliche_cuenta_cobro WHERE id_boliche = $1`, [evento.id_boliche])).rows.length === 0) {
            return res.status(409).json({ mensaje: "este boliche todavía no recibe pagos desde la página: las entradas se pagan en la puerta" });
        }

        await cliente.query("BEGIN");
        // Con el link de un RRPP (su talonario) la venta se le adjudica y cuenta contra las entradas que le asignaron.
        let talonario = null;
        if (req.body?.talonario !== undefined && req.body?.talonario !== null) {
            talonario = (await cliente.query(`SELECT * FROM talonario WHERE codigo = $1 AND id_boliche = $2 AND id_evento = $3 FOR UPDATE`,
                [String(req.body.talonario).toUpperCase(), evento.id_boliche, evento.id_evento])).rows[0];
            if (!talonario) {
                await cliente.query("ROLLBACK");
                return res.status(404).json({ mensaje: "ese link de venta no existe para este evento" });
            }
            if (!talonario.activo) {
                await cliente.query("ROLLBACK");
                return res.status(409).json({ mensaje: "ese link de venta ya no está activo" });
            }
            const usadas = Number((await cliente.query(`SELECT count(*) AS n FROM compra c JOIN entrada e ON e.id_compra = c.id_compra WHERE c.id_talonario = $1 AND e.estado <> 'anulada'`, [talonario.id_talonario])).rows[0].n);
            if (usadas + items.length > talonario.cantidad) {
                await cliente.query("ROLLBACK");
                return res.status(409).json({ mensaje: talonario.cantidad - usadas <= 0 ? "a este link de venta se le acabaron las entradas asignadas" : `a este link de venta le quedan ${talonario.cantidad - usadas} entradas` });
            }
        }
        // El cliente con cuenta recibe el descuento que le corresponda por la antigüedad de su cuenta.
        const descuento = req.usuario?.rol === "cliente" ? await descuentoPara(cliente, evento.id_boliche, req.usuario.id) : null;
        const compra = await crearCompra(cliente, {
            boliche: evento, evento, items, canal: "web", metodo: "transferencia", contacto,
            idCliente: req.usuario?.rol === "cliente" ? req.usuario.id : null,
            idRrpp: talonario?.id_rrpp ?? null, idTalonario: talonario?.id_talonario ?? null,
            descuentoPct: Number(descuento?.porcentaje ?? 0), descuentoNombre: descuento?.nombre ?? null,
        });
        await sincronizarAgotadas(cliente, evento.id_boliche, evento.id_evento);
        await cliente.query("COMMIT");

        res.status(201).json({ ...datosCompra(compra, await entradasDe(pool, compra.id_compra)), evento: evento.evento, boliche: evento.boliche });
    } catch (error) {
        await cliente.query("ROLLBACK");
        if (error.estado) return res.status(error.estado).json({ mensaje: error.mensaje });
        if (responderErrorDeBase(error, res)) return;
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo registrar la compra" });
    } finally {
        cliente.release();
    }
};

const SELECT_COMPRA_PUBLICA = `
    SELECT c.*, e.nombre AS evento, e.fecha_hora, b.nombre AS boliche, b.subdominio
      FROM compra c JOIN evento e ON e.id_boliche = c.id_boliche AND e.id_evento = c.id_evento
      JOIN boliche b ON b.id_boliche = c.id_boliche`;

// GET /publico/compras/:token — quien tiene el link ve su compra; los QR aparecen cuando el pago está confirmado.
export const verCompra = async (req, res) => {
    try {
        await liberarVencidas(pool);
        const compra = (await pool.query(`${SELECT_COMPRA_PUBLICA} WHERE c.token_publico = $1`, [String(req.params.token)])).rows[0];
        if (!compra) return res.status(404).json({ mensaje: "no encontramos esa compra" });

        // Mientras espera el pago, se le muestra a dónde transferir.
        const cuenta = compra.estado === "pendiente"
            ? (await pool.query(`SELECT titular, banco, alias, cbu, instrucciones FROM boliche_cuenta_cobro WHERE id_boliche = $1`, [compra.id_boliche])).rows[0] ?? null
            : null;

        res.json({ ...datosCompra(compra, await entradasDe(pool, compra.id_compra, { conCodigo: true })), evento: compra.evento, fecha_hora: compra.fecha_hora, boliche: compra.boliche, subdominio: compra.subdominio, cuenta_cobro: cuenta });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo obtener la compra" });
    }
};

// GET /cliente/compras — las compras hechas con la cuenta del cliente, con sus QR.
export const misCompras = async (req, res) => {
    try {
        await liberarVencidas(pool);
        const compras = (await pool.query(`${SELECT_COMPRA_PUBLICA} WHERE c.id_cliente = $1 ORDER BY c.creada_en DESC`, [req.usuario.id])).rows;
        const salida = [];
        for (const c of compras) {
            salida.push({ ...datosCompra(c, await entradasDe(pool, c.id_compra, { conCodigo: true })), evento: c.evento, fecha_hora: c.fecha_hora, boliche: c.boliche, subdominio: c.subdominio });
        }

        res.json(salida);
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "no se pudieron obtener tus compras" });
    }
};
