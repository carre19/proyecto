import pool from "../data/db.js";
import { parseId } from "../utils/validaciones.js";
import { responderErrorDeBase } from "../utils/usuarios.js";
import { borrarImagen, guardarImagen } from "../utils/imagenes.js";

// Fotos de un boliche: una es la portada y el resto forma la galería. Hasta 10 (lo controla la base).
// Las fotos de un boliche solo se ven y se tocan por su propio /boliches/:id (accesoBoliche ya verificó el acceso).
const SELECT_FOTOS = `SELECT id_foto, url, es_portada, orden FROM boliche_foto WHERE id_boliche = $1 ORDER BY es_portada DESC, orden, id_foto`;

const fotosDe = async (db, idBoliche) => (await db.query(SELECT_FOTOS, [idBoliche])).rows;

export const listarFotos = async (req, res) => {
    try {
        res.json(await fotosDe(pool, req.boliche.id_boliche));
    } catch(error){
        console.error(error);
        res.status(500).json({mensaje: "no se pudieron obtener las fotos"});
    }
};

// Sube una foto (el cuerpo es la imagen). La primera del boliche queda de portada.
export const subirFoto = async (req, res) => {
    let url = null;
    try{
        const idBoliche = req.boliche.id_boliche;
        url = await guardarImagen(`boliches/${idBoliche}`, req.imagen.buffer, req.imagen.extension);
        await pool.query(`
            INSERT INTO boliche_foto (id_boliche, url, es_portada, orden)
            VALUES ($1, $2, NOT EXISTS (SELECT 1 FROM boliche_foto WHERE id_boliche = $1 AND es_portada),
                    COALESCE((SELECT max(orden) + 1 FROM boliche_foto WHERE id_boliche = $1), 1))`, [idBoliche, url]);

        res.status(201).json(await fotosDe(pool, idBoliche));
    } catch(error){
        await borrarImagen(url); // si no se pudo anotar en la base (por ejemplo, ya hay 10 fotos), no queda un archivo huérfano
        if(responderErrorDeBase(error, res)){
            return;
        }
        console.error(error);
        res.status(500).json({mensaje: "no se pudo subir la foto"});
    }
};

// Marca la portada ({es_portada: true}) y/o cambia el orden ({orden: n}).
export const editarFoto = async (req, res) => {
    const cliente = await pool.connect();
    try{
        const idFoto = parseId(req.params.idFoto);
        if(idFoto === null){
            return res.status(400).json({mensaje: "el id de la foto no es valido"});
        }
        const {es_portada: portada, orden} = req.body ?? {};
        if(portada !== undefined && typeof portada !== "boolean"){
            return res.status(400).json({mensaje: "es_portada debe ser verdadero o falso"});
        }
        if(orden !== undefined && (!Number.isInteger(orden) || orden < 0 || orden > 100)){
            return res.status(400).json({mensaje: "el orden debe ser un entero entre 0 y 100"});
        }
        if(portada === undefined && orden === undefined){
            return res.status(400).json({mensaje: "no hay nada para modificar"});
        }
        if(portada === false){
            return res.status(400).json({mensaje: "para cambiar la portada, marcá otra foto como portada"});
        }

        await cliente.query("BEGIN");
        const foto = await cliente.query(`SELECT 1 FROM boliche_foto WHERE id_boliche = $1 AND id_foto = $2 FOR UPDATE`, [req.boliche.id_boliche, idFoto]);
        if(foto.rows.length === 0){
            await cliente.query("ROLLBACK");
            return res.status(404).json({mensaje: "esa foto no está en este boliche"});
        }
        if(portada === true){
            await cliente.query(`UPDATE boliche_foto SET es_portada = false WHERE id_boliche = $1 AND es_portada`, [req.boliche.id_boliche]);
            await cliente.query(`UPDATE boliche_foto SET es_portada = true WHERE id_foto = $1`, [idFoto]);
        }
        if(orden !== undefined){
            await cliente.query(`UPDATE boliche_foto SET orden = $1 WHERE id_foto = $2`, [orden, idFoto]);
        }
        await cliente.query("COMMIT");

        res.json(await fotosDe(pool, req.boliche.id_boliche));
    } catch(error){
        await cliente.query("ROLLBACK");
        if(responderErrorDeBase(error, res)){
            return;
        }
        console.error(error);
        res.status(500).json({mensaje: "no se pudo modificar la foto"});
    } finally{
        cliente.release();
    }
};

// Borra una foto (de la base y del disco). Si era la portada, otra foto pasa a serlo.
export const borrarFoto = async (req, res) => {
    const cliente = await pool.connect();
    try{
        const idFoto = parseId(req.params.idFoto);
        if(idFoto === null){
            return res.status(400).json({mensaje: "el id de la foto no es valido"});
        }

        await cliente.query("BEGIN");
        const borrada = await cliente.query(`DELETE FROM boliche_foto WHERE id_boliche = $1 AND id_foto = $2 RETURNING url, es_portada`, [req.boliche.id_boliche, idFoto]);
        if(borrada.rows.length === 0){
            await cliente.query("ROLLBACK");
            return res.status(404).json({mensaje: "esa foto no está en este boliche"});
        }
        if(borrada.rows[0].es_portada){
            await cliente.query(`
                UPDATE boliche_foto SET es_portada = true
                WHERE id_foto = (SELECT id_foto FROM boliche_foto WHERE id_boliche = $1 ORDER BY orden, id_foto LIMIT 1)`, [req.boliche.id_boliche]);
        }
        await cliente.query("COMMIT");
        await borrarImagen(borrada.rows[0].url);

        res.json(await fotosDe(pool, req.boliche.id_boliche));
    } catch(error){
        await cliente.query("ROLLBACK");
        console.error(error);
        res.status(500).json({mensaje: "no se pudo borrar la foto"});
    } finally{
        cliente.release();
    }
};
