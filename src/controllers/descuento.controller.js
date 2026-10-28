import pool from "../data/db.js";
import { numeroOpcional, parseId, textoObligatorio } from "../utils/validaciones.js";

// Descuentos para clientes con cuenta (los define el admin de cada boliche). Se aplican a las compras hechas desde la página:
// el cliente con una cuenta de más de N meses recibe el mayor descuento que le corresponda (no se acumulan).

// El mejor descuento activo de un boliche para un cliente (por la antigüedad de su cuenta). null si no le corresponde ninguno.
export const descuentoPara = async (db, idBoliche, idUsuario) => (await db.query(`
    SELECT d.id_descuento, d.nombre, d.porcentaje FROM descuento d JOIN usuario u ON u.id_usuario = $2 AND u.rol = 'cliente'
     WHERE d.id_boliche = $1 AND d.activo AND u.fecha_creacion <= now() - make_interval(months => d.antiguedad_meses::int)
     ORDER BY d.porcentaje DESC, d.id_descuento LIMIT 1`, [idBoliche, idUsuario])).rows[0] ?? null;

const CAMPOS = "id_descuento, nombre, porcentaje::float8 AS porcentaje, antiguedad_meses, activo";

const validar = (body, parcial) => {
    const datos = {};
    const hay = (campo) => body?.[campo] !== undefined;
    if (!parcial || hay("nombre")) {
        const nombre = textoObligatorio(body?.nombre, "el nombre", 100);
        if (nombre.error) return { error: nombre.error };
        datos.nombre = nombre.valor;
    }
    if (!parcial || hay("porcentaje")) {
        const pct = numeroOpcional(body?.porcentaje, "el porcentaje", { min: 0.01, max: 100 });
        if (pct.error || pct.valor === null) return { error: pct.error ?? "el porcentaje es obligatorio" };
        datos.porcentaje = Math.round(pct.valor * 100) / 100;
    }
    if (hay("antiguedad_meses")) {
        const meses = numeroOpcional(body.antiguedad_meses, "la antigüedad", { min: 0, max: 240, entero: true });
        if (meses.error || meses.valor === null) return { error: meses.error ?? "la antigüedad es obligatoria" };
        datos.antiguedad_meses = meses.valor;
    }
    if (hay("activo")) {
        if (typeof body.activo !== "boolean") return { error: "activo debe ser verdadero o falso" };
        datos.activo = body.activo;
    }

    return { datos };
};

export const listarDescuentos = async (req, res) => {
    try {
        res.json((await pool.query(`SELECT ${CAMPOS} FROM descuento WHERE id_boliche = $1 ORDER BY porcentaje DESC, nombre`, [req.boliche.id_boliche])).rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "no se pudieron obtener los descuentos" });
    }
};

export const crearDescuento = async (req, res) => {
    try {
        const { error, datos } = validar(req.body, false);
        if (error) return res.status(400).json({ mensaje: error });
        const creado = (await pool.query(`INSERT INTO descuento (id_boliche, nombre, porcentaje, antiguedad_meses) VALUES ($1, $2, $3, $4) RETURNING ${CAMPOS}`,
            [req.boliche.id_boliche, datos.nombre, datos.porcentaje, datos.antiguedad_meses ?? 0])).rows[0];

        res.status(201).json(creado);
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo crear el descuento" });
    }
};

export const editarDescuento = async (req, res) => {
    try {
        const id = parseId(req.params.idDescuento);
        if (id === null) return res.status(400).json({ mensaje: "el id del descuento no es valido" });
        const { error, datos } = validar(req.body, true);
        if (error) return res.status(400).json({ mensaje: error });
        const campos = Object.keys(datos);
        if (campos.length === 0) return res.status(400).json({ mensaje: "no hay nada para modificar" });
        const editado = (await pool.query(`UPDATE descuento SET ${campos.map((c, i) => `${c} = $${i + 1}`).join(", ")} WHERE id_boliche = $${campos.length + 1} AND id_descuento = $${campos.length + 2} RETURNING ${CAMPOS}`,
            [...campos.map((c) => datos[c]), req.boliche.id_boliche, id])).rows[0];
        if (!editado) return res.status(404).json({ mensaje: "ese descuento no existe" });

        res.json(editado);
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo modificar el descuento" });
    }
};

export const eliminarDescuento = async (req, res) => {
    try {
        const id = parseId(req.params.idDescuento);
        if (id === null) return res.status(400).json({ mensaje: "el id del descuento no es valido" });
        const borrado = await pool.query(`DELETE FROM descuento WHERE id_boliche = $1 AND id_descuento = $2`, [req.boliche.id_boliche, id]);
        if (borrado.rowCount === 0) return res.status(404).json({ mensaje: "ese descuento no existe" });

        res.json({ mensaje: "descuento eliminado" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo eliminar el descuento" });
    }
};

// GET /publico/boliches/:subdominio/descuento — el descuento que le corresponde al cliente con sesión (para mostrarlo antes de comprar).
export const verMiDescuento = async (req, res) => {
    try {
        const boliche = (await pool.query(`SELECT id_boliche FROM boliche WHERE subdominio = $1 AND activo`, [String(req.params.subdominio).toLowerCase()])).rows[0];
        if (!boliche) return res.status(404).json({ mensaje: "Ese boliche no existe" });
        const d = req.usuario?.rol === "cliente" ? await descuentoPara(pool, boliche.id_boliche, req.usuario.id) : null;

        res.json({ descuento: d ? { nombre: d.nombre, porcentaje: Number(d.porcentaje) } : null });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo obtener el descuento" });
    }
};
