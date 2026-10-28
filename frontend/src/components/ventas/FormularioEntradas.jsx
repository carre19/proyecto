import { Alert, Button, Col, Input, InputNumber, Row, Select, Tag } from "antd";
import { useMemo, useState } from "react";
import { moneda } from "../../utils/formato.js";

const PORCENTAJE_PLATAFORMA = 6; // el cargo de la plataforma sobre las compras de la página (lo paga el cliente)
const MAXIMO = 10;

// Formulario para comprar entradas: se elige cuántas de cada tipo y, por cada entrada, nombre, apellido y DNI de la
// persona (la entrada es personal). Lo usan la compra desde la página y la venta en la puerta.
//   tipos           -> las entradas del evento ([{ id_tipo_entrada, nombre, tipo, estado, precio_virtual, precio_puerta }])
//   campoPrecio     -> "precio_virtual" (página) o "precio_puerta" (puerta)
//   conCargo        -> suma el cargo de la plataforma (solo las compras de la página)
//   metodos         -> [{ value, label }] para elegir cómo se paga (solo en la puerta)
//   contactoObligatorio -> pide teléfono o email para avisar cuando se confirme el pago
//   onEnviar(datos) -> promesa; si falla, se muestra el mensaje acá
export default function FormularioEntradas({ tipos, campoPrecio, conCargo, metodos, contactoObligatorio, textoBoton, onEnviar }) {
  const [cantidades, setCantidades] = useState({});
  const [personas, setPersonas] = useState({}); // { "idTipo-n": { nombre, apellido, dni } }
  const [contacto, setContacto] = useState({ contacto_email: "", contacto_telefono: "" });
  const [metodo, setMetodo] = useState(metodos?.[0]?.value);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const total = Object.values(cantidades).reduce((t, n) => t + n, 0);
  const subtotal = tipos.reduce((t, x) => t + (cantidades[x.id_tipo_entrada] ?? 0) * x[campoPrecio], 0);
  const cargo = conCargo ? Math.ceil((subtotal * PORCENTAJE_PLATAFORMA) / 100) : 0;

  // Una fila de datos por cada entrada elegida.
  const filas = useMemo(
    () => tipos.flatMap((x) => Array.from({ length: cantidades[x.id_tipo_entrada] ?? 0 }, (_, n) => ({ clave: `${x.id_tipo_entrada}-${n}`, tipo: x }))),
    [tipos, cantidades]
  );

  const cambiarCantidad = (idTipo, valor) => {
    const otras = total - (cantidades[idTipo] ?? 0);
    setCantidades({ ...cantidades, [idTipo]: Math.max(0, Math.min(valor ?? 0, MAXIMO - otras)) });
  };
  const cambiarPersona = (clave, campo, valor) => setPersonas({ ...personas, [clave]: { ...personas[clave], [campo]: valor } });

  const enviar = async () => {
    setError("");
    setEnviando(true);
    try {
      await onEnviar({
        items: filas.map((f) => ({ id_tipo_entrada: f.tipo.id_tipo_entrada, nombre: personas[f.clave]?.nombre ?? "", apellido: personas[f.clave]?.apellido ?? "", dni: personas[f.clave]?.dni ?? "" })),
        contacto_email: contacto.contacto_email || undefined,
        contacto_telefono: contacto.contacto_telefono || undefined,
        ...(metodos ? { metodo_pago: metodo } : {}),
      });
    } catch (e) {
      setError(e.message);
      setEnviando(false);
    }
  };

  return (
    <div className="form-entradas">
      <div className="form-entradas-tipos">
        {tipos.map((x) => {
          const disponible = x.estado === "disponible";
          return (
            <div key={x.id_tipo_entrada} className={`form-entradas-tipo ${disponible ? "" : "apagado"}`}>
              <div>
                <strong>{x.nombre}</strong> {x.tipo === "vip" && <Tag color="gold">VIP</Tag>}
                <div className="muted">
                  {moneda(x[campoPrecio])}
                  {!disponible && ` · ${x.estado === "agotada" ? "Agotada" : "No disponible"}`}
                </div>
              </div>
              <InputNumber min={0} max={MAXIMO} disabled={!disponible} value={cantidades[x.id_tipo_entrada] ?? 0} onChange={(v) => cambiarCantidad(x.id_tipo_entrada, v)} aria-label={`Cantidad de ${x.nombre}`} />
            </div>
          );
        })}
      </div>

      {filas.length > 0 && (
        <div className="form-entradas-personas">
          <p className="muted">La entrada es personal: cargá los datos de cada persona. El DNI va escrito en la entrada.</p>
          {filas.map((f, i) => (
            <Row key={f.clave} gutter={8} className="form-entradas-fila">
              <Col xs={24}><strong>Entrada {i + 1}</strong> · {f.tipo.nombre}</Col>
              <Col xs={24} md={8}><Input placeholder="Nombre" value={personas[f.clave]?.nombre ?? ""} onChange={(e) => cambiarPersona(f.clave, "nombre", e.target.value)} autoComplete="off" /></Col>
              <Col xs={24} md={8}><Input placeholder="Apellido" value={personas[f.clave]?.apellido ?? ""} onChange={(e) => cambiarPersona(f.clave, "apellido", e.target.value)} autoComplete="off" /></Col>
              <Col xs={24} md={8}><Input placeholder="DNI (sin puntos)" inputMode="numeric" value={personas[f.clave]?.dni ?? ""} onChange={(e) => cambiarPersona(f.clave, "dni", e.target.value)} autoComplete="off" /></Col>
            </Row>
          ))}

          <Row gutter={8}>
            <Col xs={24} md={12}><Input type="email" placeholder={`Email${contactoObligatorio ? " (o teléfono)" : " (opcional)"}`} value={contacto.contacto_email} onChange={(e) => setContacto({ ...contacto, contacto_email: e.target.value })} /></Col>
            <Col xs={24} md={12}><Input placeholder={`Teléfono${contactoObligatorio ? " (o email)" : " (opcional)"}`} value={contacto.contacto_telefono} onChange={(e) => setContacto({ ...contacto, contacto_telefono: e.target.value })} /></Col>
          </Row>
          {contactoObligatorio && <p className="muted">Lo usamos solo para avisarte cuando se confirme el pago.</p>}
          {metodos && <Select style={{ width: "100%" }} value={metodo} onChange={setMetodo} options={metodos} aria-label="Método de pago" />}
        </div>
      )}

      <div className="form-entradas-total">
        <div>
          <div>{total} {total === 1 ? "entrada" : "entradas"}: {moneda(subtotal)}</div>
          {conCargo && total > 0 && <div className="muted">Cargo de la plataforma ({PORCENTAJE_PLATAFORMA} %): {moneda(cargo)}</div>}
          <strong>Total: {moneda(subtotal + cargo)}</strong>
        </div>
        <Button type="primary" size="large" disabled={total === 0} loading={enviando} onClick={enviar}>{textoBoton}</Button>
      </div>
      {error && <Alert type="error" showIcon title={error} />}
    </div>
  );
}
