import crypto from "node:crypto";
import pool from "../data/db.js";
import { liberarVencidas } from "../utils/compras.js";
import { eventoDelBoliche, equipoVisible } from "../utils/evento.js";
import { parseId } from "../utils/validaciones.js";
import { responderErrorDeBase } from "../utils/usuarios.js";

// Talonarios: las entradas que se le asignan a cada RRPP para un evento, con su link propio de venta.
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const nuevoCodigo = () => [...crypto.randomBytes(8)].map((b) => ALFABETO[b % ALFABETO.length]).join("");
const FRONTEND = () => (process.env.FRONTEND_PUBLIC_URL || process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");

// Cuántas entradas del talonario ya se vendieron (pagadas) y cuántas están esperando el pago (reservan lugar).
const USO = `
    SELECT c.id_talonario, count(*) FILTER (WHERE e.estado IN ('valida', 'usada')) AS vendidas, count(*) FILTER (WHERE e.estado = 'pendiente') AS pendientes
      FROM compra c JOIN entrada e ON e.id_compra = c.id_compra WHERE c.id_talonario IS NOT NULL GROUP BY c.id_talonario`;

const forma = (t) => ({
    id_talonario: t.id_talonario, id_evento: t.id_evento, id_rrpp: t.id_rrpp, rrpp: t.rrpp, codigo: t.codigo, link: `${FRONTEND()}/t/${t.codigo}`,
    cantidad: t.cantidad, activo: t.activo, vendidas: Number(t.vendidas ?? 0), pendientes: Number(t.pendientes ?? 0),
    quedan: Math.max(0, t.cantidad - Number(t.vendidas ?? 0) - Number(t.pendientes ?? 0)),
});

const SELECT = `
    SELECT t.*, u.nombre_completo AS rrpp, uso.vendidas, uso.pendientes
      FROM talonario t JOIN usuario u ON u.id_usuario = t.id_rrpp JOIN boliche_equipo q ON q.id_boliche = t.id_boliche AND q.id_usuario = t.id_rrpp
      LEFT JOIN (${USO}) uso ON uso.id_talonario = t.id_talonario`;

// GET .../eventos/:idEvento/talonarios — el RRPP ve el suyo, el manager los de su equipo, el admin todos.
export const listarTalonarios = async (req, res) => {
    try {
        const evento = await eventoDelBoliche(req, res);
        if (!evento) return;
        await liberarVencidas(pool);
        const alcance = equipoVisible(req.usuario, 3);
        const filas = (await pool.query(`${SELECT} WHERE t.id_boliche = $1 AND t.id_evento = $2 ${alcance.sql} ORDER BY u.nombre_completo`, [req.boliche.id_boliche, evento.id_evento, ...alcance.params])).rows;

        res.json(filas.map(forma));
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "no se pudieron obtener los talonarios" });
    }
};

// Las entradas asignadas a RRPP no pueden superar el total de entradas del evento.
const verificarTotal = async (db, idBoliche, idEvento, nuevaCantidad, excluirTalonario = null) => {
    const total = Number((await db.query(`SELECT COALESCE(sum(cupo), 0) AS total FROM tipo_entrada WHERE id_boliche = $1 AND id_evento = $2`, [idBoliche, idEvento])).rows[0].total);
    if (total === 0) return "primero cargá las entradas del evento (pestaña Entradas): los talonarios se arman con esas entradas";
    const asignadas = Number((await db.query(`SELECT COALESCE(sum(cantidad), 0) AS n FROM talonario WHERE id_boliche = $1 AND id_evento = $2 AND activo AND ($3::int IS NULL OR id_talonario <> $3)`, [idBoliche, idEvento, excluirTalonario])).rows[0].n);
    if (asignadas + nuevaCantidad > total) return `entre todos los talonarios no se pueden asignar más de ${total} entradas (el total del evento); ya hay ${asignadas} asignadas`;

    return null;
};

const cantidadValida = (valor) => Number.isInteger(valor) && valor >= 1 && valor <= 100000;

