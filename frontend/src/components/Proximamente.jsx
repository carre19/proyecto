import { Card, Empty } from "antd";

// Bloques de la pantalla principal que todavía no están hechos (llegan en una fase posterior del plan, ver README).
// items: [{ titulo, texto, fase }]
export default function Proximamente({ items }) {
  return (
    <div className="proximamente">
      {items.map((it) => (
        <Card key={it.titulo} variant="borderless" title={it.titulo}>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`${it.texto} Disponible en la fase ${it.fase}.`} />
        </Card>
      ))}
    </div>
  );
}
