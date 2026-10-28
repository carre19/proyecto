import { ArrowLeftOutlined, DeleteOutlined, EnvironmentOutlined, GlobalOutlined, InstagramOutlined, StarOutlined, WhatsAppOutlined } from "@ant-design/icons";
import { Alert, App, Button, Card, Descriptions, Empty, Image, Popconfirm, Result, Select, Skeleton, Space, Tabs, Tag } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiDeBoliche, bolichesApi, fotosApi, imagenesApi, usuariosApi } from "../api/plataforma.js";
import AccionesImagen from "../components/AccionesImagen.jsx";
import PestanaBebidas from "../components/boliche/PestanaBebidas.jsx";
import PestanaDiseno from "../components/boliche/PestanaDiseno.jsx";
import PestanaEntradas from "../components/boliche/PestanaEntradas.jsx";
import PestanaMesas from "../components/boliche/PestanaMesas.jsx";
import PestanaListas from "../components/boliche/PestanaListas.jsx";
import PestanaResultados from "../components/boliche/PestanaResultados.jsx";
import PestanaTalonarios from "../components/boliche/PestanaTalonarios.jsx";
import PestanaPagos from "../components/boliche/PestanaPagos.jsx";
import PestanaPuerta from "../components/boliche/PestanaPuerta.jsx";
import PestanaVentas from "../components/boliche/PestanaVentas.jsx";
import Estado from "../components/Estado.jsx";
import FormModal from "../components/FormModal.jsx";
import PaginaCrud from "../components/PaginaCrud.jsx";
import SubirImagen from "../components/SubirImagen.jsx";
import Topbar from "../components/Topbar.jsx";
import usePermisos from "../hooks/usePermisos.js";
import { mensajeError } from "../services/api.js";
import { contacto, fechaHora, fechaLarga } from "../utils/formato.js";

const SI_NO = [{ value: true, label: "Sí" }, { value: false, label: "No" }];
const ESTADOS_EVENTO = [{ value: "publicado", label: "Publicado" }, { value: "cancelado", label: "Cancelado" }, { value: "finalizado", label: "Finalizado" }];
const COLOR_ESTADO_EVENTO = { publicado: "var(--lime)", cancelado: "var(--red)", finalizado: "var(--muted)" };
const COLOR_ROL_EQUIPO = { rrpp_manager: "var(--violet)", rrpp: "var(--pink)" };
const ROL_EQUIPO = { rrpp_manager: "RRPP manager", rrpp: "RRPP" };

// Admin y superadmin editan cualquier evento del boliche; el manager, solo los que creó él.
const puedeEditarEvento = (p, e) => p.esSuperadmin || p.esAdmin || (p.esManager && e.id_creador === p.yo);

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
      puedeEditar: puedeEditarEvento,
      // Subir, cambiar o quitar el flyer del evento: lo hace quien puede editar el evento.
      acciones: (e, { recargar }) =>
        puedeEditarEvento(permisos, e) && (
          <AccionesImagen
            imagen={e.imagen}
            recargar={recargar}
            onSubir={(archivo) => imagenesApi.subirImagenEvento(idBoliche, e.id_evento, archivo)}
            onBorrar={() => imagenesApi.borrarImagenEvento(idBoliche, e.id_evento)}
          />
        ),
      columnas: [
        { titulo: "Imagen", render: (e) => (e.imagen ? <Image src={e.imagen} alt={e.nombre} width={48} height={48} style={{ objectFit: "cover", borderRadius: 8 }} /> : "—") },
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
  }, [api, idBoliche, permisos]);

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
    { name: "capacidad", label: "Capacidad (personas)", type: "number", min: 1, ayuda: "Las entradas de cada evento no pueden repartir más que esto." },
    { name: "latitud", label: "Latitud", type: "number", min: -90, max: 90, step: 0.0001, ayuda: "Opcional. Con latitud y longitud el mapa marca el punto exacto." },
    { name: "longitud", label: "Longitud", type: "number", min: -180, max: 180, step: 0.0001 },
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
            {
              key: "ubicacion", label: "Ubicación",
              children: boliche.latitud != null && boliche.longitud != null
                ? <a href={`https://www.google.com/maps?q=${boliche.latitud},${boliche.longitud}`} target="_blank" rel="noreferrer"><EnvironmentOutlined /> {Number(boliche.latitud).toFixed(4)}, {Number(boliche.longitud).toFixed(4)}</a>
                : <span className="muted">Sin coordenadas</span>,
            },
            { key: "pagina", label: "Página", children: <a href={`/b/${boliche.subdominio}`}>/b/{boliche.subdominio}</a> },
            { key: "instagram", label: "Instagram", children: boliche.instagram ? <span><InstagramOutlined /> {boliche.instagram}</span> : "—" },
            { key: "whatsapp", label: "WhatsApp", children: boliche.whatsapp ? <span><WhatsAppOutlined /> {boliche.whatsapp}</span> : "—" },
            { key: "equipo", label: "Equipo de RRPP", children: `${boliche.equipo} personas` },
            { key: "descripcion", label: "Descripción", span: "filled", children: boliche.descripcion ?? "—" },
          ]}
        />
      </Card>

      <Card
        variant="borderless"
        title="Fotos del local (la primera es la portada)"
        extra={
          permisos.puedeEditarLocal && (
            <SubirImagen texto="Subir foto" onSubir={(archivo) => imagenesApi.subirFoto(boliche.id_boliche, archivo)} alTerminar={recargar} />
          )
        }
      >
        {boliche.fotos.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Todavía no hay fotos. Se muestran en la página pública del boliche." />
        ) : (
          <Image.PreviewGroup>
            <div className="galeria-fotos">
              {boliche.fotos.map((foto) => (
                <div key={foto.id_foto} className="galeria-foto">
                  <Image src={foto.url} alt={boliche.nombre} />
                  {foto.es_portada && <Tag color="gold" className="galeria-portada">Portada</Tag>}
                  {permisos.puedeEditarLocal && !foto.es_portada && (
                    <Button className="galeria-estrella" shape="circle" icon={<StarOutlined />} aria-label="Hacer portada" title="Hacer portada"
                      onClick={() => accion(fotosApi.marcarPortada(boliche.id_boliche, foto.id_foto), "Portada cambiada")} />
                  )}
                  {permisos.puedeEditarLocal && (
                    <Popconfirm
                      title="¿Borrar esta foto?"
                      okText="Borrar"
                      cancelText="Cancelar"
                      okButtonProps={{ danger: true }}
                      onConfirm={() => accion(imagenesApi.borrarFoto(boliche.id_boliche, foto.id_foto), "Foto borrada")}
                    >
                      <Button className="galeria-borrar" shape="circle" danger icon={<DeleteOutlined />} aria-label="Borrar foto" />
                    </Popconfirm>
                  )}
                </div>
              ))}
            </div>
          </Image.PreviewGroup>
        )}
        <p className="muted" style={{ marginTop: 12 }}>JPG, PNG o WebP, hasta 5 MB cada una y hasta 10 fotos (la primera es la portada).</p>
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

