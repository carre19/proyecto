import jwt from "jsonwebtoken";
import pool from "../data/db.js";
import { parseId } from "../utils/validaciones.js";

export const SUPERADMIN = "superadmin";
export const ADMIN = "admin";
export const MANAGER = "rrpp_manager";
export const RRPP = "rrpp";
export const CLIENTE = "cliente";

// Verifica el token y carga a la persona DESDE LA BASE (no del token): así desactivar una cuenta o
// cambiarle el rol o los boliches vale al instante. Deja en req.usuario:
//   { id, email, nombre, apellido, nombre_completo, rol, boliches: [ids de los boliches a los que accede] }
// Admin: los de boliche_admin. Manager y RRPP: el de boliche_equipo. Superadmin: todos. Cliente: ninguno.
export const verificarToken = (req, res, next) => autenticar(req, res, next, true);

// Para rutas públicas que cambian si hay sesión (por ejemplo, comprar una entrada con la cuenta del cliente):
// sin token sigue como anónimo; con un token inválido responde 401 en vez de ignorarlo en silencio.
export const tokenOpcional = (req, res, next) => autenticar(req, res, next, false);

const autenticar = async (req, res, next, obligatorio) => {
  const cabecera = req.headers.authorization;
  if (!cabecera || !cabecera.startsWith("Bearer ")) {
    if (!obligatorio) return next();
    return res.status(401).json({ mensaje: "Token no proporcionado" });
  }

  let datos;
  try {
    datos = jwt.verify(cabecera.split(" ")[1], process.env.JWT_SECRET);
  } catch (error) {
    if (error.name === "TokenExpiredError") return res.status(401).json({ mensaje: "La sesión expiró" });
    return res.status(401).json({ mensaje: "Token inválido" });
  }

  // El ticket del segundo paso solo sirve para completar el login (/auth/2fa/verificar), nunca como sesión.
  if (datos.tipo === "2fa") return res.status(401).json({ mensaje: "Token inválido" });
  // Un admin que todavía no activó la verificación en dos pasos (cuando es obligatoria) solo puede usar las rutas de /auth.
  if (datos.enrolar && req.baseUrl !== "/api/auth") {
    return res.status(403).json({ mensaje: "Para seguir tenés que activar la verificación en dos pasos", requiere_2fa: true });
  }

  try {
    const resultado = await pool.query(`
      SELECT u.id_usuario AS id, u.email, u.nombre, u.apellido, u.nombre_completo, u.rol, u.activo,
             ARRAY(SELECT id_boliche FROM boliche_admin WHERE id_usuario = u.id_usuario
                   UNION SELECT id_boliche FROM boliche_equipo WHERE id_usuario = u.id_usuario) AS boliches
      FROM usuario u WHERE u.id_usuario = $1`, [datos.id ?? null]);
    const usuario = resultado.rows[0];
    if (!usuario) return res.status(401).json({ mensaje: "Token inválido" });
    if (!usuario.activo) return res.status(403).json({ mensaje: "Tu cuenta está desactivada" });

    // La última actividad sirve para borrar a los clientes inactivos; se actualiza a lo sumo una vez por hora.
    pool.query(`UPDATE usuario SET ultima_actividad = now() WHERE id_usuario = $1 AND ultima_actividad < now() - interval '1 hour'`, [usuario.id])
      .catch((error) => console.error(error));

    req.usuario = usuario;
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al verificar la sesión" });
  }
};

// Permite el paso solo a los roles indicados. Usar después de verificarToken.
export const soloRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.usuario?.rol)) {
    return res.status(403).json({ mensaje: "No tenés permiso para esta acción" });
  }
  next();
};

export const esSuperadmin = (req) => req.usuario.rol === SUPERADMIN;

// ÚNICO lugar donde se decide el acceso a un boliche (ruta con :idBoliche). Usar después de verificarToken.
//   - el superadmin entra a todos
//   - el resto, solo a los suyos; los demás responden 404 (no se revela que existen)
//   - un boliche desactivado solo lo ve el superadmin
// Deja el boliche en req.boliche.
export const accesoBoliche = async (req, res, next) => {
  try {
    const idBoliche = parseId(req.params.idBoliche);
    if (idBoliche === null) return res.status(400).json({ mensaje: "El id del boliche no es válido" });

    if (!esSuperadmin(req) && !req.usuario.boliches.includes(idBoliche)) {
      return res.status(404).json({ mensaje: "Ese boliche no existe" });
    }
    const resultado = await pool.query(`SELECT * FROM boliche WHERE id_boliche = $1`, [idBoliche]);
    const boliche = resultado.rows[0];
    if (!boliche) return res.status(404).json({ mensaje: "Ese boliche no existe" });
    if (!boliche.activo && !esSuperadmin(req)) {
      return res.status(403).json({ mensaje: "Este boliche está desactivado" });
    }

    req.boliche = boliche;
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al verificar el acceso al boliche" });
  }
};
