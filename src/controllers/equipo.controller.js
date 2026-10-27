import pool from "../data/db.js";
import { numeroOpcional, parseId, validarPersona } from "../utils/validaciones.js";
import { insertarUsuario, responderErrorDeBase } from "../utils/usuarios.js";
import { ADMIN, MANAGER, RRPP, SUPERADMIN } from "../middleware/auth.js";

// Miembro del equipo con sus datos de contacto y su manager.
// El DNI de las personas lo ven el admin, el manager y los RRPP (los que acceden a esta ruta).
const SELECT_EQUIPO = `
  SELECT q.id_usuario, q.rol, q.id_manager, q.comision_pct, q.fecha_alta,
         u.nombre, u.apellido, u.nombre_completo, u.email, u.dni, u.telefono, u.activo,
         m.nombre_completo AS manager
  FROM boliche_equipo q
  JOIN usuario u ON u.id_usuario = q.id_usuario
  LEFT JOIN usuario m ON m.id_usuario = q.id_manager`;

const buscarMiembro = async (db, idBoliche, idUsuario) => {
  const miembro = await db.query(`${SELECT_EQUIPO} WHERE q.id_boliche = $1 AND q.id_usuario = $2`, [idBoliche, idUsuario]);
  return miembro.rows[0];
};

const esManager = (req) => req.usuario.rol === MANAGER;

// Superadmin y admin: todo el equipo. Manager: sus RRPP y los que todavía no tienen manager (para poder asignárselos).
export const listarEquipo = async (req, res) => {
  try {
    const equipo = esManager(req)
      ? await pool.query(`${SELECT_EQUIPO} WHERE q.id_boliche = $1 AND q.rol = 'rrpp' AND (q.id_manager = $2 OR q.id_manager IS NULL) ORDER BY u.nombre`, [req.boliche.id_boliche, req.usuario.id])
      : await pool.query(`${SELECT_EQUIPO} WHERE q.id_boliche = $1 ORDER BY q.rol DESC, u.nombre`, [req.boliche.id_boliche]);
    res.json(equipo.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "No se pudo obtener el equipo" });
  }
};

// Admin: da de alta managers y RRPP, y fija la comisión. Manager: da de alta RRPP, que quedan a su cargo (comisión 0 hasta que el admin la defina).
export const crearMiembro = async (req, res) => {
  const cliente = await pool.connect();
  try {
    const rol = req.body?.rol;
    if (![MANAGER, RRPP].includes(rol)) return res.status(400).json({ mensaje: "el rol debe ser rrpp_manager o rrpp" });
    if (esManager(req) && rol !== RRPP) return res.status(403).json({ mensaje: "el manager solo da de alta RRPP" });

    const { error, datos } = validarPersona(req.body);
    if (error) return res.status(400).json({ mensaje: error });

    // La comisión la fija el admin; el id del manager solo se puede indicar para un RRPP.
    let comision = { valor: 0 };
    let idManager = null;
    if (esManager(req)) {
      idManager = req.usuario.id;
    } else {
      comision = numeroOpcional(req.body?.comision_pct, "la comision", { min: 0, max: 100 });
      if (comision.error) return res.status(400).json({ mensaje: comision.error });
      if (req.body?.id_manager !== undefined && req.body.id_manager !== null) {
        idManager = parseId(req.body.id_manager);
        if (idManager === null) return res.status(400).json({ mensaje: "el id del manager no es valido" });
      }
    }

    await cliente.query("BEGIN");
    const usuario = await insertarUsuario(cliente, datos, rol);
    await cliente.query(
      `INSERT INTO boliche_equipo (id_boliche, id_usuario, rol, id_manager, comision_pct) VALUES ($1, $2, $3, $4, $5)`,
      [req.boliche.id_boliche, usuario.id_usuario, rol, idManager, comision.valor ?? 0]);
    await cliente.query("COMMIT");

    res.status(201).json(await buscarMiembro(pool, req.boliche.id_boliche, usuario.id_usuario));
  } catch (error) {
    await cliente.query("ROLLBACK");
    if (responderErrorDeBase(error, res)) return;
    console.error(error);
    res.status(500).json({ mensaje: "No se pudo dar de alta a la persona" });
  } finally {
    cliente.release();
  }
};

