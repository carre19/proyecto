import { CheckCircleFilled, CloseCircleFilled } from "@ant-design/icons";
import { Alert, App, Button, Card, ColorPicker, Popconfirm, Segmented, Skeleton, Space } from "antd";
import { useEffect, useState } from "react";
import { temaApi } from "../../api/plataforma.js";
import usePermisos from "../../hooks/usePermisos.js";
import { mensajeError } from "../../services/api.js";
import { CAMPOS_COLOR, evaluarContraste } from "../../utils/colores.js";
import TemaBoliche from "./TemaBoliche.jsx";

const MODOS = [{ value: "oscuro", label: "Modo oscuro" }, { value: "claro", label: "Modo claro" }];

// Editor de los colores de la página pública del boliche (4 por modo). Muestra al lado cómo queda y avisa si el texto
// no se lee bien (el back vuelve a verificarlo y rechaza los que no cumplen). Solo cambian colores: la tipografía y
// la estructura son las mismas para todos. Lo editan el superadmin y el admin; manager y RRPP lo ven.
export default function PestanaDiseno({ idBoliche }) {
  const permisos = usePermisos();
  const { message } = App.useApp();
  const [tema, setTema] = useState(null);
  const [modo, setModo] = useState("oscuro");
  const [borrador, setBorrador] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    temaApi.ver(idBoliche).then(setTema).catch((e) => setError(mensajeError(e, "No se pudieron cargar los colores")));
  }, [idBoliche]);

  // Al cambiar de modo (o al guardar) el borrador vuelve a ser lo guardado.
  useEffect(() => {
    if (tema) setBorrador({ ...tema[modo] });
  }, [tema, modo]);

  if (error) return <Alert type="error" showIcon title={error} />;
  if (!tema || !borrador) return <Skeleton active paragraph={{ rows: 5 }} />;

  const puedeEditar = permisos.puedeEditarLocal;
  const reglas = evaluarContraste(borrador);
  const legible = reglas.every((r) => r.cumple);
  const hayCambios = CAMPOS_COLOR.some((c) => borrador[c.name] !== tema[modo][c.name]);
  const esElPorDefecto = CAMPOS_COLOR.every((c) => tema[modo][c.name] === tema.defecto[modo][c.name]);

  const aplicar = async (promesa, aviso) => {
    setGuardando(true);
    try {
      setTema(await promesa);
      message.success(aviso);
    } catch (e) {
      message.error(mensajeError(e, "No se pudo completar la acción"));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="diseno-boliche">
      <Card variant="borderless" title="Colores de la página" extra={<Segmented value={modo} options={MODOS} onChange={setModo} />}>
        <Space orientation="vertical" size={16} style={{ width: "100%" }}>
          <span className="muted">
            Así se ve la página pública de este boliche. Abre en modo oscuro y quien la mira puede pasar al claro, por eso se eligen los colores de los dos.
            {!puedeEditar && " Solo el admin puede cambiarlos."}
          </span>

          {CAMPOS_COLOR.map((c) => (
            <div key={c.name} className="diseno-fila">
              <div>
                <strong>{c.label}</strong>
                <div className="muted">{c.ayuda}</div>
              </div>
              <ColorPicker
                value={borrador[c.name]}
                format="hex"
                disabledAlpha
                showText
                disabled={!puedeEditar}
                onChange={(color) => setBorrador({ ...borrador, [c.name]: color.toHexString().toUpperCase() })}
              />
            </div>
          ))}

          <ul className="diseno-reglas">
            {reglas.map((r) => (
              <li key={r.descripcion} className={r.cumple ? "cumple" : "no-cumple"}>
                {r.cumple ? <CheckCircleFilled /> : <CloseCircleFilled />} {r.descripcion}: contraste {r.valor.toFixed(1)}:1 (mínimo {r.minimo}:1)
              </li>
            ))}
          </ul>

          {puedeEditar && (
            <Space wrap>
              <Button type="primary" loading={guardando} disabled={!legible || !hayCambios} onClick={() => aplicar(temaApi.guardar(idBoliche, modo, borrador), "Colores guardados")}>
                Guardar colores
              </Button>
              <Button disabled={!hayCambios} onClick={() => setBorrador({ ...tema[modo] })}>
                Descartar cambios
              </Button>
              <Popconfirm title="¿Volver al negro y dorado en este modo?" okText="Volver" cancelText="Cancelar" onConfirm={() => aplicar(temaApi.restablecer(idBoliche, modo), "Colores restablecidos")}>
                <Button disabled={esElPorDefecto && !hayCambios} loading={guardando}>Negro y dorado</Button>
              </Popconfirm>
            </Space>
          )}
        </Space>
      </Card>

      <Card variant="borderless" title="Vista previa" className="diseno-previa">
        <TemaBoliche colores={borrador} modo={modo} className="bol-vista-previa">
          <span className="bol-etiqueta">VIE 5 FEB · 23:30</span>
          <h3>Noche Electrónica</h3>
          <p className="bol-artistas">DJ Nova · Kaia</p>
          <p className="bol-suave">Así se leen los textos secundarios sobre las tarjetas.</p>
          <div className="bol-chips">
            <span className="bol-chip">18+</span>
            <span className="bol-chip bol-chip--acento">Sector VIP</span>
          </div>
          <p className="bol-precio">$ 10.000</p>
          <Button type="primary" shape="round">Botón principal</Button>
        </TemaBoliche>
      </Card>
    </div>
  );
}
