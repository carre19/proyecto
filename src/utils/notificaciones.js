// Avisos al cliente cuando se confirma su pago (fase 3). Se encolan en la tabla "notificacion" dentro de la misma
// transacción que confirma el pago, y se envían aparte: así un fallo del servicio de mensajes nunca deshace un pago.
//
// Los envíos reales se conectan por HTTP (cualquier proveedor de WhatsApp o de email que acepte un POST con JSON):
//   WHATSAPP_API_URL (+ WHATSAPP_API_TOKEN)  -> recibe {to, message}
//   EMAIL_API_URL    (+ EMAIL_API_TOKEN)     -> recibe {to, subject, text}
// Sin esas variables el aviso queda registrado como "simulada" (no sale ningún mensaje).
const MAXIMO_INTENTOS = 5;
const FRONTEND = () => (process.env.FRONTEND_PUBLIC_URL || process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");

// Encola el aviso de pago confirmado para cada medio de contacto que dejó el comprador.
export const encolarAvisoPago = async (client, compra) => {
    const destinos = [["whatsapp", compra.contacto_telefono], ["email", compra.contacto_email]].filter(([, destino]) => destino);
    if (destinos.length === 0) return;
    const datos = (await client.query(`
        SELECT e.nombre AS evento, e.fecha_hora, b.nombre AS boliche FROM evento e JOIN boliche b ON b.id_boliche = e.id_boliche
         WHERE e.id_boliche = $1 AND e.id_evento = $2`, [compra.id_boliche, compra.id_evento])).rows[0];
    const link = `${FRONTEND()}/compra/${compra.token_publico}`;
    const mensaje = `¡Pago confirmado! Tus entradas para ${datos.evento} en ${datos.boliche} ya están listas. Presentá el QR en la puerta (cada QR sirve una sola vez y la entrada es personal): ${link}`;

    for (const [canal, destino] of destinos) {
        await client.query(`
            INSERT INTO notificacion (id_boliche, id_compra, canal, destino, asunto, mensaje) VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id_compra, tipo, canal) DO NOTHING`,
            [compra.id_boliche, compra.id_compra, canal, destino, canal === "email" ? `Tus entradas para ${datos.evento}` : null, mensaje]);
    }
};

const enviarPorHttp = async (url, token, cuerpo) => {
    const respuesta = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(cuerpo),
        signal: AbortSignal.timeout(10000),
    });
    if (!respuesta.ok) throw new Error(`el servicio respondió ${respuesta.status}`);
};

// Envía los avisos pendientes (los más viejos primero). Devuelve cuántos procesó. Toma las filas con FOR UPDATE SKIP LOCKED
// dentro de una transacción: si dos envíos corren a la vez, cada aviso lo manda uno solo.
export const despacharPendientes = async (pool, limite = 20) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const pendientes = (await client.query(`SELECT * FROM notificacion WHERE estado = 'pendiente' ORDER BY creada_en LIMIT $1 FOR UPDATE SKIP LOCKED`, [limite])).rows;

        for (const n of pendientes) {
            const url = n.canal === "whatsapp" ? process.env.WHATSAPP_API_URL : process.env.EMAIL_API_URL;
            const token = n.canal === "whatsapp" ? process.env.WHATSAPP_API_TOKEN : process.env.EMAIL_API_TOKEN;
            try {
                if (!url) {
                    await client.query(`UPDATE notificacion SET estado = 'simulada', enviada_en = now() WHERE id_notificacion = $1`, [n.id_notificacion]);
                    continue;
                }
                await enviarPorHttp(url, token, n.canal === "whatsapp" ? { to: n.destino, message: n.mensaje } : { to: n.destino, subject: n.asunto, text: n.mensaje });
                await client.query(`UPDATE notificacion SET estado = 'enviada', enviada_en = now(), error = NULL WHERE id_notificacion = $1`, [n.id_notificacion]);
            } catch (error) {
                const intentos = n.intentos + 1;
                await client.query(`UPDATE notificacion SET intentos = $2, error = $3, estado = $4 WHERE id_notificacion = $1`,
                    [n.id_notificacion, intentos, String(error.message).slice(0, 300), intentos >= MAXIMO_INTENTOS ? "fallida" : "pendiente"]);
            }
        }
        await client.query("COMMIT");

        return pendientes.length;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};
