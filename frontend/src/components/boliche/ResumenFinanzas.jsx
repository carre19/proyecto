import { Card, Col, Descriptions, Empty, Row, Statistic, Table } from "antd";
import { moneda } from "../../utils/formato.js";

const colorBalance = (n) => (n < 0 ? "var(--red)" : "var(--lime)");

// Ingresos, gastos y balance con su detalle (lo que sale de las entradas, lo cargado a mano, el personal y las comisiones de RRPP).
// "filas" son los renglones de abajo: las noches de un boliche o los boliches de un admin; cada una trae su propio resumen.
export default function ResumenFinanzas({ datos, titulo, columnaNombre, filas, claveFila, abrir }) {
  return (
    <div className="ficha-boliche">
      <Row gutter={[12, 12]}>
        <Col xs={24} md={8}><Card variant="borderless"><Statistic title="Ingresos" value={moneda(datos.ingresos.total)} /></Card></Col>
        <Col xs={24} md={8}><Card variant="borderless"><Statistic title="Gastos" value={moneda(datos.gastos.total)} /></Card></Col>
        <Col xs={24} md={8}><Card variant="borderless"><Statistic title="Balance" value={moneda(datos.balance)} styles={{ content: { color: colorBalance(datos.balance) } }} /></Card></Col>
      </Row>
      <Card variant="borderless" title={titulo}>
        <Descriptions size="small" column={{ xs: 1, md: 2 }} items={[
          { key: "entradas", label: "Ingresos por entradas pagadas", children: moneda(datos.ingresos.entradas) },
          { key: "ing", label: "Otros ingresos cargados (barra, guardarropa…)", children: moneda(datos.ingresos.cargados) },
          { key: "gas", label: "Gastos cargados", children: moneda(datos.gastos.cargados) },
          { key: "per", label: "Pagos al personal", children: moneda(datos.gastos.personal) },
          { key: "com", label: "Comisiones de RRPP", children: moneda(datos.gastos.comisiones_rrpp) },
        ]} />
        <p className="muted">El 6 % de la plataforma lo paga el cliente aparte: no es un ingreso ni un gasto del local.</p>
      </Card>
      <div className="table-card">
        <Table
          rowKey={claveFila}
          dataSource={filas}
          pagination={{ pageSize: 8, hideOnSinglePage: true, showSizeChanger: false }}
          scroll={{ x: "max-content" }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Todavía no hay datos." /> }}
          columns={[
            { title: columnaNombre, render: (_, f) => (abrir ? <a onClick={() => abrir(f)}>{f.nombre}</a> : f.nombre) },
            { title: "Ingresos", render: (_, f) => moneda(f.ingresos.total) },
            { title: "Gastos", render: (_, f) => moneda(f.gastos.total) },
            { title: "Balance", render: (_, f) => <strong style={{ color: colorBalance(f.balance) }}>{moneda(f.balance)}</strong> },
          ]}
        />
      </div>
    </div>
  );
}
