import pool from "../data/db.js";
import { listaDeIds, numeroOpcional, parseId, textoObligatorio, textoOpcional, validarPersona } from "../utils/validaciones.js";
import { insertarUsuario, responderErrorDeBase } from "../utils/usuarios.js";
import { ADMIN, esSuperadmin } from "../middleware/auth.js";

// Boliche con sus admins, sus fotos (la portada primero) y la cantidad de gente del equipo.
const SELECT_BOLICHE = `
  SELECT b.*,
         COALESCE((SELECT json_agg(json_build_object('id_usuario', u.id_usuario, 'nombre_completo', u.nombre_completo, 'email', u.email) ORDER BY u.nombre)
                   FROM boliche_admin a JOIN usuario u ON u.id_usuario = a.id_usuario WHERE a.id_boliche = b.id_boliche), '[]') AS admins,
         COALESCE((SELECT json_agg(json_build_object('id_foto', f.id_foto, 'url', f.url, 'es_portada', f.es_portada, 'orden', f.orden) ORDER BY f.es_portada DESC, f.orden, f.id_foto)
                   FROM boliche_foto f WHERE f.id_boliche = b.id_boliche), '[]') AS fotos,
         (SELECT count(*)::int FROM boliche_equipo q WHERE q.id_boliche = b.id_boliche) AS equipo,
         (SELECT count(*)::int FROM evento e WHERE e.id_boliche = b.id_boliche AND e.estado = 'publicado' AND e.fecha_hora >= now()) AS proximos_eventos
  FROM boliche b`;

// Campos que puede cambiar cada rol. Los de la plataforma (subdominio, cobro, activo) son solo del superadmin.
// Las fotos no se editan acá: se suben, se ordenan y se borran por /fotos (así nadie engancha la imagen de otro local).
const CAMPOS_DEL_ADMIN = ["nombre", "descripcion", "direccion", "latitud", "longitud", "capacidad", "instagram", "whatsapp"];
const CAMPOS_DEL_SUPERADMIN = [...CAMPOS_DEL_ADMIN, "subdominio", "tipo_cobro", "monto_mensual", "activo"];
const REGEX_SUBDOMINIO = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

// Valida los datos de un boliche. "parcial" = solo lo que vino (para editar). Devuelve {error} o {datos}.
const validarBoliche = (body, parcial) => {
  const datos = {};
  const hay = (campo) => body?.[campo] !== undefined;
  const requerido = (campo) => !parcial || hay(campo);

  if (requerido("nombre")) {
    const nombre = textoObligatorio(body?.nombre, "el nombre", 120);
    if (nombre.error) return { error: nombre.error };
    datos.nombre = nombre.valor;
  }
  if (requerido("subdominio")) {
    const subdominio = String(body?.subdominio ?? "").trim().toLowerCase();
    if (!REGEX_SUBDOMINIO.test(subdominio)) {
      return { error: "el subdominio debe tener entre 3 y 30 letras minusculas, numeros o guiones, sin espacios" };
    }
    datos.subdominio = subdominio;
  }
  for (const [campo, maximo, etiqueta] of [["descripcion", 2000, "la descripcion"], ["direccion", 200, "la direccion"], ["instagram", 100, "el instagram"], ["whatsapp", 30, "el whatsapp"]]) {
    if (hay(campo)) {
      const texto = textoOpcional(body[campo], etiqueta, maximo);
      if (texto.error) return { error: texto.error };
      datos[campo] = texto.valor;
    }
  }
  for (const [campo, opciones, etiqueta] of [
    ["latitud", { min: -90, max: 90 }, "la latitud"], ["longitud", { min: -180, max: 180 }, "la longitud"],
    ["capacidad", { min: 1, max: 100000, entero: true }, "la capacidad"], ["monto_mensual", { min: 0, max: 1e9 }, "el monto mensual"],
  ]) {
    if (hay(campo)) {
      const numero = numeroOpcional(body[campo], etiqueta, opciones);
      if (numero.error) return { error: numero.error };
      datos[campo] = numero.valor;
    }
  }
  if (hay("tipo_cobro")) {
    if (!["mensual", "evento_unico"].includes(body.tipo_cobro)) return { error: "el tipo de cobro debe ser mensual o evento_unico" };
    datos.tipo_cobro = body.tipo_cobro;
  }
  if (hay("activo")) {
    if (typeof body.activo !== "boolean") return { error: "activo debe ser verdadero o falso" };
    datos.activo = body.activo;
  }

  return { datos };
};

