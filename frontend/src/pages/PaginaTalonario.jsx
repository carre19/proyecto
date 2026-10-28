import { Button, Result, Skeleton } from "antd";
import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { rrppApi } from "../api/plataforma.js";
import CabeceraPublica from "../components/CabeceraPublica.jsx";

// El link de venta de un RRPP (/t/:codigo): lleva a la página del boliche con su código, así las compras se le adjudican.
export default function PaginaTalonario() {
  const { codigo } = useParams();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    rrppApi.linkPublico(codigo).then(setInfo).catch(() => setError(true));
  }, [codigo]);

  if (info?.activo && info.quedan > 0) return <Navigate to={`/b/${info.subdominio}?rrpp=${info.codigo}`} replace />;
  if (!info && !error) return <div className="pub"><CabeceraPublica /><Skeleton active paragraph={{ rows: 4 }} /></div>;

  return (
    <div className="pub">
      <CabeceraPublica />
      <Result
        status={error ? "404" : "info"}
        title={error ? "Este link no existe" : info.activo ? "Se acabaron las entradas de este link" : "Este link ya no está activo"}
        subTitle={error ? "Revisá que esté completo." : "Igual podés comprar desde la página del boliche."}
        extra={info ? <Link to={`/b/${info.subdominio}`}><Button type="primary">Ir a {info.boliche}</Button></Link> : <Link to="/explorar"><Button type="primary">Ver los boliches</Button></Link>}
      />
    </div>
  );
}
