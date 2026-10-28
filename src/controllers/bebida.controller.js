import pool from "../data/db.js";
import { numeroOpcional, parseId, textoObligatorio, textoOpcional } from "../utils/validaciones.js";
import { responderErrorDeBase } from "../utils/usuarios.js";
import { borrarImagen, guardarImagen } from "../utils/imagenes.js";

// Carta de bebidas de un boliche. Cada bebida que se carga queda guardada en la tabla "bebida";
// "disponible" permite sacarla de la carta sin borrarla. Precios en pesos, números enteros.
const CAMPOS = "id_bebida, categoria, nombre, descripcion, precio, imagen, disponible";

// Valida los datos de una bebida. "parcial" = solo lo que vino (para editar). Devuelve {error} o {datos}.
const validarBebida = (body, parcial) => {
    const datos = {};
    const hay = (campo) => body?.[campo] !== undefined;

    for(const [campo, etiqueta, maximo] of [["categoria", "la categoria", 60], ["nombre", "el nombre", 100]]){
        if(!parcial || hay(campo)){
            const texto = textoObligatorio(body?.[campo], etiqueta, maximo);
            if(texto.error){
                return {error: texto.error};
            }
            datos[campo] = texto.valor;
        }
    }
    if(hay("descripcion")){
        const descripcion = textoOpcional(body.descripcion, "la descripcion", 300);
        if(descripcion.error){
            return {error: descripcion.error};
        }
        datos.descripcion = descripcion.valor;
    }
    if(!parcial || hay("precio")){
        const precio = numeroOpcional(body?.precio, "el precio", {min: 0, max: 100000000, entero: true});
        if(precio.error || precio.valor === null){
            return {error: precio.error ?? "el precio es obligatorio"};
        }
        datos.precio = precio.valor;
    }
    if(hay("disponible")){
        if(typeof body.disponible !== "boolean"){
            return {error: "disponible debe ser verdadero o falso"};
        }
        datos.disponible = body.disponible;
    }

    return {datos};
};

export const listarBebidas = async (req, res) => {
    try{
        const bebidas = await pool.query(`SELECT ${CAMPOS} FROM bebida WHERE id_boliche = $1 ORDER BY categoria, nombre`, [req.boliche.id_boliche]);

        res.json(bebidas.rows);
    } catch(error){
        console.error(error);
        res.status(500).json({mensaje: "no se pudieron obtener las bebidas"});
    }
};

export const crearBebida = async (req, res) => {
    try{
        const {error, datos} = validarBebida(req.body, false);
        if(error){
            return res.status(400).json({mensaje: error});
        }

        const creada = await pool.query(`
            INSERT INTO bebida (id_boliche, categoria, nombre, descripcion, precio, disponible)
            VALUES ($1, $2, $3, $4, $5, COALESCE($6, true)) RETURNING ${CAMPOS}`,
            [req.boliche.id_boliche, datos.categoria, datos.nombre, datos.descripcion ?? null, datos.precio, datos.disponible ?? null]);

        res.status(201).json(creada.rows[0]);
    } catch(error){
        if(responderErrorDeBase(error, res)){
            return;
        }
        console.error(error);
        res.status(500).json({mensaje: "no se pudo crear la bebida"});
    }
};

export const editarBebida = async (req, res) => {
    try{
        const idBebida = parseId(req.params.idBebida);
        if(idBebida === null){
            return res.status(400).json({mensaje: "el id de la bebida no es valido"});
        }
        const {error, datos} = validarBebida(req.body, true);
        if(error){
            return res.status(400).json({mensaje: error});
        }
        const campos = Object.keys(datos);
        if(campos.length === 0){
            return res.status(400).json({mensaje: "no hay nada para modificar"});
        }

        const asignaciones = campos.map((campo, i) => `${campo} = $${i + 1}`).join(", ");
        const editada = await pool.query(
            `UPDATE bebida SET ${asignaciones} WHERE id_boliche = $${campos.length + 1} AND id_bebida = $${campos.length + 2} RETURNING ${CAMPOS}`,
            [...campos.map((c) => datos[c]), req.boliche.id_boliche, idBebida]);
        if(editada.rows.length === 0){
            return res.status(404).json({mensaje: "esa bebida no existe"});
        }

        res.json(editada.rows[0]);
    } catch(error){
        if(responderErrorDeBase(error, res)){
            return;
        }
        console.error(error);
        res.status(500).json({mensaje: "no se pudo editar la bebida"});
    }
};

export const eliminarBebida = async (req, res) => {
    try{
        const idBebida = parseId(req.params.idBebida);
        if(idBebida === null){
            return res.status(400).json({mensaje: "el id de la bebida no es valido"});
        }
        const borrada = await pool.query(`DELETE FROM bebida WHERE id_boliche = $1 AND id_bebida = $2 RETURNING imagen`, [req.boliche.id_boliche, idBebida]);
        if(borrada.rows.length === 0){
            return res.status(404).json({mensaje: "esa bebida no existe"});
        }
        await borrarImagen(borrada.rows[0].imagen);

        res.json({mensaje: "bebida eliminada"});
    } catch(error){
        console.error(error);
        res.status(500).json({mensaje: "no se pudo eliminar la bebida"});
    }
};

// Foto de la bebida (opcional): sube o reemplaza la imagen, o la quita.
export const subirImagenBebida = async (req, res) => {
    let url = null;
    try{
        const idBebida = parseId(req.params.idBebida);
        if(idBebida === null){
            return res.status(400).json({mensaje: "el id de la bebida no es valido"});
        }
        const actual = await pool.query(`SELECT imagen FROM bebida WHERE id_boliche = $1 AND id_bebida = $2`, [req.boliche.id_boliche, idBebida]);
        if(actual.rows.length === 0){
            return res.status(404).json({mensaje: "esa bebida no existe"});
        }

        url = await guardarImagen(`bebidas/${req.boliche.id_boliche}`, req.imagen.buffer, req.imagen.extension);
        const editada = await pool.query(`UPDATE bebida SET imagen = $1 WHERE id_boliche = $2 AND id_bebida = $3 RETURNING ${CAMPOS}`, [url, req.boliche.id_boliche, idBebida]);
        await borrarImagen(actual.rows[0].imagen);

        res.status(201).json(editada.rows[0]);
    } catch(error){
        await borrarImagen(url);
        console.error(error);
        res.status(500).json({mensaje: "no se pudo subir la imagen"});
    }
};

export const borrarImagenBebida = async (req, res) => {
    try{
        const idBebida = parseId(req.params.idBebida);
        if(idBebida === null){
            return res.status(400).json({mensaje: "el id de la bebida no es valido"});
        }
        const actual = await pool.query(`SELECT imagen FROM bebida WHERE id_boliche = $1 AND id_bebida = $2`, [req.boliche.id_boliche, idBebida]);
        if(actual.rows.length === 0){
            return res.status(404).json({mensaje: "esa bebida no existe"});
        }
        const editada = await pool.query(`UPDATE bebida SET imagen = NULL WHERE id_boliche = $1 AND id_bebida = $2 RETURNING ${CAMPOS}`, [req.boliche.id_boliche, idBebida]);
        await borrarImagen(actual.rows[0].imagen);

        res.json(editada.rows[0]);
    } catch(error){
        console.error(error);
        res.status(500).json({mensaje: "no se pudo borrar la imagen"});
    }
};
