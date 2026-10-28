import { CameraOutlined, ScanOutlined } from "@ant-design/icons";
import { Alert, App, Button, Card, Col, Empty, Input, Row, Space, Statistic, Table, Tabs, Tag } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { puertaApi } from "../../api/plataforma.js";
import { mensajeError } from "../../services/api.js";
import { fechaHora } from "../../utils/formato.js";
import SelectorEvento from "./SelectorEvento.jsx";

const RESULTADO = { ingreso_lista: "Ingreso por lista",  ingreso: "Ingreso", reingreso: "Reingreso", rechazada_usada: "Rechazada: ya usada", rechazada_no_pagada: "Rechazada: sin pagar", rechazada_anulada: "Rechazada: anulada", rechazada_otro_evento: "Rechazada: otro evento", no_encontrada: "No encontrada" };

// Cámara del celular para leer el QR (solo en navegadores que lo permiten, como Chrome en Android).
// En otros casos sirve igual un lector de QR conectado (escribe el código como un teclado) o pegar el código a mano.
function EscanerCamara({ onCodigo }) {
  const video = useRef(null);
  const alLeer = useRef(onCodigo);
  alLeer.current = onCodigo;
  const { message } = App.useApp();

  useEffect(() => {
    let activo = true;
    let flujo;
    const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
    const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      .then(async (f) => {
        flujo = f;
        video.current.srcObject = f;
        await video.current.play();
        while (activo) {
          try {
            const leidos = await detector.detect(video.current);
            if (leidos[0]) {
              alLeer.current(leidos[0].rawValue);
              await pausa(2000); // para no leer el mismo QR varias veces seguidas
            }
          } catch { /* un cuadro que no se pudo leer: se prueba con el siguiente */ }
          await pausa(300);
        }
      })
      .catch(() => message.error("No se pudo usar la cámara. Revisá el permiso del navegador."));

    return () => {
      activo = false;
      flujo?.getTracks().forEach((t) => t.stop());
    };
  }, [message]);

  return <video ref={video} muted playsInline />;
}

