import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../data/db.js";
import { normalizarEmail, validarPersona } from "../utils/validaciones.js";
import { insertarUsuario, responderErrorDeBase } from "../utils/usuarios.js";
import { ADMIN, CLIENTE, SUPERADMIN } from "../middleware/auth.js";
import { cifrar, codigoActual, descifrar, huellaDe, nuevoSecreto, nuevosCodigosDeRecuperacion, urlOtpauth, verificarCodigo } from "../utils/totp.js";

// Verificación en dos pasos: la tienen los admins (y el superadmin). Con VERIFICACION_ADMIN=obligatoria, quien todavía no la activó
// entra con una sesión limitada que solo sirve para activarla. Por defecto es opcional (cómodo para desarrollar).
const ROLES_CON_VERIFICACION = [ADMIN, SUPERADMIN];
const aplicaVerificacion = (rol) => ROLES_CON_VERIFICACION.includes(rol);
const esObligatoria = () => process.env.VERIFICACION_ADMIN === "obligatoria";

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
  boliches: await bolichesDe(usuario),
  verificacion: { aplica: aplicaVerificacion(usuario.rol), activa: Boolean(usuario.totp_activo), obligatoria: aplicaVerificacion(usuario.rol) && esObligatoria() }
});

const firmar = (usuario, extra = {}, expiresIn = process.env.JWT_EXPIRES_IN || "8h") =>
  jwt.sign({ id: usuario.id_usuario ?? usuario.id, rol: usuario.rol, ...extra }, process.env.JWT_SECRET, { expiresIn });

// Intentos fallidos del segundo paso por persona: después de 5 en 10 minutos se frena (el código tiene solo un millón de combinaciones).
const fallos = new Map();
const MAXIMO_FALLOS = 5;
const VENTANA_FALLOS = 10 * 60 * 1000;
const bloqueado = (id) => (fallos.get(id) ?? []).filter((t) => Date.now() - t < VENTANA_FALLOS).length >= MAXIMO_FALLOS;
const anotarFallo = (id) => fallos.set(id, [...(fallos.get(id) ?? []).filter((t) => Date.now() - t < VENTANA_FALLOS), Date.now()]);

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

    if (aplicaVerificacion(usuario.rol) && usuario.totp_activo) {
      // Falta el segundo paso: se entrega un ticket de 5 minutos, no una sesión.
      return res.json({ requiere_verificacion: true, ticket: firmar(usuario, { tipo: "2fa" }, "5m") });
    }
    await pool.query(`UPDATE usuario SET ultima_actividad = now() WHERE id_usuario = $1`, [usuario.id_usuario]);
    if (aplicaVerificacion(usuario.rol) && esObligatoria()) {
      return res.json({ token: firmar(usuario, { enrolar: true }, "30m"), usuario: await datosPublicos(usuario), debe_configurar_2fa: true });
    }
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

