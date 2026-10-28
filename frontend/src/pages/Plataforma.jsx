import { Alert, App, Button, Card, Col, DatePicker, Empty, Popconfirm, Row, Skeleton, Space, Statistic, Table, Tag } from "antd";
import dayjs from "dayjs";
import { useCallback, useEffect, useState } from "react";
import Estado from "../components/Estado.jsx";
import Topbar from "../components/Topbar.jsx";
import { plataformaApi } from "../api/plataforma.js";
import { mensajeError } from "../services/api.js";
import { fechaHora, fechaLarga, moneda } from "../utils/formato.js";

// Pantalla principal del superadmin: lo que gana la plataforma (el 6 % de cada compra pagada desde la página), las mensualidades y
// los cobros pendientes de cada boliche, y el borrado de datos personales vencidos.
export default function Plataforma() {
  const { message } = App.useApp();
  const [resumen, setResumen] = useState(null);
  const [cobros, setCobros] = useState([]);
  const [periodo, setPeriodo] = useState(dayjs());
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    try {
      const [r, c] = await Promise.all([plataformaApi.resumen(), plataformaApi.cobros()]);
      setResumen(r);
      setCobros(c);
    } catch (e) {
      setError(mensajeError(e, "No se pudo cargar el resumen"));
    }
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  const accion = async (promesa, aviso) => {
    try {
      const resultado = await promesa;
      message.success(typeof aviso === "function" ? aviso(resultado) : aviso);
      cargar();
    } catch (e) {
      message.error(mensajeError(e, "No se pudo completar la acción"));
    }
  };

  return (
    <main className="main">
      <Topbar sinBuscador />
      <div className="page-head">
        <div>
          <div className="eyebrow">{fechaLarga()}</div>
          <h1>Plataforma</h1>
        </div>
      </div>
      {error && <Alert type="error" showIcon title={error} />}
      {!resumen && !error && <Skeleton active paragraph={{ rows: 6 }} />}

      {resumen && (
        <>
          <Row gutter={[12, 12]}>
            <Col xs={12} md={6}><Card variant="borderless"><Statistic title="Boliches activos" value={`${resumen.boliches.activos} de ${resumen.boliches.total}`} /></Card></Col>
            <Col xs={12} md={6}><Card variant="borderless"><Statistic title={`Cobros pendientes (${resumen.cobros.pendientes})`} value={moneda(resumen.cobros.monto_pendiente)} /></Card></Col>
            <Col xs={12} md={6}><Card variant="borderless"><Statistic title={`Ganado por entradas (${resumen.entradas.porcentaje} %) este mes`} value={moneda(resumen.entradas.ganado_mes)} /></Card></Col>
            <Col xs={12} md={6}><Card variant="borderless"><Statistic title={`Ganado por entradas, en total (${resumen.entradas.compras_pagadas} compras)`} value={moneda(resumen.entradas.ganado_total)} /></Card></Col>
          </Row>

          <Card variant="borderless" title="Mensualidades y cobros a los boliches" extra={
            <Space wrap>
              <DatePicker picker="month" value={periodo} onChange={(v) => v && setPeriodo(v)} allowClear={false} format="MM/YYYY" />
              <Popconfirm title={`¿Generar los cobros de ${periodo.format("MM/YYYY")}?`} description="Se arma una mensualidad por boliche (o un cobro por evento en los de un solo evento). Repetirlo no duplica nada." okText="Generar" cancelText="No"
                onConfirm={() => accion(plataformaApi.generarCobros(periodo.format("YYYY-MM")), (r) => `Se crearon ${r.mensualidades_creadas} mensualidades y ${r.eventos_creados} cobros por evento`)}>
                <Button type="primary">Generar cobros del mes</Button>
              </Popconfirm>
            </Space>
          }>
            <div className="table-card">
              <Table
                rowKey="id_cobro"
                dataSource={cobros}
                pagination={{ pageSize: 8, hideOnSinglePage: true, showSizeChanger: false }}
                scroll={{ x: "max-content" }}
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Todavía no se generaron cobros." /> }}
                columns={[
                  { title: "Boliche", dataIndex: "boliche" },
                  { title: "Concepto", render: (_, c) => (c.tipo === "mensualidad" ? `Mensualidad ${c.periodo}` : `Evento único: ${c.evento ?? "—"}`) },
                  { title: "Monto", render: (_, c) => <strong>{moneda(c.monto)}</strong> },
                  { title: "Estado", render: (_, c) => <Estado estado={c.estado} color={c.estado === "pagado" ? "var(--lime)" : "var(--amber)"} /> },
                  { title: "Pagó", render: (_, c) => (c.pagado_en ? fechaHora(c.pagado_en) : "—") },
                  { title: "", align: "right", render: (_, c) => c.estado === "pendiente" && (
                    <Popconfirm title="¿El boliche ya pagó?" okText="Sí, marcar pagado" cancelText="No" onConfirm={() => accion(plataformaApi.pagarCobro(c.id_cobro), "Cobro marcado como pagado")}>
                      <Button size="small">Marcar pagado</Button>
                    </Popconfirm>
                  ) },
                ]}
              />
            </div>
          </Card>

          <Card variant="borderless" title="Lo que gana la plataforma por boliche">
            <div className="table-card">
              <Table
                rowKey="id_boliche"
                dataSource={resumen.por_boliche}
                pagination={false}
                scroll={{ x: "max-content" }}
                columns={[
                  { title: "Boliche", dataIndex: "nombre" },
                  { title: "Compras pagadas", dataIndex: "compras" },
                  { title: `Ganado por entradas (${resumen.entradas.porcentaje} %)`, render: (_, b) => moneda(b.cargo) },
                  { title: "Cobros pendientes", render: (_, b) => (b.pendiente > 0 ? <Tag color="gold">{moneda(b.pendiente)}</Tag> : "—") },
                ]}
              />
            </div>
          </Card>

          <Card variant="borderless" title="Borrado de datos personales">
            <p>Los datos de cada cliente (nombre, DNI y contacto) se borran solos 3 meses después de la última vez que compró una entrada o interactuó con el sistema; lo económico se conserva. Esto corre una vez por día. También se puede ejecutar ahora.</p>
            <Popconfirm title="¿Borrar ahora los datos personales vencidos?" description="No se puede deshacer." okText="Borrar" cancelText="No" okButtonProps={{ danger: true }}
              onConfirm={() => accion(plataformaApi.ejecutarBorrado(), (r) => `Borrado: ${r.entradas} entradas, ${r.invitados} invitados, ${r.compras} contactos y ${r.cuentas} cuentas`)}>
              <Button danger>Ejecutar el borrado ahora</Button>
            </Popconfirm>
          </Card>
        </>
      )}
    </main>
  );
}
