import { Alert, Empty, Skeleton, Tag } from "antd";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { comprasApi } from "../api/plataforma.js";
import CabeceraPublica from "../components/CabeceraPublica.jsx";
import TarjetaEntrada from "../components/ventas/TarjetaEntrada.jsx";
import { mensajeError } from "../services/api.js";
import { fechaHora, moneda } from "../utils/formato.js";

const ESTADO = { pendiente: ["gold", "Esperando el pago"], pagada: ["green", "Pagada"], cancelada: ["red", "Cancelada o vencida"] };

// Las compras hechas con la cuenta del cliente, con sus QR. (Comprar sin cuenta también se puede: se ve con el link de la compra.)
export default function MisEntradas() {
  const [compras, setCompras] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    comprasApi.mias().then(setCompras).catch((e) => setError(mensajeError(e, "No se pudieron cargar tus entradas")));
  }, []);

  return (
    <div className="pub">
      <CabeceraPublica />
      <div className="pub-ancho">
        <span className="eyebrow">MI CUENTA</span>
        <h1>Mis entradas</h1>
        {error && <Alert type="error" showIcon title={error} />}
        {!compras && !error && <Skeleton active paragraph={{ rows: 4 }} />}
        {compras?.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<>Todavía no compraste entradas con tu cuenta. <Link to="/explorar">Ver los boliches</Link></>} />}
        {compras?.map((c) => (
          <section key={c.id_compra} className="compra-bloque">
            <div className="compra-bloque-cabecera">
              <div>
                <h3>{c.evento}</h3>
                <span className="muted">{c.boliche} · {fechaHora(c.fecha_hora)} · {moneda(c.total)}</span>
              </div>
              <div><Tag color={ESTADO[c.estado][0]}>{ESTADO[c.estado][1]}</Tag> <Link to={`/compra/${c.token_publico}`}>Ver compra</Link></div>
            </div>
            <div className="grilla-entradas">{c.entradas.map((e) => <TarjetaEntrada key={e.id_entrada} entrada={e} />)}</div>
          </section>
        ))}
      </div>
    </div>
  );
}
