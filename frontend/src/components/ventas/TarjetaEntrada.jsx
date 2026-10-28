import { QRCode, Tag } from "antd";
import { etiqueta } from "../../utils/formato.js";

const COLOR = { valida: "green", usada: "default", pendiente: "gold", anulada: "red" };
const TEXTO = { valida: "Válida", usada: "Ya usada", pendiente: "Esperando el pago", anulada: "Anulada" };

// Una entrada: su QR (solo si está pagada), el nombre y el DNI de la persona (la entrada es personal e intransferible)
// y su estado. El QR se dibuja en negro sobre blanco aunque la página esté en modo oscuro, para que lo lea cualquier escáner.
export default function TarjetaEntrada({ entrada }) {
  const conQr = Boolean(entrada.codigo);
  return (
    <div className={`tarjeta-entrada ${entrada.estado === "usada" ? "usada" : ""}`}>
      {conQr ? (
        <QRCode value={entrada.codigo} size={150} color="#000000" bgColor="#FFFFFF" bordered={false} status={entrada.estado === "usada" ? "expired" : "active"} />
      ) : (
        <div className="tarjeta-entrada-sin-qr">El QR aparece cuando se confirma el pago</div>
      )}
      <div className="tarjeta-entrada-datos">
        <strong>{entrada.nombre} {entrada.apellido}</strong>
        <span>DNI {entrada.dni}</span>
        <span className="muted">{entrada.tipo ?? etiqueta(entrada.clase ?? "")}</span>
        <Tag color={COLOR[entrada.estado]}>{TEXTO[entrada.estado]}</Tag>
      </div>
    </div>
  );
}
