import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { App, Button, Card, Col, Descriptions, Drawer, Empty, Input, InputNumber, Row, Select, Space, Table, Tag } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiDeBoliche, personalApi } from "../../api/plataforma.js";
import { mensajeError } from "../../services/api.js";
import { fechaHora, moneda } from "../../utils/formato.js";
import Estado from "../Estado.jsx";
import PaginaCrud from "../PaginaCrud.jsx";
import SelectorEvento from "./SelectorEvento.jsx";

const ROLES = { encargado: "Encargado o gerente", puerta: "Puerta y control de acceso", boleteria: "Boletería y caja", seguridad: "Seguridad", barman: "Barman", limpieza: "Limpieza", dj_artista: "DJ y artistas", guardarropa: "Guardarropa", mozo_vip: "Mozos y sector VIP" };
const OPCIONES_ROL = Object.entries(ROLES).map(([value, label]) => ({ value, label }));
const COBRO = { por_evento: "por evento", por_hora: "por hora", mensual: "por mes" };
const CONTACTOS = [{ value: "telefono", label: "Teléfono" }, { value: "whatsapp", label: "WhatsApp" }, { value: "email", label: "Email" }, { value: "instagram", label: "Instagram" }, { value: "otro", label: "Otro" }];

// Ficha de una persona: sus contactos (se agregan con el tiempo) y su historial (en qué eventos estuvo y cuánto se le pagó).
function FichaPersonal({ idBoliche, persona, onCerrar, onCambio }) {
  const { message } = App.useApp();
  const [ficha, setFicha] = useState(null);
  const [nuevo, setNuevo] = useState({ tipo: "whatsapp", valor: "" });

  const cargar = useCallback(() => personalApi.ficha(idBoliche, persona.id_personal).then(setFicha).catch(() => setFicha(null)), [idBoliche, persona.id_personal]);
  useEffect(() => {
    cargar();
  }, [cargar]);

  const accion = async (promesa) => {
    try {
      await promesa;
      await cargar();
      onCambio();
    } catch (e) {
      message.error(mensajeError(e, "No se pudo completar la acción"));
    }
  };

  return (
    <Drawer open width={520} title={persona.nombre_completo} onClose={onCerrar}>
      {ficha && (
        <Space orientation="vertical" size={20} style={{ width: "100%" }}>
          <Descriptions size="small" column={1} items={[
            { key: "rol", label: "Rol", children: ROLES[ficha.rol_local] },
            { key: "cobra", label: "Cobra", children: ficha.monto_cobro != null ? `${moneda(ficha.monto_cobro)} ${COBRO[ficha.cobro_tipo]}` : "Sin definir" },
            { key: "notas", label: "Otros datos", children: ficha.notas ?? "—" },
          ]} />

          <Card size="small" title="Contacto" variant="borderless">
            <Space orientation="vertical" style={{ width: "100%" }}>
              {ficha.contactos.length === 0 && <span className="muted">Todavía no hay datos de contacto.</span>}
              {ficha.contactos.map((c) => (
                <Space key={c.id_contacto}><Tag>{CONTACTOS.find((x) => x.value === c.tipo)?.label}</Tag>{c.valor}
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label="Quitar contacto" onClick={() => accion(personalApi.quitarContacto(idBoliche, ficha.id_personal, c.id_contacto))} />
                </Space>
              ))}
              <Space.Compact style={{ width: "100%" }}>
                <Select style={{ width: 130 }} value={nuevo.tipo} options={CONTACTOS} onChange={(tipo) => setNuevo({ ...nuevo, tipo })} />
                <Input placeholder="Dato de contacto" value={nuevo.valor} onChange={(e) => setNuevo({ ...nuevo, valor: e.target.value })} onPressEnter={() => nuevo.valor.trim() && accion(personalApi.agregarContacto(idBoliche, ficha.id_personal, nuevo).then(() => setNuevo({ ...nuevo, valor: "" })))} />
                <Button icon={<PlusOutlined />} disabled={!nuevo.valor.trim()} onClick={() => accion(personalApi.agregarContacto(idBoliche, ficha.id_personal, nuevo).then(() => setNuevo({ ...nuevo, valor: "" })))}>Agregar</Button>
              </Space.Compact>
            </Space>
          </Card>

          <Card size="small" title={`Cuándo estuvo · total pagado ${moneda(ficha.total_pagado)}`} variant="borderless">
            <Table rowKey="id_evento" size="small" pagination={false} dataSource={ficha.historial}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Todavía no trabajó en ningún evento." /> }}
              columns={[{ title: "Evento", dataIndex: "evento" }, { title: "Fecha", render: (_, h) => fechaHora(h.fecha_hora) }, { title: "Se le pagó", render: (_, h) => (h.monto_pagado != null ? moneda(h.monto_pagado) : "—") }]} />
          </Card>
        </Space>
      )}
    </Drawer>
  );
}

