import { useMemo } from "react";
import { apiDeBoliche } from "../../api/plataforma.js";
import { moneda } from "../../utils/formato.js";
import Estado from "../Estado.jsx";
import PaginaCrud from "../PaginaCrud.jsx";

// Proveedores del local: cada uno con lo que se le gastó. Uno con gastos registrados no se borra: se desactiva.
export default function PestanaProveedores({ idBoliche }) {
  const config = useMemo(() => {
    const campos = [
      { name: "nombre", label: "Nombre", required: true, full: true },
      { name: "rubro", label: "Rubro", ayuda: "Por ejemplo: bebidas, sonido, limpieza." },
      { name: "contacto", label: "Contacto" },
      { name: "notas", label: "Notas", type: "textarea" },
    ];
    return {
      titulo: "Proveedores",
      singular: "proveedor",
      api: apiDeBoliche(idBoliche, "proveedores"),
      id: "id_proveedor",
      embebida: true,
      columnas: [
        { titulo: "Proveedor", render: (p) => p.nombre },
        { titulo: "Rubro", render: (p) => p.rubro ?? "—" },
        { titulo: "Contacto", render: (p) => p.contacto ?? "—" },
        { titulo: "Gastos", render: (p) => `${p.cantidad_gastos} · ${moneda(p.total_gastado)}` },
        { titulo: "Estado", render: (p) => <Estado estado={p.activo ? "Activo" : "Desactivado"} color={p.activo ? "var(--lime)" : "var(--muted)"} /> },
      ],
      campos,
      camposEdicion: [...campos, { name: "activo", label: "Estado", type: "select", required: true, defecto: true, options: [{ value: true, label: "Activo" }, { value: false, label: "Desactivado" }] }],
    };
  }, [idBoliche]);

  return <PaginaCrud config={config} />;
}
