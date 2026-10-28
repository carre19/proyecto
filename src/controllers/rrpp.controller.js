import pool from "../data/db.js";
import { enmascarar, liberarVencidas, puedeVerDni } from "../utils/compras.js";
import { equipoVisible } from "../utils/evento.js";
import { parseId } from "../utils/validaciones.js";

// Resultados de ventas de los RRPP. Quién ve qué: cada RRPP lo suyo (cuánto vendió, su comisión y el nombre de quien pagó);
// el manager lo mismo de todo su equipo; el admin de todos; y el ranking lo ven todos (solo nombres y cantidad vendida).

// El filtro opcional ?evento=<id>; si viene mal responde 400 y devuelve undefined.
const eventoFiltro = (req, res) => {
    if (req.query.evento === undefined) return null;
    const id = parseId(req.query.evento);
    if (id === null) res.status(400).json({ mensaje: "el evento no es valido" });

    return id ?? undefined;
};

const VENDIDAS = `e.estado IN ('valida', 'usada')`;

// GET /boliches/:id/rrpp/resultados[?evento=] — por RRPP: entradas asignadas, vendidas, pendientes de pago, monto y comisión ganada.
export const resultados = async (req, res) => {
    try {
        const evento = eventoFiltro(req, res);
        if (evento === undefined) return;
        await liberarVencidas(pool);
        const alcance = equipoVisible(req.usuario, 3);
        const filas = (await pool.query(`
            SELECT q.id_usuario AS id_rrpp, u.nombre_completo AS nombre, q.comision_pct,
                   COALESCE(t.asignadas, 0)::int AS asignadas, COALESCE(v.vendidas, 0)::int AS vendidas, COALESCE(v.pendientes, 0)::int AS pendientes,
                   COALESCE(v.monto, 0)::int AS monto, COALESCE(v.comision, 0)::int AS comision
              FROM boliche_equipo q JOIN usuario u ON u.id_usuario = q.id_usuario
              LEFT JOIN (SELECT id_rrpp, sum(cantidad) AS asignadas FROM talonario WHERE id_boliche = $1 AND activo AND ($2::int IS NULL OR id_evento = $2) GROUP BY id_rrpp) t ON t.id_rrpp = q.id_usuario
              LEFT JOIN (SELECT e.id_rrpp, count(*) FILTER (WHERE ${VENDIDAS}) AS vendidas, count(*) FILTER (WHERE e.estado = 'pendiente') AS pendientes,
                                sum(e.precio) FILTER (WHERE ${VENDIDAS}) AS monto, sum(e.comision) FILTER (WHERE ${VENDIDAS}) AS comision
                           FROM entrada e WHERE e.id_boliche = $1 AND e.id_rrpp IS NOT NULL AND ($2::int IS NULL OR e.id_evento = $2) GROUP BY e.id_rrpp) v ON v.id_rrpp = q.id_usuario
             WHERE q.id_boliche = $1 AND q.rol = 'rrpp' ${alcance.sql} ORDER BY vendidas DESC, u.nombre_completo`, [req.boliche.id_boliche, evento, ...alcance.params])).rows;

        const suma = (campo) => filas.reduce((total, f) => total + f[campo], 0);
        res.json({ rrpp: filas, total: { asignadas: suma("asignadas"), vendidas: suma("vendidas"), pendientes: suma("pendientes"), monto: suma("monto"), comision: suma("comision") } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "no se pudieron obtener los resultados" });
    }
};

// GET /boliches/:id/rrpp/ranking[?evento=] — todos los RRPP del boliche ordenados por entradas vendidas. Sin montos ni comisiones.
export const ranking = async (req, res) => {
    try {
        const evento = eventoFiltro(req, res);
        if (evento === undefined) return;
        const filas = (await pool.query(`
            SELECT u.nombre_completo AS nombre, count(e.id_entrada) FILTER (WHERE ${VENDIDAS})::int AS vendidas, q.id_usuario = $3 AS soy_yo
              FROM boliche_equipo q JOIN usuario u ON u.id_usuario = q.id_usuario
              LEFT JOIN entrada e ON e.id_boliche = q.id_boliche AND e.id_rrpp = q.id_usuario AND ($2::int IS NULL OR e.id_evento = $2)
             WHERE q.id_boliche = $1 AND q.rol = 'rrpp' GROUP BY u.nombre_completo, q.id_usuario ORDER BY vendidas DESC, u.nombre_completo`, [req.boliche.id_boliche, evento, req.usuario.id])).rows;

        // Mismo puesto para los que empatan en entradas vendidas.
        res.json(filas.map((f, i) => ({ ...f, puesto: filas.findIndex((x) => x.vendidas === f.vendidas) + 1, orden: i + 1 })));
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo obtener el ranking" });
    }
};

// GET /boliches/:id/rrpp/mis-ventas[?evento=][&id_rrpp=] — las entradas pagadas de un RRPP con el nombre de quien pagó y la comisión.
// El RRPP ve las suyas; el manager y el admin pueden pedir las de un RRPP (el manager, solo de su equipo).
export const misVentas = async (req, res) => {
    try {
        const evento = eventoFiltro(req, res);
        if (evento === undefined) return;
        let idRrpp = req.usuario.id;
        if (req.usuario.rol !== "rrpp") {
            idRrpp = parseId(req.query.id_rrpp);
            if (idRrpp === null) return res.status(400).json({ mensaje: "indicá de qué RRPP querés ver las ventas (id_rrpp)" });
            const alcance = equipoVisible(req.usuario, 3);
            const existe = (await pool.query(`SELECT 1 FROM boliche_equipo q WHERE q.id_boliche = $1 AND q.id_usuario = $2 AND q.rol = 'rrpp' ${alcance.sql}`, [req.boliche.id_boliche, idRrpp, ...alcance.params])).rows[0];
            if (!existe) return res.status(404).json({ mensaje: "ese RRPP no existe o no es de tu equipo" });
        }

        const ventas = (await pool.query(`
            SELECT e.id_entrada, ev.nombre AS evento, ev.fecha_hora, t.nombre AS tipo, e.nombre, e.apellido, e.dni, e.precio, e.comision_pct, e.comision, c.pagada_en, c.canal
              FROM entrada e JOIN compra c ON c.id_compra = e.id_compra JOIN tipo_entrada t ON t.id_tipo_entrada = e.id_tipo_entrada
              JOIN evento ev ON ev.id_boliche = e.id_boliche AND ev.id_evento = e.id_evento
             WHERE e.id_boliche = $1 AND e.id_rrpp = $2 AND ${VENDIDAS} AND ($3::int IS NULL OR e.id_evento = $3) ORDER BY c.pagada_en DESC, e.id_entrada DESC`, [req.boliche.id_boliche, idRrpp, evento])).rows;

        const ver = puedeVerDni(req.usuario.rol);
        res.json({
            total: { entradas: ventas.length, vendido: ventas.reduce((t, v) => t + v.precio, 0), comision: ventas.reduce((t, v) => t + (v.comision ?? 0), 0) },
            ventas: ventas.map((v) => ({ ...v, dni: ver ? v.dni : enmascarar(v.dni) })),
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "no se pudieron obtener las ventas" });
    }
};
