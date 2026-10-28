import crypto from "node:crypto";
import pool from "../data/db.js";
import { liberarVencidas } from "../utils/compras.js";
import { confirmarCompra } from "../utils/pagos.js";
import { despacharPendientes } from "../utils/notificaciones.js";
import { parseId, textoObligatorio, textoOpcional } from "../utils/validaciones.js";
import { responderErrorDeBase } from "../utils/usuarios.js";

// Pagos: aviso automático de transferencias (webhook firmado), cuenta de cobro del boliche, pagos a revisar y avisos enviados.

const enviarAvisos = () => despacharPendientes(pool).catch((error) => console.error("No se pudieron enviar los avisos:", error.message));

// POST /api/pagos/webhook — lo llama el servicio que detecta que llegó una transferencia (el pendiente de la sección 4 del README).
// Cuerpo: {referencia, monto, id_operacion}. Va firmado: cabecera X-Firma = HMAC-SHA256 (hex) del cuerpo con PAGOS_WEBHOOK_SECRET.
// Siempre responde 200 cuando entendió el aviso (aunque el pago quede "a revisar"), para que el servicio no lo reintente.
export const webhook = async (req, res) => {
    const secreto = process.env.PAGOS_WEBHOOK_SECRET;
    if (!secreto) return res.status(503).json({ mensaje: "la confirmación automática no está configurada" });

    const firma = Buffer.from(String(req.headers["x-firma"] ?? ""), "hex");
    const esperada = crypto.createHmac("sha256", secreto).update(req.rawBody ?? Buffer.alloc(0)).digest();
    if (firma.length !== esperada.length || !crypto.timingSafeEqual(firma, esperada)) return res.status(401).json({ mensaje: "firma inválida" });

    const referencia = String(req.body?.referencia ?? "").trim().toUpperCase();
    const monto = Number(req.body?.monto);
    const idOperacion = String(req.body?.id_operacion ?? "").trim();
    if (!/^NX[A-Z0-9]{6}$/.test(referencia)) return res.status(400).json({ mensaje: "la referencia no es válida" });
    if (!Number.isInteger(monto) || monto < 0) return res.status(400).json({ mensaje: "el monto no es válido" });
    if (!idOperacion || idOperacion.length > 80) return res.status(400).json({ mensaje: "falta el id de la operación" });

    const cliente = await pool.connect();
    try {
        await cliente.query("BEGIN");
        const compra = (await cliente.query(`SELECT * FROM compra WHERE referencia = $1 FOR UPDATE`, [referencia])).rows[0];
        if (!compra) {
            await cliente.query("ROLLBACK");
            return res.status(404).json({ ok: false, motivo: "referencia_desconocida" });
        }
        if ((await cliente.query(`SELECT 1 FROM pago WHERE id_operacion = $1`, [idOperacion])).rows.length > 0) {
            await cliente.query("ROLLBACK");
            return res.json({ ok: true, duplicado: true });
        }

        const aRevisar = async (detalle) => {
            await cliente.query(`
                INSERT INTO pago (id_boliche, id_compra, metodo, monto, id_operacion, estado, origen, detalle) VALUES ($1, $2, 'transferencia', $3, $4, 'a_revisar', 'automatico', $5)`,
                [compra.id_boliche, compra.id_compra, monto, idOperacion, detalle]);
            await cliente.query("COMMIT");
            return res.json({ ok: true, resultado: "a_revisar", motivo: detalle });
        };

        if (compra.estado === "pagada") return await aRevisar("pago repetido: la compra ya estaba paga");
        if (compra.estado === "cancelada") return await aRevisar("llegó el pago de una compra vencida o cancelada");
        if (monto < compra.total) return await aRevisar(`monto insuficiente: llegaron $${monto} de $${compra.total}`);

        await confirmarCompra(cliente, compra.id_compra, { metodo: "transferencia", origen: "automatico", idOperacion, monto, detalle: monto > compra.total ? `llegó $${monto - compra.total} de más` : null });
        await cliente.query("COMMIT");
        enviarAvisos();

        res.json({ ok: true, resultado: "confirmado", id_compra: compra.id_compra });
    } catch (error) {
        await cliente.query("ROLLBACK");
        if (error.code === "23505") return res.json({ ok: true, duplicado: true }); // dos avisos de la misma operación al mismo tiempo
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo procesar el aviso de pago" });
    } finally {
        cliente.release();
    }
};

