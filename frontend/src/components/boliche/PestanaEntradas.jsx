import { Alert, Empty, Progress, Select, Space, Tag } from "antd";
import { useEffect, useMemo, useState } from "react";
import { apiDeBoliche } from "../../api/plataforma.js";
import usePermisos from "../../hooks/usePermisos.js";
import { fechaHora, moneda } from "../../utils/formato.js";
import Estado from "../Estado.jsx";
import PaginaCrud from "../PaginaCrud.jsx";

const TIPOS = [{ value: "tanda", label: "Tanda" }, { value: "vip", label: "VIP" }];
const ESTADOS = [{ value: "disponible", label: "Disponible" }, { value: "agotada", label: "Agotada" }, { value: "no_disponible", label: "No disponible" }];
const COLOR_ESTADO = { disponible: "var(--lime)", agotada: "var(--red)", no_disponible: "var(--muted)" };

// Entradas de un evento: tandas y VIP con precio online y de puerta, cupo y estado. Se elige el evento arriba.
// La suma de los cupos no puede pasar de la capacidad del boliche (lo controla la base; acá se muestra cuánto queda).
// Las ven todos los del boliche; las editan el superadmin y el admin.
export default function PestanaEntradas({ boliche }) {
  const permisos = usePermisos();
  const [eventos, setEventos] = useState(null);
  const [idEvento, setIdEvento] = useState(null);
  const [usados, setUsados] = useState(0);
  const capacidad = boliche.capacidad;

  useEffect(() => {
    apiDeBoliche(boliche.id_boliche, "eventos").obtenerTodos()
      .then((lista) => { setEventos(lista); setIdEvento(lista[0]?.id_evento ?? null); })
      .catch(() => setEventos([]));
  }, [boliche.id_boliche]);

  const config = useMemo(() => {
    const api = apiDeBoliche(boliche.id_boliche, `eventos/${idEvento}/entradas`);
    const campos = [
      { name: "nombre", label: "Nombre", required: true, full: true, ayuda: "Por ejemplo: Tanda 1, Early bird, VIP." },
      { name: "tipo", label: "Tipo", type: "select", required: true, defecto: "tanda", options: TIPOS },
      { name: "estado", label: "Estado", type: "select", required: true, defecto: "disponible", options: ESTADOS },
      { name: "precio_virtual", label: "Precio online ($)", type: "number", required: true, step: 500 },
      { name: "precio_puerta", label: "Precio en puerta ($)", type: "number", required: true, step: 500 },
      { name: "cupo", label: "Cupo (entradas)", type: "number", required: true, min: 1, ayuda: capacidad ? `Entre todas las entradas del evento, hasta ${capacidad.toLocaleString("es-AR")}.` : undefined },
      { name: "orden", label: "Orden", type: "number", ayuda: "Para ordenarlas: 1, 2, 3…" },
    ];
    return {
      titulo: "Entradas",
      singular: "entrada",
      femenino: true,
      api,
      id: "id_tipo_entrada",
      embebida: true,
      alCargar: (items) => setUsados(items.reduce((total, e) => total + e.cupo, 0)),
      puedeCrear: (p) => p.puedeEditarLocal && Boolean(capacidad),
      puedeEditar: (p) => p.puedeEditarLocal,
      columnas: [
        { titulo: "Entrada", render: (e) => <Space size={6}>{e.nombre}{e.tipo === "vip" && <Tag color="gold">VIP</Tag>}</Space> },
        { titulo: "Precio online", render: (e) => moneda(e.precio_virtual) },
        { titulo: "Precio en puerta", render: (e) => moneda(e.precio_puerta) },
        { titulo: "Cupo", render: (e) => e.cupo.toLocaleString("es-AR") },
        { titulo: "Estado", render: (e) => <Estado estado={e.estado} color={COLOR_ESTADO[e.estado]} /> },
      ],
      campos,
      // Los campos opcionales vacíos no se mandan (el back los toma como "no cambió").
      guardar: (item, v) => {
        const datos = Object.fromEntries(Object.entries(v).filter(([, valor]) => valor !== null));
        return item ? api.editar(item.id_tipo_entrada, datos) : api.crear(datos);
      },
    };
  }, [boliche.id_boliche, idEvento, capacidad]);

  if (!eventos) return null;
  if (eventos.length === 0) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Primero creá un evento en la pestaña Eventos: las entradas se cargan por evento." />;

  const porcentaje = capacidad ? Math.min(100, Math.round((usados / capacidad) * 100)) : 0;

  return (
    <Space orientation="vertical" size={16} style={{ width: "100%" }}>
      <Select
        style={{ width: "100%", maxWidth: 460 }}
        value={idEvento}
        onChange={setIdEvento}
        options={eventos.map((e) => ({ value: e.id_evento, label: `${e.nombre} · ${fechaHora(e.fecha_hora)}` }))}
      />
      {!capacidad ? (
        <Alert type="warning" showIcon title="Este boliche todavía no tiene capacidad." description={permisos.puedeEditarLocal ? "Cargala en la pestaña Datos del local: sin ella no se pueden crear entradas." : "Pedile al admin que la cargue en Datos del local."} />
      ) : (
        <div>
          <span className="muted">Cupos repartidos: {usados.toLocaleString("es-AR")} de {capacidad.toLocaleString("es-AR")} (capacidad del boliche) · quedan {Math.max(0, capacidad - usados).toLocaleString("es-AR")}</span>
          <Progress percent={porcentaje} showInfo={false} status={usados >= capacidad ? "exception" : "normal"} />
        </div>
      )}
      <PaginaCrud key={idEvento} config={config} />
    </Space>
  );
}
