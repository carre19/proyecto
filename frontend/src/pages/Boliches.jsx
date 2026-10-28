import { ArrowRightOutlined } from "@ant-design/icons";
import { Button } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { bolichesApi, usuariosApi } from "../api/plataforma.js";
import Estado from "../components/Estado.jsx";
import PaginaCrud from "../components/PaginaCrud.jsx";
import usePermisos from "../hooks/usePermisos.js";

const COBROS = [{ value: "mensual", label: "Mensual" }, { value: "evento_unico", label: "Evento único" }];
const ESTADOS = [{ value: true, label: "Activo" }, { value: false, label: "Desactivado" }];

// Boliches. El superadmin los ve todos, los crea (junto con su admin) y maneja el cobro de la plataforma.
// El admin ve solo los suyos y edita los datos de su local. Cada fila abre la ficha del boliche.
export default function Boliches() {
  const navigate = useNavigate();
  const permisos = usePermisos();
  const [admins, setAdmins] = useState([]);

  // Para elegir los admins de un boliche nuevo (solo el superadmin puede ver a los usuarios).
  useEffect(() => {
    if (!permisos.esSuperadmin) return;
    usuariosApi.obtenerTodos().then((u) => setAdmins(u.filter((x) => x.rol === "admin" && x.activo))).catch(() => setAdmins([]));
  }, [permisos.esSuperadmin]);

  const config = useMemo(() => {
    const datosDelLocal = [
      { name: "nombre", label: "Nombre", required: true },
      { name: "direccion", label: "Dirección" },
      { name: "capacidad", label: "Capacidad (personas)", type: "number" },
      { name: "whatsapp", label: "WhatsApp" },
      { name: "instagram", label: "Instagram", ayuda: "Por ejemplo @miboliche" },
      { name: "descripcion", label: "Descripción", type: "textarea" },
    ];
    // Lo de la plataforma (dirección web, cobro y estado) lo define el superadmin.
    const datosDeLaPlataforma = [
      { name: "subdominio", label: "Subdominio", required: true, ayuda: "3 a 30 letras minúsculas, números o guiones. La página será /b/subdominio." },
      { name: "tipo_cobro", label: "Cobro de la plataforma", type: "select", required: true, defecto: "mensual", options: COBROS },
      { name: "monto_mensual", label: "Monto mensual ($)", type: "number", ayuda: "Lo que paga el boliche por mes (o el monto del evento único)." },
    ];

    return {
      titulo: "Boliches",
      singular: "boliche",
      api: bolichesApi,
      id: "id_boliche",
      sinEliminar: true,
      puedeCrear: (p) => p.puedeCrearBoliches,
      puedeEditar: (p) => p.puedeEditarLocal,
      buscar: (b) => `${b.nombre} ${b.subdominio} ${b.direccion ?? ""} ${b.admins.map((a) => a.nombre_completo).join(" ")}`,
      columnas: [
        { titulo: "Boliche", render: (b) => b.nombre },
        { titulo: "Subdominio", render: (b) => `/b/${b.subdominio}` },
        { titulo: "Dirección", render: (b) => b.direccion ?? "—" },
        { titulo: "Capacidad", render: (b) => (b.capacidad ? b.capacidad.toLocaleString("es-AR") : "—") },
        ...(permisos.esSuperadmin ? [{ titulo: "Admins", render: (b) => b.admins.map((a) => a.nombre_completo).join(", ") || "—" }] : []),
        { titulo: "Próximos eventos", render: (b) => b.proximos_eventos },
        { titulo: "Estado", render: (b) => <Estado estado={b.activo ? "Activo" : "Desactivado"} color={b.activo ? "var(--lime)" : "var(--muted)"} /> },
      ],
      acciones: (b) => (
        <Button type="text" icon={<ArrowRightOutlined />} onClick={() => navigate(`/boliches/${b.id_boliche}`)}>
          Abrir
        </Button>
      ),
      // Al crear: los datos del local, los de la plataforma y quién lo administra (uno existente o uno nuevo).
      campos: [
        ...datosDelLocal.slice(0, 3),
        ...datosDeLaPlataforma,
        { name: "id_admins", label: "Admins que ya existen", type: "multiselect", full: true, options: admins.map((a) => ({ value: a.id_usuario, label: `${a.nombre_completo} (${a.email})` })), ayuda: "Elegí uno o más, o cargá un admin nuevo acá abajo." },
        { name: "admin_nombre", label: "Admin nuevo: nombre" },
        { name: "admin_apellido", label: "Admin nuevo: apellido" },
        { name: "admin_email", label: "Admin nuevo: email", type: "email" },
        { name: "admin_password", label: "Admin nuevo: contraseña", type: "password", minimo: 8 },
      ],
      camposEdicion: permisos.esSuperadmin
        ? [...datosDelLocal, ...datosDeLaPlataforma, { name: "activo", label: "Estado", type: "select", required: true, defecto: true, options: ESTADOS, ayuda: "Un boliche desactivado deja de verse en la página pública y de entrar al panel." }]
        : datosDelLocal,
      guardar: async (item, valores) => {
        if (item) return bolichesApi.editar(item.id_boliche, valores);
        const { id_admins, admin_nombre, admin_apellido, admin_email, admin_password, ...boliche } = valores;
        const hayAdminNuevo = Boolean(admin_nombre || admin_apellido || admin_email || admin_password);
        if (hayAdminNuevo && !(admin_nombre && admin_apellido && admin_email && admin_password)) {
          throw new Error("Para el admin nuevo completá nombre, apellido, email y contraseña.");
        }
        if (!hayAdminNuevo && !id_admins?.length) {
          throw new Error("Un boliche necesita al menos un admin: elegí uno que ya exista o cargá uno nuevo.");
        }
        return bolichesApi.crear({
          ...boliche,
          id_admins,
          ...(hayAdminNuevo ? { admin: { nombre: admin_nombre, apellido: admin_apellido, email: admin_email, password: admin_password } } : {}),
        });
      },
    };
  }, [admins, navigate]);

  return <PaginaCrud config={config} />;
}
