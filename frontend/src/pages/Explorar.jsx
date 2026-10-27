import { EnvironmentOutlined, InstagramOutlined } from "@ant-design/icons";
import { Alert, Card, Empty, Input, Skeleton } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { publicoApi } from "../api/plataforma.js";
import CabeceraPublica from "../components/CabeceraPublica.jsx";
import { mensajeError } from "../services/api.js";

// Lista pública de boliches: la ve cualquier persona, con o sin cuenta. Cada tarjeta abre la página del boliche.
export default function Explorar() {
  const navigate = useNavigate();
  const [boliches, setBoliches] = useState(null);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    publicoApi.boliches().then(setBoliches).catch((e) => setError(mensajeError(e, "No se pudieron cargar los boliches")));
  }, []);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (boliches ?? []).filter((b) => !q || `${b.nombre} ${b.direccion ?? ""} ${b.descripcion ?? ""}`.toLowerCase().includes(q));
  }, [boliches, busqueda]);

  return (
    <div className="pub">
      <CabeceraPublica />

      <div className="pub-ancho">
        <span className="eyebrow">BOLICHES Y BARES</span>
        <h1>Elegí tu noche</h1>
        <Input.Search
          className="pub-buscador"
          size="large"
          allowClear
          placeholder="Buscar un boliche…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />

        {error && <Alert type="error" showIcon title={error} />}
        {!boliches && !error && <Skeleton active paragraph={{ rows: 5 }} />}

        {boliches && visibles.length === 0 && (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={busqueda ? "No encontramos ese boliche." : "Todavía no hay boliches."} />
        )}

        <div className="grilla-boliches">
          {visibles.map((b) => (
            <Card key={b.id_boliche} variant="borderless" hoverable onClick={() => navigate(`/b/${b.subdominio}`)}>
              <h3>{b.nombre}</h3>
              {b.direccion && <p className="muted"><EnvironmentOutlined /> {b.direccion}</p>}
              {b.descripcion && <p>{b.descripcion}</p>}
              {b.instagram && <p className="muted"><InstagramOutlined /> {b.instagram}</p>}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
