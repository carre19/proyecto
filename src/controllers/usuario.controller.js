import pool from "../data/db.js";
import { parseId, textoObligatorio, textoOpcional, validarPersona } from "../utils/validaciones.js";
import { insertarUsuario, responderErrorDeBase } from "../utils/usuarios.js";
import { ADMIN } from "../middleware/auth.js";

const ROLES = ["superadmin", "admin", "rrpp_manager", "rrpp", "cliente"];

// Solo el superadmin: lista a todos los usuarios del sistema (con los boliches de cada uno).
export const listarUsuarios = async (req, res) => {
  try {
    const rol = req.query.rol;
    if (rol !== undefined && !ROLES.includes(rol)) return res.status(400).json({ mensaje: `el rol debe ser uno de: ${ROLES.join(", ")}` });
    const texto = typeof req.query.q === "string" ? `%${req.query.q.trim().toLowerCase()}%` : null;

    const usuarios = await pool.query(`
      SELECT u.id_usuario, u.email, u.nombre, u.apellido, u.nombre_completo, u.dni, u.telefono, u.rol, u.activo, u.fecha_creacion, u.ultima_actividad,
             COALESCE((SELECT json_agg(json_build_object('id_boliche', b.id_boliche, 'nombre', b.nombre) ORDER BY b.nombre)
                       FROM boliche b WHERE b.id_boliche IN (SELECT id_boliche FROM boliche_admin WHERE id_usuario = u.id_usuario
                                                             UNION SELECT id_boliche FROM boliche_equipo WHERE id_usuario = u.id_usuario)), '[]') AS boliches
      FROM usuario u
      WHERE ($1::text IS NULL OR u.rol = $1)
        AND ($2::text IS NULL OR lower(u.nombre_completo) LIKE $2 OR u.email LIKE $2)
      ORDER BY u.rol, u.nombre_completo`, [rol ?? null, texto]);
    res.json(usuarios.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "No se pudieron obtener los usuarios" });
  }
};

// Da de alta a un admin (el que después se asigna a uno o más boliches). El resto de los roles los crea quien corresponde.
export const crearAdmin = async (req, res) => {
  try {
    const { error, datos } = validarPersona(req.body);
    if (error) return res.status(400).json({ mensaje: error });

    res.status(201).json(await insertarUsuario(pool, datos, ADMIN));
  } catch (error) {
    if (responderErrorDeBase(error, res)) return;
    console.error(error);
    res.status(500).json({ mensaje: "No se pudo crear el admin" });
  }
};

// Activa o desactiva una cuenta y corrige sus datos de contacto. No se puede desactivar a uno mismo.
export const editarUsuario = async (req, res) => {
  try {
    const id = parseId(req.params.idUsuario);
    if (id === null) return res.status(400).json({ mensaje: "el id del usuario no es valido" });
    const { activo } = req.body ?? {};
    if (activo !== undefined && typeof activo !== "boolean") return res.status(400).json({ mensaje: "activo debe ser verdadero o falso" });
    if (activo === false && id === req.usuario.id) return res.status(400).json({ mensaje: "no podés desactivar tu propia cuenta" });

    const nombre = req.body?.nombre === undefined ? { valor: null } : textoObligatorio(req.body.nombre, "el nombre", 100);
    const apellido = req.body?.apellido === undefined ? { valor: null } : textoObligatorio(req.body.apellido, "el apellido", 100);
    const telefono = textoOpcional(req.body?.telefono, "el telefono", 30);
    const error = nombre.error ?? apellido.error ?? telefono.error;
    if (error) return res.status(400).json({ mensaje: error });

    const editado = await pool.query(`
      UPDATE usuario SET nombre = COALESCE($1, nombre), apellido = COALESCE($2, apellido),
             telefono = CASE WHEN $3::boolean THEN $4 ELSE telefono END, activo = COALESCE($5, activo)
      WHERE id_usuario = $6
      RETURNING id_usuario, email, nombre, apellido, nombre_completo, telefono, rol, activo`,
      [nombre.valor, apellido.valor, req.body?.telefono !== undefined, telefono.valor, activo ?? null, id]);
    if (editado.rows.length === 0) return res.status(404).json({ mensaje: "ese usuario no existe" });

    res.json(editado.rows[0]);
  } catch (error) {
    if (responderErrorDeBase(error, res)) return;
    console.error(error);
    res.status(500).json({ mensaje: "No se pudo editar el usuario" });
  }
};
