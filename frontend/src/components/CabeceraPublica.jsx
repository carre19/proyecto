import { Space } from "antd";
import BotonTema from "./BotonTema.jsx";
import BotonesSesion from "./BotonesSesion.jsx";
import Logo from "./Logo.jsx";

// Cabecera de las páginas públicas (lista de boliches).
// Sin sesión: botón para ingresar. Con sesión: el staff va a su panel; el cliente ve su nombre y puede salir.
export default function CabeceraPublica() {
  return (
    <div className="pub-cabecera">
      <Logo />
      <Space wrap>
        <BotonTema />
        <BotonesSesion />
      </Space>
    </div>
  );
}
