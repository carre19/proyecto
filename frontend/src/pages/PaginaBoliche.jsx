import { ArrowLeftOutlined, EnvironmentOutlined, InstagramOutlined, WhatsAppOutlined } from "@ant-design/icons";
import { Button, Card, Empty, Image, Result, Skeleton, Space, Tag } from "antd";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { publicoApi } from "../api/plataforma.js";
import CabeceraPublica from "../components/CabeceraPublica.jsx";
import Proximamente from "../components/Proximamente.jsx";
import { fechaHora } from "../utils/formato.js";

// Página pública de un boliche (/b/:subdominio): datos, ubicación, redes y próximos eventos.
// Los precios, las tandas de entradas y "mis entradas con QR" llegan en la fase 2.
export default function PaginaBoliche() {
  const { subdominio } = useParams();
  const navigate = useNavigate();
  const [boliche, setBoliche] = useState(null);
  const [noExiste, setNoExiste] = useState(false);

  useEffect(() => {
    setBoliche(null);
    setNoExiste(false);
    publicoApi.boliche(subdominio).then(setBoliche).catch(() => setNoExiste(true));
  }, [subdominio]);

  if (noExiste) {
    return (
      <div className="pub">
        <CabeceraPublica />
        <Result status="404" title="No encontramos este boliche" subTitle="Puede que la dirección esté mal escrita o que el boliche ya no esté activo."
          extra={<Button type="primary" onClick={() => navigate("/explorar")}>Ver los boliches</Button>} />
      </div>
    );
  }
  if (!boliche) {
    return (
      <div className="pub">
        <CabeceraPublica />
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }

  // Mapa: con coordenadas, un punto exacto; si no, se busca por la dirección.
  const mapa = boliche.latitud != null && boliche.longitud != null
    ? `https://www.google.com/maps?q=${boliche.latitud},${boliche.longitud}`
    : boliche.direccion ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(boliche.direccion)}` : null;
  const whatsapp = boliche.whatsapp ? `https://wa.me/${boliche.whatsapp.replace(/\D/g, "")}` : null;
  const instagram = boliche.instagram ? `https://instagram.com/${boliche.instagram.replace(/^@/, "")}` : null;

  return (
    <div className="pub">
      <CabeceraPublica />

      <div className="pub-ancho">
        <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate("/explorar")} style={{ padding: 0, alignSelf: "flex-start" }}>
          Todos los boliches
        </Button>
        <span className="eyebrow">BOLICHE</span>
        <h1>{boliche.nombre}</h1>
        {boliche.descripcion && <p className="pub-lead">{boliche.descripcion}</p>}

        <Space wrap>
          {boliche.direccion && (
            <Button shape="round" icon={<EnvironmentOutlined />} href={mapa ?? undefined} target="_blank" rel="noreferrer">
              {boliche.direccion}
            </Button>
          )}
          {instagram && <Button shape="round" icon={<InstagramOutlined />} href={instagram} target="_blank" rel="noreferrer">{boliche.instagram}</Button>}
          {whatsapp && <Button shape="round" icon={<WhatsAppOutlined />} href={whatsapp} target="_blank" rel="noreferrer">WhatsApp</Button>}
        </Space>

        {boliche.fotos.length > 0 && (
          <Image.PreviewGroup>
            <div className="pub-fotos">
              {boliche.fotos.map((f) => <Image key={f} src={f} alt={boliche.nombre} />)}
            </div>
          </Image.PreviewGroup>
        )}

        <h2>Próximos eventos</h2>
        {boliche.eventos.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Todavía no hay eventos publicados." />
        ) : (
          <div className="grilla-boliches">
            {boliche.eventos.map((e) => (
              <Card key={e.id_evento} variant="borderless" cover={e.imagen ? <img className="evento-flyer" src={e.imagen} alt={e.nombre} /> : undefined}>
                <span className="eyebrow">{fechaHora(e.fecha_hora)}</span>
                <h3>{e.nombre}</h3>
                {e.artistas.length > 0 && <p>{e.artistas.join(" · ")}</p>}
                {e.descripcion && <p className="muted">{e.descripcion}</p>}
                <Space wrap size={[6, 6]}>
                  <Tag>{e.edad_minima}+</Tag>
                  {e.dress_code && <Tag>Dress code: {e.dress_code}</Tag>}
                  {e.tiene_vip && <Tag color="gold">Sector VIP{e.mesas_vip ? ` · ${e.mesas_vip} mesas` : ""}</Tag>}
                </Space>
              </Card>
            ))}
          </div>
        )}

        <Proximamente items={[{ titulo: "Entradas y precios", texto: "Tandas, VIP, precio virtual y de puerta, y tus entradas compradas con el QR.", fase: 2 }]} />
      </div>
    </div>
  );
}
