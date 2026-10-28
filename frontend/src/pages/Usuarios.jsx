import { SafetyCertificateOutlined } from "@ant-design/icons";
import { App, Button, Popconfirm } from "antd";
import PaginaCrud from "../components/PaginaCrud.jsx";
import Estado from "../components/Estado.jsx";
import { usuariosApi } from "../api/plataforma.js";
import { ROLES } from "../utils/formato.js";

const COLOR_ROL = { superadmin: "var(--red)", admin: "var(--amber)", rrpp_manager: "var(--violet)", rrpp: "var(--pink)", cliente: "var(--cyan)" };

// Usuarios de todo el sistema (solo el superadmin). Acá se dan de alta los admins, que después se asignan a uno o más boliches;
// managers y RRPP los da de alta el admin desde su boliche, y los clientes se registran solos.
const config = {
  titulo: "Usuarios",
  singular: "admin",
  api: usuariosApi,
  id: "id_usuario",
  sinEliminar: true,
  // Un admin que perdió el celular y los códigos de recuperación: el superadmin le restablece la verificación en dos pasos.
  acciones: (u) => ["admin", "superadmin"].includes(u.rol) && <RestablecerVerificacion usuario={u} />,
  buscar: (u) => `${u.nombre_completo} ${u.email} ${ROLES[u.rol]} ${u.boliches.map((b) => b.nombre).join(" ")}`,
  columnas: [
    { titulo: "Nombre", render: (u) => u.nombre_completo },
    { titulo: "Email", render: (u) => u.email },
    { titulo: "Rol", render: (u) => <Estado estado={ROLES[u.rol]} color={COLOR_ROL[u.rol]} /> },
    { titulo: "Boliches", render: (u) => u.boliches.map((b) => b.nombre).join(", ") || "—" },
    { titulo: "Estado", render: (u) => <Estado estado={u.activo ? "Activo" : "Desactivado"} color={u.activo ? "var(--lime)" : "var(--muted)"} /> },
  ],
  campos: [
    { name: "nombre", label: "Nombre", required: true },
    { name: "apellido", label: "Apellido", required: true },
    { name: "email", label: "Email de acceso", type: "email", required: true },
    { name: "password", label: "Contraseña", type: "password", required: true, minimo: 8, ayuda: "Mínimo 8 caracteres." },
    { name: "dni", label: "DNI" },
    { name: "telefono", label: "Teléfono" },
  ],
  camposEdicion: [
    { name: "nombre", label: "Nombre", required: true },
    { name: "apellido", label: "Apellido", required: true },
    { name: "telefono", label: "Teléfono" },
    {
      name: "activo", label: "Estado de la cuenta", type: "select", required: true, defecto: true,
      options: [{ value: true, label: "Activa" }, { value: false, label: "Desactivada" }],
      ayuda: "Una cuenta desactivada no puede iniciar sesión.",
    },
  ],
};

function RestablecerVerificacion({ usuario }) {
  const { message } = App.useApp();
  return (
    <Popconfirm title={`¿Restablecer la verificación en dos pasos de ${usuario.nombre_completo}?`} description="Va a tener que volver a activarla la próxima vez que entre." okText="Restablecer" cancelText="No"
      onConfirm={() => usuariosApi.resetear2fa(usuario.id_usuario).then(() => message.success("Verificación restablecida")).catch((e) => message.error(e.response?.data?.mensaje ?? "No se pudo restablecer"))}>
      <Button type="text" icon={<SafetyCertificateOutlined />} title="Restablecer la verificación en dos pasos" aria-label="Restablecer la verificación en dos pasos" />
    </Popconfirm>
  );
}

export default function Usuarios() {
  return <PaginaCrud config={config} />;
}
