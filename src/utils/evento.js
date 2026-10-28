import pool from "../data/db.js";
import { parseId } from "./validaciones.js";

// Busca el evento de la ruta (:idEvento) DENTRO del boliche al que ya se accedió; si no existe responde 404 y devuelve null.
export const eventoDelBoliche = async (req, res) => {
    const idEvento = parseId(req.params.idEvento);
    if (idEvento === null) {
        res.status(400).json({ mensaje: "el id del evento no es valido" });
        return null;
    }
    const evento = (await pool.query(`SELECT id_evento, id_boliche, nombre, estado, edad_minima, fecha_hora FROM evento WHERE id_boliche = $1 AND id_evento = $2`, [req.boliche.id_boliche, idEvento])).rows[0];
    if (!evento) {
        res.status(404).json({ mensaje: "ese evento no existe" });
        return null;
    }

    return evento;
};

// Qué RRPP ve cada rol (como condición sobre boliche_equipo "q"): el RRPP solo a sí mismo, el manager a su equipo, el admin a todos.
export const equipoVisible = (usuario, idxParam) => {
    if (usuario.rol === "rrpp") return { sql: `AND q.id_usuario = $${idxParam}`, params: [usuario.id] };
    if (usuario.rol === "rrpp_manager") return { sql: `AND q.id_manager = $${idxParam}`, params: [usuario.id] };

    return { sql: "", params: [] };
};