// Superadmin: todos. Admin, manager y RRPP: solo los suyos (la lista sale de req.usuario.boliches, que carga el middleware).
export const listarBoliches = async (req, res) => {
  try {
    const boliches = esSuperadmin(req)
      ? await pool.query(`${SELECT_BOLICHE} ORDER BY b.nombre`)
      : await pool.query(`${SELECT_BOLICHE} WHERE b.id_boliche = ANY($1) ORDER BY b.nombre`, [req.usuario.boliches]);
    res.json(boliches.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "No se pudieron obtener los boliches" });
  }
};

export const verBoliche = async (req, res) => {
  try {
    const boliche = await pool.query(`${SELECT_BOLICHE} WHERE b.id_boliche = $1`, [req.boliche.id_boliche]);
    res.json(boliche.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "No se pudo obtener el boliche" });
  }
};

// El superadmin crea el boliche junto con su admin (uno nuevo, o admins que ya existen). Sin admin nadie lo manejaría.
export const crearBoliche = async (req, res) => {
  const cliente = await pool.connect();
  try {
    const { error, datos } = validarBoliche(req.body, false);
    if (error) return res.status(400).json({ mensaje: error });

    let idsAdmins = [];
    if (req.body?.id_admins !== undefined) {
      const lista = listaDeIds(req.body.id_admins, "id_admins");
      if (lista.error) return res.status(400).json({ mensaje: lista.error });
      idsAdmins = lista.ids;
    }
    let adminNuevo = null;
    if (req.body?.admin) {
      const validado = validarPersona(req.body.admin);
      if (validado.error) return res.status(400).json({ mensaje: `admin: ${validado.error}` });
      adminNuevo = validado.datos;
    }
    if (idsAdmins.length === 0 && !adminNuevo) {
      return res.status(400).json({ mensaje: "un boliche necesita al menos un admin: indicá admin (uno nuevo) o id_admins (existentes)" });
    }

    await cliente.query("BEGIN");
    const creado = await cliente.query(`
      INSERT INTO boliche (nombre, subdominio, descripcion, direccion, latitud, longitud, capacidad, instagram, whatsapp, tipo_cobro, monto_mensual)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, 'mensual'), $11) RETURNING id_boliche`,
      [datos.nombre, datos.subdominio, datos.descripcion ?? null, datos.direccion ?? null, datos.latitud ?? null, datos.longitud ?? null,
       datos.capacidad ?? null, datos.instagram ?? null, datos.whatsapp ?? null, datos.tipo_cobro ?? null, datos.monto_mensual ?? null]);
    const idBoliche = creado.rows[0].id_boliche;

    if (adminNuevo) idsAdmins.push((await insertarUsuario(cliente, adminNuevo, ADMIN)).id_usuario);
    for (const idUsuario of idsAdmins) {
      await cliente.query(`INSERT INTO boliche_admin (id_boliche, id_usuario) VALUES ($1, $2)`, [idBoliche, idUsuario]);
    }
    await cliente.query("COMMIT");

    const boliche = await pool.query(`${SELECT_BOLICHE} WHERE b.id_boliche = $1`, [idBoliche]);
    res.status(201).json(boliche.rows[0]);
  } catch (error) {
    await cliente.query("ROLLBACK");
    if (responderErrorDeBase(error, res)) return;
    console.error(error);
    res.status(500).json({ mensaje: "No se pudo crear el boliche" });
  } finally {
    cliente.release();
  }
};

