import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import RutaProtegida from "./components/RutaProtegida.jsx";
import Acceso from "./pages/Acceso.jsx";
import Landing from "./pages/Landing.jsx";
import Splash from "./components/Splash.jsx";

// Las pantallas se cargan recién cuando se visitan (la landing y el acceso, que son lo primero que se ve, van directas).
const Boliches = lazy(() => import("./pages/Boliches.jsx"));
const Explorar = lazy(() => import("./pages/Explorar.jsx"));
const PaginaBoliche = lazy(() => import("./pages/PaginaBoliche.jsx"));
const PaginaTalonario = lazy(() => import("./pages/PaginaTalonario.jsx"));
const Compra = lazy(() => import("./pages/Compra.jsx"));
const MisEntradas = lazy(() => import("./pages/MisEntradas.jsx"));
const BolicheDetalle = lazy(() => import("./pages/BolicheDetalle.jsx"));
const Finanzas = lazy(() => import("./pages/Finanzas.jsx"));
const Usuarios = lazy(() => import("./pages/Usuarios.jsx"));

// Mapa de rutas de toda la app.
//   Públicas:  /  /login  /registro  /explorar (lista de boliches)  /b/:subdominio (página de un boliche)
//              /t/:codigo (el link de venta de un RRPP)  /compra/:token (una compra con sus QR, sin cuenta)  /mis-entradas (cliente con sesión)
//   Privadas:  /boliches (superadmin y admin) · /boliches/:id (ficha: todos los del boliche) · /usuarios (superadmin)
//              Van dentro de RutaProtegida (exige sesión y rol) y de Layout (sidebar + barra móvil).
//   Cualquier otra URL vuelve a la landing.
// <Splash /> es la pantalla que aparece al cambiar de modo claro/oscuro (siempre montado, se muestra por evento).
export default function App() {
  return (
    <>
      <Splash />
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Landing />} />
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
            <Route path="/finanzas" element={<RutaProtegida roles={["superadmin", "admin"]}><Finanzas /></RutaProtegida>} />
            <Route path="/usuarios" element={<RutaProtegida roles={["superadmin"]}><Usuarios /></RutaProtegida>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}
