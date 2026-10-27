import { ArrowLeftOutlined, GlobalOutlined, InstagramOutlined, WhatsAppOutlined } from "@ant-design/icons";
import { Alert, App, Button, Card, Descriptions, Popconfirm, Result, Select, Skeleton, Space, Tabs, Tag } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiDeBoliche, bolichesApi, usuariosApi } from "../api/plataforma.js";
import Estado from "../components/Estado.jsx";
import FormModal from "../components/FormModal.jsx";
import PaginaCrud from "../components/PaginaCrud.jsx";
import Proximamente from "../components/Proximamente.jsx";
import Topbar from "../components/Topbar.jsx";
import usePermisos from "../hooks/usePermisos.js";
import { mensajeError } from "../services/api.js";
import { contacto, fechaHora, fechaLarga } from "../utils/formato.js";

const SI_NO = [{ value: true, label: "Sí" }, { value: false, label: "No" }];
const ESTADOS_EVENTO = [{ value: "publicado", label: "Publicado" }, { value: "cancelado", label: "Cancelado" }, { value: "finalizado", label: "Finalizado" }];
const COLOR_ESTADO_EVENTO = { publicado: "var(--lime)", cancelado: "var(--red)", finalizado: "var(--muted)" };
const COLOR_ROL_EQUIPO = { rrpp_manager: "var(--violet)", rrpp: "var(--pink)" };
const ROL_EQUIPO = { rrpp_manager: "RRPP manager", rrpp: "RRPP" };

// Pestaña de eventos: los ven todos los del boliche; crean el superadmin, el admin y el manager (este solo edita los suyos).
function PestanaEventos({ idBoliche }) {
  const permisos = usePermisos();
  const api = useMemo(() => apiDeBoliche(idBoliche, "eventos"), [idBoliche]);

  const config = useMemo(() => {
    const campos = [
      { name: "nombre", label: "Nombre del evento", required: true, full: true },
      { name: "fecha_hora", label: "Fecha y hora", type: "datetime", required: true },
      { name: "edad_minima", label: "Edad mínima", type: "number", required: true, defecto: 18, step: 1 },
      { name: "artistas", label: "Artistas", full: true, ayuda: "Separados por coma. Por ejemplo: DJ Nova, Kaia", desde: (e) => (e.artistas ?? []).join(", ") },
      { name: "dress_code", label: "Dress code" },
      { name: "tiene_vip", label: "¿Hay sector VIP?", type: "select", required: true, defecto: false, options: SI_NO },
      { name: "mesas_vip", label: "Mesas VIP", type: "number", step: 1, ayuda: "Solo si hay sector VIP." },
      { name: "descripcion", label: "Descripción", type: "textarea" },
    ];
    const guardar = async (item, v) => {
      const datos = { ...v, artistas: v.artistas ?? "", mesas_vip: v.tiene_vip ? v.mesas_vip : null };
      return item ? api.editar(item.id_evento, datos) : api.crear(datos);
    };
    return {
      titulo: "Eventos",
      singular: "evento",
      api,
      id: "id_evento",
      embebida: true,
      guardar,
      // Solo el admin y el superadmin borran; el manager edita los eventos que creó él.
      sinEliminar: !(permisos.esSuperadmin || permisos.esAdmin),
      puedeCrear: (p) => p.puedeCrearEventos,
      puedeEditar: (p, e) => p.esSuperadmin || p.esAdmin || (p.esManager && e.id_creador === p.yo),
      columnas: [
        { titulo: "Evento", render: (e) => e.nombre },
        { titulo: "Fecha y hora", render: (e) => fechaHora(e.fecha_hora) },
        { titulo: "Artistas", render: (e) => (e.artistas?.length ? e.artistas.join(", ") : "—") },
        { titulo: "Edad mín.", render: (e) => `${e.edad_minima}+` },
        { titulo: "VIP", render: (e) => (e.tiene_vip ? `Sí${e.mesas_vip != null ? ` (${e.mesas_vip} mesas)` : ""}` : "No") },
        { titulo: "Estado", render: (e) => <Estado estado={e.estado} color={COLOR_ESTADO_EVENTO[e.estado]} /> },
        { titulo: "Lo creó", render: (e) => e.creador ?? "—" },
      ],
      campos,
      camposEdicion: [...campos, { name: "estado", label: "Estado", type: "select", required: true, defecto: "publicado", options: ESTADOS_EVENTO }],
    };
  }, [api, permisos.esSuperadmin, permisos.esAdmin]);

  return <PaginaCrud config={config} />;
}

