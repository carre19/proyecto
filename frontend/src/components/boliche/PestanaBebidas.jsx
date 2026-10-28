import { Image } from "antd";
import { useMemo } from "react";
import { apiDeBoliche, imagenesApi } from "../../api/plataforma.js";
import { moneda } from "../../utils/formato.js";
import AccionesImagen from "../AccionesImagen.jsx";
import Estado from "../Estado.jsx";
import PaginaCrud from "../PaginaCrud.jsx";

const SI_NO = [{ value: true, label: "Sí, en la carta" }, { value: false, label: "No, fuera de la carta" }];

// Carta de bebidas del boliche: cada bebida que se agrega queda guardada (tabla "bebida"). "Disponible" la saca de la carta
// pública sin borrarla. Las ven todos los del boliche; las editan el superadmin y el admin.
export default function PestanaBebidas({ idBoliche }) {
  const config = useMemo(() => {
    const api = apiDeBoliche(idBoliche, "bebidas");
    return {
      titulo: "Bebidas",
      singular: "bebida",
      femenino: true,
      api,
      id: "id_bebida",
      embebida: true,
      puedeCrear: (p) => p.puedeEditarLocal,
      puedeEditar: (p) => p.puedeEditarLocal,
      acciones: (b, { recargar }) => (
        <AccionesImagen
          imagen={b.imagen}
          recargar={recargar}
          onSubir={(archivo) => imagenesApi.subirImagenBebida(idBoliche, b.id_bebida, archivo)}
          onBorrar={() => imagenesApi.borrarImagenBebida(idBoliche, b.id_bebida)}
        />
      ),
      columnas: [
        { titulo: "Foto", render: (b) => (b.imagen ? <Image src={b.imagen} alt={b.nombre} width={48} height={48} style={{ objectFit: "cover", borderRadius: 8 }} /> : "—") },
        { titulo: "Bebida", render: (b) => b.nombre },
        { titulo: "Categoría", render: (b) => b.categoria },
        { titulo: "Precio", render: (b) => moneda(b.precio) },
        { titulo: "Carta", render: (b) => <Estado estado={b.disponible ? "En la carta" : "Fuera de la carta"} color={b.disponible ? "var(--lime)" : "var(--muted)"} /> },
        { titulo: "Descripción", render: (b) => b.descripcion ?? "—" },
      ],
      campos: [
        { name: "categoria", label: "Categoría", required: true, ayuda: "Por ejemplo: Tragos, Cervezas, Botellas, Sin alcohol." },
        { name: "nombre", label: "Nombre", required: true },
        { name: "precio", label: "Precio ($)", type: "number", required: true, step: 500, ayuda: "En pesos, sin centavos." },
        { name: "disponible", label: "¿Está en la carta?", type: "select", required: true, defecto: true, options: SI_NO },
        { name: "descripcion", label: "Descripción", type: "textarea" },
      ],
    };
  }, [idBoliche]);

  return <PaginaCrud config={config} />;
}