// POST .../talonarios {id_rrpp, cantidad} — lo arma el admin (para cualquier RRPP) o el manager (para los RRPP de su equipo).
export const crearTalonario = async (req, res) => {
    const cliente = await pool.connect();
    try {
        const evento = await eventoDelBoliche(req, res);
        if (!evento) return;
        const idRrpp = parseId(req.body?.id_rrpp);
        const cantidad = req.body?.cantidad;
        if (idRrpp === null) return res.status(400).json({ mensaje: "elegí a qué RRPP se le asignan las entradas" });
        if (!cantidadValida(cantidad)) return res.status(400).json({ mensaje: "la cantidad tiene que ser un número entero de 1 en adelante" });

        const alcance = equipoVisible(req.usuario, 3);
        const rrpp = (await pool.query(`SELECT q.id_usuario FROM boliche_equipo q WHERE q.id_boliche = $1 AND q.id_usuario = $2 AND q.rol = 'rrpp' ${alcance.sql.replace("$3", "$3")}`, [req.boliche.id_boliche, idRrpp, ...alcance.params])).rows[0];
        if (!rrpp) return res.status(404).json({ mensaje: "ese RRPP no existe o no es de tu equipo" });

        await cliente.query("BEGIN");
        await cliente.query(`SELECT 1 FROM evento WHERE id_boliche = $1 AND id_evento = $2 FOR UPDATE`, [req.boliche.id_boliche, evento.id_evento]); // serializa las asignaciones del evento
        const problema = await verificarTotal(cliente, req.boliche.id_boliche, evento.id_evento, cantidad);
        if (problema) {
            await cliente.query("ROLLBACK");
            return res.status(409).json({ mensaje: problema });
        }
        const creado = (await cliente.query(`
            INSERT INTO talonario (id_boliche, id_evento, id_rrpp, codigo, cantidad, creado_por) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_talonario`,
            [req.boliche.id_boliche, evento.id_evento, idRrpp, nuevoCodigo(), cantidad, req.usuario.id])).rows[0];
        await cliente.query("COMMIT");

        res.status(201).json(forma((await pool.query(`${SELECT} WHERE t.id_talonario = $1`, [creado.id_talonario])).rows[0]));
    } catch (error) {
        await cliente.query("ROLLBACK");
        if (responderErrorDeBase(error, res)) return;
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo crear el talonario" });
    } finally {
        cliente.release();
    }
};

const talonarioDeLaRuta = async (req, res, db) => {
    const idTalonario = parseId(req.params.idTalonario);
    if (idTalonario === null) {
        res.status(400).json({ mensaje: "el id del talonario no es valido" });
        return null;
    }
    const alcance = equipoVisible(req.usuario, 4);
    const talonario = (await db.query(`
        SELECT t.* FROM talonario t JOIN boliche_equipo q ON q.id_boliche = t.id_boliche AND q.id_usuario = t.id_rrpp
         WHERE t.id_boliche = $1 AND t.id_evento = $2 AND t.id_talonario = $3 ${alcance.sql} FOR UPDATE OF t`, [req.boliche.id_boliche, Number(req.params.idEvento), idTalonario, ...alcance.params])).rows[0];
    if (!talonario) {
        res.status(404).json({ mensaje: "ese talonario no existe" });
        return null;
    }

    return talonario;
};

