import { Modal } from "antd";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { comprasApi, descuentoClienteApi } from "../../api/plataforma.js";
import { mensajeError } from "../../services/api.js";
import FormularioEntradas from "./FormularioEntradas.jsx";

// Compra de entradas de un evento desde la página pública. Al terminar lleva a la página de la compra (/compra/:token),
// donde se ve cómo pagar y, una vez confirmado el pago, los QR.
export default function ModalCompra({ subdominio, evento, talonario, onCerrar }) {
  const navigate = useNavigate();
  const [descuento, setDescuento] = useState(null);

  // Si quien compra tiene una cuenta de cliente, se le muestra el descuento que le corresponde.
  useEffect(() => {
    if (localStorage.getItem("token")) descuentoClienteApi(subdominio).then(setDescuento).catch(() => setDescuento(null));
  }, [subdominio]);

  const comprar = async (datos) => {
    try {
      const compra = await comprasApi.comprar(subdominio, evento.id_evento, { ...datos, ...(talonario ? { talonario } : {}) });
      navigate(`/compra/${compra.token_publico}`);
    } catch (e) {
      throw new Error(mensajeError(e, "No se pudo registrar la compra"));
    }
  };

  return (
    <Modal open centered width={680} footer={null} onCancel={onCerrar} title={`Entradas · ${evento.nombre}`} destroyOnHidden>
      <FormularioEntradas tipos={evento.entradas} campoPrecio="precio_virtual" conCargo descuento={descuento} contactoObligatorio textoBoton="Comprar" onEnviar={comprar} />
    </Modal>
  );
}
