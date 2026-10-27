import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../data/db.js";
import { normalizarEmail, validarPersona } from "../utils/validaciones.js";
import { insertarUsuario, responderErrorDeBase } from "../utils/usuarios.js";
import { CLIENTE, SUPERADMIN } from "../middleware/auth.js";

// A qué boliches accede una persona (para que el front arme su panel). El superadmin ve todos.
const bolichesDe = async (usuario) => {
  const resultado = usuario.rol === SUPERADMIN
    ? await pool.query(`SELECT id_boliche, nombre, subdominio, activo FROM boliche ORDER BY nombre`)
    : await pool.query(`
        SELECT b.id_boliche, b.nombre, b.subdominio, b.activo FROM boliche b
        WHERE b.id_boliche IN (SELECT id_boliche FROM boliche_admin WHERE id_usuario = $1
                               UNION SELECT id_boliche FROM boliche_equipo WHERE id_usuario = $1)
        ORDER BY b.nombre`, [usuario.id_usuario ?? usuario.id]);
  return resultado.rows;
};

const datosPublicos = async (usuario) => ({
  id: usuario.id_usuario ?? usuario.id,
  nombre: usuario.nombre,
  apellido: usuario.apellido,
  nombre_completo: usuario.nombre_completo,
  email: usuario.email,
  rol: usuario.rol,
  boliches: await bolichesDe(usuario)
});

const firmar = (usuario) =>
  jwt.sign({ id: usuario.id_usuario ?? usuario.id, rol: usuario.rol }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "8h" });

// El público se registra solo, como cliente. Admins, managers y RRPP los da de alta quien corresponde.
export const registrar = async (req, res) => {
  try {
    const { error, datos } = validarPersona(req.body);
    if (error) return res.status(400).json({ mensaje: error });

    const usuario = await insertarUsuario(pool, datos, CLIENTE);
    res.status(201).json(await datosPublicos(usuario));
  } catch (error) {
    if (responderErrorDeBase(error, res)) return;
    console.error(error);
    res.status(500).json({ mensaje: "Error al crear la cuenta" });
  }
};

export const login = async (req, res) => {
  try {
    const email = normalizarEmail(req.body?.email);
    const password = req.body?.password;
    if (!email || typeof password !== "string" || !password) {
      return res.status(400).json({ mensaje: "Faltan datos" });
    }

    const resultado = await pool.query(`SELECT * FROM usuario WHERE email = $1`, [email]);
    const usuario = resultado.rows[0];
    // El mismo mensaje si el email no existe o la clave es otra: no se revela cuál de las dos falló.
    if (!usuario || !(await bcrypt.compare(password, usuario.password_hash))) {
      return res.status(401).json({ mensaje: "Credenciales inválidas" });
    }
    if (!usuario.activo) return res.status(403).json({ mensaje: "Tu cuenta está desactivada" });

    await pool.query(`UPDATE usuario SET ultima_actividad = now() WHERE id_usuario = $1`, [usuario.id_usuario]);
    res.json({ token: firmar(usuario), usuario: await datosPublicos(usuario) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al iniciar sesión" });
  }
};

export const perfil = async (req, res) => {
  try {
    res.json(await datosPublicos(req.usuario));
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al obtener el perfil" });
  }
};
