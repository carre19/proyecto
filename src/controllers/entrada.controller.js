import pool from "../data/db.js";
import { numeroOpcional, parseId, textoObligatorio } from "../utils/validaciones.js";
import { responderErrorDeBase } from "../utils/usuarios.js";

// Entradas de un evento: tandas y VIP, con precio virtual (el de la página) y de puerta, cupo y estado.
// La base garantiza que la suma de los cupos no supere la capacidad del boliche.
const TIPOS = ["tanda", "vip"];
const ESTADOS = ["disponible", "agotada", "no_disponible"];
const SELECT_ENTRADAS = `SELECT id_tipo_entrada, id_evento, nombre, tipo, precio_virtual, precio_puerta, cupo, estado, orden FROM tipo_entrada`;

// El evento tiene que ser de este boliche: uno de otro local responde 404.
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

// Valida los datos de una entrada. "parcial" = solo lo que vino (para editar). Devuelve {error} o {datos}.
const validarEntrada = (body, parcial) => {
    const datos = {};
    const hay = (campo) => body?.[campo] !== undefined;

    if(!parcial || hay("nombre")){
        const nombre = textoObligatorio(body?.nombre, "el nombre", 60);
        if(nombre.error){
            return {error: nombre.error};
        }
        datos.nombre = nombre.valor;
    }
    if(hay("tipo")){
        if(!TIPOS.includes(body.tipo)){
            return {error: `el tipo debe ser uno de: ${TIPOS.join(", ")}`};
        }
        datos.tipo = body.tipo;
    }
    for(const [campo, etiqueta, minimo, maximo] of [["precio_virtual", "el precio virtual", 0, 100000000], ["precio_puerta", "el precio de puerta", 0, 100000000], ["cupo", "el cupo", 1, 1000000], ["orden", "el orden", 0, 1000]]){
        if(!parcial && campo !== "orden" && !hay(campo)){
            return {error: `${etiqueta} es obligatorio`};
        }
        if(hay(campo)){
            const numero = numeroOpcional(body[campo], etiqueta, {min: minimo, max: maximo, entero: true});
            if(numero.error || numero.valor === null){
                return {error: numero.error ?? `${etiqueta} no es valido`};
            }
            datos[campo] = numero.valor;
        }
    }
    if(hay("estado")){
        if(!ESTADOS.includes(body.estado)){
            return {error: `el estado debe ser uno de: ${ESTADOS.join(", ")}`};
        }
        datos.estado = body.estado;
    }

    return {datos};
};

export const listarEntradas = async (req, res) => {
    try{
        const idEvento = await eventoDelBoliche(req, res);
        if(idEvento === null){
            return;
        }
        const entradas = await pool.query(`${SELECT_ENTRADAS} WHERE id_boliche = $1 AND id_evento = $2 ORDER BY orden, id_tipo_entrada`, [req.boliche.id_boliche, idEvento]);

        res.json(entradas.rows);
    } catch(error){
        console.error(error);
        res.status(500).json({mensaje: "no se pudieron obtener las entradas"});
    }
};

export const crearEntrada = async (req, res) => {
    try{
        const idEvento = await eventoDelBoliche(req, res);
        if(idEvento === null){
            return;
        }
        const {error, datos} = validarEntrada(req.body, false);
        if(error){
            return res.status(400).json({mensaje: error});
        }

        const creada = await pool.query(`
            INSERT INTO tipo_entrada (id_boliche, id_evento, nombre, tipo, precio_virtual, precio_puerta, cupo, estado, orden)
            VALUES ($1, $2, $3, COALESCE($4, 'tanda'), $5, $6, $7, COALESCE($8, 'disponible'), COALESCE($9, 0))
            RETURNING id_tipo_entrada, id_evento, nombre, tipo, precio_virtual, precio_puerta, cupo, estado, orden`,
            [req.boliche.id_boliche, idEvento, datos.nombre, datos.tipo ?? null, datos.precio_virtual, datos.precio_puerta, datos.cupo, datos.estado ?? null, datos.orden ?? null]);

        res.status(201).json(creada.rows[0]);
    } catch(error){
        if(responderErrorDeBase(error, res)){
            return;
        }
        console.error(error);
        res.status(500).json({mensaje: "no se pudo crear la entrada"});
    }
};

export const editarEntrada = async (req, res) => {
    try{
        const idEvento = await eventoDelBoliche(req, res);
        if(idEvento === null){
            return;
        }
        const idEntrada = parseId(req.params.idEntrada);
        if(idEntrada === null){
            return res.status(400).json({mensaje: "el id de la entrada no es valido"});
        }
        const {error, datos} = validarEntrada(req.body, true);
        if(error){
            return res.status(400).json({mensaje: error});
        }
        const campos = Object.keys(datos);
        if(campos.length === 0){
            return res.status(400).json({mensaje: "no hay nada para modificar"});
        }

        if(datos.estado !== undefined){
            // El estado puesto a mano manda: deja de ser una "agotada sola".
            campos.push("agotada_auto");
            datos.agotada_auto = false;
        }
        const asignaciones = campos.map((campo, i) => `${campo} = $${i + 1}`).join(", ");
        const editada = await pool.query(
            `UPDATE tipo_entrada SET ${asignaciones} WHERE id_boliche = $${campos.length + 1} AND id_evento = $${campos.length + 2} AND id_tipo_entrada = $${campos.length + 3}
             RETURNING id_tipo_entrada, id_evento, nombre, tipo, precio_virtual, precio_puerta, cupo, estado, orden`,
            [...campos.map((c) => datos[c]), req.boliche.id_boliche, idEvento, idEntrada]);
        if(editada.rows.length === 0){
            return res.status(404).json({mensaje: "esa entrada no existe"});
        }

        res.json(editada.rows[0]);
    } catch(error){
        if(responderErrorDeBase(error, res)){
            return;
        }
        console.error(error);
        res.status(500).json({mensaje: "no se pudo editar la entrada"});
    }
};

export const eliminarEntrada = async (req, res) => {
    try{
        const idEvento = await eventoDelBoliche(req, res);
        if(idEvento === null){
            return;
        }
        const idEntrada = parseId(req.params.idEntrada);
        if(idEntrada === null){
            return res.status(400).json({mensaje: "el id de la entrada no es valido"});
        }
        const borrada = await pool.query(`DELETE FROM tipo_entrada WHERE id_boliche = $1 AND id_evento = $2 AND id_tipo_entrada = $3 RETURNING id_tipo_entrada`, [req.boliche.id_boliche, idEvento, idEntrada]);
        if(borrada.rows.length === 0){
            return res.status(404).json({mensaje: "esa entrada no existe"});
        }

        res.json({mensaje: "entrada eliminada"});
    } catch(error){
        if(responderErrorDeBase(error, res)){
            return;
        }
        console.error(error);
        res.status(500).json({mensaje: "no se pudo eliminar la entrada"});
    }
};