// Pestaña del equipo de RRPP. El admin da de alta managers y RRPP y fija la comisión;
// el manager da de alta RRPP (quedan a su cargo) y asigna o desasigna a los suyos.
function PestanaEquipo({ idBoliche }) {
  const permisos = usePermisos();
  const api = useMemo(() => apiDeBoliche(idBoliche, "equipo"), [idBoliche]);
  const [managers, setManagers] = useState([]);

  // Los managers del boliche, para asignarles RRPP (lo hace el admin).
  useEffect(() => {
    if (!permisos.puedeFijarComision) return;
    api.obtenerTodos().then((eq) => setManagers(eq.filter((m) => m.rol === "rrpp_manager"))).catch(() => setManagers([]));
  }, [api, permisos.puedeFijarComision]);

  const config = useMemo(() => {
    const opcionesManager = managers.map((m) => ({ value: m.id_usuario, label: m.nombre_completo }));
    const datosPersona = [
      { name: "nombre", label: "Nombre", required: true },
      { name: "apellido", label: "Apellido", required: true },
      { name: "email", label: "Email de acceso", type: "email", required: true },
      { name: "password", label: "Contraseña", type: "password", required: true, minimo: 8, ayuda: "Mínimo 8 caracteres." },
      { name: "dni", label: "DNI", ayuda: "Sin puntos. Lo ven el admin, el manager y los RRPP." },
      { name: "telefono", label: "Teléfono" },
    ];
    const rolesDisponibles = permisos.esManager ? [{ value: "rrpp", label: "RRPP" }] : [{ value: "rrpp", label: "RRPP" }, { value: "rrpp_manager", label: "RRPP manager" }];
    const campos = [
      { name: "rol", label: "Rol", type: "select", required: true, defecto: "rrpp", options: rolesDisponibles, full: true },
      ...datosPersona,
      ...(permisos.puedeFijarComision
        ? [
            { name: "comision_pct", label: "Comisión (%)", type: "number", step: 0.5, defecto: 0, ayuda: "La fija el admin. Solo para RRPP." },
            { name: "id_manager", label: "Manager", type: "select", options: opcionesManager, ayuda: "Opcional: el RRPP puede ir directo con el admin." },
          ]
        : []),
    ];
    // Al editar: el admin cambia la comisión, el manager y el estado de la cuenta; el manager solo asigna o desasigna.
    const camposEdicion = permisos.esManager
      ? [{ name: "id_manager", label: "¿A tu cargo?", type: "select", options: [{ value: permisos.yo, label: "Sí, a mi cargo" }], ayuda: "Borrá la selección para desasignarlo." }]
      : [
          { name: "comision_pct", label: "Comisión (%)", type: "number", step: 0.5, ayuda: "Solo para RRPP." },
          { name: "id_manager", label: "Manager", type: "select", options: opcionesManager },
          { name: "activo", label: "Cuenta", type: "select", required: true, defecto: true, options: [{ value: true, label: "Activa" }, { value: false, label: "Desactivada" }] },
        ];

    return {
      titulo: "Equipo",
      singular: "persona",
      femenino: true,
      api,
      id: "id_usuario",
      embebida: true,
      // Dar de baja (sale del equipo y se desactiva la cuenta) lo hacen el admin y el superadmin.
      sinEliminar: permisos.esManager,
      puedeCrear: () => true,
      columnas: [
        { titulo: "Nombre", render: (m) => m.nombre_completo },
        { titulo: "Rol", render: (m) => <Estado estado={ROL_EQUIPO[m.rol]} color={COLOR_ROL_EQUIPO[m.rol]} /> },
        { titulo: "Manager", render: (m) => m.manager ?? (m.rol === "rrpp" ? <span className="muted">Sin manager</span> : "—") },
        { titulo: "Comisión", render: (m) => (m.rol === "rrpp" ? `${Number(m.comision_pct)} %` : "—") },
        { titulo: "Contacto", render: (m) => contacto(m.telefono, m.email) || "—" },
        { titulo: "DNI", render: (m) => m.dni ?? "—" },
        { titulo: "Cuenta", render: (m) => <Estado estado={m.activo ? "Activa" : "Desactivada"} color={m.activo ? "var(--lime)" : "var(--muted)"} /> },
      ],
      campos,
      camposEdicion,
      guardar: async (item, v) => {
        if (item) {
          // El manager solo manda id_manager; el admin manda los tres. La comisión y el manager no aplican a un manager.
          const datos = permisos.esManager ? { id_manager: v.id_manager ?? null } : { ...v, id_manager: item.rol === "rrpp" ? v.id_manager ?? null : null };
          if (item.rol !== "rrpp") delete datos.comision_pct;
          return api.editar(item.id_usuario, datos);
        }
        const datos = { ...v };
        if (datos.rol !== "rrpp") { delete datos.id_manager; delete datos.comision_pct; }
        return api.crear(datos);
      },
    };
  }, [api, managers, permisos.esManager, permisos.puedeFijarComision, permisos.yo]);

  return <PaginaCrud config={config} />;
}

