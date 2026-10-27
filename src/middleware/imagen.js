import express from "express";
import { TAMANO_MAXIMO, TIPOS, detectarFormato } from "../utils/imagenes.js";

// Recibe una imagen como cuerpo de la petición (Content-Type image/jpeg, image/png o image/webp, hasta 5 MB)
// y deja en req.imagen { buffer, extension }. Rechaza todo lo que no sea una imagen de verdad.
const leerCuerpo = express.raw({type: TIPOS, limit: TAMANO_MAXIMO});

export const recibirImagen = [
    leerCuerpo,
    (req, res, next) => {
        if(!Buffer.isBuffer(req.body) || req.body.length === 0){
            return res.status(415).json({mensaje: "mandá la imagen como cuerpo de la petición, con tipo image/jpeg, image/png o image/webp"});
        }
        const extension = detectarFormato(req.body);
        if(!extension){
            return res.status(415).json({mensaje: "el archivo no es una imagen JPG, PNG o WebP valida"});
        }

        req.imagen = {buffer: req.body, extension};
        next();
    },
];
