import { encolarAvisoPago } from "./notificaciones.js";
import { marcarPagada } from "./compras.js";

// Confirma una compra pendiente: la deja paga (entradas válidas con QR), registra el pago y encola el aviso al cliente.
// Todo dentro de la transacción que abrió quien llama. Devuelve la compra, o null si ya no estaba pendiente.
//   origen: "automatico" (llegó la transferencia), "manual" (lo confirmó una persona) o "puerta" (se cobró en el local)
export const confirmarCompra = async (client, idCompra, { metodo = null, origen, idUsuario = null, idOperacion = null, monto = null, detalle = null }) => {
    const compra = await marcarPagada(client, idCompra, metodo);
    if (!compra) return null;
    await client.query(`
        INSERT INTO pago (id_boliche, id_compra, metodo, monto, id_operacion, estado, origen, id_usuario, detalle)
        VALUES ($1, $2, $3, $4, $5, 'confirmado', $6, $7, $8)`,
        [compra.id_boliche, compra.id_compra, compra.metodo_pago, monto ?? compra.total, idOperacion, origen, idUsuario, detalle]);
    await encolarAvisoPago(client, compra);

    return compra;
};
