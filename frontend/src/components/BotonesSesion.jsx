import { LoginOutlined, LogoutOutlined, ShopOutlined } from "@ant-design/icons";
import { Button, Space } from "antd";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { inicioDe } from "../utils/formato.js";

// Sin sesión: botón para ingresar. Con sesión: el staff va a su panel; el cliente ve su nombre. Quien entró puede salir.
// Lo usan la cabecera pública y la página de cada boliche (que tiene sus propios colores).
export default function BotonesSesion() {
  const { usuario, salir } = useAuth();
  const navigate = useNavigate();
  const esCliente = usuario?.rol === "cliente";

  return (
    <>
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
    </>
  );
}
