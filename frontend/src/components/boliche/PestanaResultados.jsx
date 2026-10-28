import { TrophyOutlined } from "@ant-design/icons";
import { Card, Col, Empty, Row, Select, Space, Statistic, Table, Tag } from "antd";
import { useEffect, useState } from "react";
import { apiDeBoliche, rrppApi } from "../../api/plataforma.js";
import usePermisos from "../../hooks/usePermisos.js";
import { fechaHora, moneda } from "../../utils/formato.js";

// Resultados de ventas de los RRPP. Cada RRPP ve cuánto vendió, su comisión y el nombre de quien pagó; el manager lo mismo de
// todo su equipo (con las entradas asignadas a cada uno); el admin de todos. El ranking lo ven todos, solo con las cantidades.
export default function PestanaResultados({ idBoliche }) {
  const permisos = usePermisos();
  const [eventos, setEventos] = useState([]);
  const [evento, setEvento] = useState(null); // null = todos los eventos
  const [res, setRes] = useState(null);
  const [rank, setRank] = useState([]);
  const [ventas, setVentas] = useState(null);

  useEffect(() => {
    apiDeBoliche(idBoliche, "eventos").obtenerTodos().then(setEventos).catch(() => setEventos([]));
  }, [idBoliche]);

  useEffect(() => {
    const id = evento ?? undefined;
    Promise.all([rrppApi.resultados(idBoliche, id), rrppApi.ranking(idBoliche, id)]).then(([r, k]) => { setRes(r); setRank(k); }).catch(() => {});
    if (permisos.esRrpp) rrppApi.misVentas(idBoliche, id).then(setVentas).catch(() => setVentas(null));
  }, [idBoliche, evento, permisos.esRrpp]);

  const t = res?.total;
  return (
    <Space orientation="vertical" size={16} style={{ width: "100%" }}>
      <Select
        style={{ width: "100%", maxWidth: 460 }}
        value={evento}
        onChange={setEvento}
        options={[{ value: null, label: "Todos los eventos" }, ...eventos.map((e) => ({ value: e.id_evento, label: `${e.nombre} · ${fechaHora(e.fecha_hora)}` }))]}
      />

      {t && (
        <Row gutter={[12, 12]}>
          <Col xs={12} md={6}><Card variant="borderless"><Statistic title={permisos.esRrpp ? "Tus entradas asignadas" : "Entradas asignadas"} value={t.asignadas} /></Card></Col>
          <Col xs={12} md={6}><Card variant="borderless"><Statistic title={permisos.esRrpp ? "Vendiste" : "Entradas vendidas"} value={t.vendidas} /></Card></Col>
          <Col xs={12} md={6}><Card variant="borderless"><Statistic title="Vendido" value={moneda(t.monto)} /></Card></Col>
          <Col xs={12} md={6}><Card variant="borderless"><Statistic title={permisos.esRrpp ? "Tu comisión ganada" : "Comisiones"} value={moneda(t.comision)} /></Card></Col>
        </Row>
      )}

      {!permisos.esRrpp && (
        <div className="table-card">
          <Table
            rowKey="id_rrpp"
            title={() => <strong>{permisos.esManager ? "Tu equipo" : "RRPP"}</strong>}
            dataSource={res?.rrpp ?? []}
            pagination={false}
            scroll={{ x: "max-content" }}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Todavía no hay RRPP." /> }}
            columns={[
              { title: "RRPP", dataIndex: "nombre" },
              { title: "Comisión", render: (_, f) => `${Number(f.comision_pct)} %` },
              { title: "Asignadas", dataIndex: "asignadas" },
              { title: "Vendidas", dataIndex: "vendidas" },
              { title: "Esperando pago", dataIndex: "pendientes" },
              { title: "Vendido", render: (_, f) => moneda(f.monto) },
              { title: "Comisión ganada", render: (_, f) => moneda(f.comision) },
            ]}
          />
        </div>
      )}

      <div className="table-card">
        <Table
          rowKey="orden"
          title={() => <strong><TrophyOutlined /> Ranking de RRPP</strong>}
          dataSource={rank}
          pagination={false}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Todavía no hay RRPP." /> }}
          columns={[
            { title: "Puesto", render: (_, f) => `#${f.puesto}`, width: 90 },
            { title: "RRPP", render: (_, f) => <span>{f.nombre} {f.soy_yo && <Tag color="gold">Vos</Tag>}</span> },
            { title: "Entradas vendidas", dataIndex: "vendidas" },
          ]}
        />
      </div>

      {permisos.esRrpp && (
        <div className="table-card">
          <Table
            rowKey="id_entrada"
            title={() => <strong>Tus ventas</strong>}
            dataSource={ventas?.ventas ?? []}
            pagination={{ pageSize: 8, hideOnSinglePage: true, showSizeChanger: false }}
            scroll={{ x: "max-content" }}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Todavía no vendiste entradas." /> }}
            columns={[
              { title: "Pagó", render: (_, v) => `${v.nombre} ${v.apellido}` },
              { title: "DNI", dataIndex: "dni" },
              { title: "Evento", dataIndex: "evento" },
              { title: "Entrada", dataIndex: "tipo" },
              { title: "Precio", render: (_, v) => moneda(v.precio) },
              { title: "Tu comisión", render: (_, v) => `${moneda(v.comision ?? 0)} (${Number(v.comision_pct ?? 0)} %)` },
              { title: "Cuándo", render: (_, v) => fechaHora(v.pagada_en) },
            ]}
          />
        </div>
      )}
    </Space>
  );
}
