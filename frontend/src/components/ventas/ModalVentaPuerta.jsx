import { Button, Modal, Result } from "antd";
import { useEffect, useState } from "react";
import { apiDeBoliche, ventasApi } from "../../api/plataforma.js";
import { mensajeError } from "../../services/api.js";
import FormularioEntradas from "./FormularioEntradas.jsx";
import TarjetaEntrada from "./TarjetaEntrada.jsx";

const METODOS = [{ value: "efectivo", label: "Efectivo" }, { value: "qr", label: "QR" }, { value: "transferencia", label: "Transferencia" }];

// Venta en el local: precio de puerta, sin cargo de la plataforma, paga en efectivo, QR o transferencia.
// La entrada queda válida enseguida; al terminar se muestra su QR para que la persona ya pueda entrar.
export default function ModalVentaPuerta({ idBoliche, evento, onCerrar, onVendida }) {
  const [tipos, setTipos] = useState(null);
  const [venta, setVenta] = useState(null);

  useEffect(() => {
    apiDeBoliche(idBoliche, `eventos/${evento.id_evento}/entradas`).obtenerTodos().then(setTipos).catch(() => setTipos([]));
  }, [idBoliche, evento.id_evento]);

  const vender = async (datos) => {
    try {
      setVenta(await ventasApi.ventaPuerta(idBoliche, evento.id_evento, datos));
      onVendida();
    } catch (e) {
      throw new Error(mensajeError(e, "No se pudo registrar la venta"));
    }
  };

  return (
    <Modal open centered width={680} footer={null} onCancel={onCerrar} title={`Venta en puerta · ${evento.nombre}`} destroyOnHidden>
      {venta ? (
        <Result
          status="success"
          title="Venta registrada"
          subTitle={`Total cobrado: $ ${venta.total.toLocaleString("es-AR")}`}
          extra={<Button type="primary" onClick={onCerrar}>Listo</Button>}
        >
          <div className="grilla-entradas">{venta.entradas.map((e) => <TarjetaEntrada key={e.id_entrada} entrada={e} />)}</div>
        </Result>
      ) : (
        tipos && <FormularioEntradas tipos={tipos} campoPrecio="precio_puerta" metodos={METODOS} textoBoton="Registrar venta" onEnviar={vender} />
      )}
    </Modal>
  );
}
