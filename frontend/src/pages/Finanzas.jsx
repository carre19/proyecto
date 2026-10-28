import { DatePicker, Skeleton } from "antd";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { finanzasApi } from "../api/plataforma.js";
import ResumenFinanzas from "../components/boliche/ResumenFinanzas.jsx";
import Topbar from "../components/Topbar.jsx";
import { fechaLarga } from "../utils/formato.js";

// El resumen general del admin: sus ingresos, gastos y balance con todos los boliches juntos y el de cada uno.
export default function Finanzas() {
  const navigate = useNavigate();
  const [periodo, setPeriodo] = useState([null, null]);
  const [datos, setDatos] = useState(null);

  useEffect(() => {
    setDatos(null);
    finanzasApi.general(periodo[0]?.format("YYYY-MM-DD"), periodo[1]?.format("YYYY-MM-DD")).then(setDatos).catch(() => setDatos(null));
  }, [periodo]);

  return (
    <main className="main">
      <Topbar sinBuscador />
      <div className="page-head">
        <div>
          <div className="eyebrow">{fechaLarga()}</div>
          <h1>Ingresos y gastos</h1>
        </div>
        <DatePicker.RangePicker value={periodo} onChange={(v) => setPeriodo(v ?? [null, null])} format="DD/MM/YYYY" placeholder={["Desde", "Hasta"]} allowEmpty={[true, true]} />
      </div>
      {datos ? (
        <ResumenFinanzas datos={datos} titulo="Todos tus locales juntos" columnaNombre="Boliche" filas={datos.boliches} claveFila="id_boliche" abrir={(b) => navigate(`/boliches/${b.id_boliche}`)} />
      ) : (
        <Skeleton active paragraph={{ rows: 6 }} />
      )}
    </main>
  );
}