// Ficha de un boliche: sus eventos, entradas, bebidas, mesas VIP, colores, equipo y datos del local. La ven el superadmin, el admin del boliche, su manager y sus RRPP.
// Quien no es del boliche recibe un 404 del back, y acá se muestra como "no existe".
export default function BolicheDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const permisos = usePermisos();
  const [boliche, setBoliche] = useState(null);
  const [error, setError] = useState(null);
  // El manager y el RRPP arrancan en sus resultados (su pantalla principal); el resto, en los eventos.
  const [tab, setTab] = useState(permisos.esManager || permisos.esRrpp ? "resultados" : "eventos");

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
    { key: "entradas", label: "Entradas", children: <PestanaEntradas boliche={boliche} /> },
    { key: "resultados", label: "Resultados RRPP", children: <PestanaResultados idBoliche={boliche.id_boliche} /> },
    { key: "talonarios", label: "Talonarios", children: <PestanaTalonarios idBoliche={boliche.id_boliche} /> },
    { key: "listas", label: "Listas", children: <PestanaListas idBoliche={boliche.id_boliche} /> },
    { key: "ventas", label: "Ventas", children: <PestanaVentas idBoliche={boliche.id_boliche} /> },
    ...(permisos.puedeGestionarPagos ? [{ key: "pagos", label: "Pagos", children: <PestanaPagos idBoliche={boliche.id_boliche} /> }] : []),
    { key: "puerta", label: "Puerta", children: <PestanaPuerta idBoliche={boliche.id_boliche} /> },
    { key: "bebidas", label: "Bebidas", children: <PestanaBebidas idBoliche={boliche.id_boliche} /> },
    { key: "mesas", label: "Mesas VIP", children: <PestanaMesas idBoliche={boliche.id_boliche} /> },
    { key: "diseno", label: "Diseño", children: <PestanaDiseno idBoliche={boliche.id_boliche} /> },
    ...(permisos.puedeVerEquipo ? [{ key: "equipo", label: "Equipo", children: <PestanaEquipo idBoliche={boliche.id_boliche} /> }] : []),
    { key: "datos", label: "Datos del local", children: <PestanaDatos boliche={boliche} recargar={cargar} /> },
  ];
  // Al manager y al RRPP se les muestra primero lo que usan todos los días (su pantalla principal).
  if (permisos.esManager || permisos.esRrpp) {
    const primero = ["resultados", "talonarios", "listas", "ventas", "puerta"];
    pestanas.sort((x, y) => (primero.includes(y.key) ? 1 : 0) - (primero.includes(x.key) ? 1 : 0) || primero.indexOf(x.key) - primero.indexOf(y.key));
  }
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

      <Tabs activeKey={tab} onChange={setTab} items={pestanas} />
    </main>
  );
}
