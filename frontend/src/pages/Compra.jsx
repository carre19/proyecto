import { CopyOutlined } from "@ant-design/icons";
import { Alert, App, Button, Card, Descriptions, Result, Skeleton, Space, Tag } from "antd";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { comprasApi } from "../api/plataforma.js";
import CabeceraPublica from "../components/CabeceraPublica.jsx";
import TarjetaEntrada from "../components/ventas/TarjetaEntrada.jsx";
import { fechaHora, moneda } from "../utils/formato.js";

const ESTADO = { pendiente: ["gold", "Esperando el pago"], pagada: ["green", "Pagada"], cancelada: ["red", "Cancelada o vencida"] };

// Un dato que se copia con un click (alias, CBU, referencia).
const Copiable = ({ valor, aviso }) => (
  <Button
    size="small"
    icon={<CopyOutlined />}
    onClick={() => navigator.clipboard?.writeText(valor).then(() => aviso.success("Copiado"), () => aviso.info(valor))}
  >
    {valor}
  </Button>
);

// Página de una compra (/compra/:token): quien tiene el link la ve sin necesidad de una cuenta.
// Pendiente: cuánto y cómo pagar (se actualiza sola cuando llega el pago). Pagada: los QR, uno por persona.
export default function Compra() {
  const { token } = useParams();
  const { message } = App.useApp();
  const [compra, setCompra] = useState(null);
  const [noExiste, setNoExiste] = useState(false);

  const cargar = useCallback(() => comprasApi.ver(token).then(setCompra).catch(() => setNoExiste(true)), [token]);
  useEffect(() => {
    cargar();
  }, [cargar]);

  // Mientras espera el pago, consulta cada pocos segundos.
  useEffect(() => {
    if (compra?.estado !== "pendiente") return undefined;
    const reloj = setInterval(cargar, 8000);
    return () => clearInterval(reloj);
  }, [compra?.estado, cargar]);

  if (noExiste) {
    return (
      <div className="pub">
        <CabeceraPublica />
        <Result status="404" title="No encontramos esta compra" subTitle="Revisá que el link esté completo." extra={<Link to="/explorar"><Button type="primary">Ver los boliches</Button></Link>} />
      </div>
    );
  }
  if (!compra) return <div className="pub"><CabeceraPublica /><Skeleton active paragraph={{ rows: 6 }} /></div>;

  const [color, texto] = ESTADO[compra.estado];
  return (
    <div className="pub">
      <CabeceraPublica />
      <div className="pub-ancho compra">
        <span className="eyebrow">TU COMPRA</span>
        <h1>{compra.evento}</h1>
        <Space wrap>
          <span className="muted">{compra.boliche} · {fechaHora(compra.fecha_hora)}</span>
          <Tag color={color}>{texto}</Tag>
        </Space>

        {compra.estado === "pendiente" && (
          <Alert
            type="warning"
            showIcon
            title={`Pagá ${moneda(compra.total)} antes de las ${new Date(compra.vence_en).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`}
            description={
              <>
                Pagás desde cualquier plataforma, por transferencia. Pon{"é"} este código de referencia: <strong>{compra.referencia}</strong>. Si no pagás a tiempo, se liberan las entradas; en la puerta se paga el precio de puerta.
              </>
            }
          />
        )}
        {compra.estado === "pendiente" && compra.cuenta_cobro && (
          <Card variant="borderless" title="Datos para transferir">
            <Descriptions
              size="small"
              column={{ xs: 1, sm: 2 }}
              items={[
                { key: "titular", label: "Titular", children: compra.cuenta_cobro.titular },
                ...(compra.cuenta_cobro.banco ? [{ key: "banco", label: "Banco", children: compra.cuenta_cobro.banco }] : []),
                ...(compra.cuenta_cobro.alias ? [{ key: "alias", label: "Alias", children: <Copiable valor={compra.cuenta_cobro.alias} aviso={message} /> }] : []),
                ...(compra.cuenta_cobro.cbu ? [{ key: "cbu", label: "CBU", children: <Copiable valor={compra.cuenta_cobro.cbu} aviso={message} /> }] : []),
                { key: "monto", label: "Monto", children: <strong>{moneda(compra.total)}</strong> },
                { key: "ref", label: "Referencia", children: <Copiable valor={compra.referencia} aviso={message} /> },
              ]}
            />
            {compra.cuenta_cobro.instrucciones && <p className="muted">{compra.cuenta_cobro.instrucciones}</p>}
            <p className="muted">Apenas llegue el pago se confirma solo y esta página te muestra los QR (también te avisamos por WhatsApp o email).</p>
          </Card>
        )}
        {compra.estado === "cancelada" && <Alert type="error" showIcon title="Esta compra se canceló o venció." description="Las entradas se liberaron. Podés volver a comprar." />}
        {compra.estado === "pagada" && <Alert type="success" showIcon title="Pago confirmado" description="Presentá el QR en la puerta. Cada QR sirve una sola vez y la entrada es personal: no se puede pasar a otra persona." />}

        <div className="compra-resumen">
          <span>Entradas: {moneda(compra.subtotal)}</span>
          {compra.descuento > 0 && <span>Descuento{compra.descuento_nombre ? ` «${compra.descuento_nombre}»` : ""}: −{moneda(compra.descuento)}</span>}
          {compra.cargo_plataforma > 0 && <span>Cargo de la plataforma: {moneda(compra.cargo_plataforma)}</span>}
          <strong>Total: {moneda(compra.total)}</strong>
        </div>

        <div className="grilla-entradas">
          {compra.entradas.map((e) => <TarjetaEntrada key={e.id_entrada} entrada={e} />)}
        </div>
        <Link to={`/b/${compra.subdominio}`}>← Volver a la página de {compra.boliche}</Link>
      </div>
    </div>
  );
}
