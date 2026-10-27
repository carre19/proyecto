import { MoonOutlined, SunOutlined } from "@ant-design/icons";
import { Button } from "antd";
import useTema from "../hooks/useTema.js";

// Botón que alterna entre modo claro y oscuro. Al cambiar se muestra el splash (ver utils/tema.js).
// El texto dice a qué modo se va a pasar.
export default function BotonTema({ className = "", bloque = false }) {
  const [tema, alternar] = useTema();
  const aClaro = tema === "dark";
  return (
    <Button
      shape="round"
      block={bloque}
      className={`boton-tema ${className}`}
      icon={aClaro ? <SunOutlined /> : <MoonOutlined />}
      onClick={alternar}
    >
      {aClaro ? "Modo claro" : "Modo oscuro"}
    </Button>
  );
}
