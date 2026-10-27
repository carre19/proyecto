import { LoginOutlined, LogoutOutlined, ShopOutlined } from "@ant-design/icons";
import { Button, Space } from "antd";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { inicioDe } from "../utils/formato.js";
import BotonTema from "./BotonTema.jsx";
import Logo from "./Logo.jsx";

// Cabecera de las páginas públicas (lista de boliches y página de cada boliche).
// Sin sesión: botón para ingresar. Con sesión: el staff va a su panel; el cliente ve su nombre y puede salir.
export default function CabeceraPublica() {
  const { usuario, salir } = useAuth();
  const navigate = useNavigate();
  const esCliente = usuario?.rol === "cliente";

  return (
    <div className="pub-cabecera">
      <Logo />
      <Space wrap>
        <BotonTema />
        {!usuario && (
          <Button type="primary" shape="round" icon={<LoginOutlined />} onClick={() => navigate("/login")}>
            Ingresar
          </Button>
        )}
        {usuario && !esCliente && (
          <Button type="primary" shape="round" icon={<ShopOutlined />} onClick={() => navigate(inicioDe(usuario))}>
            Mi panel
          </Button>
        )}
        {esCliente && <span className="muted">{usuario.nombre_completo}</span>}
        {usuario && (
          <Button shape="round" icon={<LogoutOutlined />} onClick={() => { salir(); navigate("/explorar"); }}>
            Salir
          </Button>
        )}
      </Space>
    </div>
  );
}
