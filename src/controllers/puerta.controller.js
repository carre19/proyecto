import pool from "../data/db.js";
import { enmascarar, puedeVerDni } from "../utils/compras.js";
import { parseId } from "../utils/validaciones.js";

// Control de acceso en la puerta: cada QR sirve una sola vez. Todo queda registrado en acceso_puerta.

const eventoDelBoliche = async (req, res) => {
    const idEvento = parseId(req.params.idEvento);
    if (idEvento === null) {
        res.status(400).json({ mensaje: "el id del evento no es valido" });
        return null;
    }
    const evento = (await pool.query(`SELECT id_evento, nombre FROM evento WHERE id_boliche = $1 AND id_evento = $2`, [req.boliche.id_boliche, idEvento])).rows[0];
    if (!evento) {
        res.status(404).json({ mensaje: "ese evento no existe" });
        return null;
    }

    return evento;
};

const registrar = (req, evento, idEntrada, resultado, detalle = null) => pool.query(
    `INSERT INTO acceso_puerta (id_boliche, id_evento, id_entrada, resultado, id_usuario, detalle) VALUES ($1, $2, $3, $4, $5, $6)`,
    [req.boliche.id_boliche, evento.id_evento, idEntrada, resultado, req.usuario.id, detalle]);

// Lo que ve quien está en la puerta de la persona: nombre, DNI (para compararlo con el físico) y tipo de entrada.
const datosPuerta = (req, e) => ({
    id_entrada: e.id_entrada, nombre: e.nombre, apellido: e.apellido, dni: puedeVerDni(req.usuario.rol) ? e.dni : enmascarar(e.dni),
    tipo: e.tipo, estado: e.estado, usada_en: e.usada_en,
});

const SELECT_ENTRADA = `
    SELECT e.id_entrada, e.id_evento, e.nombre, e.apellido, e.dni, e.estado, e.usada_en, t.nombre AS tipo, ev.nombre AS evento
      FROM entrada e JOIN tipo_entrada t ON t.id_tipo_entrada = e.id_tipo_entrada JOIN evento ev ON ev.id_evento = e.id_evento`;

// POST .../puerta/escanear {codigo} — valida el QR. Entra solo si está pagada y no se usó antes.
export const escanear = async (req, res) => {
    try {
        const evento = await eventoDelBoliche(req, res);
        if (!evento) return;
        const codigo = String(req.body?.codigo ?? "").trim().toLowerCase();
        if (!/^[0-9a-f]{32}$/.test(codigo)) return res.status(400).json({ resultado: "no_encontrada", mensaje: "el código no tiene el formato de una entrada" });

        // Solo se buscan entradas de ESTE boliche: la de otro local se trata como si no existiera.
        const entrada = (await pool.query(`${SELECT_ENTRADA} WHERE e.codigo = $1 AND e.id_boliche = $2`, [codigo, req.boliche.id_boliche])).rows[0];
        if (!entrada) {
            await registrar(req, evento, null, "no_encontrada", "código desconocido");
            return res.status(404).json({ resultado: "no_encontrada", mensaje: "esa entrada no existe" });
        }
        if (entrada.id_evento !== evento.id_evento) {
            await registrar(req, evento, entrada.id_entrada, "rechazada_otro_evento", `es del evento ${entrada.evento}`);
            return res.status(409).json({ resultado: "rechazada_otro_evento", mensaje: `esta entrada es del evento "${entrada.evento}"`, entrada: datosPuerta(req, entrada) });
        }
        if (entrada.estado === "usada") {
            await registrar(req, evento, entrada.id_entrada, "rechazada_usada", `ya usada el ${entrada.usada_en.toISOString()}`);
            return res.status(409).json({ resultado: "rechazada_usada", mensaje: "esta entrada ya fue usada", entrada: datosPuerta(req, entrada) });
        }
        if (entrada.estado === "pendiente") {
            await registrar(req, evento, entrada.id_entrada, "rechazada_no_pagada");
            return res.status(409).json({ resultado: "rechazada_no_pagada", mensaje: "la entrada no está paga", entrada: datosPuerta(req, entrada) });
        }
        if (entrada.estado === "anulada") {
            await registrar(req, evento, entrada.id_entrada, "rechazada_anulada");
            return res.status(409).json({ resultado: "rechazada_anulada", mensaje: "la entrada fue anulada", entrada: datosPuerta(req, entrada) });
        }

        // El UPDATE condicional es atómico: si dos personas escanean el mismo QR a la vez, solo una lo marca.
        const usada = (await pool.query(`UPDATE entrada SET estado = 'usada', usada_en = now() WHERE id_entrada = $1 AND estado = 'valida' RETURNING usada_en`, [entrada.id_entrada])).rows[0];
        if (!usada) {
            await registrar(req, evento, entrada.id_entrada, "rechazada_usada", "escaneada al mismo tiempo");
            return res.status(409).json({ resultado: "rechazada_usada", mensaje: "esta entrada ya fue usada", entrada: datosPuerta(req, entrada) });
        }
        await registrar(req, evento, entrada.id_entrada, "ingreso");

        res.json({ resultado: "ingreso", mensaje: "puede pasar", entrada: datosPuerta(req, { ...entrada, estado: "usada", usada_en: usada.usada_en }) });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo validar la entrada" });
    }
};

