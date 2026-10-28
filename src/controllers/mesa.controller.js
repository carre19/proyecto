import pool from "../data/db.js";
import { numeroOpcional, parseId, textoObligatorio, textoOpcional } from "../utils/validaciones.js";
import { responderErrorDeBase } from "../utils/usuarios.js";
import { borrarImagen, guardarImagen } from "../utils/imagenes.js";

// Mesas VIP de un boliche (el catálogo) y cuáles ofrece cada evento. Precios en pesos, números enteros.
const CAMPOS = "id_mesa, nombre, capacidad, precio, descripcion, imagen, activa";
const ESTADOS_EVENTO = ["disponible", "reservada"];

const validarMesa = (body, parcial) => {
    const datos = {};
    const hay = (campo) => body?.[campo] !== undefined;

    if(!parcial || hay("nombre")){
        const nombre = textoObligatorio(body?.nombre, "el nombre", 60);
        if(nombre.error){
            return {error: nombre.error};
        }
        datos.nombre = nombre.valor;
    }
    for(const [campo, etiqueta, minimo, maximo] of [["capacidad", "la capacidad", 1, 200], ["precio", "el precio", 0, 100000000]]){
        if(!parcial || hay(campo)){
            const numero = numeroOpcional(body?.[campo], etiqueta, {min: minimo, max: maximo, entero: true});
            if(numero.error || numero.valor === null){
                return {error: numero.error ?? `${etiqueta} es obligatoria`};
            }
            datos[campo] = numero.valor;
        }
    }
    if(hay("descripcion")){
        const descripcion = textoOpcional(body.descripcion, "la descripcion", 400);
        if(descripcion.error){
            return {error: descripcion.error};
        }
        datos.descripcion = descripcion.valor;
    }
    if(hay("activa")){
        if(typeof body.activa !== "boolean"){
            return {error: "activa debe ser verdadero o falso"};
        }
        datos.activa = body.activa;
    }

    return {datos};
};

export const listarMesas = async (req, res) => {
    try{
        const mesas = await pool.query(`SELECT ${CAMPOS} FROM mesa_vip WHERE id_boliche = $1 ORDER BY precio, nombre`, [req.boliche.id_boliche]);

        res.json(mesas.rows);
    } catch(error){
        console.error(error);
        res.status(500).json({mensaje: "no se pudieron obtener las mesas VIP"});
    }
};

export const crearMesa = async (req, res) => {
    try{
        const {error, datos} = validarMesa(req.body, false);
        if(error){
            return res.status(400).json({mensaje: error});
        }

        const creada = await pool.query(`
            INSERT INTO mesa_vip (id_boliche, nombre, capacidad, precio, descripcion, activa)
            VALUES ($1, $2, $3, $4, $5, COALESCE($6, true)) RETURNING ${CAMPOS}`,
            [req.boliche.id_boliche, datos.nombre, datos.capacidad, datos.precio, datos.descripcion ?? null, datos.activa ?? null]);

        res.status(201).json(creada.rows[0]);
    } catch(error){
        if(responderErrorDeBase(error, res)){
            return;
        }
        console.error(error);
        res.status(500).json({mensaje: "no se pudo crear la mesa"});
    }
};

export const editarMesa = async (req, res) => {
    try{
        const idMesa = parseId(req.params.idMesa);
        if(idMesa === null){
            return res.status(400).json({mensaje: "el id de la mesa no es valido"});
        }
        const {error, datos} = validarMesa(req.body, true);
        if(error){
            return res.status(400).json({mensaje: error});
        }
        const campos = Object.keys(datos);
        if(campos.length === 0){
            return res.status(400).json({mensaje: "no hay nada para modificar"});
        }

        const asignaciones = campos.map((campo, i) => `${campo} = $${i + 1}`).join(", ");
        const editada = await pool.query(
            `UPDATE mesa_vip SET ${asignaciones} WHERE id_boliche = $${campos.length + 1} AND id_mesa = $${campos.length + 2} RETURNING ${CAMPOS}`,
            [...campos.map((c) => datos[c]), req.boliche.id_boliche, idMesa]);
        if(editada.rows.length === 0){
            return res.status(404).json({mensaje: "esa mesa no existe"});
        }

        res.json(editada.rows[0]);
    } catch(error){
        if(responderErrorDeBase(error, res)){
            return;
        }
        console.error(error);
        res.status(500).json({mensaje: "no se pudo editar la mesa"});
    }
};

// Borrar una mesa también la saca de los eventos que la ofrecían (lo hace la base).
export const eliminarMesa = async (req, res) => {
    try{
        const idMesa = parseId(req.params.idMesa);
        if(idMesa === null){
            return res.status(400).json({mensaje: "el id de la mesa no es valido"});
        }
        const borrada = await pool.query(`DELETE FROM mesa_vip WHERE id_boliche = $1 AND id_mesa = $2 RETURNING imagen`, [req.boliche.id_boliche, idMesa]);
        if(borrada.rows.length === 0){
            return res.status(404).json({mensaje: "esa mesa no existe"});
        }
        await borrarImagen(borrada.rows[0].imagen);

        res.json({mensaje: "mesa eliminada"});
    } catch(error){
        console.error(error);
        res.status(500).json({mensaje: "no se pudo eliminar la mesa"});
    }
};

