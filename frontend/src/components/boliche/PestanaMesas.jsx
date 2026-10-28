import { App, Card, Empty, Image, Select, Switch, Table } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiDeBoliche, imagenesApi, mesasDeEventoApi } from "../../api/plataforma.js";
import usePermisos from "../../hooks/usePermisos.js";
import { mensajeError } from "../../services/api.js";
import { eventoPorDefecto, fechaHora, moneda } from "../../utils/formato.js";
import AccionesImagen from "../AccionesImagen.jsx";
import Estado from "../Estado.jsx";
import PaginaCrud from "../PaginaCrud.jsx";

const SI_NO = [{ value: true, label: "Sí" }, { value: false, label: "No (desactivada)" }];
const ESTADOS = [{ value: "disponible", label: "Disponible" }, { value: "reservada", label: "Reservada" }];

// Qué mesas VIP ofrece cada evento y en qué estado está cada una esa noche.
function MesasPorEvento({ idBoliche }) {
  const permisos = usePermisos();
  const { message } = App.useApp();
  const [eventos, setEventos] = useState([]);
  const [idEvento, setIdEvento] = useState(null);
  const [mesas, setMesas] = useState([]);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    apiDeBoliche(idBoliche, "eventos").obtenerTodos()
      .then((lista) => { setEventos(lista); setIdEvento(eventoPorDefecto(lista)); })
      .catch(() => setEventos([]));
  }, [idBoliche]);

  const cargar = useCallback(async () => {
    if (!idEvento) return setMesas([]);
    setCargando(true);
    try {
      setMesas(await mesasDeEventoApi.listar(idBoliche, idEvento));
    } catch (e) {
      message.error(mensajeError(e, "No se pudieron cargar las mesas del evento"));
    } finally {
      setCargando(false);
    }
  }, [idBoliche, idEvento, message]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // El back devuelve la lista completa y actualizada.
  const cambiar = async (mesa, datos) => {
    try {
      setMesas(await mesasDeEventoApi.ofrecer(idBoliche, idEvento, mesa.id_mesa, datos));
    } catch (e) {
      message.error(mensajeError(e, "No se pudo cambiar la mesa"));
    }
  };

  if (eventos.length === 0) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Primero creá un evento en la pestaña Eventos." />;

  return (
    <>
      <Select
        style={{ width: "100%", maxWidth: 460, marginBottom: 12 }}
        value={idEvento}
        onChange={setIdEvento}
        options={eventos.map((e) => ({ value: e.id_evento, label: `${e.nombre} · ${fechaHora(e.fecha_hora)}` }))}
      />
      <Table
        rowKey="id_mesa"
        loading={cargando}
        dataSource={mesas}
        pagination={false}
        scroll={{ x: "max-content" }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="El boliche todavía no tiene mesas VIP activas." /> }}
        columns={[
          { title: "Mesa", dataIndex: "nombre" },
          { title: "Personas", dataIndex: "capacidad" },
          { title: "Precio", render: (_, m) => moneda(m.precio) },
          {
            title: "¿La ofrece este evento?",
            render: (_, m) => <Switch checked={m.ofrecida} disabled={!permisos.puedeEditarLocal} onChange={(ofrecida) => cambiar(m, { ofrecida })} />,
          },
          {
            title: "Estado esa noche",
            render: (_, m) =>
              !m.ofrecida ? "—" : permisos.puedeEditarLocal ? (
                <Select size="small" style={{ width: 140 }} value={m.estado} options={ESTADOS} onChange={(estado) => cambiar(m, { ofrecida: true, estado })} />
              ) : (
                <Estado estado={m.estado} color={m.estado === "disponible" ? "var(--lime)" : "var(--red)"} />
              ),
          },
        ]}
      />
    </>
  );
}

// Mesas VIP: el catálogo del boliche (nombre, personas, precio, foto) y cuáles ofrece cada evento.
// Las ven todos los del boliche; las editan el superadmin y el admin. La reserva por el cliente llega en la fase 2.
export default function PestanaMesas({ idBoliche }) {
  const config = useMemo(() => {
    const api = apiDeBoliche(idBoliche, "mesas-vip");
    return {
      titulo: "Mesas VIP",
      singular: "mesa VIP",
      femenino: true,
      api,
      id: "id_mesa",
      embebida: true,
      puedeCrear: (p) => p.puedeEditarLocal,
      puedeEditar: (p) => p.puedeEditarLocal,
      acciones: (m, { recargar }) => (
        <AccionesImagen
          imagen={m.imagen}
          recargar={recargar}
          onSubir={(archivo) => imagenesApi.subirImagenMesa(idBoliche, m.id_mesa, archivo)}
          onBorrar={() => imagenesApi.borrarImagenMesa(idBoliche, m.id_mesa)}
        />
      ),
      columnas: [
        { titulo: "Foto", render: (m) => (m.imagen ? <Image src={m.imagen} alt={m.nombre} width={48} height={48} style={{ objectFit: "cover", borderRadius: 8 }} /> : "—") },
        { titulo: "Mesa", render: (m) => m.nombre },
        { titulo: "Personas", render: (m) => m.capacidad },
        { titulo: "Precio", render: (m) => moneda(m.precio) },
        { titulo: "Estado", render: (m) => <Estado estado={m.activa ? "Activa" : "Desactivada"} color={m.activa ? "var(--lime)" : "var(--muted)"} /> },
        { titulo: "Descripción", render: (m) => (m.descripcion ? <span className="celda-corta" title={m.descripcion}>{m.descripcion}</span> : "—") },
      ],
      campos: [
        { name: "nombre", label: "Nombre", required: true, full: true, ayuda: "Por ejemplo: Mesa 1, Palco." },
        { name: "capacidad", label: "Personas", type: "number", required: true, min: 1, max: 200 },
        { name: "precio", label: "Precio ($)", type: "number", required: true, step: 5000, ayuda: "En pesos, sin centavos." },
        { name: "activa", label: "¿Activa?", type: "select", required: true, defecto: true, options: SI_NO },
        { name: "descripcion", label: "Descripción", type: "textarea", ayuda: "Qué incluye: botellas, mozo, ubicación…" },
      ],
    };
  }, [idBoliche]);

  return (
    <div className="ficha-boliche">
      <PaginaCrud config={config} />
      <Card variant="borderless" title="Mesas por evento">
        <MesasPorEvento idBoliche={idBoliche} />
      </Card>
    </div>
  );
}
