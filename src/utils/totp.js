import crypto from "node:crypto";

// Códigos de verificación en dos pasos (TOTP, RFC 6238): 6 números que cambian cada 30 segundos, los genera una app como
// Google Authenticator, Authy o Microsoft Authenticator a partir de un secreto que se comparte una sola vez (con un QR).
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const PASO_SEGUNDOS = 30;

export const nuevoSecreto = () => {
    const bytes = crypto.randomBytes(20);
    let bits = "";
    for (const b of bytes) bits += b.toString(2).padStart(8, "0");

    return bits.match(/.{1,5}/g).map((trozo) => BASE32[parseInt(trozo.padEnd(5, "0"), 2)]).join("");
};

const decodificar = (texto) => {
    let bits = "";
    for (const c of texto.replace(/=+$/, "").toUpperCase()) bits += BASE32.indexOf(c).toString(2).padStart(5, "0");

    return Buffer.from(bits.match(/.{8}/g).map((byte) => parseInt(byte, 2)));
};

const codigoDelPaso = (secreto, paso) => {
    const contador = Buffer.alloc(8);
    contador.writeBigUInt64BE(BigInt(paso));
    const hmac = crypto.createHmac("sha1", decodificar(secreto)).update(contador).digest();
    const desplazamiento = hmac[hmac.length - 1] & 0xf;
    const numero = ((hmac[desplazamiento] & 0x7f) << 24) | (hmac[desplazamiento + 1] << 16) | (hmac[desplazamiento + 2] << 8) | hmac[desplazamiento + 3];

    return String(numero % 1000000).padStart(6, "0");
};

export const pasoActual = (ahora = Date.now()) => Math.floor(ahora / 1000 / PASO_SEGUNDOS);

// Verifica un código aceptando el paso anterior y el siguiente (por si los relojes difieren unos segundos).
// Devuelve el paso en que coincidió, o null. "ultimoPaso" es el último ya usado: un código no se puede repetir.
export const verificarCodigo = (secreto, codigo, ultimoPaso = null, ahora = Date.now()) => {
    if (!/^\d{6}$/.test(String(codigo ?? ""))) return null;
    const actual = pasoActual(ahora);
    for (const paso of [actual, actual - 1, actual + 1]) {
        if (ultimoPaso !== null && paso <= Number(ultimoPaso)) continue;
        const esperado = Buffer.from(codigoDelPaso(secreto, paso));
        if (crypto.timingSafeEqual(esperado, Buffer.from(String(codigo)))) return paso;
    }

    return null;
};

export const codigoActual = (secreto, ahora = Date.now()) => codigoDelPaso(secreto, pasoActual(ahora));

export const urlOtpauth = (secreto, email) => `otpauth://totp/Noctis:${encodeURIComponent(email)}?secret=${secreto}&issuer=Noctis&digits=6&period=${PASO_SEGUNDOS}`;

// El secreto se guarda cifrado (AES-256-GCM) con una clave derivada de TOTP_CLAVE (o, si falta, de JWT_SECRET).
const clave = () => crypto.scryptSync(process.env.TOTP_CLAVE || process.env.JWT_SECRET, "noctis-totp", 32);

export const cifrar = (texto) => {
    const iv = crypto.randomBytes(12);
    const cifrador = crypto.createCipheriv("aes-256-gcm", clave(), iv);
    const datos = Buffer.concat([cifrador.update(texto, "utf8"), cifrador.final()]);

    return [iv, cifrador.getAuthTag(), datos].map((b) => b.toString("base64")).join(".");
};

export const descifrar = (guardado) => {
    const [iv, etiqueta, datos] = guardado.split(".").map((p) => Buffer.from(p, "base64"));
    const descifrador = crypto.createDecipheriv("aes-256-gcm", clave(), iv);
    descifrador.setAuthTag(etiqueta);

    return Buffer.concat([descifrador.update(datos), descifrador.final()]).toString("utf8");
};

export const nuevosCodigosDeRecuperacion = (cantidad = 8) => Array.from({ length: cantidad }, () => {
    const c = crypto.randomBytes(5).toString("hex").toUpperCase();
    return `${c.slice(0, 5)}-${c.slice(5)}`;
});
export const huellaDe = (codigo) => crypto.createHash("sha256").update(String(codigo).replace(/[^0-9A-Za-z]/g, "").toUpperCase()).digest("hex");