// Pestaña de datos del local: lo que ve el admin (precios y entradas llegan en la fase 2), las redes y, para el superadmin, sus admins.
function PestanaDatos({ boliche, recargar }) {
  const permisos = usePermisos();
  const { message } = App.useApp();
  const [editando, setEditando] = useState(false);
  const [usuarios, setUsuarios] = useState([]);
  const [nuevoAdmin, setNuevoAdmin] = useState(null);

  useEffect(() => {
    if (!permisos.esSuperadmin) return;
    usuariosApi.obtenerTodos().then((u) => setUsuarios(u.filter((x) => x.rol === "admin" && x.activo))).catch(() => setUsuarios([]));
  }, [permisos.esSuperadmin]);

  const campos = [
    { name: "nombre", label: "Nombre", required: true },
    { name: "direccion", label: "Dirección" },
    { name: "capacidad", label: "Capacidad (personas)", type: "number" },
    { name: "whatsapp", label: "WhatsApp" },
    { name: "instagram", label: "Instagram", ayuda: "Por ejemplo @miboliche" },
    { name: "descripcion", label: "Descripción", type: "textarea" },
  ];
  const adminIds = new Set(boliche.admins.map((a) => a.id_usuario));

  const accion = async (promesa, ok) => {
    try {
      await promesa;
      message.success(ok);
      await recargar();
    } catch (e) {
      message.error(mensajeError(e, "No se pudo completar la acción"));
    }
  };

  return (
    <div className="ficha-boliche">
      <Card
        variant="borderless"
        title="Datos del local"
        extra={permisos.puedeEditarLocal && <Button onClick={() => setEditando(true)}>Editar datos</Button>}
      >
        <Descriptions
          size="small"
          column={{ xs: 1, sm: 2, lg: 3 }}
          layout="vertical"
          items={[
            { key: "direccion", label: "Dirección", children: boliche.direccion ?? "—" },
            { key: "capacidad", label: "Capacidad", children: boliche.capacidad ? `${boliche.capacidad.toLocaleString("es-AR")} personas` : "—" },
            { key: "pagina", label: "Página", children: <a href={`/b/${boliche.subdominio}`}>/b/{boliche.subdominio}</a> },
            { key: "instagram", label: "Instagram", children: boliche.instagram ? <span><InstagramOutlined /> {boliche.instagram}</span> : "—" },
            { key: "whatsapp", label: "WhatsApp", children: boliche.whatsapp ? <span><WhatsAppOutlined /> {boliche.whatsapp}</span> : "—" },
            { key: "equipo", label: "Equipo de RRPP", children: `${boliche.equipo} personas` },
            { key: "descripcion", label: "Descripción", span: "filled", children: boliche.descripcion ?? "—" },
          ]}
        />
      </Card>

      {permisos.esSuperadmin && (
        <Card variant="borderless" title="Admins del boliche" extra={<span className="muted">{boliche.admins.length} {boliche.admins.length === 1 ? "admin" : "admins"}</span>}>
          <Space orientation="vertical" style={{ width: "100%" }} size={12}>
            <Space wrap>
              {boliche.admins.map((a) => (
                <Popconfirm
                  key={a.id_usuario}
                  title={`¿Quitar a ${a.nombre_completo} de este boliche?`}
                  okText="Quitar"
                  cancelText="Cancelar"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => accion(bolichesApi.quitarAdmin(boliche.id_boliche, a.id_usuario), "Admin quitado")}
                >
                  <Tag closable onClose={(e) => e.preventDefault()}>{a.nombre_completo} · {a.email}</Tag>
                </Popconfirm>
              ))}
            </Space>
            <Space.Compact style={{ maxWidth: 520, width: "100%" }}>
              <Select
                showSearch
                optionFilterProp="label"
                style={{ width: "100%" }}
                placeholder="Sumar un admin que ya existe"
                value={nuevoAdmin}
                onChange={setNuevoAdmin}
                options={usuarios.filter((u) => !adminIds.has(u.id_usuario)).map((u) => ({ value: u.id_usuario, label: `${u.nombre_completo} (${u.email})` }))}
              />
              <Button
                type="primary"
                disabled={!nuevoAdmin}
                onClick={() => accion(bolichesApi.agregarAdmin(boliche.id_boliche, nuevoAdmin).then(() => setNuevoAdmin(null)), "Admin sumado")}
              >
                Sumar
              </Button>
            </Space.Compact>
            <span className="muted">Para crear un admin nuevo, andá a Usuarios. Un boliche siempre tiene que conservar al menos uno.</span>
          </Space>
        </Card>
      )}

      {editando && (
        <FormModal
          titulo="Editar datos del local"
          campos={campos}
          item={boliche}
          onGuardar={async (valores) => {
            try {
              await bolichesApi.editar(boliche.id_boliche, valores);
            } catch (e) {
              throw new Error(mensajeError(e, "No se pudo guardar"));
            }
            await recargar();
          }}
          onCerrar={() => setEditando(false)}
        />
      )}
    </div>
  );
}

