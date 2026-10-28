import pool from "../data/db.js";
import { COLORES_POR_DEFECTO, MODOS, validarColores } from "../utils/colores.js";

// Colores de la página de cada boliche. Sin fila guardada, rigen los valores por defecto (negro y dorado).
// Solo se pueden elegir colores: la tipografía, la estructura y las secciones no cambian.
export const temaDe = async (db, idBoliche) => {
    const guardados = await db.query(`SELECT modo, fondo, tarjetas, texto, acento FROM boliche_tema WHERE id_boliche = $1`, [idBoliche]);
    const tema = {claro: {...COLORES_POR_DEFECTO.claro}, oscuro: {...COLORES_POR_DEFECTO.oscuro}, personalizado: {claro: false, oscuro: false}};
    for(const fila of guardados.rows){
        tema[fila.modo] = {fondo: fila.fondo, tarjetas: fila.tarjetas, texto: fila.texto, acento: fila.acento};
        tema.personalizado[fila.modo] = true;
    }

    return tema;
};

export const verTema = async (req, res) => {
    try{
        res.json({...(await temaDe(pool, req.boliche.id_boliche)), defecto: COLORES_POR_DEFECTO});
    } catch(error){
        console.error(error);
        res.status(500).json({mensaje: "no se pudieron obtener los colores"});
    }
};

// Guarda los colores de UN modo: {modo: "claro" | "oscuro", fondo, tarjetas, texto, acento}. Valida el contraste.
export const guardarTema = async (req, res) => {
    try{
        const modo = req.body?.modo;
        if(!MODOS.includes(modo)){
            return res.status(400).json({mensaje: `el modo debe ser uno de: ${MODOS.join(", ")}`});
        }
        const {error, colores} = validarColores(req.body);
        if(error){
            return res.status(400).json({mensaje: error});
        }

        await pool.query(`
            INSERT INTO boliche_tema (id_boliche, modo, fondo, tarjetas, texto, acento) VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id_boliche, modo) DO UPDATE SET fondo = $3, tarjetas = $4, texto = $5, acento = $6`,
            [req.boliche.id_boliche, modo, colores.fondo, colores.tarjetas, colores.texto, colores.acento]);

        res.json({...(await temaDe(pool, req.boliche.id_boliche)), defecto: COLORES_POR_DEFECTO});
    } catch(error){
        console.error(error);
        res.status(500).json({mensaje: "no se pudieron guardar los colores"});
    }
};

// Restablece el negro y dorado: de un modo (?modo=claro) o de los dos.
export const restablecerTema = async (req, res) => {
    try{
        const modo = req.query.modo;
        if(modo !== undefined && !MODOS.includes(modo)){
            return res.status(400).json({mensaje: `el modo debe ser uno de: ${MODOS.join(", ")}`});
        }
        await pool.query(`DELETE FROM boliche_tema WHERE id_boliche = $1 AND ($2::text IS NULL OR modo = $2)`, [req.boliche.id_boliche, modo ?? null]);

        res.json({...(await temaDe(pool, req.boliche.id_boliche)), defecto: COLORES_POR_DEFECTO});
    } catch(error){
        console.error(error);
        res.status(500).json({mensaje: "no se pudieron restablecer los colores"});
    }
};