// PUT .../talonarios/:idTalonario {cantidad?, activo?} — no se puede bajar la cantidad por debajo de lo ya vendido o reservado.
export const editarTalonario = async (req, res) => {
    const cliente = await pool.connect();
    try {
        const { cantidad, activo } = req.body ?? {};
        if (cantidad === undefined && activo === undefined) return res.status(400).json({ mensaje: "no hay nada para modificar" });
        if (cantidad !== undefined && !cantidadValida(cantidad)) return res.status(400).json({ mensaje: "la cantidad tiene que ser un número entero de 1 en adelante" });
        if (activo !== undefined && typeof activo !== "boolean") return res.status(400).json({ mensaje: "activo debe ser verdadero o falso" });

        await liberarVencidas(pool);
        await cliente.query("BEGIN");
        const talonario = await talonarioDeLaRuta(req, res, cliente);
        if (!talonario) return void (await cliente.query("ROLLBACK"));
        if (cantidad !== undefined) {
            const uso = (await cliente.query(`SELECT count(*) AS n FROM compra c JOIN entrada e ON e.id_compra = c.id_compra WHERE c.id_talonario = $1 AND e.estado <> 'anulada'`, [talonario.id_talonario])).rows[0].n;
            if (cantidad < Number(uso)) {
                await cliente.query("ROLLBACK");
                return res.status(409).json({ mensaje: `ya se vendieron o reservaron ${uso} entradas de este talonario: no se puede bajar de ahí` });
            }
            const problema = await verificarTotal(cliente, req.boliche.id_boliche, talonario.id_evento, cantidad, talonario.id_talonario);
            if (problema) {
                await cliente.query("ROLLBACK");
                return res.status(409).json({ mensaje: problema });
            }
        }
        await cliente.query(`UPDATE talonario SET cantidad = COALESCE($2, cantidad), activo = COALESCE($3, activo) WHERE id_talonario = $1`, [talonario.id_talonario, cantidad ?? null, activo ?? null]);
        await cliente.query("COMMIT");

        res.json(forma((await pool.query(`${SELECT} WHERE t.id_talonario = $1`, [talonario.id_talonario])).rows[0]));
    } catch (error) {
        await cliente.query("ROLLBACK");
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo modificar el talonario" });
    } finally {
        cliente.release();
    }
};

// DELETE .../talonarios/:idTalonario — solo si todavía no tuvo ventas; si no, se desactiva.
export const eliminarTalonario = async (req, res) => {
    const cliente = await pool.connect();
    try {
        await cliente.query("BEGIN");
        const talonario = await talonarioDeLaRuta(req, res, cliente);
        if (!talonario) return void (await cliente.query("ROLLBACK"));
        const compras = (await cliente.query(`SELECT count(*) AS n FROM compra WHERE id_talonario = $1`, [talonario.id_talonario])).rows[0].n;
        if (Number(compras) > 0) {
            await cliente.query("ROLLBACK");
            return res.status(409).json({ mensaje: "este talonario ya tuvo ventas: desactivalo en vez de borrarlo" });
        }
        await cliente.query(`DELETE FROM talonario WHERE id_talonario = $1`, [talonario.id_talonario]);
        await cliente.query("COMMIT");

        res.json({ mensaje: "talonario eliminado" });
    } catch (error) {
        await cliente.query("ROLLBACK");
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo eliminar el talonario" });
    } finally {
        cliente.release();
    }
};

// GET /publico/talonarios/:codigo — a dónde lleva el link de un RRPP y cuánto le queda (para mostrar "comprás con el link de…").
export const verTalonarioPublico = async (req, res) => {
    try {
        await liberarVencidas(pool);
        const t = (await pool.query(`
            SELECT t.*, u.nombre_completo AS rrpp, b.subdominio, b.nombre AS boliche, e.nombre AS evento, uso.vendidas, uso.pendientes
              FROM talonario t JOIN boliche b ON b.id_boliche = t.id_boliche AND b.activo JOIN evento e ON e.id_boliche = t.id_boliche AND e.id_evento = t.id_evento
              JOIN usuario u ON u.id_usuario = t.id_rrpp LEFT JOIN (${USO}) uso ON uso.id_talonario = t.id_talonario
             WHERE t.codigo = $1`, [String(req.params.codigo).toUpperCase()])).rows[0];
        if (!t) return res.status(404).json({ mensaje: "ese link no existe" });
        const f = forma(t);

        res.json({ codigo: t.codigo, rrpp: t.rrpp, activo: t.activo, quedan: f.quedan, id_evento: t.id_evento, evento: t.evento, boliche: t.boliche, subdominio: t.subdominio });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo obtener el link" });
    }
};