export const subirImagenMesa = async (req, res) => {
    let url = null;
    try{
        const idMesa = parseId(req.params.idMesa);
        if(idMesa === null){
            return res.status(400).json({mensaje: "el id de la mesa no es valido"});
        }
        const actual = await pool.query(`SELECT imagen FROM mesa_vip WHERE id_boliche = $1 AND id_mesa = $2`, [req.boliche.id_boliche, idMesa]);
        if(actual.rows.length === 0){
            return res.status(404).json({mensaje: "esa mesa no existe"});
        }

        url = await guardarImagen(`mesas/${req.boliche.id_boliche}`, req.imagen.buffer, req.imagen.extension);
        const editada = await pool.query(`UPDATE mesa_vip SET imagen = $1 WHERE id_boliche = $2 AND id_mesa = $3 RETURNING ${CAMPOS}`, [url, req.boliche.id_boliche, idMesa]);
        await borrarImagen(actual.rows[0].imagen);

        res.status(201).json(editada.rows[0]);
    } catch(error){
        await borrarImagen(url);
        console.error(error);
        res.status(500).json({mensaje: "no se pudo subir la imagen"});
    }
};

export const borrarImagenMesa = async (req, res) => {
    try{
        const idMesa = parseId(req.params.idMesa);
        if(idMesa === null){
            return res.status(400).json({mensaje: "el id de la mesa no es valido"});
        }
        const actual = await pool.query(`SELECT imagen FROM mesa_vip WHERE id_boliche = $1 AND id_mesa = $2`, [req.boliche.id_boliche, idMesa]);
        if(actual.rows.length === 0){
            return res.status(404).json({mensaje: "esa mesa no existe"});
        }
        const editada = await pool.query(`UPDATE mesa_vip SET imagen = NULL WHERE id_boliche = $1 AND id_mesa = $2 RETURNING ${CAMPOS}`, [req.boliche.id_boliche, idMesa]);
        await borrarImagen(actual.rows[0].imagen);

        res.json(editada.rows[0]);
    } catch(error){
        console.error(error);
        res.status(500).json({mensaje: "no se pudo borrar la imagen"});
    }
};

// ---------- Qué mesas ofrece cada evento ----------

const eventoDelBoliche = async (req, res) => {
    const idEvento = parseId(req.params.idEvento);
    if(idEvento === null){
        res.status(400).json({mensaje: "el id del evento no es valido"});
        return null;
    }
    const evento = await pool.query(`SELECT id_evento FROM evento WHERE id_boliche = $1 AND id_evento = $2`, [req.boliche.id_boliche, idEvento]);
    if(evento.rows.length === 0){
        res.status(404).json({mensaje: "ese evento no existe"});
        return null;
    }

    return idEvento;
};

// Todas las mesas activas del boliche, indicando cuáles ofrece este evento y en qué estado (ofrecida: false = no la ofrece).
const mesasDelEvento = async (idBoliche, idEvento) => (await pool.query(`
    SELECT m.id_mesa, m.nombre, m.capacidad, m.precio, m.imagen, (x.id_mesa IS NOT NULL) AS ofrecida, x.estado
    FROM mesa_vip m
    LEFT JOIN evento_mesa_vip x ON x.id_boliche = m.id_boliche AND x.id_mesa = m.id_mesa AND x.id_evento = $2
    WHERE m.id_boliche = $1 AND m.activa
    ORDER BY m.precio, m.nombre`, [idBoliche, idEvento])).rows;

export const listarMesasDelEvento = async (req, res) => {
    try{
        const idEvento = await eventoDelBoliche(req, res);
        if(idEvento === null){
            return;
        }

        res.json(await mesasDelEvento(req.boliche.id_boliche, idEvento));
    } catch(error){
        console.error(error);
        res.status(500).json({mensaje: "no se pudieron obtener las mesas del evento"});
    }
};

// Cuerpo: {ofrecida: true|false, estado?: "disponible"|"reservada"}. Con ofrecida: false la mesa deja de ofrecerse en ese evento.
export const ofrecerMesa = async (req, res) => {
    try{
        const idEvento = await eventoDelBoliche(req, res);
        if(idEvento === null){
            return;
        }
        const idMesa = parseId(req.params.idMesa);
        if(idMesa === null){
            return res.status(400).json({mensaje: "el id de la mesa no es valido"});
        }
        const {ofrecida, estado} = req.body ?? {};
        if(typeof ofrecida !== "boolean"){
            return res.status(400).json({mensaje: "indicá si el evento ofrece la mesa (ofrecida: true o false)"});
        }
        if(estado !== undefined && !ESTADOS_EVENTO.includes(estado)){
            return res.status(400).json({mensaje: `el estado debe ser uno de: ${ESTADOS_EVENTO.join(", ")}`});
        }
        const mesa = await pool.query(`SELECT 1 FROM mesa_vip WHERE id_boliche = $1 AND id_mesa = $2 AND activa`, [req.boliche.id_boliche, idMesa]);
        if(mesa.rows.length === 0){
            return res.status(404).json({mensaje: "esa mesa no existe o está desactivada"});
        }

        if(ofrecida){
            await pool.query(`
                INSERT INTO evento_mesa_vip (id_boliche, id_evento, id_mesa, estado) VALUES ($1, $2, $3, COALESCE($4, 'disponible'))
                ON CONFLICT (id_evento, id_mesa) DO UPDATE SET estado = COALESCE($4, evento_mesa_vip.estado)`,
                [req.boliche.id_boliche, idEvento, idMesa, estado ?? null]);
        } else {
            await pool.query(`DELETE FROM evento_mesa_vip WHERE id_boliche = $1 AND id_evento = $2 AND id_mesa = $3`, [req.boliche.id_boliche, idEvento, idMesa]);
        }

        res.json(await mesasDelEvento(req.boliche.id_boliche, idEvento));
    } catch(error){
        if(responderErrorDeBase(error, res)){
            return;
        }
        console.error(error);
        res.status(500).json({mensaje: "no se pudo modificar la mesa del evento"});
    }
};
