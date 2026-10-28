import { useMemo } from "react";
import { apiDeBoliche } from "../../api/plataforma.js";
import Estado from "../Estado.jsx";
import PaginaCrud from "../PaginaCrud.jsx";

// Descuentos para los clientes que tienen cuenta: el cliente con una cuenta de más de N meses recibe el mayor descuento que le
// corresponda al comprar desde la página (no se acumulan). Ejemplo: un cliente registrado hace más de 6 meses, un 5 %.
export default function PestanaDescuentos({ idBoliche }) {
  const config = useMemo(() => {
    const campos = [
      { name: "nombre", label: "Nombre del descuento", required: true, full: true, ayuda: "Por ejemplo: Cliente de más de 6 meses." },
      { name: "porcentaje", label: "Porcentaje (%)", type: "number", required: true, min: 0.5, max: 100, step: 0.5 },
      { name: "antiguedad_meses", label: "Cuenta de más de (meses)", type: "number", required: true, defecto: 0, min: 0, max: 240, ayuda: "0 = cualquier cliente con cuenta." },
    ];
    return {
      titulo: "Descuentos",
      singular: "descuento",
      api: apiDeBoliche(idBoliche, "descuentos"),
      id: "id_descuento",
      embebida: true,
      columnas: [
        { titulo: "Descuento", render: (d) => d.nombre },
        { titulo: "Porcentaje", render: (d) => `${d.porcentaje} %` },
        { titulo: "Para quién", render: (d) => (d.antiguedad_meses === 0 ? "Cualquier cliente con cuenta" : `Cuenta de más de ${d.antiguedad_meses} meses`) },
        { titulo: "Estado", render: (d) => <Estado estado={d.activo ? "Activo" : "Desactivado"} color={d.activo ? "var(--lime)" : "var(--muted)"} /> },
      ],
      campos,
      camposEdicion: [...campos, { name: "activo", label: "Estado", type: "select", required: true, defecto: true, options: [{ value: true, label: "Activo" }, { value: false, label: "Desactivado" }] }],
      pie: <p className="muted" style={{ marginTop: 12 }}>El descuento se aplica a las compras hechas desde la página (pago por transferencia). Las ventas en la puerta no llevan descuento.</p>,
    };
  }, [idBoliche]);

  return <PaginaCrud config={config} />;
}
