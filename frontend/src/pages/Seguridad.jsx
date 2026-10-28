import { CopyOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { Alert, App, Button, Card, Form, Input, QRCode, Result, Skeleton, Space, Tag } from "antd";
import { useCallback, useEffect, useState } from "react";
import Topbar from "../components/Topbar.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { mensajeError } from "../services/api.js";
import { activar2fa, desactivar2fa, estado2fa, preparar2fa } from "../services/authService.js";
import { fechaLarga } from "../utils/formato.js";

// Verificación en dos pasos de los admins: además de la contraseña, se pide un código de 6 números que genera una app
// (Google Authenticator, Authy, Microsoft Authenticator...) en el celular. Si la plataforma la exige, el admin que todavía
// no la activó solo puede usar esta pantalla.
export default function Seguridad() {
  const { message } = App.useApp();
  const { guardarSesion, usuario } = useAuth();
  const [estado, setEstado] = useState(null);
  const [preparada, setPreparada] = useState(null); // { secreto, otpauth_url }
  const [codigos, setCodigos] = useState(null); // códigos de recuperación recién generados (se ven una sola vez)
  const [error, setError] = useState("");
  const [trabajando, setTrabajando] = useState(false);

  const cargar = useCallback(() => estado2fa().then(setEstado).catch((e) => setError(mensajeError(e, "No se pudo cargar la verificación"))), []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  const ejecutar = async (accion) => {
    setError("");
    setTrabajando(true);
    try {
      await accion();
    } catch (e) {
      setError(mensajeError(e, "No se pudo completar la acción"));
    } finally {
      setTrabajando(false);
    }
  };

  const copiar = (texto) => navigator.clipboard?.writeText(texto).then(() => message.success("Copiado"), () => message.info(texto));

  const activar = ({ codigo }) => ejecutar(async () => {
    const datos = await activar2fa(codigo);
    setCodigos(datos.codigos_de_recuperacion);
    setPreparada(null);
    guardarSesion(datos.token, datos.usuario); // si venía con la sesión limitada, ahora recibe la completa
    cargar();
  });

  const desactivar = ({ password, codigo }) => ejecutar(async () => {
    await desactivar2fa(password, codigo);
    message.success("Verificación en dos pasos desactivada");
    guardarSesion(localStorage.getItem("token"), { ...usuario, verificacion: { ...usuario.verificacion, activa: false } });
    cargar();
  });

  return (
    <main className="main">
      <Topbar sinBuscador />
      <div className="page-head">
        <div>
          <div className="eyebrow">{fechaLarga()}</div>
          <h1>Seguridad de tu cuenta</h1>
        </div>
      </div>

      {!estado && !error && <Skeleton active paragraph={{ rows: 4 }} />}
      {error && <Alert type="error" showIcon title={error} />}

      {estado?.obligatoria && !estado.activa && (
        <Alert type="warning" showIcon title="Tenés que activar la verificación en dos pasos para usar la plataforma." description="Es obligatoria para los admins: sin ella solo podés ver esta pantalla." />
      )}

      {codigos && (
        <Card variant="borderless" title="Guardá estos códigos de recuperación">
          <p>Si perdés el celular, cada uno sirve <strong>una sola vez</strong> en lugar del código de la app. Guardalos en un lugar seguro: no se vuelven a mostrar.</p>
          <Space wrap size={[8, 8]}>{codigos.map((c) => <Tag key={c} style={{ fontSize: 16, padding: "4px 10px" }}>{c}</Tag>)}</Space>
          <div style={{ marginTop: 12 }}><Button icon={<CopyOutlined />} onClick={() => copiar(codigos.join("\n"))}>Copiar todos</Button></div>
        </Card>
      )}

      {estado && !estado.activa && !codigos && (
        <Card variant="borderless" title="Activar la verificación en dos pasos">
          {!preparada ? (
            <Space orientation="vertical">
              <p>Vas a necesitar una app de verificación en el celular (Google Authenticator, Authy o Microsoft Authenticator).</p>
              <Button type="primary" icon={<SafetyCertificateOutlined />} loading={trabajando} onClick={() => ejecutar(async () => setPreparada(await preparar2fa()))}>Empezar</Button>
            </Space>
          ) : (
            <Space orientation="vertical" size={16}>
              <p>1. En la app, elegí "agregar cuenta" y escaneá este código QR.</p>
              <QRCode value={preparada.otpauth_url} size={200} color="#000000" bgColor="#FFFFFF" />
              <p className="muted">¿No podés escanearlo? Escribí este código a mano: <strong>{preparada.secreto}</strong> <Button size="small" icon={<CopyOutlined />} onClick={() => copiar(preparada.secreto)} /></p>
              <p>2. Ingresá el código de 6 números que muestra la app para confirmar.</p>
              <Form layout="inline" onFinish={activar}>
                <Form.Item name="codigo" rules={[{ required: true, message: "Ingresá el código" }]}><Input placeholder="123456" inputMode="numeric" autoComplete="one-time-code" maxLength={6} style={{ width: 160 }} /></Form.Item>
                <Button type="primary" htmlType="submit" loading={trabajando}>Activar</Button>
              </Form>
            </Space>
          )}
        </Card>
      )}

      {estado?.activa && (
        <Card variant="borderless" title="Verificación en dos pasos">
          <Result status="success" title="Está activa" subTitle={`Te quedan ${estado.codigos_de_recuperacion_restantes} códigos de recuperación sin usar.`} />
          {!estado.obligatoria ? (
            <Form layout="vertical" onFinish={desactivar} style={{ maxWidth: 360 }}>
              <p className="muted">Para desactivarla, confirmá tu contraseña y un código de la app.</p>
              <Form.Item name="password" label="Contraseña" rules={[{ required: true, message: "Ingresá tu contraseña" }]}><Input.Password autoComplete="current-password" /></Form.Item>
              <Form.Item name="codigo" label="Código de la app" rules={[{ required: true, message: "Ingresá el código" }]}><Input inputMode="numeric" maxLength={6} autoComplete="one-time-code" /></Form.Item>
              <Button danger htmlType="submit" loading={trabajando}>Desactivar</Button>
            </Form>
          ) : (
            <p className="muted">En esta plataforma es obligatoria: no se puede desactivar. Si perdés el celular, pedile al superadmin que la restablezca.</p>
          )}
        </Card>
      )}
    </main>
  );
}
