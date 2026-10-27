import { Tag } from "antd";
import { etiqueta } from "../utils/formato.js";

// Etiqueta de estado con color (evento, propuesta, tarea). "color" es una variable CSS como "var(--lime)":
// el fondo es ese color muy suave y el texto el color pleno, así funciona igual en los dos temas.
export default function Estado({ estado, color = "var(--muted)", className }) {
  return (
    <Tag
      variant="filled"
      className={className}
      style={{ "--c": color, color: "var(--c)", background: "color-mix(in srgb, var(--c) 16%, transparent)", fontWeight: 500, marginInlineEnd: 0 }}
    >
      {etiqueta(estado)}
    </Tag>
  );
}
