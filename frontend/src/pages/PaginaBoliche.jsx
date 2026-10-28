import { ArrowLeftOutlined, EnvironmentOutlined, InstagramOutlined, MoonOutlined, SunOutlined, TeamOutlined, WhatsAppOutlined } from "@ant-design/icons";
import { Button, Empty, Image, Result, Skeleton, Space } from "antd";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { publicoApi, rrppApi } from "../api/plataforma.js";
import BotonesSesion from "../components/BotonesSesion.jsx";
import TemaBoliche from "../components/boliche/TemaBoliche.jsx";
import CabeceraPublica from "../components/CabeceraPublica.jsx";
import ModalCompra from "../components/ventas/ModalCompra.jsx";
import { fechaHora, moneda } from "../utils/formato.js";

const hayEntradasDisponibles = (e) => e.entradas.some((t) => t.estado === "disponible");
const ESTADO_ENTRADA = { disponible: "Disponible", agotada: "Agotada", no_disponible: "No disponible" };
const ESTADO_MESA = { disponible: "Disponible", reservada: "Reservada" };

// Etiqueta de disponibilidad: llena con el acento del boliche si se puede comprar o reservar, apagada si no.
const Disponibilidad = ({ estado, textos }) => (
  <span className={`bol-estado ${estado === "disponible" ? "bol-estado--si" : "bol-estado--no"}`}>{textos[estado]}</span>
);

// Las bebidas llegan ordenadas por categoría; acá se agrupan para mostrar la carta por secciones.
const agruparPorCategoria = (bebidas) => {
  const grupos = new Map();
  for (const b of bebidas) grupos.set(b.categoria, [...(grupos.get(b.categoria) ?? []), b]);
  return [...grupos].map(([categoria, items]) => ({ categoria, items }));
};

