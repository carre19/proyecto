import pool from "../data/db.js";
import { temaDe } from "./tema.controller.js";

// Lo que ve cualquier persona, sin cuenta. Solo boliches activos y solo datos pensados para el público:
// nunca el cobro de la plataforma, el equipo, los cupos ni los datos de las personas.
const CAMPOS_PUBLICOS = `b.id_boliche, b.nombre, b.subdominio, b.descripcion, b.direccion, b.latitud::float8 AS latitud, b.longitud::float8 AS longitud, b.capacidad, b.instagram, b.whatsapp`;
const PORTADA = `(SELECT f.url FROM boliche_foto f WHERE f.id_boliche = b.id_boliche ORDER BY f.es_portada DESC, f.orden, f.id_foto LIMIT 1)`;

export const listarBoliches = async (req, res) => {
  try {
    const boliches = await pool.query(`SELECT ${CAMPOS_PUBLICOS}, ${PORTADA} AS portada FROM boliche b WHERE b.activo ORDER BY b.nombre`);
    res.json(boliches.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "No se pudieron obtener los boliches" });
  }
};

// La página de un boliche: datos, fotos, colores, carta de bebidas, mesas VIP y próximos eventos con sus entradas
// y las mesas que ofrece cada uno (los eventos de las últimas horas todavía cuentan: la noche sigue).
export const verBoliche = async (req, res) => {
  try {
    const encontrado = await pool.query(`SELECT ${CAMPOS_PUBLICOS} FROM boliche b WHERE b.subdominio = $1 AND b.activo`, [String(req.params.subdominio).toLowerCase()]);
    if (encontrado.rows.length === 0) return res.status(404).json({ mensaje: "Ese boliche no existe" });
    const boliche = encontrado.rows[0];
    const id = boliche.id_boliche;

    const [fotos, tema, bebidas, mesas, eventos, entradas, mesasEvento] = await Promise.all([
      pool.query(`SELECT id_foto, url, es_portada FROM boliche_foto WHERE id_boliche = $1 ORDER BY es_portada DESC, orden, id_foto`, [id]),
      temaDe(pool, id),
      pool.query(`SELECT id_bebida, categoria, nombre, descripcion, precio, imagen FROM bebida WHERE id_boliche = $1 AND disponible ORDER BY categoria, nombre`, [id]),
      pool.query(`SELECT id_mesa, nombre, capacidad, precio, descripcion, imagen FROM mesa_vip WHERE id_boliche = $1 AND activa ORDER BY precio, nombre`, [id]),
      pool.query(`
        SELECT id_evento, nombre, fecha_hora, artistas, edad_minima, dress_code, tiene_vip, mesas_vip, descripcion, imagen
        FROM evento WHERE id_boliche = $1 AND estado = 'publicado' AND fecha_hora >= now() - interval '6 hours' ORDER BY fecha_hora`, [id]),
      pool.query(`
        SELECT t.id_evento, t.id_tipo_entrada, t.nombre, t.tipo, t.precio_virtual, t.precio_puerta, t.estado
        FROM tipo_entrada t WHERE t.id_boliche = $1 ORDER BY t.orden, t.id_tipo_entrada`, [id]),
      pool.query(`
        SELECT x.id_evento, m.id_mesa, m.nombre, m.capacidad, m.precio, m.descripcion, m.imagen, x.estado
        FROM evento_mesa_vip x JOIN mesa_vip m ON m.id_boliche = x.id_boliche AND m.id_mesa = x.id_mesa
        WHERE x.id_boliche = $1 AND m.activa ORDER BY m.precio, m.nombre`, [id]),
    ]);

    const porEvento = (filas, idEvento) => filas.filter((f) => f.id_evento === idEvento).map(({ id_evento, ...resto }) => resto);
    res.json({
      ...boliche,
      fotos: fotos.rows,
      tema: { claro: tema.claro, oscuro: tema.oscuro },
      bebidas: bebidas.rows,
      mesas_vip: mesas.rows,
      eventos: eventos.rows.map((e) => ({ ...e, entradas: porEvento(entradas.rows, e.id_evento), mesas_vip: porEvento(mesasEvento.rows, e.id_evento) })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "No se pudo obtener el boliche" });
  }
};
