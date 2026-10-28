import crypto from "node:crypto";
import { REGEX_DNI, REGEX_EMAIL, textoObligatorio, textoOpcional } from "./validaciones.js";

// Reglas de la venta de entradas (fase 2). Los precios son pesos enteros.
export const PORCENTAJE_PLATAFORMA = Number(process.env.PORCENTAJE_PLATAFORMA ?? 6); // lo paga el cliente, sobre las compras de la página
export const MINUTOS_RESERVA = Number(process.env.MINUTOS_RESERVA ?? 30); // tiempo para pagar antes de que se libere el cupo
export const MAXIMO_POR_COMPRA = 10;
export const METODOS_PUERTA = ["efectivo", "qr", "transferencia"];

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O ni 1/I para que se pueda dictar
export const nuevaReferencia = () => "NX" + [...crypto.randomBytes(6)].map((b) => ALFABETO[b % ALFABETO.length]).join("");
export const nuevoToken = () => crypto.randomBytes(20).toString("hex");
export const nuevoCodigo = () => crypto.randomBytes(16).toString("hex");

// Cargo de la plataforma sobre un monto (redondeado hacia arriba).
export const cargoPlataforma = (monto) => Math.ceil((monto * PORCENTAJE_PLATAFORMA) / 100);

// Solo los roles que la documentación autoriza ven el DNI de los clientes (admin, RRPP manager y RRPP).
export const puedeVerDni = (rol) => ["admin", "rrpp_manager", "rrpp"].includes(rol);
export const enmascarar = (dni) => (dni ? `${"*".repeat(Math.max(0, dni.length - 3))}${dni.slice(-3)}` : dni);

// Cancela las compras vencidas (libera su cupo). Se llama antes de mirar disponibilidad.
export const liberarVencidas = (db) => db.query(`SELECT public.liberar_compras_vencidas()`);

// Ajusta "agotada" según lo vendido: se marca sola al venderse todo el cupo y vuelve a disponible si se libera
// (solo las que se marcaron solas; las que el admin marcó agotadas a mano no se tocan).
export const sincronizarAgotadas = async (db, idBoliche, idEvento) => {
    await db.query(`
        UPDATE tipo_entrada t SET estado = 'agotada', agotada_auto = true
         WHERE t.id_boliche = $1 AND t.id_evento = $2 AND t.estado = 'disponible'
           AND (SELECT count(*) FROM entrada e WHERE e.id_tipo_entrada = t.id_tipo_entrada AND e.estado <> 'anulada') >= t.cupo`, [idBoliche, idEvento]);
    await db.query(`
        UPDATE tipo_entrada t SET estado = 'disponible', agotada_auto = false
         WHERE t.id_boliche = $1 AND t.id_evento = $2 AND t.estado = 'agotada' AND t.agotada_auto
           AND (SELECT count(*) FROM entrada e WHERE e.id_tipo_entrada = t.id_tipo_entrada AND e.estado <> 'anulada') < t.cupo`, [idBoliche, idEvento]);
};

// Valida la lista de personas de una compra: [{id_tipo_entrada, nombre, apellido, dni}]. Devuelve {error} o {items} limpios.
export const validarItems = (items) => {
    if (!Array.isArray(items) || items.length === 0) return { error: "elegí al menos una entrada" };
    if (items.length > MAXIMO_POR_COMPRA) return { error: `se pueden comprar hasta ${MAXIMO_POR_COMPRA} entradas por vez` };

    const limpios = [];
    const dnis = new Set();
    for (const [i, item] of items.entries()) {
        const donde = `entrada ${i + 1}`;
        const idTipo = Number(item?.id_tipo_entrada);
        if (!Number.isInteger(idTipo) || idTipo < 1) return { error: `${donde}: elegí el tipo de entrada` };
        const nombre = textoObligatorio(item?.nombre, `${donde}: el nombre`, 100);
        const apellido = textoObligatorio(item?.apellido, `${donde}: el apellido`, 100);
        if (nombre.error || apellido.error) return { error: nombre.error ?? apellido.error };
        const dni = String(item?.dni ?? "").replace(/[.\s]/g, "");
        if (!REGEX_DNI.test(dni)) return { error: `${donde}: el DNI debe tener entre 7 y 9 números, sin puntos` };
        if (dnis.has(dni)) return { error: `el DNI ${dni} está repetido: la entrada es personal, una por persona` };
        dnis.add(dni);
        limpios.push({ id_tipo_entrada: idTipo, nombre: nombre.valor, apellido: apellido.valor, dni });
    }

    return { items: limpios };
};

// Contacto del comprador (para el aviso del pago): hace falta al menos un email o un teléfono. Devuelve {error} o {email, telefono}.
export const validarContacto = (body, obligatorio) => {
    const email = textoOpcional(body?.contacto_email, "el email", 150);
    const telefono = textoOpcional(body?.contacto_telefono, "el telefono", 30);
    if (email.error || telefono.error) return { error: email.error ?? telefono.error };
    if (email.valor && !REGEX_EMAIL.test(email.valor)) return { error: "el email no es valido" };
    if (telefono.valor && !/^[0-9+() \-]{6,30}$/.test(telefono.valor)) return { error: "el telefono no es valido" };
    if (obligatorio && !email.valor && !telefono.valor) return { error: "indicá un teléfono o un email para avisarte cuando se confirme el pago" };

    return { email: email.valor?.toLowerCase() ?? null, telefono: telefono.valor };
};

