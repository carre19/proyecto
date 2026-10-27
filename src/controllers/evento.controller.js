import pool from "../data/db.js";
import { numeroOpcional, parseId, textoObligatorio, textoOpcional } from "../utils/validaciones.js";
import { responderErrorDeBase } from "../utils/usuarios.js";
import { MANAGER } from "../middleware/auth.js";

const ESTADOS = ["publicado", "cancelado", "finalizado"];

// Artistas: acepta una lista o un texto separado por comas.
const validarArtistas = (valor) => {
  const lista = Array.isArray(valor) ? valor : typeof valor === "string" ? valor.split(",") : null;
  if (!lista || lista.length > 30 || lista.some((a) => typeof a !== "string" || a.trim().length > 100)) {
    return { error: "los artistas deben ser una lista de hasta 30 nombres de hasta 100 caracteres" };
  }
  return { valor: lista.map((a) => a.trim()).filter(Boolean) };
};

// Valida los datos de un evento. "parcial" = solo lo que vino (para editar). Devuelve {error} o {datos}.
const validarEvento = (body, parcial) => {
  const datos = {};
  const hay = (campo) => body?.[campo] !== undefined;

  if (!parcial || hay("nombre")) {
    const nombre = textoObligatorio(body?.nombre, "el nombre", 150);
    if (nombre.error) return { error: nombre.error };
    datos.nombre = nombre.valor;
  }
  if (!parcial || hay("fecha_hora")) {
    const fecha = new Date(body?.fecha_hora);
    if (!body?.fecha_hora || Number.isNaN(fecha.getTime())) return { error: "la fecha y hora no son validas (por ejemplo 2026-11-20T23:00:00-03:00)" };
    datos.fecha_hora = fecha.toISOString();
  }
  if (hay("artistas")) {
    const artistas = validarArtistas(body.artistas);
    if (artistas.error) return { error: artistas.error };
    datos.artistas = artistas.valor;
  }
  if (hay("edad_minima")) {
    const edad = numeroOpcional(body.edad_minima, "la edad minima", { min: 0, max: 99, entero: true });
    if (edad.error || edad.valor === null) return { error: edad.error ?? "la edad minima no es valida" };
    datos.edad_minima = edad.valor;
  }
  for (const [campo, maximo, etiqueta] of [["dress_code", 100, "el dress code"], ["descripcion", 2000, "la descripcion"]]) {
    if (hay(campo)) {
      const texto = textoOpcional(body[campo], etiqueta, maximo);
      if (texto.error) return { error: texto.error };
      datos[campo] = texto.valor;
    }
  }
  if (hay("tiene_vip")) {
    if (typeof body.tiene_vip !== "boolean") return { error: "tiene_vip debe ser verdadero o falso" };
    datos.tiene_vip = body.tiene_vip;
  }
  if (hay("mesas_vip")) {
    const mesas = numeroOpcional(body.mesas_vip, "las mesas VIP", { min: 0, max: 1000, entero: true });
    if (mesas.error) return { error: mesas.error };
    datos.mesas_vip = mesas.valor;
  }
  if (hay("estado")) {
    if (!ESTADOS.includes(body.estado)) return { error: `el estado debe ser uno de: ${ESTADOS.join(", ")}` };
    datos.estado = body.estado;
  }

  return { datos };
};

// Todo evento se busca SIEMPRE junto con su boliche: un evento de otro local responde 404.
const buscarEvento = async (idBoliche, idEvento) => {
  const evento = await pool.query(`
    SELECT e.*, u.nombre_completo AS creador FROM evento e LEFT JOIN usuario u ON u.id_usuario = e.id_creador
    WHERE e.id_boliche = $1 AND e.id_evento = $2`, [idBoliche, idEvento]);
  return evento.rows[0];
};

export const listarEventos = async (req, res) => {
  try {
    const estado = req.query.estado;
    if (estado !== undefined && !ESTADOS.includes(estado)) return res.status(400).json({ mensaje: `el estado debe ser uno de: ${ESTADOS.join(", ")}` });
    const soloProximos = req.query.proximos === "true";

    const eventos = await pool.query(`
      SELECT e.*, u.nombre_completo AS creador FROM evento e LEFT JOIN usuario u ON u.id_usuario = e.id_creador
      WHERE e.id_boliche = $1 AND ($2::text IS NULL OR e.estado = $2) AND (NOT $3::boolean OR e.fecha_hora >= now() - interval '6 hours')
      ORDER BY e.fecha_hora DESC`, [req.boliche.id_boliche, estado ?? null, soloProximos]);
    res.json(eventos.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "No se pudieron obtener los eventos" });
  }
};

