import pool from "../data/db.js";
import { parseId, textoOpcional } from "../utils/validaciones.js";
import { limpiarDatosVencidos } from "../utils/retencion.js";

// Lo que maneja el superadmin de la plataforma: cobros a los boliches (mensualidades y eventos únicos), lo que se gana por entradas
// y el borrado de datos vencidos.

// POST /plataforma/cobros/generar {periodo: "AAAA-MM"} — arma los cobros de ese mes (se puede repetir: no duplica nada).
//   - Boliche con cobro mensual: una mensualidad por mes (monto_mensual).
//   - Boliche de un solo evento: un cobro por cada evento del mes (monto_mensual guarda el monto del evento) y sin mensualidad.
// Los boliches desactivados o sin monto cargado se saltean.
export const generarCobros = async (req, res) => {
    try {
        const periodo = String(req.body?.periodo ?? "");
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) return res.status(400).json({ mensaje: "el período tiene que tener el formato AAAA-MM" });
        const primero = `${periodo}-01`;

        const mensualidades = await pool.query(`
            INSERT INTO cobro_plataforma (id_boliche, tipo, periodo, monto)
            SELECT id_boliche, 'mensualidad', $1::date, round(monto_mensual)::int FROM boliche WHERE activo AND tipo_cobro = 'mensual' AND monto_mensual > 0
            ON CONFLICT DO NOTHING RETURNING id_cobro`, [primero]);
        const eventos = await pool.query(`
            INSERT INTO cobro_plataforma (id_boliche, tipo, id_evento, periodo, monto)
            SELECT b.id_boliche, 'evento_unico', e.id_evento, NULL, round(b.monto_mensual)::int
              FROM boliche b JOIN evento e ON e.id_boliche = b.id_boliche
             WHERE b.activo AND b.tipo_cobro = 'evento_unico' AND b.monto_mensual > 0 AND e.estado <> 'cancelado'
               AND e.fecha_hora >= $1::date AND e.fecha_hora < ($1::date + interval '1 month')
            ON CONFLICT DO NOTHING RETURNING id_cobro`, [primero]);
        const sinMonto = await pool.query(`SELECT nombre FROM boliche WHERE activo AND (monto_mensual IS NULL OR monto_mensual <= 0) ORDER BY nombre`);

        res.json({ periodo, mensualidades_creadas: mensualidades.rowCount, eventos_creados: eventos.rowCount, boliches_sin_monto: sinMonto.rows.map((b) => b.nombre) });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "no se pudieron generar los cobros" });
    }
};

// GET /plataforma/cobros[?estado=pendiente|pagado][&id_boliche=]
export const listarCobros = async (req, res) => {
    try {
        const estado = ["pendiente", "pagado"].includes(req.query.estado) ? req.query.estado : null;
        const idBoliche = req.query.id_boliche === undefined ? null : parseId(req.query.id_boliche);
        if (req.query.id_boliche !== undefined && idBoliche === null) return res.status(400).json({ mensaje: "el boliche no es valido" });
        const cobros = (await pool.query(`
            SELECT c.id_cobro, c.id_boliche, b.nombre AS boliche, c.tipo, to_char(c.periodo, 'YYYY-MM') AS periodo, c.id_evento, ev.nombre AS evento, c.monto, c.estado, c.nota, c.generado_en, c.pagado_en
              FROM cobro_plataforma c JOIN boliche b ON b.id_boliche = c.id_boliche LEFT JOIN evento ev ON ev.id_boliche = c.id_boliche AND ev.id_evento = c.id_evento
             WHERE ($1::text IS NULL OR c.estado = $1) AND ($2::int IS NULL OR c.id_boliche = $2) ORDER BY c.estado DESC, c.generado_en DESC, c.id_cobro DESC LIMIT 500`, [estado, idBoliche])).rows;

        res.json(cobros);
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "no se pudieron obtener los cobros" });
    }
};

