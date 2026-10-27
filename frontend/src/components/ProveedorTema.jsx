import { App as AntApp, ConfigProvider } from "antd";
import esES from "antd/locale/es_ES";
import dayjs from "dayjs";
import "dayjs/locale/es";
import useTema from "../hooks/useTema.js";
import { temaAnt } from "../utils/temaAnt.js";

dayjs.locale("es"); // fechas de los selectores en español

// Envuelve toda la app con la configuración de Ant Design: idioma español y colores del tema vigente.
// Cuando el usuario cambia de modo, useTema vuelve a renderizar y antd actualiza todos sus componentes.
// <AntApp> habilita message / notification / modal con el tema correcto (se usan con App.useApp()).
export default function ProveedorTema({ children }) {
  const [tema] = useTema();
  return (
    <ConfigProvider locale={esES} theme={temaAnt(tema)}>
      <AntApp component={false}>{children}</AntApp>
    </ConfigProvider>
  );
}
