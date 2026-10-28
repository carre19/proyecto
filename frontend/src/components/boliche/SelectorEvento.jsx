import { Select } from "antd";
import { useEffect, useState } from "react";
import { apiDeBoliche } from "../../api/plataforma.js";
import { eventoPorDefecto, fechaHora } from "../../utils/formato.js";

// Lista desplegable con los eventos del boliche (arranca en el próximo). Avisa el evento elegido con onElegir(evento | null).
// Lo usan las pestañas que trabajan "por evento": ventas, puerta, listas y talonarios.
export default function SelectorEvento({ idBoliche, onElegir }) {
  const [eventos, setEventos] = useState([]);
  const [idEvento, setIdEvento] = useState(null);

  useEffect(() => {
    apiDeBoliche(idBoliche, "eventos").obtenerTodos().then((lista) => {
      setEventos(lista);
      const id = eventoPorDefecto(lista);
      setIdEvento(id);
      onElegir(lista.find((e) => e.id_evento === id) ?? null);
    }).catch(() => onElegir(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al cambiar de boliche
  }, [idBoliche]);

  return (
    <Select
      style={{ width: "100%", maxWidth: 460 }}
      value={idEvento}
      placeholder="Elegí un evento"
      onChange={(id) => { setIdEvento(id); onElegir(eventos.find((e) => e.id_evento === id) ?? null); }}
      options={eventos.map((e) => ({ value: e.id_evento, label: `${e.nombre} · ${fechaHora(e.fecha_hora)}` }))}
    />
  );
}
