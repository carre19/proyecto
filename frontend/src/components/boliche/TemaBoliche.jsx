import { ConfigProvider, theme } from "antd";
import { useMemo } from "react";
import { textoSobre } from "../../utils/colores.js";

const FUENTE = '"Philosopher", Georgia, serif'; // la misma tipografía griega de toda la app

// Envuelve una parte de la pantalla con los colores de UN boliche en UN modo (ver boliche_tema en la base).
//   colores -> { fondo, tarjetas, texto, acento } en #RRGGBB
//   modo    -> "claro" | "oscuro" (le dice a Ant Design cómo calcular sombras, bordes y estados)
// Define las variables CSS --b-* que usa styles/boliche.css y, aparte, un ConfigProvider de antd con "inherit: false":
// los botones, etiquetas y tablas de adentro toman estos colores y no los del tema general de la app (rojo o mármol).
export default function TemaBoliche({ colores, modo, className = "", children }) {
  const { fondo, tarjetas, texto, acento } = colores;

  const configAnt = useMemo(
    () => ({
      inherit: false,
      algorithm: modo === "oscuro" ? theme.darkAlgorithm : theme.defaultAlgorithm,
      token: {
        fontFamily: FUENTE,
        fontSize: 15,
        borderRadius: 12,
        controlHeight: 42,
        colorPrimary: acento,
        colorLink: acento,
        colorBgBase: fondo,
        colorTextBase: texto,
        colorBgContainer: tarjetas,
        colorBgElevated: tarjetas,
      },
      components: { Button: { primaryColor: textoSobre(acento), fontWeight: 700 } },
    }),
    [modo, fondo, tarjetas, texto, acento]
  );

  const variables = { "--b-fondo": fondo, "--b-tarjetas": tarjetas, "--b-texto": texto, "--b-acento": acento, "--b-sobre-acento": textoSobre(acento), colorScheme: modo === "oscuro" ? "dark" : "light" };

  return (
    <ConfigProvider theme={configAnt}>
      <div className={`bol ${className}`} style={variables} data-modo={modo}>
        {children}
      </div>
    </ConfigProvider>
  );
}