// Control de acceso: se escanea (o se escribe) el código del QR. Cada QR sirve una sola vez; lo que pasa queda registrado.
// Como último recurso se busca por DNI: quien salió y vuelve muestra su entrada con el DNI escrito y su DNI físico.
export default function PestanaPuerta({ idBoliche }) {
  const { message } = App.useApp();
  const [evento, setEvento] = useState(null);
  const [codigo, setCodigo] = useState("");
  const [ultimo, setUltimo] = useState(null);
  const [resumen, setResumen] = useState(null);
  const [accesos, setAccesos] = useState([]);
  const [dni, setDni] = useState("");
  const [encontradas, setEncontradas] = useState(null);
  const [camara, setCamara] = useState(false);
  const hayCamara = typeof window !== "undefined" && "BarcodeDetector" in window && Boolean(navigator.mediaDevices?.getUserMedia);

  const recargar = useCallback(async () => {
    if (!evento) return;
    try {
      const [r, a] = await Promise.all([puertaApi.resumen(idBoliche, evento.id_evento), puertaApi.accesos(idBoliche, evento.id_evento)]);
      setResumen(r);
      setAccesos(a);
    } catch (e) {
      message.error(mensajeError(e, "No se pudo cargar la puerta"));
    }
  }, [idBoliche, evento, message]);
  useEffect(() => {
    setUltimo(null);
    setEncontradas(null);
    recargar();
  }, [recargar]);

  const escanear = useCallback(async (valor) => {
    if (!evento || !valor.trim()) return;
    try {
      setUltimo(await puertaApi.escanear(idBoliche, evento.id_evento, valor));
    } catch (e) {
      setUltimo({ resultado: "error", mensaje: mensajeError(e, "No se pudo validar la entrada") });
    }
    setCodigo("");
    recargar();
  }, [idBoliche, evento, recargar]);

  const buscar = async () => {
    try {
      setEncontradas(await puertaApi.buscar(idBoliche, evento.id_evento, dni));
    } catch (e) {
      message.error(mensajeError(e, "No se pudo buscar"));
    }
  };
  const dejarEntrar = async (id) => {
    try {
      await puertaApi.ingresarInvitado(idBoliche, evento.id_evento, id);
      message.success("Ingreso registrado");
      setEncontradas(await puertaApi.buscar(idBoliche, evento.id_evento, dni));
      recargar();
    } catch (e) {
      message.error(mensajeError(e, "No se pudo registrar el ingreso"));
    }
  };
  const reingresar = async (id) => {
    try {
      await puertaApi.reingreso(idBoliche, evento.id_evento, id);
      message.success("Reingreso registrado");
      recargar();
    } catch (e) {
      message.error(mensajeError(e, "No se pudo registrar el reingreso"));
    }
  };

  const entrada = ultimo?.entrada;
  const resultadoUi = (
    ultimo && (
      <Alert
        className="puerta-resultado"
        type={ultimo.resultado === "ingreso" || ultimo.resultado === "reingreso" ? "success" : "error"}
        showIcon
        title={ultimo.mensaje}
        description={entrada && <>{entrada.nombre} {entrada.apellido} · DNI {entrada.dni} · {entrada.tipo}{entrada.usada_en && ` · usada ${fechaHora(entrada.usada_en)}`}</>}
      />
    )
  );

  return (
    <div className="puerta">
      <SelectorEvento idBoliche={idBoliche} onElegir={setEvento} />

      {resumen && (
        <Row gutter={[12, 12]}>
          <Col xs={12} md={6}><Card variant="borderless"><Statistic title="Entradas pagadas" value={resumen.pagadas} /></Card></Col>
          <Col xs={12} md={6}><Card variant="borderless"><Statistic title="Ya entraron" value={resumen.ingresaron} /></Card></Col>
          <Col xs={12} md={6}><Card variant="borderless"><Statistic title="Faltan entrar" value={resumen.faltan} /></Card></Col>
          <Col xs={12} md={6}><Card variant="borderless"><Statistic title="Sin pagar" value={resumen.pendientes_de_pago} /></Card></Col>
          {resumen.invitados > 0 && <Col xs={24}><Card variant="borderless"><Statistic title="Invitados de lista que ya entraron" value={`${resumen.invitados_ingresaron} de ${resumen.invitados}`} /></Card></Col>}
        </Row>
      )}

      <Tabs
        items={[
          {
            key: "qr",
            label: "Escanear QR",
            children: (
              <Space orientation="vertical" size={12} style={{ width: "100%" }}>
                <Input.Search
                  size="large"
                  autoFocus
                  allowClear
                  enterButton={<><ScanOutlined /> Validar</>}
                  placeholder="Escaneá el QR o pegá el código"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  onSearch={escanear}
                  disabled={!evento}
                />
                {hayCamara && <Button icon={<CameraOutlined />} onClick={() => setCamara(!camara)}>{camara ? "Apagar la cámara" : "Usar la cámara"}</Button>}
                {camara && <div className="puerta-camara"><EscanerCamara onCodigo={escanear} /></div>}
                {resultadoUi}
              </Space>
            ),
          },
          {
            key: "dni",
            label: "Buscar por DNI",
            children: (
              <Space orientation="vertical" size={12} style={{ width: "100%" }}>
                <Input.Search size="large" inputMode="numeric" placeholder="DNI de la persona (sin puntos)" value={dni} onChange={(e) => setDni(e.target.value)} onSearch={buscar} enterButton="Buscar" disabled={!evento} />
                {encontradas?.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Ese DNI no tiene entradas para este evento." />}
                {encontradas?.map((e) => (
                  <Card key={e.id_entrada ?? `i${e.id_invitado}`} size="small" variant="borderless">
                    <Space wrap style={{ width: "100%", justifyContent: "space-between" }}>
                      <span>{e.nombre} {e.apellido} · DNI {e.dni} · {e.tipo} <Tag>{e.estado}</Tag></span>
                      {e.origen === "lista" && e.estado === "en_lista" && <Button type="primary" onClick={() => dejarEntrar(e.id_invitado)}>Dejar entrar (lista)</Button>}
                      {e.origen !== "lista" && e.estado === "usada" && <Button onClick={() => reingresar(e.id_entrada)}>Registrar reingreso (DNI verificado)</Button>}
                    </Space>
                  </Card>
                ))}
              </Space>
            ),
          },
        ]}
      />

      <div className="table-card">
        <Table
          rowKey="id_acceso"
          size="small"
          dataSource={accesos}
          pagination={{ pageSize: 8, hideOnSinglePage: true, showSizeChanger: false }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Todavía no hubo movimientos en la puerta." /> }}
          columns={[
            { title: "Hora", render: (_, a) => new Date(a.momento).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) },
            { title: "Resultado", render: (_, a) => <Tag color={a.resultado === "ingreso" || a.resultado === "reingreso" ? "green" : "red"}>{RESULTADO[a.resultado]}</Tag> },
            { title: "Persona", render: (_, a) => (a.nombre ? `${a.nombre} ${a.apellido}` : "—") },
            { title: "Lo registró", dataIndex: "registrado_por" },
          ]}
        />
      </div>
    </div>
  );
}
