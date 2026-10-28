import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { App, Button, Collapse, Empty, Popconfirm, Space, Table, Tag } from "antd";
import { useCallback, useEffect, useState } from "react";
import { rrppApi } from "../../api/plataforma.js";
import usePermisos from "../../hooks/usePermisos.js";
import { mensajeError } from "../../services/api.js";
import { fechaHora } from "../../utils/formato.js";
import FormModal from "../FormModal.jsx";
import SelectorEvento from "./SelectorEvento.jsx";

// Listas de invitados: las arma cada RRPP para un evento (nombre, apellido, DNI, teléfono y edad; la edad tiene que alcanzar
// la mínima del evento). El manager ve las de su equipo y el admin todas. Los invitados entran por la puerta con su DNI.
export default function PestanaListas({ idBoliche }) {
  const permisos = usePermisos();
  const { message } = App.useApp();
  const [evento, setEvento] = useState(null);
  const [listas, setListas] = useState([]);
  const [modal, setModal] = useState(null); // {tipo: "lista"} | {tipo: "invitado", lista}

  const cargar = useCallback(async () => {
    if (!evento) return setListas([]);
    try {
      setListas(await rrppApi.listas(idBoliche, evento.id_evento));
    } catch (e) {
      message.error(mensajeError(e, "No se pudieron cargar las listas"));
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
  const propia = permisos.esRrpp;
  const guardar = (promesa) => async (valores) => {
    try {
      await promesa(valores);
    } catch (e) {
      throw new Error(mensajeError(e, "No se pudo guardar"));
    }
    await cargar();
  };

  return (
    <div className="puerta">
      <Space wrap style={{ width: "100%", justifyContent: "space-between" }}>
        <SelectorEvento idBoliche={idBoliche} onElegir={setEvento} />
        {propia && evento && <Button type="primary" icon={<PlusOutlined />} onClick={() => setModal({ tipo: "lista" })}>Nueva lista</Button>}
      </Space>

      {listas.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={evento ? (propia ? "Todavía no armaste listas para este evento." : "Todavía no hay listas para este evento.") : "Elegí un evento."} />
      ) : (
        <Collapse
          defaultActiveKey={listas.map((l) => String(l.id_lista))}
          items={listas.map((l) => ({
            key: String(l.id_lista),
            label: <span>{l.nombre} <span className="muted">· {l.invitados.length} {l.invitados.length === 1 ? "invitado" : "invitados"}{!propia && ` · ${l.rrpp}`}</span></span>,
            extra: propia && (
              <Space size={4} onClick={(e) => e.stopPropagation()}>
                <Button size="small" icon={<PlusOutlined />} onClick={() => setModal({ tipo: "invitado", lista: l })}>Agregar</Button>
                <Popconfirm title="¿Borrar la lista?" okText="Borrar" cancelText="No" okButtonProps={{ danger: true }} onConfirm={() => accion(rrppApi.eliminarLista(idBoliche, evento.id_evento, l.id_lista), "Lista borrada")}>
                  <Button size="small" danger icon={<DeleteOutlined />} aria-label="Borrar lista" />
                </Popconfirm>
              </Space>
            ),
            children: (
              <Table
                rowKey="id_invitado"
                size="small"
                dataSource={l.invitados}
                pagination={false}
                scroll={{ x: "max-content" }}
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Lista vacía." /> }}
                columns={[
                  { title: "Nombre", render: (_, i) => `${i.nombre} ${i.apellido}` },
                  { title: "DNI", dataIndex: "dni" },
                  { title: "Teléfono", render: (_, i) => i.telefono ?? "—" },
                  { title: "Edad", dataIndex: "edad" },
                  { title: "Entrada", render: (_, i) => (i.ingreso_en ? <Tag color="green">Entró {fechaHora(i.ingreso_en)}</Tag> : <Tag>En lista</Tag>) },
                  {
                    title: "",
                    align: "right",
                    render: (_, i) => propia && !i.ingreso_en && (
                      <Popconfirm title="¿Quitar de la lista?" okText="Quitar" cancelText="No" okButtonProps={{ danger: true }} onConfirm={() => accion(rrppApi.quitarInvitado(idBoliche, evento.id_evento, l.id_lista, i.id_invitado), "Invitado quitado")}>
                        <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label="Quitar invitado" />
                      </Popconfirm>
                    ),
                  },
                ]}
              />
            ),
          }))}
        />
      )}

      {modal?.tipo === "lista" && (
        <FormModal titulo="Nueva lista" campos={[{ name: "nombre", label: "Nombre de la lista", required: true, full: true, ayuda: "Por ejemplo: Cumple de Sofi." }]} item={null}
          onGuardar={guardar((v) => rrppApi.crearLista(idBoliche, evento.id_evento, v.nombre))} onCerrar={() => setModal(null)} />
      )}
      {modal?.tipo === "invitado" && (
        <FormModal
          titulo={`Agregar a "${modal.lista.nombre}"`}
          campos={[
            { name: "nombre", label: "Nombre", required: true },
            { name: "apellido", label: "Apellido", required: true },
            { name: "dni", label: "DNI", required: true, ayuda: "Sin puntos." },
            { name: "telefono", label: "Teléfono" },
            { name: "edad", label: "Edad", type: "number", required: true, min: 0, max: 120, ayuda: `Mínimo para este evento: ${evento.edad_minima} años.` },
          ]}
          item={null}
          onGuardar={guardar((v) => rrppApi.agregarInvitado(idBoliche, evento.id_evento, modal.lista.id_lista, Object.fromEntries(Object.entries(v).filter(([, valor]) => valor !== null))))}
          onCerrar={() => setModal(null)}
        />
      )}
    </div>
  );
}
