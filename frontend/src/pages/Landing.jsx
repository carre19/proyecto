import { ArrowRightOutlined, LoginOutlined } from "@ant-design/icons";
import { Button, Collapse } from "antd";
import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import BotonTema from "../components/BotonTema.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { inicioDe } from "../utils/formato.js";

// Landing pública: presentación del producto. Los textos están en estas listas (FUNCIONES, PASOS, FAQ).
// Los botones y el FAQ (acordeón) son de Ant Design.
const FUNCIONES = [
  { titulo: "Boliches", texto: "Varios locales y bares en una sola plataforma, cada uno con su propia página.", color: "var(--pink)" },
  { titulo: "Eventos", texto: "Fecha, artistas, edad mínima, dress code y sector VIP de cada noche.", color: "var(--amber)" },
  { titulo: "Equipo", texto: "Admins, RRPP managers y RRPP, cada uno con su panel y su comisión.", color: "var(--lime)" },
  { titulo: "Entradas", texto: "Por tandas y VIP, con precio virtual y de puerta, y un QR de un solo uso.", color: "var(--cyan)" },
];

const PASOS = [
  { n: 1, titulo: "Sumá tu boliche", texto: "La plataforma lo da de alta con su página y su admin.", color: "var(--pink)" },
  { n: 2, titulo: "Armá tu equipo", texto: "Managers y RRPP, con la comisión que vos definas.", color: "var(--amber)" },
  { n: 3, titulo: "Publicá la noche", texto: "Creá el evento y el público lo ve en la página del boliche.", color: "var(--cyan)" },
];

const FAQ = [
  {
    pregunta: "¿Qué roles hay?",
    respuesta: "Superadmin (la plataforma), admin de boliche (los dueños), RRPP manager, RRPP y cliente. Cada uno tiene su propio panel.",
  },
  {
    pregunta: "¿Puedo tener varios locales?",
    respuesta: "Sí. Un admin puede manejar varios boliches y cada uno se gestiona por separado, sin mezclar sus datos.",
  },
  {
    pregunta: "¿Cada local ve la información de los demás?",
    respuesta: "No. Cada boliche ve únicamente sus propios datos; solo el superadmin de la plataforma ve todos.",
  },
  {
    pregunta: "¿Necesito una cuenta para ver los eventos?",
    respuesta: "No. Cualquier persona puede ver los boliches y sus próximos eventos. La cuenta es opcional y sirve para recibir descuentos.",
  },
];

// Efecto de aparición: marca con la clase "in" los elementos .reveal cuando entran en pantalla.
// Marca con la clase "in" los elementos .reveal cuando entran en pantalla.
function useReveal(ref) {
  useEffect(() => {
    if (!ref.current) return;
    const els = ref.current.querySelectorAll(".reveal");
    const io = new IntersectionObserver(
      (entradas) => entradas.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      }),
      { threshold: 0.15 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ref]);
}

export default function Landing() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false); // true cuando se bajó un poco: la barra pasa a ser de cristal
  const raiz = useRef(null);

  useEffect(() => {
    const alScroll = () => setScrolled(window.scrollY > 24);
    alScroll();
    window.addEventListener("scroll", alScroll, { passive: true });
    return () => window.removeEventListener("scroll", alScroll);
  }, []);

  useReveal(raiz);

  // Quien ya tiene sesión va directo al panel.
  if (usuario) return <Navigate to={inicioDe(usuario)} replace />;

  return (
    <div className="landing" ref={raiz}>
      <header className={`land-nav ${scrolled ? "scrolled" : ""}`}>
        <span>NOCTIS / PLATAFORMA DE BOLICHES</span>
        <nav>
          <Button shape="round" href="#funcionalidades">Funcionalidades</Button>
          <Button shape="round" href="#como-funciona">Cómo funciona</Button>
          <Button shape="round" href="#faq">FAQ</Button>
          <Button shape="round" onClick={() => navigate("/explorar")}>Ver boliches</Button>
          <BotonTema />
          <Button type="primary" shape="round" icon={<LoginOutlined />} onClick={() => navigate("/login")}>
            Ingresar
          </Button>
        </nav>
      </header>

      <section className="land-hero">
        <h1 className="land-title">NOC<br /><span>TIS</span></h1>
        <div className="land-sub">
          <p className="reveal d1">Todos tus boliches y bares, en un solo lugar.</p>
          <ul className="reveal d2">
            <li>ADMINS</li>
            <li>RRPP MANAGERS</li>
            <li>RRPP</li>
          </ul>
          <div className="end reveal d3">
            <Button type="primary" size="large" shape="round" onClick={() => navigate("/explorar")}>
              Ver los boliches <ArrowRightOutlined />
            </Button>
          </div>
        </div>
      </section>

      <section className="lineup" id="funcionalidades">
        <div className="lineup-head reveal">
          <span>LINE-UP DE FUNCIONALIDADES</span>
          <span>{String(FUNCIONES.length).padStart(2, "0")} ACTOS</span>
        </div>
        {FUNCIONES.map((f) => (
          <div key={f.titulo} className="lineup-row reveal">
            <b style={{ color: f.color }}>{f.titulo}</b>
            <span>{f.texto}</span>
          </div>
        ))}
      </section>

      <section className="steps" id="como-funciona">
        {PASOS.map((p) => (
          <div key={p.n} className="step reveal" style={{ "--c": p.color }}>
            <span className="n">{p.n}</span>
            <h3>{p.titulo}</h3>
            <p>{p.texto}</p>
          </div>
        ))}
      </section>

      {/* Preguntas frecuentes: acordeón de Ant Design (se abre una sola a la vez). */}
      <section className="faq" id="faq">
        <h2 className="reveal">FAQ</h2>
        <Collapse
          className="reveal"
          accordion
          ghost
          size="large"
          defaultActiveKey={["0"]}
          items={FAQ.map((f, i) => ({ key: String(i), label: f.pregunta, children: <p>{f.respuesta}</p> }))}
        />
      </section>

      <footer className="land-foot">
        <span>NOCTIS</span>
        <Button type="link" onClick={() => navigate("/login")}>Ingresar</Button>
      </footer>
    </div>
  );
}