// POST /auth/2fa/verificar {ticket, codigo} — completa el login: el código de la app o uno de recuperación (de un solo uso).
export const verificarSegundoPaso = async (req, res) => {
  try {
    let ticket;
    try {
      ticket = jwt.verify(String(req.body?.ticket ?? ""), process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ mensaje: "El paso venció: volvé a iniciar sesión" });
    }
    if (ticket.tipo !== "2fa") return res.status(401).json({ mensaje: "El paso venció: volvé a iniciar sesión" });
    if (bloqueado(ticket.id)) return res.status(429).json({ mensaje: "Demasiados códigos incorrectos. Esperá unos minutos." });

    const usuario = (await pool.query(`SELECT * FROM usuario WHERE id_usuario = $1`, [ticket.id])).rows[0];
    if (!usuario || !usuario.activo || !usuario.totp_activo) return res.status(401).json({ mensaje: "El paso venció: volvé a iniciar sesión" });

    const codigo = String(req.body?.codigo ?? "").trim();
    let valido = false;
    if (/^\d{6}$/.test(codigo)) {
      const paso = verificarCodigo(descifrar(usuario.totp_secreto), codigo, usuario.totp_ultimo_paso);
      if (paso !== null) {
        // El UPDATE condicional impide usar el mismo código dos veces, ni siquiera en dos pedidos simultáneos.
        valido = (await pool.query(`UPDATE usuario SET totp_ultimo_paso = $2 WHERE id_usuario = $1 AND (totp_ultimo_paso IS NULL OR totp_ultimo_paso < $2)`, [usuario.id_usuario, paso])).rowCount === 1;
      }
    } else if (codigo) {
      valido = (await pool.query(`UPDATE usuario_recuperacion SET usado_en = now() WHERE id_usuario = $1 AND huella = $2 AND usado_en IS NULL`, [usuario.id_usuario, huellaDe(codigo)])).rowCount === 1;
    }
    if (!valido) {
      anotarFallo(ticket.id);
      return res.status(401).json({ mensaje: "El código no es correcto" });
    }

    fallos.delete(ticket.id);
    await pool.query(`UPDATE usuario SET ultima_actividad = now() WHERE id_usuario = $1`, [usuario.id_usuario]);
    res.json({ token: firmar(usuario), usuario: await datosPublicos(usuario) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al verificar el código" });
  }
};

const soloConVerificacion = (req, res) => {
  if (aplicaVerificacion(req.usuario.rol)) return true;
  res.status(403).json({ mensaje: "La verificación en dos pasos es para admins" });
  return false;
};

// GET /auth/2fa — cómo está la verificación de quien pregunta.
export const estado2fa = async (req, res) => {
  try {
    if (!soloConVerificacion(req, res)) return;
    const u = (await pool.query(`SELECT totp_activo, (SELECT count(*)::int FROM usuario_recuperacion r WHERE r.id_usuario = u.id_usuario AND r.usado_en IS NULL) AS codigos FROM usuario u WHERE id_usuario = $1`, [req.usuario.id])).rows[0];
    res.json({ activa: u.totp_activo, obligatoria: esObligatoria(), codigos_de_recuperacion_restantes: u.codigos });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al consultar la verificación" });
  }
};

// POST /auth/2fa/preparar — genera el secreto para la app (se muestra una vez como QR). Todavía no queda activa.
export const preparar2fa = async (req, res) => {
  try {
    if (!soloConVerificacion(req, res)) return;
    const u = (await pool.query(`SELECT totp_activo FROM usuario WHERE id_usuario = $1`, [req.usuario.id])).rows[0];
    if (u.totp_activo) return res.status(409).json({ mensaje: "Ya tenés la verificación en dos pasos activa" });
    const secreto = nuevoSecreto();
    await pool.query(`UPDATE usuario SET totp_secreto = $2, totp_ultimo_paso = NULL WHERE id_usuario = $1`, [req.usuario.id, cifrar(secreto)]);

    res.json({ secreto, otpauth_url: urlOtpauth(secreto, req.usuario.email) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al preparar la verificación" });
  }
};

// POST /auth/2fa/activar {codigo} — confirma con un código de la app que quedó bien configurada. Devuelve los códigos de recuperación (se ven una sola vez).
export const activar2fa = async (req, res) => {
  const cliente = await pool.connect();
  try {
    if (!soloConVerificacion(req, res)) return;
    const u = (await pool.query(`SELECT * FROM usuario WHERE id_usuario = $1`, [req.usuario.id])).rows[0];
    if (u.totp_activo) return res.status(409).json({ mensaje: "Ya tenés la verificación en dos pasos activa" });
    if (!u.totp_secreto) return res.status(409).json({ mensaje: "Primero pedí el código QR (preparar)" });
    if (bloqueado(u.id_usuario)) return res.status(429).json({ mensaje: "Demasiados códigos incorrectos. Esperá unos minutos." });
    const paso = verificarCodigo(descifrar(u.totp_secreto), req.body?.codigo, null);
    if (paso === null) {
      anotarFallo(u.id_usuario);
      return res.status(400).json({ mensaje: "El código no es correcto: revisá la hora del celular y probá con el siguiente" });
    }

    const codigos = nuevosCodigosDeRecuperacion();
    await cliente.query("BEGIN");
    await cliente.query(`UPDATE usuario SET totp_activo = true, totp_ultimo_paso = $2 WHERE id_usuario = $1`, [u.id_usuario, paso]);
    await cliente.query(`DELETE FROM usuario_recuperacion WHERE id_usuario = $1`, [u.id_usuario]);
    for (const c of codigos) await cliente.query(`INSERT INTO usuario_recuperacion (id_usuario, huella) VALUES ($1, $2)`, [u.id_usuario, huellaDe(c)]);
    await cliente.query("COMMIT");
    fallos.delete(u.id_usuario);

    // Si venía con la sesión limitada (verificación obligatoria), ahora recibe la sesión completa.
    const activa = { ...u, totp_activo: true };
    res.json({ codigos_de_recuperacion: codigos, token: firmar(u), usuario: await datosPublicos(activa) });
  } catch (error) {
    await cliente.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ mensaje: "Error al activar la verificación" });
  } finally {
    cliente.release();
  }
};

// POST /auth/2fa/desactivar {password, codigo} — solo si la verificación no es obligatoria.
export const desactivar2fa = async (req, res) => {
  try {
    if (!soloConVerificacion(req, res)) return;
    if (esObligatoria()) return res.status(403).json({ mensaje: "La verificación en dos pasos es obligatoria para admins" });
    const u = (await pool.query(`SELECT * FROM usuario WHERE id_usuario = $1`, [req.usuario.id])).rows[0];
    if (!u.totp_activo) return res.status(409).json({ mensaje: "No tenés la verificación en dos pasos activa" });
    if (bloqueado(u.id_usuario)) return res.status(429).json({ mensaje: "Demasiados códigos incorrectos. Esperá unos minutos." });
    if (typeof req.body?.password !== "string" || !(await bcrypt.compare(req.body.password, u.password_hash)) || verificarCodigo(descifrar(u.totp_secreto), req.body?.codigo, u.totp_ultimo_paso) === null) {
      anotarFallo(u.id_usuario);
      return res.status(401).json({ mensaje: "La contraseña o el código no son correctos" });
    }
    await pool.query(`UPDATE usuario SET totp_activo = false, totp_secreto = NULL, totp_ultimo_paso = NULL WHERE id_usuario = $1`, [u.id_usuario]);
    await pool.query(`DELETE FROM usuario_recuperacion WHERE id_usuario = $1`, [u.id_usuario]);

    res.json({ mensaje: "Verificación en dos pasos desactivada" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al desactivar la verificación" });
  }
};

// DELETE /usuarios/:id/2fa — el superadmin la restablece si un admin perdió el celular y los códigos de recuperación.
export const resetear2fa = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ mensaje: "El id del usuario no es válido" });
    const hecho = await pool.query(`UPDATE usuario SET totp_activo = false, totp_secreto = NULL, totp_ultimo_paso = NULL WHERE id_usuario = $1 AND rol IN ('admin', 'superadmin')`, [id]);
    if (hecho.rowCount === 0) return res.status(404).json({ mensaje: "Ese admin no existe" });
    await pool.query(`DELETE FROM usuario_recuperacion WHERE id_usuario = $1`, [id]);

    res.json({ mensaje: "Verificación en dos pasos restablecida: tiene que volver a activarla" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "No se pudo restablecer la verificación" });
  }
};
