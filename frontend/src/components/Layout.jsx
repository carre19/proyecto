import { BankOutlined, DollarOutlined, LogoutOutlined, SafetyCertificateOutlined, ShopOutlined, TeamOutlined } from "@ant-design/icons";
import { Avatar, Button, Dropdown, Menu, Result, Tooltip } from "antd";
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { iniciales, inicioDe, rolDe } from "../utils/formato.js";
import BotonTema from "./BotonTema.jsx";
import Logo from "./Logo.jsx";

// Secciones del menú de cada rol (menú lateral en escritorio y barra inferior en móvil):
//   superadmin -> Boliches y Usuarios | admin -> Mis boliches | manager y RRPP -> directo a su boliche
export const seccionesDe = (usuario) => {
  switch (usuario?.rol) {
    case "superadmin":
      return [
        { to: "/boliches", label: "Boliches", icono: <ShopOutlined /> },
        { to: "/plataforma", label: "Plataforma", icono: <BankOutlined /> },
        { to: "/finanzas", label: "Finanzas", icono: <DollarOutlined /> },
        { to: "/usuarios", label: "Usuarios", icono: <TeamOutlined /> },
        { to: "/seguridad", label: "Seguridad", icono: <SafetyCertificateOutlined /> },
      ];
    case "admin":
      return [
        { to: "/boliches", label: "Mis boliches", icono: <ShopOutlined /> },
        { to: "/finanzas", label: "Finanzas", icono: <DollarOutlined /> },
        { to: "/seguridad", label: "Seguridad", icono: <SafetyCertificateOutlined /> },
      ];
    case "rrpp_manager":
    case "rrpp":
      return usuario.boliches?.length ? [{ to: inicioDe(usuario), label: "Mi boliche", icono: <ShopOutlined /> }] : [];
    default:
      return [];
  }
};

// Estilo del círculo con las iniciales del usuario.
const ESTILO_AVATAR = { background: "var(--amber)", color: "var(--on-primary)", fontWeight: 700 };

// Estructura de las páginas privadas: menú lateral fijo en escritorio, cabecera + barra inferior en móvil.
// <Outlet /> es donde React Router dibuja la página activa (Eventos, Clientes, etc.).
export default function Layout() {
  const { usuario, salir } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // El cliente no tiene panel: va a la parte pública.
  if (usuario?.rol === "cliente") return <Navigate to="/explorar" replace />;

  const secciones = seccionesDe(usuario);
  const inicio = inicioDe(usuario);

  const cerrarSesion = () => {
    salir();
    navigate("/login");
  };

  const nombre = usuario?.nombre_completo ?? usuario?.email;

  return (
    <div className="shell">
      <aside className="side">
        <Logo to={inicio} />

        {/* Menú de Ant Design: la sección activa sale de la URL actual. */}
        <Menu
          mode="inline"
          className="menu-lateral"
          selectedKeys={[secciones.find((s) => pathname === s.to || pathname.startsWith(`${s.to}/`))?.to ?? pathname]}
          items={secciones.map((s) => ({ key: s.to, icon: s.icono, label: s.label }))}
          onClick={({ key }) => navigate(key)}
        />

        <BotonTema bloque className="boton-tema--side" />

        <div className="me">
          <Avatar style={ESTILO_AVATAR}>{iniciales(usuario?.nombre_completo)}</Avatar>
          <div className="who">
            <b>{nombre}</b>
            <span>{rolDe(usuario)}</span>
          </div>
          <Tooltip title="Cerrar sesión">
            <Button type="text" shape="circle" icon={<LogoutOutlined />} aria-label="Cerrar sesión" onClick={cerrarSesion} />
          </Tooltip>
        </div>
      </aside>

      {/* Cabecera que solo se ve en teléfono. */}
      <div className="mobile-top">
        <Logo to={inicio} />
        <BotonTema />
        <Dropdown
          trigger={["click"]}
          menu={{ items: [{ key: "salir", icon: <LogoutOutlined />, label: "Cerrar sesión", onClick: cerrarSesion }] }}
        >
          <Avatar style={{ ...ESTILO_AVATAR, cursor: "pointer" }} size={40}>
            {iniciales(usuario?.nombre_completo)}
          </Avatar>
        </Dropdown>
      </div>

      {/* Manager o RRPP que todavía no están en el equipo de ningún boliche: no hay nada que mostrar. */}
      {secciones.length ? (
        <Outlet />
      ) : (
        <main className="main">
          <Result
            status="info"
            title="Todavía no estás asignado a un boliche"
            subTitle="El admin del boliche tiene que sumarte a su equipo para que puedas ver su información."
            extra={<Button onClick={cerrarSesion}>Cerrar sesión</Button>}
          />
        </main>
      )}

      {/* Barra inferior que solo se ve en teléfono. NavLink marca con "on" la sección activa. */}
      <nav className="mobile-nav">
        {secciones.map((s) => (
          <NavLink key={s.to} to={s.to} className={({ isActive }) => (isActive ? "on" : "")}>
            {s.icono}
            {s.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