// Crea la compra y sus entradas DENTRO de una transacción ya abierta.
//   canal "web": precio virtual + cargo de la plataforma; queda pendiente hasta que se pague.
//   canal "puerta": precio de puerta, sin cargo.
// Bloquea las filas de los tipos de entrada para que dos compras a la vez no se pasen del cupo.
// Lanza {estado, mensaje} si algo no se puede vender.
export const crearCompra = async (client, { boliche, evento, items, canal, metodo, contacto, idCliente = null, idVendedor = null, idRrpp = null, descuento = 0 }) => {
    const falla = (estado, mensaje) => Object.assign(new Error(mensaje), { estado, mensaje });

    const idsTipos = [...new Set(items.map((i) => i.id_tipo_entrada))].sort((a, b) => a - b);
    const tipos = (await client.query(`
        SELECT id_tipo_entrada, nombre, precio_virtual, precio_puerta, cupo, estado FROM tipo_entrada
         WHERE id_boliche = $1 AND id_evento = $2 AND id_tipo_entrada = ANY($3) ORDER BY id_tipo_entrada FOR UPDATE`,
        [boliche.id_boliche, evento.id_evento, idsTipos])).rows;
    if (tipos.length !== idsTipos.length) throw falla(400, "alguna de las entradas no es de este evento");
    const porId = new Map(tipos.map((t) => [t.id_tipo_entrada, t]));

    for (const t of tipos) {
        const pedidas = items.filter((i) => i.id_tipo_entrada === t.id_tipo_entrada).length;
        if (t.estado !== "disponible") throw falla(409, `la entrada "${t.nombre}" no está disponible`);
        const vendidas = Number((await client.query(`SELECT count(*) FROM entrada WHERE id_tipo_entrada = $1 AND estado <> 'anulada'`, [t.id_tipo_entrada])).rows[0].count);
        if (vendidas + pedidas > t.cupo) {
            const quedan = Math.max(0, t.cupo - vendidas);
            throw falla(409, quedan === 0 ? `se agotó la entrada "${t.nombre}"` : `de la entrada "${t.nombre}" quedan ${quedan}`);
        }
    }

    const precioDe = (t) => (canal === "web" ? t.precio_virtual : t.precio_puerta);
    const subtotal = items.reduce((total, i) => total + precioDe(porId.get(i.id_tipo_entrada)), 0);
    const descuentoAplicado = Math.min(descuento, subtotal);
    const cargo = canal === "web" ? cargoPlataforma(subtotal - descuentoAplicado) : 0;

    const compra = (await client.query(`
        INSERT INTO compra (id_boliche, id_evento, id_cliente, token_publico, referencia, canal, metodo_pago, id_vendedor, id_rrpp,
                            subtotal, descuento, cargo_plataforma, total, contacto_email, contacto_telefono, vence_en)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CASE WHEN $16::int IS NOT NULL THEN now() + make_interval(mins => $16::int) END)
        RETURNING *`,
        [boliche.id_boliche, evento.id_evento, idCliente, nuevoToken(), nuevaReferencia(), canal, metodo, idVendedor, idRrpp,
         subtotal, descuentoAplicado, cargo, subtotal - descuentoAplicado + cargo, contacto.email, contacto.telefono, canal === "web" ? MINUTOS_RESERVA : null])).rows[0];

    for (const i of items) {
        await client.query(`
            INSERT INTO entrada (id_boliche, id_evento, id_tipo_entrada, id_compra, nombre, apellido, dni, precio, codigo, id_rrpp)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [boliche.id_boliche, evento.id_evento, i.id_tipo_entrada, compra.id_compra, i.nombre, i.apellido, i.dni, precioDe(porId.get(i.id_tipo_entrada)), nuevoCodigo(), idRrpp]);
    }

    return compra;
};

// Pasa una compra pendiente a pagada: sus entradas quedan válidas (con QR) y a las del RRPP se les fija la comisión
// que tenía ese RRPP en este momento. Devuelve la compra, o null si ya no estaba pendiente.
export const marcarPagada = async (client, idCompra, metodo = null) => {
    const compra = (await client.query(`
        UPDATE compra SET estado = 'pagada', pagada_en = now(), vence_en = NULL, metodo_pago = COALESCE($2, metodo_pago)
         WHERE id_compra = $1 AND estado = 'pendiente' RETURNING *`, [idCompra, metodo])).rows[0];
    if (!compra) return null;
    await client.query(`UPDATE entrada SET estado = 'valida' WHERE id_compra = $1 AND estado = 'pendiente'`, [idCompra]);
    await client.query(`
        UPDATE entrada e SET comision_pct = q.comision_pct, comision = round(e.precio * q.comision_pct / 100)
          FROM boliche_equipo q
         WHERE e.id_compra = $1 AND e.id_rrpp IS NOT NULL AND q.id_boliche = e.id_boliche AND q.id_usuario = e.id_rrpp`, [idCompra]);

    return compra;
};

// Forma pública de una compra: los QR (codigo) solo se muestran una vez pagada.
export const entradasDe = async (db, idCompra, { verDni = true, conCodigo = false } = {}) => {
    const filas = (await db.query(`
        SELECT e.id_entrada, e.id_tipo_entrada, t.nombre AS tipo, t.tipo AS clase, e.nombre, e.apellido, e.dni, e.precio, e.estado, e.usada_en, e.codigo
          FROM entrada e JOIN tipo_entrada t ON t.id_tipo_entrada = e.id_tipo_entrada
         WHERE e.id_compra = $1 ORDER BY e.id_entrada`, [idCompra])).rows;

    return filas.map(({ codigo, dni, ...resto }) => ({
        ...resto,
        dni: verDni ? dni : enmascarar(dni),
        ...(conCodigo && ["valida", "usada"].includes(resto.estado) ? { codigo } : {}),
    }));
};
