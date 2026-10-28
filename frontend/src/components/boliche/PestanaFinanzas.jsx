import { DatePicker, Segmented, Space } from "antd";
import { useEffect, useMemo, useState } from "react";
import { apiDeBoliche, finanzasApi, movimientosApi } from "../../api/plataforma.js";
import { hoyISO, moneda } from "../../utils/formato.js";
import PaginaCrud from "../PaginaCrud.jsx";
import ResumenFinanzas from "./ResumenFinanzas.jsx";

// Lista de gastos o ingresos con su alta, edición y baja. Un registro puede ser de una noche o general del local (sin evento).
function Movimientos({ idBoliche, recurso }) {
  const esGasto = recurso === "gastos";
  const [eventos, setEventos] = useState([]);
  const [proveedores, setProveedores] = useState([]);

  useEffect(() => {
    apiDeBoliche(idBoliche, "eventos").obtenerTodos().then(setEventos).catch(() => setEventos([]));
    if (esGasto) apiDeBoliche(idBoliche, "proveedores").obtenerTodos().then((p) => setProveedores(p.filter((x) => x.activo))).catch(() => setProveedores([]));
  }, [idBoliche, esGasto]);

  const config = useMemo(() => {
    const campos = [
      { name: "concepto", label: "Concepto", required: true, full: true },
      { name: "monto", label: "Monto ($)", type: "number", required: true, min: 1, step: 1000 },
      { name: "fecha", label: "Fecha", type: "date", required: true, defecto: hoyISO() },
      { name: "id_evento", label: "Noche", type: "select", options: eventos.map((e) => ({ value: e.id_evento, label: e.nombre })), ayuda: "Vacío = general del local." },
      ...(esGasto ? [{ name: "id_proveedor", label: "Proveedor", type: "select", options: proveedores.map((p) => ({ value: p.id_proveedor, label: p.nombre })) }] : []),
      { name: "categoria", label: "Categoría" },
      { name: "nota", label: "Nota", type: "textarea" },
    ];
    return {
      titulo: esGasto ? "Gastos" : "Ingresos",
      singular: esGasto ? "gasto" : "ingreso",
      api: movimientosApi(idBoliche, recurso),
      id: "id",
      embebida: true,
      columnas: [
        { titulo: "Fecha", render: (m) => m.fecha },
        { titulo: "Concepto", render: (m) => m.concepto },
        { titulo: "Monto", render: (m) => <strong>{moneda(m.monto)}</strong> },
        { titulo: "Noche", render: (m) => m.evento ?? <span className="muted">General</span> },
        ...(esGasto ? [{ titulo: "Proveedor", render: (m) => m.proveedor ?? "—" }] : []),
        { titulo: "Categoría", render: (m) => m.categoria ?? "—" },
      ],
      campos,
    };
  }, [idBoliche, recurso, esGasto, eventos, proveedores]);

  return <PaginaCrud config={config} />;
}

// Finanzas del boliche: el resumen (con las noches una por una) y los gastos e ingresos cargados. Lo ve solo el admin.
export default function PestanaFinanzas({ idBoliche }) {
  const [seccion, setSeccion] = useState("resumen");
  const [periodo, setPeriodo] = useState([null, null]);
  const [datos, setDatos] = useState(null);

  useEffect(() => {
    if (seccion !== "resumen") return;
    finanzasApi.delBoliche(idBoliche, periodo[0]?.format("YYYY-MM-DD"), periodo[1]?.format("YYYY-MM-DD")).then(setDatos).catch(() => setDatos(null));
  }, [idBoliche, seccion, periodo]);

  return (
    <Space orientation="vertical" size={16} style={{ width: "100%" }}>
      <Space wrap>
        <Segmented value={seccion} onChange={setSeccion} options={[{ value: "resumen", label: "Resumen" }, { value: "gastos", label: "Gastos" }, { value: "ingresos", label: "Ingresos" }]} />
        {seccion === "resumen" && <DatePicker.RangePicker value={periodo} onChange={(v) => setPeriodo(v ?? [null, null])} format="DD/MM/YYYY" placeholder={["Desde", "Hasta"]} allowEmpty={[true, true]} />}
      </Space>
      {seccion === "resumen" && datos && <ResumenFinanzas datos={datos} titulo="De dónde sale cada número" columnaNombre="Noche" filas={datos.eventos.map((e) => ({ ...e, nombre: e.nombre }))} claveFila="id_evento" />}
      {seccion === "gastos" && <Movimientos idBoliche={idBoliche} recurso="gastos" />}
      {seccion === "ingresos" && <Movimientos idBoliche={idBoliche} recurso="ingresos" />}
    </Space>
  );
}