export const verEvento = async (req, res) => {
  try {
    const idEvento = parseId(req.params.idEvento);
    if (idEvento === null) return res.status(400).json({ mensaje: "el id del evento no es valido" });
    const evento = await buscarEvento(req.boliche.id_boliche, idEvento);
    if (!evento) return res.status(404).json({ mensaje: "ese evento no existe" });

    res.json(evento);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "No se pudo obtener el evento" });
  }
};

// Crean eventos el superadmin, el admin del boliche y su manager (la ruta ya filtra los roles).
export const crearEvento = async (req, res) => {
  try {
    const { error, datos } = validarEvento(req.body, false);
    if (error) return res.status(400).json({ mensaje: error });
    if (datos.mesas_vip != null && !datos.tiene_vip) return res.status(400).json({ mensaje: "para indicar mesas VIP el evento tiene que tener sector VIP" });

    const creado = await pool.query(`
      INSERT INTO evento (id_boliche, nombre, fecha_hora, artistas, edad_minima, dress_code, tiene_vip, mesas_vip, descripcion, id_creador)
      VALUES ($1, $2, $3, COALESCE($4::text[], '{}'::text[]), COALESCE($5::smallint, 18::smallint), $6, COALESCE($7::boolean, false), $8, $9, $10) RETURNING id_evento`,
      [req.boliche.id_boliche, datos.nombre, datos.fecha_hora, datos.artistas ?? null, datos.edad_minima ?? null, datos.dress_code ?? null,
       datos.tiene_vip ?? null, datos.mesas_vip ?? null, datos.descripcion ?? null, req.usuario.id]);

    res.status(201).json(await buscarEvento(req.boliche.id_boliche, creado.rows[0].id_evento));
  } catch (error) {
    if (responderErrorDeBase(error, res)) return;
    console.error(error);
    res.status(500).json({ mensaje: "No se pudo crear el evento" });
  }
};

// Admin y superadmin editan cualquier evento del boliche; el manager, solo los que creó él.
const puedeTocar = (req, evento) => req.usuario.rol !== MANAGER || evento.id_creador === req.usuario.id;

export const editarEvento = async (req, res) => {
  try {
    const idEvento = parseId(req.params.idEvento);
    if (idEvento === null) return res.status(400).json({ mensaje: "el id del evento no es valido" });
    const actual = await buscarEvento(req.boliche.id_boliche, idEvento);
    if (!actual) return res.status(404).json({ mensaje: "ese evento no existe" });
    if (!puedeTocar(req, actual)) return res.status(403).json({ mensaje: "el manager solo modifica los eventos que creó" });

    const { error, datos } = validarEvento(req.body, true);
    if (error) return res.status(400).json({ mensaje: error });
    const campos = Object.keys(datos);
    if (campos.length === 0) return res.status(400).json({ mensaje: "no hay nada para modificar" });

    const tieneVip = datos.tiene_vip ?? actual.tiene_vip;
    if (!tieneVip && (datos.mesas_vip ?? actual.mesas_vip) != null) {
      datos.mesas_vip = null;
      if (!campos.includes("mesas_vip")) campos.push("mesas_vip");
    }
    const asignaciones = campos.map((campo, i) => `${campo} = $${i + 1}`).join(", ");
    await pool.query(`UPDATE evento SET ${asignaciones} WHERE id_boliche = $${campos.length + 1} AND id_evento = $${campos.length + 2}`,
      [...campos.map((c) => datos[c]), req.boliche.id_boliche, idEvento]);

    res.json(await buscarEvento(req.boliche.id_boliche, idEvento));
  } catch (error) {
    if (responderErrorDeBase(error, res)) return;
    console.error(error);
    res.status(500).json({ mensaje: "No se pudo editar el evento" });
  }
};

// Borrar un evento solo lo hacen el admin y el superadmin. (Cuando haya entradas vendidas habrá que cancelarlo en vez de borrarlo.)
export const eliminarEvento = async (req, res) => {
  try {
    const idEvento = parseId(req.params.idEvento);
    if (idEvento === null) return res.status(400).json({ mensaje: "el id del evento no es valido" });

    const borrado = await pool.query(`DELETE FROM evento WHERE id_boliche = $1 AND id_evento = $2 RETURNING id_evento`, [req.boliche.id_boliche, idEvento]);
    if (borrado.rows.length === 0) return res.status(404).json({ mensaje: "ese evento no existe" });

    res.json({ mensaje: "evento eliminado" });
  } catch (error) {
    if (responderErrorDeBase(error, res)) return;
    console.error(error);
    res.status(500).json({ mensaje: "No se pudo eliminar el evento" });
  }
};
