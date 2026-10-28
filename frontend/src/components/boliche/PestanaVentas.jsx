import { Button, Card, Col, Empty, Popconfirm, Row, Space, Statistic, Table, Tag, App } from "antd";
import { useCallback, useEffect, useState } from "react";
import { ventasApi } from "../../api/plataforma.js";
import usePermisos from "../../hooks/usePermisos.js";
import { mensajeError } from "../../services/api.js";
import { fechaHora, moneda } from "../../utils/formato.js";
import Estado from "../Estado.jsx";
import ModalVentaPuerta from "../ventas/ModalVentaPuerta.jsx";
import SelectorEvento from "./SelectorEvento.jsx";

const COLOR_COMPRA = { pendiente: "var(--amber)", pagada: "var(--lime)", cancelada: "var(--muted)" };
const COLOR_ENTRADA = { pendiente: "gold", valida: "green", usada: "default", anulada: "red" };

// Ventas de un evento: quién compró, cuánto y si pagó. El admin y el manager confirman o cancelan los pagos a mano
// (el automático llega con la fase 3); quien puede vender también registra ventas en la puerta.
// Cada rol ve lo que le corresponde: el RRPP solo sus ventas, el manager las de su equipo y el DNI solo lo ven admin, manager y RRPP.
export default function PestanaVentas({ idBoliche }) {
  const permisos = usePermisos();
  const { message } = App.useApp();
  const [evento, setEvento] = useState(null);
  const [datos, setDatos] = useState(null);
  const [vendiendo, setVendiendo] = useState(false);

  const cargar = useCallback(async () => {
    if (!evento) return setDatos(null);
    try {
      setDatos(await ventasApi.listar(idBoliche, evento.id_evento));
    } catch (e) {
      message.error(mensajeError(e, "No se pudieron cargar las ventas"));
    }
  }, [idBoliche, evento, message]);
  useEffect(() => {
    cargar();
  }, [cargar]);

  const accion = async (promesa, aviso) => {
    try {
      await promesa;
      message.success(aviso);
      cargar();
    } catch (e) {
      message.error(mensajeError(e, "No se pudo completar la acción"));
    }
  };

  const columnas = [
    { title: "Referencia", dataIndex: "referencia" },
    { title: "Compró", render: (_, c) => `${c.entradas[0]?.nombre ?? ""} ${c.entradas[0]?.apellido ?? ""}${c.entradas.length > 1 ? ` +${c.entradas.length - 1}` : ""}` },
    { title: "Entradas", render: (_, c) => c.entradas.length },
    { title: "Total", render: (_, c) => moneda(c.total) },
    { title: "Estado", render: (_, c) => <Estado estado={c.estado} color={COLOR_COMPRA[c.estado]} /> },
    { title: "Canal", render: (_, c) => (c.canal === "web" ? "Página" : `Puerta · ${c.metodo_pago}`) },
    { title: "Vendió", render: (_, c) => c.rrpp ?? c.vendedor ?? "—" },
    {
      title: "",
      align: "right",
      render: (_, c) =>
        c.estado === "pendiente" && permisos.puedeGestionarPagos && (
          <Space size={4}>
            <Popconfirm title="¿Confirmar que llegó el pago?" okText="Sí, confirmar" cancelText="No" onConfirm={() => accion(ventasApi.pagar(idBoliche, c.id_compra), "Pago confirmado")}>
              <Button size="small" type="primary">Confirmar pago</Button>
            </Popconfirm>
            <Popconfirm title="¿Cancelar la compra?" okText="Cancelar compra" cancelText="No" okButtonProps={{ danger: true }} onConfirm={() => accion(ventasApi.cancelar(idBoliche, c.id_compra), "Compra cancelada")}>
              <Button size="small" danger>Cancelar</Button>
            </Popconfirm>
          </Space>
        ),
    },
  ];

  return (
    <Space orientation="vertical" size={16} style={{ width: "100%" }}>
      <Space wrap style={{ width: "100%", justifyContent: "space-between" }}>
        <SelectorEvento idBoliche={idBoliche} onElegir={setEvento} />
        {permisos.puedeVender && evento && <Button type="primary" onClick={() => setVendiendo(true)}>Venta en puerta</Button>}
      </Space>

      {datos && (
        <Row gutter={[12, 12]}>
          <Col xs={12} md={6}><Card variant="borderless"><Statistic title="Compras" value={datos.resumen.compras} /></Card></Col>
          <Col xs={12} md={6}><Card variant="borderless"><Statistic title="Entradas pagadas" value={datos.resumen.entradas_pagadas} /></Card></Col>
          <Col xs={12} md={6}><Card variant="borderless"><Statistic title="Esperando el pago" value={datos.resumen.entradas_pendientes} /></Card></Col>
          <Col xs={12} md={6}><Card variant="borderless"><Statistic title="Vendido" value={moneda(datos.resumen.recaudado)} /></Card></Col>
        </Row>
      )}

      <div className="table-card">
        <Table
          rowKey="id_compra"
          columns={columnas}
          dataSource={datos?.compras ?? []}
          loading={Boolean(evento) && !datos}
          pagination={{ pageSize: 8, hideOnSinglePage: true, showSizeChanger: false }}
          scroll={{ x: "max-content" }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={evento ? "Todavía no hay ventas de este evento." : "Elegí un evento."} /> }}
          expandable={{
            expandedRowRender: (c) => (
              <ul className="lista-simple">
                {c.entradas.map((e) => (
                  <li key={e.id_entrada}>
                    {e.nombre} {e.apellido} · DNI {e.dni} · {e.tipo} · {moneda(e.precio)} <Tag color={COLOR_ENTRADA[e.estado]}>{e.estado}</Tag>
                    {e.usada_en && <span className="muted"> entró {fechaHora(e.usada_en)}</span>}
                  </li>
                ))}
              </ul>
            ),
          }}
        />
      </div>

      {vendiendo && <ModalVentaPuerta idBoliche={idBoliche} evento={evento} onCerrar={() => setVendiendo(false)} onVendida={cargar} />}
    </Space>
  );
}
