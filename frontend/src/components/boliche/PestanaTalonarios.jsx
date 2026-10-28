import { CopyOutlined } from "@ant-design/icons";
import { App, Button, Tag } from "antd";
import { useEffect, useMemo, useState } from "react";
import { apiDeBoliche } from "../../api/plataforma.js";
import usePermisos from "../../hooks/usePermisos.js";
import Estado from "../Estado.jsx";
import PaginaCrud from "../PaginaCrud.jsx";
import SelectorEvento from "./SelectorEvento.jsx";

// Talonarios: las entradas que se le asignan a cada RRPP para un evento, con su link propio. Las compras hechas con ese link
// se le adjudican (y cuentan para su comisión). El admin los arma para cualquier RRPP y el manager para los de su equipo;
// cada RRPP ve el suyo y comparte el link.
export default function PestanaTalonarios({ idBoliche }) {
  const permisos = usePermisos();
  const { message } = App.useApp();
  const [evento, setEvento] = useState(null);
  const [rrpp, setRrpp] = useState([]);

  // RRPP a quienes se les puede asignar: todos para el admin; solo los de su equipo para el manager.
  useEffect(() => {
    if (!permisos.puedeGestionarPagos) return;
    apiDeBoliche(idBoliche, "equipo").obtenerTodos()
      .then((eq) => setRrpp(eq.filter((m) => m.rol === "rrpp" && (!permisos.esManager || m.id_manager === permisos.yo))))
      .catch(() => setRrpp([]));
  }, [idBoliche, permisos.puedeGestionarPagos, permisos.esManager, permisos.yo]);

  const config = useMemo(() => {
    if (!evento) return null;
    const api = apiDeBoliche(idBoliche, `eventos/${evento.id_evento}/talonarios`);
    const copiar = (link) => navigator.clipboard?.writeText(link).then(() => message.success("Link copiado"), () => message.info(link));
    return {
      titulo: "Talonarios",
      singular: "talonario",
      api,
      id: "id_talonario",
      embebida: true,
      puedeCrear: (p) => p.puedeGestionarPagos,
      puedeEditar: (p) => p.puedeGestionarPagos,
      acciones: (t) => <Button type="text" icon={<CopyOutlined />} title="Copiar el link de venta" aria-label="Copiar el link de venta" onClick={() => copiar(t.link)} />,
      columnas: [
        { titulo: "RRPP", render: (t) => t.rrpp },
        { titulo: "Asignadas", render: (t) => t.cantidad },
        { titulo: "Vendidas", render: (t) => t.vendidas },
        { titulo: "Esperando pago", render: (t) => t.pendientes },
        { titulo: "Quedan", render: (t) => <strong>{t.quedan}</strong> },
        { titulo: "Link", render: (t) => <Tag>{t.link.replace(/^https?:\/\//, "")}</Tag> },
        { titulo: "Estado", render: (t) => <Estado estado={t.activo ? "Activo" : "Desactivado"} color={t.activo ? "var(--lime)" : "var(--muted)"} /> },
      ],
      campos: [
        { name: "id_rrpp", label: "RRPP", type: "select", required: true, full: true, options: rrpp.map((m) => ({ value: m.id_usuario, label: m.nombre_completo })) },
        { name: "cantidad", label: "Entradas asignadas", type: "number", required: true, min: 1, ayuda: "Entre todos los talonarios no pueden pasar del total de entradas del evento." },
      ],
      camposEdicion: [
        { name: "cantidad", label: "Entradas asignadas", type: "number", required: true, min: 1, ayuda: "No puede ser menos de lo ya vendido o reservado." },
        { name: "activo", label: "Link de venta", type: "select", required: true, defecto: true, options: [{ value: true, label: "Activo" }, { value: false, label: "Desactivado" }] },
      ],
    };
  }, [idBoliche, evento, rrpp, message]);

  return (
    <div className="puerta">
      <SelectorEvento idBoliche={idBoliche} onElegir={setEvento} />
      {config && <PaginaCrud key={evento.id_evento} config={config} />}
    </div>
  );
}
