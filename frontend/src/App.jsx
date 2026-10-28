import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import RutaProtegida from "./components/RutaProtegida.jsx";
import Acceso from "./pages/Acceso.jsx";
import Landing from "./pages/Landing.jsx";
import Splash from "./components/Splash.jsx";
import { subdominioActual } from "./utils/subdominio.js";

// Las pantallas se cargan recién cuando se visitan (la landing y el acceso, que son lo primero que se ve, van directas).
const Boliches = lazy(() => import("./pages/Boliches.jsx"));
const Explorar = lazy(() => import("./pages/Explorar.jsx"));
const PaginaBoliche = lazy(() => import("./pages/PaginaBoliche.jsx"));
const PaginaTalonario = lazy(() => import("./pages/PaginaTalonario.jsx"));
const Compra = lazy(() => import("./pages/Compra.jsx"));
const MisEntradas = lazy(() => import("./pages/MisEntradas.jsx"));
const BolicheDetalle = lazy(() => import("./pages/BolicheDetalle.jsx"));
const Seguridad = lazy(() => import("./pages/Seguridad.jsx"));
const Plataforma = lazy(() => import("./pages/Plataforma.jsx"));
const Finanzas = lazy(() => import("./pages/Finanzas.jsx"));
const Usuarios = lazy(() => import("./pages/Usuarios.jsx"));

// Mapa de rutas de toda la app.
//   Públicas:  /  /login  /registro  /explorar (lista de boliches)  /b/:subdominio (página de un boliche)
//              /t/:codigo (el link de venta de un RRPP)  /compra/:token (una compra con sus QR, sin cuenta)  /mis-entradas (cliente con sesión)
//   Privadas:  /boliches (superadmin y admin) · /boliches/:id (ficha: todos los del boliche) · /usuarios (superadmin)
//              Van dentro de RutaProtegida (exige sesión y rol) y de Layout (sidebar + barra móvil).
//   En el subdominio de un boliche (VITE_DOMINIO_BASE), "/" es la página de ese boliche.
//   Cualquier otra URL vuelve a la landing.
// <Splash /> es la pantalla que aparece al cambiar de modo claro/oscuro (siempre montado, se muestra por evento).
export default function App() {
  // Si se entró por el subdominio de un boliche, la raíz es la página de ese boliche.
  const subdominio = subdominioActual();
  return (
    <>
      <Splash />
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={subdominio ? <PaginaBoliche subdominioFijo={subdominio} /> : <Landing />} />
          <Route path="/login" element={<Acceso modo="login" />} />
          <Route path="/registro" element={<Acceso modo="registro" />} />
          <Route path="/explorar" element={<Explorar />} />
          <Route path="/b/:subdominio" element={<PaginaBoliche />} />
          <Route path="/t/:codigo" element={<PaginaTalonario />} />
          <Route path="/compra/:token" element={<Compra />} />
          <Route path="/mis-entradas" element={<RutaProtegida roles={["cliente"]}><MisEntradas /></RutaProtegida>} />

          <Route
            element={
              <RutaProtegida>
                <Layout />
              </RutaProtegida>
            }
          >
            <Route path="/boliches" element={<RutaProtegida roles={["superadmin", "admin"]}><Boliches /></RutaProtegida>} />
            <Route path="/boliches/:id" element={<BolicheDetalle />} />
            <Route path="/seguridad" element={<RutaProtegida roles={["superadmin", "admin"]}><Seguridad /></RutaProtegida>} />
            <Route path="/plataforma" element={<RutaProtegida roles={["superadmin"]}><Plataforma /></RutaProtegida>} />
            <Route path="/finanzas" element={<RutaProtegida roles={["superadmin", "admin"]}><Finanzas /></RutaProtegida>} />
            <Route path="/usuarios" element={<RutaProtegida roles={["superadmin"]}><Usuarios /></RutaProtegida>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}