// Quién trabaja cada noche y cuánta gente de seguridad, limpieza y barman se necesita.
function PersonalPorEvento({ idBoliche, personal }) {
  const { message } = App.useApp();
  const [evento, setEvento] = useState(null);
  const [datos, setDatos] = useState(null);
  const [elegida, setElegida] = useState(null);
  const [monto, setMonto] = useState(null);

  const cargar = useCallback(async () => {
    if (!evento) return setDatos(null);
    try {
      setDatos(await personalApi.delEvento(idBoliche, evento.id_evento));
    } catch (e) {
      message.error(mensajeError(e, "No se pudo cargar el personal del evento"));
    }
  }, [idBoliche, evento, message]);
  useEffect(() => {
    cargar();
  }, [cargar]);

  const accion = async (promesa, aviso) => {
    try {
      await promesa;
      if (aviso) message.success(aviso);
      await cargar();
    } catch (e) {
      message.error(mensajeError(e, "No se pudo completar la acción"));
    }
  };
  const libres = personal.filter((p) => p.activo && !datos?.asignados.some((a) => a.id_personal === p.id_personal));

  return (
    <Card variant="borderless" title="Personal de cada noche">
      <Space orientation="vertical" size={16} style={{ width: "100%" }}>
        <SelectorEvento idBoliche={idBoliche} onElegir={setEvento} />
        {datos && (
          <>
            <Row gutter={[12, 12]}>
              {datos.dotacion.map((d) => (
                <Col key={d.rol_local} xs={24} md={8}>
                  <Card size="small" variant="borderless">
                    <div>{ROLES[d.rol_local]}</div>
                    <Space>
                      <InputNumber min={0} max={500} value={d.pedida} onChange={(v) => v !== null && v !== d.pedida && accion(personalApi.fijarDotacion(idBoliche, evento.id_evento, { [d.rol_local]: v }))} aria-label={`Cuántos de ${ROLES[d.rol_local]}`} />
                      <span className="muted">van · {d.asignada} asignados</span>
                      {d.asignada < d.pedida && <Tag color="gold">faltan {d.pedida - d.asignada}</Tag>}
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
            <Table rowKey="id_personal" size="small" pagination={false} dataSource={datos.asignados}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Todavía no asignaste a nadie a esta noche." /> }}
              columns={[
                { title: "Persona", dataIndex: "nombre_completo" },
                { title: "Rol", render: (_, a) => ROLES[a.rol_local] },
                { title: "Se le paga", render: (_, a) => (a.monto_pagado != null ? moneda(a.monto_pagado) : "—") },
                { title: "", align: "right", render: (_, a) => <Button type="text" danger icon={<DeleteOutlined />} aria-label="Quitar del evento" onClick={() => accion(personalApi.quitarDelEvento(idBoliche, evento.id_evento, a.id_personal), "Persona quitada")} /> },
              ]}
              footer={() => <strong>Total pagado al personal esa noche: {moneda(datos.total_pagado)}</strong>} />
            <Space wrap>
              <Select style={{ width: 280 }} showSearch optionFilterProp="label" placeholder="Sumar a una persona" value={elegida} onChange={(v) => { setElegida(v); setMonto(personal.find((p) => p.id_personal === v)?.monto_cobro ?? null); }}
                options={libres.map((p) => ({ value: p.id_personal, label: `${p.nombre_completo} · ${ROLES[p.rol_local]}` }))} />
              <InputNumber min={0} step={1000} value={monto} onChange={setMonto} placeholder="Se le paga ($)" style={{ width: 160 }} />
              <Button type="primary" disabled={!elegida} onClick={() => accion(personalApi.asignar(idBoliche, evento.id_evento, elegida, { monto_pagado: monto }).then(() => { setElegida(null); setMonto(null); }), "Persona asignada")}>Asignar a la noche</Button>
            </Space>
          </>
        )}
      </Space>
    </Card>
  );
}

// Personal externo: no tiene panel propio; el admin lleva una ficha por persona y arma la dotación de cada evento.
export default function PestanaPersonal({ idBoliche }) {
  const [personal, setPersonal] = useState([]);
  const [verFicha, setVerFicha] = useState(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    apiDeBoliche(idBoliche, "personal").obtenerTodos().then(setPersonal).catch(() => setPersonal([]));
  }, [idBoliche, version]);

  const config = useMemo(() => {
    const api = apiDeBoliche(idBoliche, "personal");
    const campos = [
      { name: "nombre", label: "Nombre", required: true },
      { name: "apellido", label: "Apellido", required: true },
      { name: "rol_local", label: "Qué hace en el local", type: "select", required: true, full: true, options: OPCIONES_ROL },
      { name: "monto_cobro", label: "Cuánto cobra ($)", type: "number", step: 1000 },
      { name: "cobro_tipo", label: "Cobra", type: "select", required: true, defecto: "por_evento", options: Object.entries(COBRO).map(([value, label]) => ({ value, label })) },
      { name: "notas", label: "Otros datos", type: "textarea" },
    ];
    return {
      titulo: "Personal",
      singular: "persona",
      femenino: true,
      api,
      id: "id_personal",
      embebida: true,
      acciones: (p) => <Button type="text" onClick={() => setVerFicha(p)}>Ficha</Button>,
      columnas: [
        { titulo: "Persona", render: (p) => p.nombre_completo },
        { titulo: "Rol", render: (p) => ROLES[p.rol_local] },
        { titulo: "Cobra", render: (p) => (p.monto_cobro != null ? `${moneda(p.monto_cobro)} ${COBRO[p.cobro_tipo]}` : "—") },
        { titulo: "Contacto", render: (p) => (p.contactos.length ? p.contactos.map((c) => c.valor).join(" · ") : <span className="muted">Sin cargar</span>) },
        { titulo: "Eventos", render: (p) => p.eventos },
        { titulo: "Estado", render: (p) => <Estado estado={p.activo ? "Activa" : "Desactivada"} color={p.activo ? "var(--lime)" : "var(--muted)"} /> },
      ],
      campos,
      camposEdicion: [...campos, { name: "activo", label: "Estado", type: "select", required: true, defecto: true, options: [{ value: true, label: "Activa" }, { value: false, label: "Desactivada" }] }],
      alCargar: () => {},
    };
  }, [idBoliche]);

  return (
    <div className="ficha-boliche">
      <PaginaCrud config={{ ...config, alCargar: () => setVersion((v) => v + 1) }} />
      <PersonalPorEvento idBoliche={idBoliche} personal={personal} />
      {verFicha && <FichaPersonal idBoliche={idBoliche} persona={verFicha} onCerrar={() => setVerFicha(null)} onCambio={() => setVersion((v) => v + 1)} />}
    </div>
  );
}