// Admin: comisión, manager y estado de la cuenta. Manager: solo asignar y desasignar RRPP (a sí mismo o a nadie).
export const editarMiembro = async (req, res) => {
  try {
    const idUsuario = parseId(req.params.idUsuario);
    if (idUsuario === null) return res.status(400).json({ mensaje: "el id del usuario no es valido" });
    const actual = await buscarMiembro(pool, req.boliche.id_boliche, idUsuario);
    if (!actual) return res.status(404).json({ mensaje: "esa persona no está en el equipo de este boliche" });

    const cuerpo = req.body ?? {};
    if (esManager(req)) {
      const extra = Object.keys(cuerpo).filter((campo) => campo !== "id_manager");
      if (extra.length > 0) return res.status(403).json({ mensaje: `el manager solo asigna y desasigna RRPP, no puede modificar: ${extra.join(", ")}` });
      if (actual.rol !== RRPP) return res.status(403).json({ mensaje: "el manager solo maneja a los RRPP" });
      if (cuerpo.id_manager !== null && cuerpo.id_manager !== req.usuario.id) {
        return res.status(403).json({ mensaje: "solo podés asignar un RRPP a vos mismo, o desasignarlo (id_manager: null)" });
      }
      if (actual.id_manager !== null && actual.id_manager !== req.usuario.id) {
        return res.status(403).json({ mensaje: "ese RRPP está a cargo de otro manager" });
      }
    }

    const cambios = [];
    const valores = [];
    if (cuerpo.comision_pct !== undefined) {
      const comision = numeroOpcional(cuerpo.comision_pct, "la comision", { min: 0, max: 100 });
      if (comision.error || comision.valor === null) return res.status(400).json({ mensaje: comision.error ?? "la comision no es valida" });
      valores.push(comision.valor); cambios.push(`comision_pct = $${valores.length}`);
    }
    if (cuerpo.id_manager !== undefined) {
      const idManager = cuerpo.id_manager === null ? null : parseId(cuerpo.id_manager);
      if (cuerpo.id_manager !== null && idManager === null) return res.status(400).json({ mensaje: "el id del manager no es valido" });
      valores.push(idManager); cambios.push(`id_manager = $${valores.length}`);
    }
    if (cuerpo.activo !== undefined && typeof cuerpo.activo !== "boolean") return res.status(400).json({ mensaje: "activo debe ser verdadero o falso" });
    if (cambios.length === 0 && cuerpo.activo === undefined) return res.status(400).json({ mensaje: "no hay nada para modificar" });

    if (cambios.length > 0) {
      valores.push(req.boliche.id_boliche, idUsuario);
      await pool.query(`UPDATE boliche_equipo SET ${cambios.join(", ")} WHERE id_boliche = $${valores.length - 1} AND id_usuario = $${valores.length}`, valores);
    }
    if (cuerpo.activo !== undefined) {
      await pool.query(`UPDATE usuario SET activo = $1 WHERE id_usuario = $2`, [cuerpo.activo, idUsuario]);
    }

    res.json(await buscarMiembro(pool, req.boliche.id_boliche, idUsuario));
  } catch (error) {
    if (responderErrorDeBase(error, res)) return;
    console.error(error);
    res.status(500).json({ mensaje: "No se pudo modificar a la persona" });
  }
};

// Baja: sale del equipo y su cuenta se desactiva (se conserva el historial). Solo admin y superadmin.
export const darDeBaja = async (req, res) => {
  const cliente = await pool.connect();
  try {
    const idUsuario = parseId(req.params.idUsuario);
    if (idUsuario === null) return res.status(400).json({ mensaje: "el id del usuario no es valido" });

    await cliente.query("BEGIN");
    const baja = await cliente.query(`DELETE FROM boliche_equipo WHERE id_boliche = $1 AND id_usuario = $2 RETURNING id_usuario`, [req.boliche.id_boliche, idUsuario]);
    if (baja.rows.length === 0) {
      await cliente.query("ROLLBACK");
      return res.status(404).json({ mensaje: "esa persona no está en el equipo de este boliche" });
    }
    await cliente.query(`UPDATE usuario SET activo = false WHERE id_usuario = $1`, [idUsuario]);
    await cliente.query("COMMIT");

    res.json({ mensaje: "persona dada de baja" });
  } catch (error) {
    await cliente.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ mensaje: "No se pudo dar de baja a la persona" });
  } finally {
    cliente.release();
  }
};
