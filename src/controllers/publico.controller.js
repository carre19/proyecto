import pool from "../data/db.js";

// Lo que ve cualquier persona, sin cuenta. Solo boliches activos y solo datos pensados para el público.
const CAMPOS_PUBLICOS = `b.id_boliche, b.nombre, b.subdominio, b.descripcion, b.direccion, b.latitud, b.longitud,
                         b.instagram, b.whatsapp, b.fotos`;

export const listarBoliches = async (req, res) => {
  try {
    const boliches = await pool.query(`SELECT ${CAMPOS_PUBLICOS} FROM boliche b WHERE b.activo ORDER BY b.nombre`);
    res.json(boliches.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "No se pudieron obtener los boliches" });
  }
};

// La página de un boliche: sus datos y sus próximos eventos (los de las últimas horas todavía cuentan: la noche sigue).
export const verBoliche = async (req, res) => {
  try {
    const boliche = await pool.query(`SELECT ${CAMPOS_PUBLICOS} FROM boliche b WHERE b.subdominio = $1 AND b.activo`, [String(req.params.subdominio).toLowerCase()]);
    if (boliche.rows.length === 0) return res.status(404).json({ mensaje: "Ese boliche no existe" });

    const eventos = await pool.query(`
      SELECT id_evento, nombre, fecha_hora, artistas, edad_minima, dress_code, tiene_vip, mesas_vip, descripcion, imagen
      FROM evento
      WHERE id_boliche = $1 AND estado = 'publicado' AND fecha_hora >= now() - interval '6 hours'
      ORDER BY fecha_hora`, [boliche.rows[0].id_boliche]);

    res.json({ ...boliche.rows[0], eventos: eventos.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "No se pudo obtener el boliche" });
  }
};