// Página pública de un boliche (/b/:subdominio): su ficha, fotos, próximos eventos con sus entradas y mesas VIP,
// las mesas VIP del local y la carta de bebidas. Tiene los colores y el modo claro/oscuro de ESE boliche
// (se abre siempre en oscuro; el botón de arriba alterna solo esta página, no el modo de la app).
// La compra de entradas, la reserva de mesas y "mis entradas con QR" llegan en la fase 2.
export default function PaginaBoliche({ subdominioFijo }) {
  // Entrando por boliche-uno.<dominio> el subdominio sale de la dirección; si no, de la ruta /b/:subdominio.
  const { subdominio: deLaRuta } = useParams();
  const subdominio = subdominioFijo ?? deLaRuta;
  const navigate = useNavigate();
  const [boliche, setBoliche] = useState(null);
  const [noExiste, setNoExiste] = useState(false);
  const [modo, setModo] = useState("oscuro");
  const [params] = useSearchParams();
  const [vendedor, setVendedor] = useState(null); // el RRPP de cuyo link se llegó, si hay
  const [comprando, setComprando] = useState(null); // el evento cuyas entradas se están comprando

  useEffect(() => {
    setBoliche(null);
    setNoExiste(false);
    setModo("oscuro");
    publicoApi.boliche(subdominio).then(setBoliche).catch(() => setNoExiste(true));
  }, [subdominio]);

  // Si se llegó con el link de un RRPP (?rrpp=CODIGO), las compras se le adjudican.
  useEffect(() => {
    const codigo = params.get("rrpp");
    setVendedor(null);
    if (codigo) rrppApi.linkPublico(codigo).then((v) => v.activo && v.subdominio === subdominio && setVendedor(v)).catch(() => {});
  }, [params, subdominio]);

  const carta = useMemo(() => agruparPorCategoria(boliche?.bebidas ?? []), [boliche]);

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
  const [portada, ...galeria] = boliche.fotos; // la portada viene primero
  const aOscuro = modo === "claro";

  return (
    <TemaBoliche colores={boliche.tema[modo]} modo={modo} className="bol-pagina">
      <header className="bol-barra">
        <Link to="/explorar" className="bol-volver">
          <ArrowLeftOutlined /> Todos los boliches
        </Link>
        <Space wrap>
          <Button shape="round" icon={aOscuro ? <MoonOutlined /> : <SunOutlined />} onClick={() => setModo(aOscuro ? "oscuro" : "claro")}>
            {aOscuro ? "Modo oscuro" : "Modo claro"}
          </Button>
          <BotonesSesion />
        </Space>
      </header>

      <section className={`bol-portada ${portada ? "bol-portada--foto" : ""}`} style={portada ? { backgroundImage: `url("${portada.url}")` } : undefined}>
        <div className="bol-portada-velo">
          <span className="bol-etiqueta">BOLICHE</span>
          <h1>{boliche.nombre}</h1>
          {boliche.descripcion && <p className="bol-lead">{boliche.descripcion}</p>}
          <Space wrap size={[8, 8]}>
            {boliche.capacidad && (
              <span className="bol-dato"><TeamOutlined /> Capacidad: {boliche.capacidad.toLocaleString("es-AR")} personas</span>
            )}
            {boliche.direccion && (
              <Button shape="round" icon={<EnvironmentOutlined />} href={mapa ?? undefined} target="_blank" rel="noreferrer">
                {boliche.direccion}
              </Button>
            )}
            {instagram && <Button shape="round" icon={<InstagramOutlined />} href={instagram} target="_blank" rel="noreferrer">{boliche.instagram}</Button>}
            {whatsapp && <Button shape="round" icon={<WhatsAppOutlined />} href={whatsapp} target="_blank" rel="noreferrer">WhatsApp</Button>}
          </Space>
        </div>
      </section>

      {vendedor && <div className="bol-vendedor">Estás comprando con el link de <strong>{vendedor.rrpp}</strong></div>}

      <main className="bol-cuerpo">
        {galeria.length > 0 && (
          <section>
            <h2>Galería</h2>
            <Image.PreviewGroup>
              <div className="bol-galeria">
                {galeria.map((f) => <Image key={f.id_foto} src={f.url} alt={boliche.nombre} />)}
              </div>
            </Image.PreviewGroup>
          </section>
        )}

        <section>
          <h2>Próximos eventos</h2>
          {boliche.eventos.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Todavía no hay eventos publicados." />
          ) : (
            <div className="bol-grilla bol-grilla--eventos">
              {boliche.eventos.map((e) => (
                <article key={e.id_evento} className="bol-tarjeta">
                  {e.imagen && <img className="bol-flyer" src={e.imagen} alt={e.nombre} />}
                  <div className="bol-tarjeta-cuerpo">
                    <span className="bol-etiqueta">{fechaHora(e.fecha_hora)}</span>
                    <h3>{e.nombre}</h3>
                    {e.artistas.length > 0 && <p className="bol-artistas">{e.artistas.join(" · ")}</p>}
                    {e.descripcion && <p className="bol-suave">{e.descripcion}</p>}
                    <div className="bol-chips">
                      <span className="bol-chip">{e.edad_minima}+</span>
                      {e.dress_code && <span className="bol-chip">Dress code: {e.dress_code}</span>}
                      {e.tiene_vip && <span className="bol-chip bol-chip--acento">Sector VIP</span>}
                    </div>

                    {e.entradas.length > 0 && (
                      <div className="bol-bloque">
                        <h4>ENTRADAS</h4>
                        <ul className="bol-lista">
                          {e.entradas.map((t) => (
                            <li key={t.id_tipo_entrada} className={t.estado !== "disponible" ? "bol-apagado" : ""}>
                              <div>
                                <strong>{t.nombre}</strong>
                                {t.tipo === "vip" && <span className="bol-chip bol-chip--acento">VIP</span>}
                                <div className="bol-suave">Online {moneda(t.precio_virtual)} · En puerta {moneda(t.precio_puerta)}</div>
                              </div>
                              <Disponibilidad estado={t.estado} textos={ESTADO_ENTRADA} />
                            </li>
                          ))}
                        </ul>
                        {hayEntradasDisponibles(e) && boliche.acepta_pagos_online && <Button type="primary" shape="round" onClick={() => setComprando(e)}>Comprar entradas</Button>}
                      </div>
                    )}

                    {e.mesas_vip.length > 0 && (
                      <div className="bol-bloque">
                        <h4>MESAS VIP</h4>
                        <ul className="bol-lista">
                          {e.mesas_vip.map((m) => (
                            <li key={m.id_mesa} className={m.estado !== "disponible" ? "bol-apagado" : ""}>
                              <div>
                                <strong>{m.nombre}</strong>
                                <div className="bol-suave">Hasta {m.capacidad} personas · {moneda(m.precio)}</div>
                              </div>
                              <Disponibilidad estado={m.estado} textos={ESTADO_MESA} />
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
          <p className="bol-aviso">{boliche.acepta_pagos_online ? "Pagás desde la página por transferencia (precio online). Si no, en la puerta se paga el precio de puerta." : "Las entradas se pagan en la puerta (precio de puerta)."} La reserva de mesas VIP llega pronto.</p>
        </section>

        {boliche.mesas_vip.length > 0 && (
          <section>
            <h2>Mesas VIP</h2>
            <div className="bol-grilla">
              {boliche.mesas_vip.map((m) => (
                <article key={m.id_mesa} className="bol-tarjeta">
                  {m.imagen && <img className="bol-flyer bol-flyer--baja" src={m.imagen} alt={m.nombre} />}
                  <div className="bol-tarjeta-cuerpo">
                    <h3>{m.nombre}</h3>
                    <p className="bol-precio">{moneda(m.precio)}</p>
                    <p className="bol-suave"><TeamOutlined /> Hasta {m.capacidad} personas</p>
                    {m.descripcion && <p className="bol-suave">{m.descripcion}</p>}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {carta.length > 0 && (
          <section>
            <h2>Carta de bebidas</h2>
            {carta.map((grupo) => (
              <div key={grupo.categoria} className="bol-categoria">
                <h3>{grupo.categoria}</h3>
                <div className="bol-grilla bol-grilla--carta">
                  {grupo.items.map((b) => (
                    <article key={b.id_bebida} className="bol-tarjeta bol-bebida">
                      {b.imagen && <img className="bol-bebida-foto" src={b.imagen} alt={b.nombre} />}
                      <div className="bol-tarjeta-cuerpo">
                        <div className="bol-bebida-titulo">
                          <strong>{b.nombre}</strong>
                          <span className="bol-precio">{moneda(b.precio)}</span>
                        </div>
                        {b.descripcion && <p className="bol-suave">{b.descripcion}</p>}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}
      </main>

      {comprando && <ModalCompra subdominio={boliche.subdominio} evento={comprando} talonario={vendedor?.codigo} onCerrar={() => setComprando(null)} />}

      <footer className="bol-pie">
        <span>{boliche.nombre} · página en NOCTIS</span>
      </footer>
    </TemaBoliche>
  );
}
