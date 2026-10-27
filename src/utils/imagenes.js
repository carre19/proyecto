import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

// Imágenes subidas (fotos de los boliches y flyers de los eventos). Se guardan en disco, en UPLOADS_DIR
// (por defecto la carpeta "uploads" del proyecto, que no se sube a GitHub), y se sirven en /api/uploads/...
// Lo que se guarda en la base es solo la ruta pública (por ejemplo /api/uploads/boliches/3/ab12.jpg).
export const DIR_UPLOADS = path.resolve(process.env.UPLOADS_DIR || "uploads");
export const URL_UPLOADS = "/api/uploads";
export const TAMANO_MAXIMO = 5 * 1024 * 1024; // 5 MB
export const TIPOS = ["image/jpeg", "image/png", "image/webp"];

// Reconoce el formato mirando los primeros bytes del archivo, NO lo que dice el cliente: así nadie sube
// un programa o un HTML disfrazado de imagen. Devuelve la extensión o null si no es JPG, PNG o WebP.
export const detectarFormato = (b) => {
    if(!Buffer.isBuffer(b) || b.length < 12){
        return null;
    }
    if(b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff){
        return "jpg";
    }
    if(b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))){
        return "png";
    }
    if(b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP"){
        return "webp";
    }

    return null;
};

// Guarda la imagen en uploads/<carpeta>/ con un nombre al azar y devuelve su ruta pública.
export const guardarImagen = async (carpeta, buffer, extension) => {
    const dir = path.join(DIR_UPLOADS, carpeta);
    await fs.mkdir(dir, {recursive: true});
    const archivo = `${crypto.randomUUID()}.${extension}`;
    await fs.writeFile(path.join(dir, archivo), buffer, {flag: "wx"});

    return `${URL_UPLOADS}/${carpeta}/${archivo}`;
};

// Borra el archivo de una ruta pública. Solo toca archivos dentro de UPLOADS_DIR; si no existe, no pasa nada.
export const borrarImagen = async (url) => {
    if(typeof url !== "string" || !url.startsWith(`${URL_UPLOADS}/`)){
        return;
    }
    const destino = path.resolve(DIR_UPLOADS, url.slice(URL_UPLOADS.length + 1));
    if(!destino.startsWith(DIR_UPLOADS + path.sep)){
        return;
    }
    await fs.rm(destino, {force: true});
};
