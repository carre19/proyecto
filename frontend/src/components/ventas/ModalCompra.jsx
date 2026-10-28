import { Modal } from "antd";
import { useNavigate } from "react-router-dom";
import { comprasApi } from "../../api/plataforma.js";
import { mensajeError } from "../../services/api.js";
import FormularioEntradas from "./FormularioEntradas.jsx";

// Compra de entradas de un evento desde la página pública. Al terminar lleva a la página de la compra (/compra/:token),
// donde se ve cómo pagar y, una vez confirmado el pago, los QR.
export default function ModalCompra({ subdominio, evento, onCerrar }) {
  const navigate = useNavigate();

  const comprar = async (datos) => {
    try {
      const compra = await comprasApi.comprar(subdominio, evento.id_evento, datos);
      navigate(`/compra/${compra.token_publico}`);
    } catch (e) {
      throw new Error(mensajeError(e, "No se pudo registrar la compra"));
    }
  };

  return (
    <Modal open centered width={680} footer={null} onCancel={onCerrar} title={`Entradas · ${evento.nombre}`} destroyOnHidden>
      <FormularioEntradas tipos={evento.entradas} campoPrecio="precio_virtual" conCargo contactoObligatorio textoBoton="Comprar" onEnviar={comprar} />
    </Modal>
  );
}