// POST .../puerta/buscar {dni} — último recurso: busca las entradas de un DNI en este evento.
export const buscarPorDni = async (req, res) => {
    try {
        const evento = await eventoDelBoliche(req, res);
        if (!evento) return;
        const dni = String(req.body?.dni ?? "").replace(/[.\s]/g, "");
        if (!/^\d{7,9}$/.test(dni)) return res.status(400).json({ mensaje: "el DNI debe tener entre 7 y 9 números" });

        const entradas = (await pool.query(`${SELECT_ENTRADA} WHERE e.id_boliche = $1 AND e.id_evento = $2 AND e.dni = $3 AND e.estado <> 'anulada' ORDER BY e.id_entrada`,
            [req.boliche.id_boliche, evento.id_evento, dni])).rows;

        res.json(entradas.map((e) => datosPuerta(req, e)));
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo buscar" });
    }
};

// POST .../puerta/reingreso {id_entrada} — alguien que salió y vuelve: presenta la entrada con su DNI escrito y el DNI físico.
export const reingreso = async (req, res) => {
    try {
        const evento = await eventoDelBoliche(req, res);
        if (!evento) return;
        const idEntrada = parseId(req.body?.id_entrada);
        if (idEntrada === null) return res.status(400).json({ mensaje: "el id de la entrada no es valido" });

        const entrada = (await pool.query(`${SELECT_ENTRADA} WHERE e.id_boliche = $1 AND e.id_evento = $2 AND e.id_entrada = $3`, [req.boliche.id_boliche, evento.id_evento, idEntrada])).rows[0];
        if (!entrada) return res.status(404).json({ mensaje: "esa entrada no existe en este evento" });
        if (entrada.estado !== "usada") return res.status(409).json({ mensaje: "esa entrada todavía no ingresó: se valida con el QR" });

        await registrar(req, evento, entrada.id_entrada, "reingreso", "DNI escrito en la entrada verificado con el DNI físico");
        res.json({ resultado: "reingreso", mensaje: "reingreso registrado", entrada: datosPuerta(req, entrada) });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo registrar el reingreso" });
    }
};

// GET .../puerta/resumen — cuánta gente entró y cuánta falta.
export const resumenPuerta = async (req, res) => {
    try {
        const evento = await eventoDelBoliche(req, res);
        if (!evento) return;
        const fila = (await pool.query(`
            SELECT count(*) FILTER (WHERE estado IN ('valida', 'usada')) AS pagadas,
                   count(*) FILTER (WHERE estado = 'usada') AS ingresaron,
                   count(*) FILTER (WHERE estado = 'valida') AS faltan,
                   count(*) FILTER (WHERE estado = 'pendiente') AS pendientes_de_pago
              FROM entrada WHERE id_boliche = $1 AND id_evento = $2`, [req.boliche.id_boliche, evento.id_evento])).rows[0];

        res.json({ evento: evento.nombre, capacidad: req.boliche.capacidad, ...Object.fromEntries(Object.entries(fila).map(([k, v]) => [k, Number(v)])) });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo obtener el resumen" });
    }
};

// GET .../puerta/accesos — los últimos movimientos de la puerta.
export const ultimosAccesos = async (req, res) => {
    try {
        const evento = await eventoDelBoliche(req, res);
        if (!evento) return;
        const accesos = (await pool.query(`
            SELECT a.id_acceso, a.resultado, a.momento, a.detalle, e.nombre, e.apellido, u.nombre_completo AS registrado_por
              FROM acceso_puerta a LEFT JOIN entrada e ON e.id_entrada = a.id_entrada LEFT JOIN usuario u ON u.id_usuario = a.id_usuario
             WHERE a.id_boliche = $1 AND a.id_evento = $2 ORDER BY a.momento DESC, a.id_acceso DESC LIMIT 50`, [req.boliche.id_boliche, evento.id_evento])).rows;

        res.json(accesos);
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "no se pudieron obtener los accesos" });
    }
};
