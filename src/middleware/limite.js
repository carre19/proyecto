// Limita cuántas veces una misma dirección IP puede usar una ruta en una ventana de tiempo (en memoria del servidor).
// Sirve para frenar abusos de las rutas públicas, por ejemplo reservar cupo con compras falsas.
export const limitar = (maximo, ventanaMs) => {
    const usos = new Map(); // ip -> [momentos]

    return (req, res, next) => {
        const ahora = Date.now();
        const ip = req.ip ?? "desconocida";
        const recientes = (usos.get(ip) ?? []).filter((momento) => ahora - momento < ventanaMs);
        if (recientes.length >= maximo) {
            res.setHeader("Retry-After", Math.ceil((ventanaMs - (ahora - recientes[0])) / 1000));
            return res.status(429).json({ mensaje: "Hiciste muchos intentos seguidos. Esperá unos minutos y volvé a probar." });
        }
        recientes.push(ahora);
        usos.set(ip, recientes);
        // De vez en cuando se limpian las direcciones que ya no cuentan.
        if (usos.size > 5000) for (const [clave, momentos] of usos) if (momentos.every((m) => ahora - m >= ventanaMs)) usos.delete(clave);
        next();
    };
};