// Ficha de un boliche: sus eventos, su equipo y sus datos. La ven el superadmin, el admin del boliche, su manager y sus RRPP.
// Quien no es del boliche recibe un 404 del back, y acá se muestra como "no existe".
export default function BolicheDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const permisos = usePermisos();
  const [boliche, setBoliche] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("eventos");

  const cargar = useCallback(async () => {
    try {
      setBoliche(await bolichesApi.obtenerUno(id));
      setError(null);
    } catch (e) {
      setBoliche(null);
      setError({ estado: e.response?.status, mensaje: mensajeError(e, "No se pudo cargar el boliche") });
    }
  }, [id]);

  useEffect(() => {
    setBoliche(null);
    cargar();
  }, [cargar]);

  if (error) {
    return (
      <main className="main">
        <Result
          status={error.estado === 404 ? "404" : "warning"}
          title={error.estado === 404 ? "No encontramos este boliche" : "No se pudo abrir el boliche"}
          subTitle={error.mensaje}
          extra={<Button onClick={() => navigate("/")}>Volver al inicio</Button>}
        />
      </main>
    );
  }
  if (!boliche) {
    return (
      <main className="main">
        <Skeleton active paragraph={{ rows: 6 }} />
      </main>
    );
  }

  const pestanas = [
    { key: "eventos", label: "Eventos", children: <PestanaEventos idBoliche={boliche.id_boliche} /> },
    ...(permisos.puedeVerEquipo ? [{ key: "equipo", label: "Equipo", children: <PestanaEquipo idBoliche={boliche.id_boliche} /> }] : []),
    { key: "datos", label: "Datos del local", children: <PestanaDatos boliche={boliche} recargar={cargar} /> },
  ];
  const puedeVolver = permisos.esSuperadmin || permisos.esAdmin;

  return (
    <main className="main">
      <Topbar sinBuscador />

      <div className="page-head">
        <div>
          {puedeVolver && (
            <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate("/boliches")} style={{ padding: 0 }}>
              Boliches
            </Button>
          )}
          <div className="eyebrow">{fechaLarga()}</div>
          <h1>{boliche.nombre}</h1>
          <Space wrap style={{ marginTop: 8 }}>
            <Estado estado={boliche.activo ? "Activo" : "Desactivado"} color={boliche.activo ? "var(--lime)" : "var(--muted)"} />
            <Button size="small" shape="round" icon={<GlobalOutlined />} onClick={() => navigate(`/b/${boliche.subdominio}`)}>
              Ver página pública
            </Button>
          </Space>
        </div>
      </div>

      {!boliche.activo && <Alert type="warning" showIcon title="Este boliche está desactivado: no se ve en la página pública." />}

      {/* Lo de la pantalla principal del manager y del RRPP que llega en la fase 4. */}
      {permisos.esManager && (
        <Proximamente items={[{ titulo: "Resultados de ventas por RRPP", texto: "Entradas asignadas y vendidas por cada RRPP, y el ranking.", fase: 4 }]} />
      )}
      {permisos.esRrpp && (
        <Proximamente
          items={[
            { titulo: "Tus ventas y tu comisión", texto: "Lo que vendiste y lo que ganaste.", fase: 4 },
            { titulo: "Tus listas de invitados", texto: "Armá tus listas y controlá el QR en la puerta.", fase: 4 },
          ]}
        />
      )}

      <Tabs activeKey={tab} onChange={setTab} items={pestanas} />
    </main>
  );
}