// GET/PUT /boliches/:id/cuenta-cobro — la cuenta donde el boliche recibe las transferencias.
export const verCuentaCobro = async (req, res) => {
    try {
        const cuenta = (await pool.query(`SELECT titular, banco, alias, cbu, instrucciones, actualizada_en FROM boliche_cuenta_cobro WHERE id_boliche = $1`, [req.boliche.id_boliche])).rows[0];
        res.json(cuenta ?? null);
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo obtener la cuenta de cobro" });
    }
};

export const guardarCuentaCobro = async (req, res) => {
    try {
        const titular = textoObligatorio(req.body?.titular, "el titular", 120);
        const banco = textoOpcional(req.body?.banco, "el banco", 80);
        const alias = textoOpcional(req.body?.alias, "el alias", 60);
        const cbu = textoOpcional(req.body?.cbu === undefined || req.body?.cbu === null ? null : String(req.body.cbu), "el CBU", 30);
        const instrucciones = textoOpcional(req.body?.instrucciones, "las instrucciones", 500);
        const error = titular.error ?? banco.error ?? alias.error ?? cbu.error ?? instrucciones.error;
        if (error) return res.status(400).json({ mensaje: error });
        if (!alias.valor && !cbu.valor) return res.status(400).json({ mensaje: "cargá el alias o el CBU de la cuenta" });
        if (cbu.valor && !/^\d{22}$/.test(cbu.valor)) return res.status(400).json({ mensaje: "el CBU tiene 22 números" });

        await pool.query(`
            INSERT INTO boliche_cuenta_cobro (id_boliche, titular, banco, alias, cbu, instrucciones) VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id_boliche) DO UPDATE SET titular = $2, banco = $3, alias = $4, cbu = $5, instrucciones = $6, actualizada_en = now()`,
            [req.boliche.id_boliche, titular.valor, banco.valor, alias.valor, cbu.valor, instrucciones.valor]);

        res.json((await pool.query(`SELECT titular, banco, alias, cbu, instrucciones, actualizada_en FROM boliche_cuenta_cobro WHERE id_boliche = $1`, [req.boliche.id_boliche])).rows[0]);
    } catch (error) {
        if (responderErrorDeBase(error, res)) return;
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo guardar la cuenta de cobro" });
    }
};

// GET /boliches/:id/pagos[?estado=a_revisar|confirmado|resuelto]
export const listarPagos = async (req, res) => {
    try {
        const estado = ["confirmado", "a_revisar", "resuelto"].includes(req.query.estado) ? req.query.estado : null;
        const pagos = (await pool.query(`
            SELECT p.id_pago, p.id_compra, c.referencia, c.estado AS estado_compra, c.total AS total_compra, p.metodo, p.monto, p.id_operacion, p.estado, p.origen, p.detalle, p.recibido_en,
                   u.nombre_completo AS registrado_por
              FROM pago p JOIN compra c ON c.id_boliche = p.id_boliche AND c.id_compra = p.id_compra LEFT JOIN usuario u ON u.id_usuario = p.id_usuario
             WHERE p.id_boliche = $1 AND ($2::text IS NULL OR p.estado = $2) ORDER BY p.recibido_en DESC, p.id_pago DESC LIMIT 200`, [req.boliche.id_boliche, estado])).rows;

        res.json(pagos);
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "no se pudieron obtener los pagos" });
    }
};

const pagoARevisar = async (req, res, db) => {
    const idPago = parseId(req.params.idPago);
    if (idPago === null) {
        res.status(400).json({ mensaje: "el id del pago no es valido" });
        return null;
    }
    const pago = (await db.query(`SELECT * FROM pago WHERE id_boliche = $1 AND id_pago = $2 FOR UPDATE`, [req.boliche.id_boliche, idPago])).rows[0];
    if (!pago) {
        res.status(404).json({ mensaje: "ese pago no existe" });
        return null;
    }
    if (pago.estado !== "a_revisar") {
        res.status(409).json({ mensaje: "ese pago no está para revisar" });
        return null;
    }

    return pago;
};