// PUT /plataforma/cobros/:idCobro/pagar {nota?} — el boliche pagó.
export const pagarCobro = async (req, res) => {
    try {
        const id = parseId(req.params.idCobro);
        if (id === null) return res.status(400).json({ mensaje: "el id del cobro no es valido" });
        const nota = textoOpcional(req.body?.nota, "la nota", 300);
        if (nota.error) return res.status(400).json({ mensaje: nota.error });
        const pagado = (await pool.query(`UPDATE cobro_plataforma SET estado = 'pagado', pagado_en = now(), nota = COALESCE($2, nota) WHERE id_cobro = $1 AND estado = 'pendiente' RETURNING id_cobro`, [id, nota.valor])).rows[0];
        if (!pagado) {
            const existe = (await pool.query(`SELECT 1 FROM cobro_plataforma WHERE id_cobro = $1`, [id])).rows[0];
            return existe ? res.status(409).json({ mensaje: "ese cobro ya estaba pagado" }) : res.status(404).json({ mensaje: "ese cobro no existe" });
        }

        res.json({ mensaje: "cobro marcado como pagado" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo marcar el cobro" });
    }
};

// GET /plataforma/resumen — la pantalla principal del superadmin: boliches, mensualidades y cobros pendientes, y lo que gana la
// plataforma por entradas (el 6 % de cada compra pagada desde la página).
export const resumenPlataforma = async (req, res) => {
    try {
        const f = (await pool.query(`
            SELECT (SELECT count(*) FROM boliche) AS boliches, (SELECT count(*) FROM boliche WHERE activo) AS boliches_activos,
                   (SELECT count(*) FROM usuario WHERE rol = 'admin') AS admins, (SELECT count(*) FROM usuario WHERE rol = 'cliente') AS clientes,
                   (SELECT count(*) FROM cobro_plataforma WHERE estado = 'pendiente') AS cobros_pendientes,
                   (SELECT COALESCE(sum(monto), 0) FROM cobro_plataforma WHERE estado = 'pendiente') AS monto_pendiente,
                   (SELECT COALESCE(sum(monto), 0) FROM cobro_plataforma WHERE estado = 'pagado') AS monto_cobrado,
                   (SELECT COALESCE(sum(cargo_plataforma), 0) FROM compra WHERE estado = 'pagada' AND canal = 'web') AS entradas_total,
                   (SELECT COALESCE(sum(cargo_plataforma), 0) FROM compra WHERE estado = 'pagada' AND canal = 'web' AND date_trunc('month', pagada_en) = date_trunc('month', now())) AS entradas_mes,
                   (SELECT count(*) FROM compra WHERE estado = 'pagada' AND canal = 'web') AS compras_pagadas`)).rows[0];
        const n = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, Number(v)]));
        const porBoliche = (await pool.query(`
            SELECT b.id_boliche, b.nombre, COALESCE(sum(c.cargo_plataforma), 0)::int AS cargo, count(c.id_compra)::int AS compras,
                   COALESCE((SELECT sum(monto) FROM cobro_plataforma p WHERE p.id_boliche = b.id_boliche AND p.estado = 'pendiente'), 0)::int AS pendiente
              FROM boliche b LEFT JOIN compra c ON c.id_boliche = b.id_boliche AND c.estado = 'pagada' AND c.canal = 'web' GROUP BY b.id_boliche ORDER BY cargo DESC, b.nombre`)).rows;

        res.json({
            boliches: { total: n.boliches, activos: n.boliches_activos }, admins: n.admins, clientes: n.clientes,
            cobros: { pendientes: n.cobros_pendientes, monto_pendiente: n.monto_pendiente, monto_cobrado: n.monto_cobrado },
            entradas: { porcentaje: Number(process.env.PORCENTAJE_PLATAFORMA ?? 6), ganado_total: n.entradas_total, ganado_mes: n.entradas_mes, compras_pagadas: n.compras_pagadas },
            por_boliche: porBoliche,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo obtener el resumen" });
    }
};

// POST /plataforma/retencion/ejecutar — corre ahora el borrado de datos vencidos (también corre solo una vez por día).
export const ejecutarRetencion = async (req, res) => {
    try {
        res.json(await limpiarDatosVencidos(pool));
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo ejecutar el borrado de datos" });
    }
};