// Superadmin: cualquier dato. Admin: solo los datos de su local (no el subdominio, el cobro ni el estado).
export const editarBoliche = async (req, res) => {
  try {
    const permitidos = esSuperadmin(req) ? CAMPOS_DEL_SUPERADMIN : CAMPOS_DEL_ADMIN;
    const prohibidos = Object.keys(req.body ?? {}).filter((campo) => !permitidos.includes(campo));
    if (prohibidos.length > 0) {
      return res.status(403).json({ mensaje: `no podés modificar: ${prohibidos.join(", ")}` });
    }

    const { error, datos } = validarBoliche(req.body, true);
    if (error) return res.status(400).json({ mensaje: error });
    const campos = Object.keys(datos);
    if (campos.length === 0) return res.status(400).json({ mensaje: "no hay nada para modificar" });

    const asignaciones = campos.map((campo, i) => `${campo} = $${i + 1}`).join(", ");
    await pool.query(`UPDATE boliche SET ${asignaciones} WHERE id_boliche = $${campos.length + 1}`, [...campos.map((c) => datos[c]), req.boliche.id_boliche]);

    const boliche = await pool.query(`${SELECT_BOLICHE} WHERE b.id_boliche = $1`, [req.boliche.id_boliche]);
    res.json(boliche.rows[0]);
  } catch (error) {
    if (responderErrorDeBase(error, res)) return;
    console.error(error);
    res.status(500).json({ mensaje: "No se pudo editar el boliche" });
  }
};

// Suma un admin (que ya existe) a un boliche.
export const agregarAdmin = async (req, res) => {
  try {
    const idUsuario = parseId(req.body?.id_usuario);
    if (idUsuario === null) return res.status(400).json({ mensaje: "el id del usuario no es valido" });

    await pool.query(`INSERT INTO boliche_admin (id_boliche, id_usuario) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [req.boliche.id_boliche, idUsuario]);
    const boliche = await pool.query(`${SELECT_BOLICHE} WHERE b.id_boliche = $1`, [req.boliche.id_boliche]);
    res.status(201).json(boliche.rows[0]);
  } catch (error) {
    if (responderErrorDeBase(error, res)) return;
    console.error(error);
    res.status(500).json({ mensaje: "No se pudo agregar el admin" });
  }
};

// Quita un admin; el boliche tiene que conservar al menos uno.
export const quitarAdmin = async (req, res) => {
  const cliente = await pool.connect();
  try {
    const idUsuario = parseId(req.params.idUsuario);
    if (idUsuario === null) return res.status(400).json({ mensaje: "el id del usuario no es valido" });

    await cliente.query("BEGIN");
    const admins = await cliente.query(`SELECT id_usuario FROM boliche_admin WHERE id_boliche = $1 FOR UPDATE`, [req.boliche.id_boliche]);
    if (!admins.rows.some((fila) => fila.id_usuario === idUsuario)) {
      await cliente.query("ROLLBACK");
      return res.status(404).json({ mensaje: "esa persona no es admin de este boliche" });
    }
    if (admins.rows.length === 1) {
      await cliente.query("ROLLBACK");
      return res.status(400).json({ mensaje: "el boliche tiene que tener al menos un admin: antes de quitarlo, agregá otro" });
    }
    await cliente.query(`DELETE FROM boliche_admin WHERE id_boliche = $1 AND id_usuario = $2`, [req.boliche.id_boliche, idUsuario]);
    await cliente.query("COMMIT");

    const boliche = await pool.query(`${SELECT_BOLICHE} WHERE b.id_boliche = $1`, [req.boliche.id_boliche]);
    res.json(boliche.rows[0]);
  } catch (error) {
    await cliente.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ mensaje: "No se pudo quitar el admin" });
  } finally {
    cliente.release();
  }
};
