import { Alert, App, Button, Card, Empty, Input, Modal, Popconfirm, Space, Table, Tag } from "antd";
import { useCallback, useEffect, useState } from "react";
import { pagosApi } from "../../api/plataforma.js";
import usePermisos from "../../hooks/usePermisos.js";
import { mensajeError } from "../../services/api.js";
import { fechaHora, moneda } from "../../utils/formato.js";
import Estado from "../Estado.jsx";
import FormModal from "../FormModal.jsx";

const CAMPOS_CUENTA = [
  { name: "titular", label: "Titular de la cuenta", required: true, full: true },
  { name: "banco", label: "Banco o billetera" },
  { name: "alias", label: "Alias", ayuda: "Alias o CBU: al menos uno." },
  { name: "cbu", label: "CBU", ayuda: "22 números.", full: true },
  { name: "instrucciones", label: "Instrucciones para el cliente", type: "textarea" },
];
const ESTADO_AVISO = { pendiente: "var(--amber)", enviada: "var(--lime)", simulada: "var(--muted)", fallida: "var(--red)" };
const ORIGEN = { automatico: "Aviso del banco", manual: "Confirmado a mano", puerta: "Puerta" };

// Pagos del boliche: dónde se cobra (la cuenta que cargó el admin), los pagos que llegaron y no se pudieron asignar solos
// (monto menor, pago repetido o compra vencida), el historial y los avisos que se mandaron a los clientes.
// Lo ven el superadmin, el admin y el manager; solo el admin y el superadmin cambian la cuenta de cobro.
export default function PestanaPagos({ idBoliche }) {
  const permisos = usePermisos();
  const { message } = App.useApp();
  const [cuenta, setCuenta] = useState(undefined);
  const [pagos, setPagos] = useState([]);
  const [avisos, setAvisos] = useState([]);
  const [editando, setEditando] = useState(false);
  const [resolviendo, setResolviendo] = useState(null);
  const [nota, setNota] = useState("");

  const cargar = useCallback(async () => {
    try {
      const [c, p, a] = await Promise.all([pagosApi.cuenta(idBoliche), pagosApi.listar(idBoliche), pagosApi.avisos(idBoliche)]);
      setCuenta(c);
      setPagos(p);
      setAvisos(a);
    } catch (e) {
      message.error(mensajeError(e, "No se pudieron cargar los pagos"));
    }
  }, [idBoliche, message]);
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

  const aRevisar = pagos.filter((p) => p.estado === "a_revisar");

  return (
    <div className="ficha-boliche">
      <Card variant="borderless" title="Cuenta de cobro" extra={permisos.puedeEditarLocal && <Button onClick={() => setEditando(true)}>{cuenta ? "Editar" : "Cargar cuenta"}</Button>}>
        {cuenta === undefined ? null : cuenta ? (
          <p>
            <strong>{cuenta.titular}</strong>{cuenta.banco && ` · ${cuenta.banco}`}
            {cuenta.alias && <><br />Alias: {cuenta.alias}</>}
            {cuenta.cbu && <><br />CBU: {cuenta.cbu}</>}
            {cuenta.instrucciones && <><br /><span className="muted">{cuenta.instrucciones}</span></>}
          </p>
        ) : (
          <Alert type="warning" showIcon title="Todavía no cargaste la cuenta donde cobrás." description="Sin ella, las entradas no se pueden pagar desde la página: solo se venden en la puerta." />
        )}
      </Card>

      <Card variant="borderless" title={`Pagos para revisar (${aRevisar.length})`}>
        <Table
          rowKey="id_pago"
          size="small"
          dataSource={aRevisar}
          pagination={false}
          scroll={{ x: "max-content" }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No hay pagos para revisar." /> }}
          columns={[
            { title: "Cuándo", render: (_, p) => fechaHora(p.recibido_en) },
            { title: "Compra", dataIndex: "referencia" },
            { title: "Llegó", render: (_, p) => moneda(p.monto) },
            { title: "La compra pedía", render: (_, p) => moneda(p.total_compra) },
            { title: "Qué pasó", dataIndex: "detalle" },
            {
              title: "",
              align: "right",
              render: (_, p) => (
                <Space size={4}>
                  {p.estado_compra === "cancelada" && (
                    <Popconfirm title="¿Volver a tomar las entradas y confirmar la compra?" okText="Reactivar" cancelText="No" onConfirm={() => accion(pagosApi.reactivar(idBoliche, p.id_pago), "Compra reactivada")}>
                      <Button size="small" type="primary">Reactivar compra</Button>
                    </Popconfirm>
                  )}
                  <Button size="small" onClick={() => { setNota(""); setResolviendo(p); }}>Marcar resuelto</Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Card variant="borderless" title="Últimos pagos">
        <Table
          rowKey="id_pago"
          size="small"
          dataSource={pagos.filter((p) => p.estado !== "a_revisar")}
          pagination={{ pageSize: 8, hideOnSinglePage: true, showSizeChanger: false }}
          scroll={{ x: "max-content" }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Todavía no hay pagos." /> }}
          columns={[
            { title: "Cuándo", render: (_, p) => fechaHora(p.recibido_en) },
            { title: "Compra", dataIndex: "referencia" },
            { title: "Monto", render: (_, p) => moneda(p.monto) },
            { title: "Cómo", render: (_, p) => `${p.metodo} · ${ORIGEN[p.origen]}` },
            { title: "Estado", render: (_, p) => <Tag color={p.estado === "confirmado" ? "green" : "default"}>{p.estado}</Tag> },
            { title: "Lo cargó", render: (_, p) => p.registrado_por ?? "—" },
          ]}
        />
      </Card>

      <Card variant="borderless" title="Avisos a los clientes">
        <Table
          rowKey="id_notificacion"
          size="small"
          dataSource={avisos}
          pagination={{ pageSize: 6, hideOnSinglePage: true, showSizeChanger: false }}
          scroll={{ x: "max-content" }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Todavía no se mandó ningún aviso." /> }}
          columns={[
            { title: "Cuándo", render: (_, a) => fechaHora(a.creada_en) },
            { title: "Compra", dataIndex: "referencia" },
            { title: "Canal", dataIndex: "canal" },
            { title: "Destino", dataIndex: "destino" },
            { title: "Estado", render: (_, a) => <Estado estado={a.estado} color={ESTADO_AVISO[a.estado]} /> },
            { title: "Detalle", render: (_, a) => (a.error ? `${a.error} (intentos: ${a.intentos})` : a.estado === "simulada" ? "Sin servicio de mensajes conectado" : "—") },
          ]}
        />
      </Card>

      {editando && (
        <FormModal
          titulo="Cuenta de cobro"
          campos={CAMPOS_CUENTA}
          item={cuenta}
          onGuardar={async (valores) => {
            try {
              await pagosApi.guardarCuenta(idBoliche, valores);
            } catch (e) {
              throw new Error(mensajeError(e, "No se pudo guardar la cuenta"));
            }
            await cargar();
          }}
          onCerrar={() => setEditando(false)}
        />
      )}
      <Modal open={Boolean(resolviendo)} title="Marcar el pago como resuelto" okText="Marcar resuelto" cancelText="Cancelar" onCancel={() => setResolviendo(null)}
        onOk={async () => { await accion(pagosApi.resolver(idBoliche, resolviendo.id_pago, nota), "Pago resuelto"); setResolviendo(null); }}>
        <p className="muted">Por ejemplo, si devolviste el dinero fuera del sistema. Podés dejar una nota.</p>
        <Input.TextArea rows={3} maxLength={250} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Qué se hizo con este pago" />
      </Modal>
    </div>
  );
}