// PUT /boliches/:id/pagos/:idPago/resolver {detalle} — el admin ya lo revisó (por ejemplo, devolvió la plata fuera del sistema).
export const resolverPago = async (req, res) => {
    const cliente = await pool.connect();
    try {
        const nota = textoOpcional(req.body?.detalle, "el detalle", 300);
        if (nota.error) return res.status(400).json({ mensaje: nota.error });
        await cliente.query("BEGIN");
        const pago = await pagoARevisar(req, res, cliente);
        if (!pago) return void (await cliente.query("ROLLBACK"));
        await cliente.query(`UPDATE pago SET estado = 'resuelto', detalle = left(concat_ws(' · ', detalle, $2::text), 300) WHERE id_pago = $1`, [pago.id_pago, nota.valor]);
        await cliente.query("COMMIT");

        res.json({ mensaje: "pago resuelto" });
    } catch (error) {
        await cliente.query("ROLLBACK");
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo resolver el pago" });
    } finally {
        cliente.release();
    }
};

// PUT /boliches/:id/pagos/:idPago/reactivar — la plata llegó tarde (la compra venció): se vuelven a tomar las entradas si todavía
// hay lugar y nadie más tomó el DNI, y la compra queda paga.
export const reactivarCompra = async (req, res) => {
    const cliente = await pool.connect();
    try {
        await cliente.query("BEGIN");
        const pago = await pagoARevisar(req, res, cliente);
        if (!pago) return void (await cliente.query("ROLLBACK"));
        const compra = (await cliente.query(`SELECT * FROM compra WHERE id_compra = $1 FOR UPDATE`, [pago.id_compra])).rows[0];
        if (compra.estado !== "cancelada") {
            await cliente.query("ROLLBACK");
            return res.status(409).json({ mensaje: "solo se reactivan compras vencidas o canceladas" });
        }

        // Bloquea los tipos de entrada (en orden fijo) y verifica que alcance el cupo.
        const pedidas = (await cliente.query(`SELECT id_tipo_entrada, count(*)::int AS n FROM entrada WHERE id_compra = $1 GROUP BY id_tipo_entrada ORDER BY id_tipo_entrada`, [compra.id_compra])).rows;
        for (const { id_tipo_entrada, n } of pedidas) {
            const tipo = (await cliente.query(`SELECT cupo, nombre FROM tipo_entrada WHERE id_tipo_entrada = $1 FOR UPDATE`, [id_tipo_entrada])).rows[0];
            const vendidas = Number((await cliente.query(`SELECT count(*) FROM entrada WHERE id_tipo_entrada = $1 AND estado <> 'anulada'`, [id_tipo_entrada])).rows[0].count);
            if (vendidas + n > tipo.cupo) {
                await cliente.query("ROLLBACK");
                return res.status(409).json({ mensaje: `ya no quedan entradas "${tipo.nombre}": hay que devolver el dinero fuera del sistema y marcar el pago como resuelto` });
            }
        }
        await cliente.query(`UPDATE entrada SET estado = 'pendiente' WHERE id_compra = $1 AND estado = 'anulada'`, [compra.id_compra]);
        await cliente.query(`UPDATE compra SET estado = 'pendiente', vence_en = now() + interval '1 minute' WHERE id_compra = $1`, [compra.id_compra]);
        await confirmarCompra(cliente, compra.id_compra, { metodo: "transferencia", origen: "manual", idUsuario: req.usuario.id, monto: pago.monto, detalle: "reactivada tras un pago tardío" });
        await cliente.query(`UPDATE pago SET estado = 'resuelto', detalle = left(concat_ws(' · ', detalle, 'compra reactivada'), 300) WHERE id_pago = $1`, [pago.id_pago]);
        await cliente.query("COMMIT");
        enviarAvisos();

        res.json({ mensaje: "compra reactivada y paga" });
    } catch (error) {
        await cliente.query("ROLLBACK");
        if (error.code === "23505") return res.status(409).json({ mensaje: "otra persona ya tomó el lugar de alguna de esas entradas (mismo DNI)" });
        if (responderErrorDeBase(error, res)) return;
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo reactivar la compra" });
    } finally {
        cliente.release();
    }
};

// GET /boliches/:id/notificaciones — los últimos avisos al cliente y cómo salieron.
export const listarNotificaciones = async (req, res) => {
    try {
        const avisos = (await pool.query(`
            SELECT n.id_notificacion, n.id_compra, c.referencia, n.canal, n.destino, n.estado, n.intentos, n.error, n.creada_en, n.enviada_en
              FROM notificacion n JOIN compra c ON c.id_boliche = n.id_boliche AND c.id_compra = n.id_compra
             WHERE n.id_boliche = $1 ORDER BY n.creada_en DESC, n.id_notificacion DESC LIMIT 100`, [req.boliche.id_boliche])).rows;

        res.json(avisos);
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "no se pudieron obtener los avisos" });
    }
};
