import { ArrowLeftOutlined, IdcardOutlined, LockOutlined, MailOutlined, PhoneOutlined, SafetyOutlined, UserOutlined } from "@ant-design/icons";
import { Alert, Button, Form, Input, Segmented } from "antd";
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import BotonTema from "../components/BotonTema.jsx";
import Logo from "../components/Logo.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { mensajeError } from "../services/api.js";
import { registrar } from "../services/authService.js";
import { inicioDe } from "../utils/formato.js";

// Login y registro comparten pantalla: modo "login" o "registro" según la ruta.
// El formulario es de Ant Design (Form): valida los campos antes de llamar a onFinish.
// Crear una cuenta es solo para clientes: el resto de los roles los da de alta quien corresponde (superadmin, admin o manager).
export default function Acceso({ modo }) {
  const esLogin = modo === "login";
  const { usuario, ingresar, completarVerificacion } = useAuth();
  const [ticket, setTicket] = useState(null); // si no es null, falta el segundo paso del login (verificación en dos pasos)
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Al pasar de login a registro (o al revés) se limpia el error anterior.
  useEffect(() => setError(""), [modo]);

  // Si ya hay sesión no tiene sentido ver esta pantalla.
  if (usuario) return <Navigate to={inicioDe(usuario)} replace />;

  // valores = { nombre?, apellido?, dni?, telefono?, email, password } ya validados por antd.
  const enviar = async (valores) => {
    setError("");
    setEnviando(true);
    try {
      if (!esLogin) await registrar(valores);
      // Al entrar, cada rol va a su pantalla de inicio (la Navigate de arriba se encarga cuando cambia la sesión).
      const { ticket: paso2 } = await ingresar(valores.email, valores.password);
      if (paso2) {
        setTicket(paso2);
        setEnviando(false);
      }
    } catch (err) {
      setError(mensajeError(err, esLogin ? "Error al iniciar sesión" : "Error al crear la cuenta"));
      setEnviando(false);
    }
  };

  const verificar = async ({ codigo }) => {
    setError("");
    setEnviando(true);
    try {
      await completarVerificacion(ticket, codigo);
    } catch (err) {
      setError(mensajeError(err, "El código no es correcto"));
      setEnviando(false);
    }
  };

  return (
    <div className="auth">
      {/* Volver y cambiar de tema: arriba a la derecha de la página. */}
      <div className="auth-acciones">
        <Button shape="round" icon={<ArrowLeftOutlined />} onClick={() => navigate("/")}>
          Volver al inicio
        </Button>
        <BotonTema />
      </div>

      <div className="auth-art">
        <div className="art-top">
          <Logo />
        </div>
        {esLogin ? (
          <h2 key="l">Volvé<br /><span style={{ color: "var(--pink)" }}>a la pista.</span></h2>
        ) : (
          <h2 key="r">Sumate<br /><span style={{ color: "var(--lime)" }}>a la noche.</span></h2>
        )}
      </div>

      <div className="auth-form">
        {ticket ? (
          <Form className="swap" layout="vertical" requiredMark={false} size="large" onFinish={verificar} disabled={enviando}>
            <div>
              <h1>Verificación en dos pasos</h1>
              <p className="lead">Ingresá el código de 6 números de tu app de verificación. Si perdiste el celular, usá un código de recuperación.</p>
            </div>
            <Form.Item name="codigo" label="Código" rules={[{ required: true, message: "Ingresá el código" }]}>
              <Input prefix={<SafetyOutlined />} placeholder="123456" autoFocus autoComplete="one-time-code" inputMode="numeric" />
            </Form.Item>
            {error && <Alert type="error" showIcon title={error} />}
            <Button type="primary" size="large" htmlType="submit" block loading={enviando}>Verificar</Button>
            <Button type="link" block onClick={() => { setTicket(null); setError(""); }}>Volver</Button>
          </Form>
        ) : (
        <>
        {/* Cambia entre las rutas /login y /registro. */}
        <Segmented
          size="large"
          value={modo}
          onChange={(valor) => navigate(valor === "login" ? "/login" : "/registro")}
          options={[
            { label: "Ingresar", value: "login" },
            { label: "Crear cuenta", value: "registro" },
          ]}
        />

        {/* key={modo}: reinicia el formulario y su animación al cambiar de modo. */}
        <Form key={modo} className="swap" layout="vertical" requiredMark={false} size="large" onFinish={enviar} disabled={enviando}>
          <div>
            <h1>{esLogin ? "Ingresá a tu cuenta" : "Creá tu cuenta"}</h1>
            {esLogin && <p className="lead">Usá el email con el que te registraste.</p>}
          </div>

          {!esLogin && (
            <>
              <Form.Item name="nombre" label="Nombre" rules={[{ required: true, message: "Ingresá tu nombre" }]}>
                <Input prefix={<UserOutlined />} placeholder="Nombre" autoComplete="given-name" />
              </Form.Item>
              <Form.Item name="apellido" label="Apellido" rules={[{ required: true, message: "Ingresá tu apellido" }]}>
                <Input prefix={<UserOutlined />} placeholder="Apellido" autoComplete="family-name" />
              </Form.Item>
            </>
          )}

          {!esLogin && (
            <>
              <Form.Item name="dni" label="DNI (opcional)" rules={[{ pattern: /^\d{7,9}$/, message: "Entre 7 y 9 números, sin puntos" }]}>
                <Input prefix={<IdcardOutlined />} placeholder="Sin puntos" inputMode="numeric" />
              </Form.Item>
              <Form.Item name="telefono" label="Teléfono (opcional)">
                <Input prefix={<PhoneOutlined />} placeholder="351 000 0000" autoComplete="tel" />
              </Form.Item>
            </>
          )}

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: "Ingresá tu email" },
              { type: "email", message: "Ingresá un email válido" },
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="usuario@gmail.com" autoComplete="email" />
          </Form.Item>

          <Form.Item
            name="password"
            label="Contraseña"
            rules={[
              { required: true, message: "Ingresá tu contraseña" },
              ...(esLogin ? [] : [{ min: 8, message: "Mínimo 8 caracteres" }]),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder={esLogin ? "••••••••" : "Mínimo 8 caracteres"}
              autoComplete={esLogin ? "current-password" : "new-password"}
            />
          </Form.Item>

          {error && <Alert type="error" showIcon title={error} />}

          <Button type="primary" size="large" htmlType="submit" block loading={enviando}>
            {esLogin ? "Ingresar" : "Crear cuenta"}
          </Button>
        </Form>
        </>
        )}
      </div>
    </div>
  );
}
