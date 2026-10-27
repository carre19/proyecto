import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import RutaProtegida from "./components/RutaProtegida.jsx";
import Acceso from "./pages/Acceso.jsx";
import Landing from "./pages/Landing.jsx";
import Splash from "./components/Splash.jsx";

// Las pantallas se cargan recién cuando se visitan (la landing y el acceso, que son lo primero que se ve, van directas).
const Boliches = lazy(() => import("./pages/Boliches.jsx"));
const BolicheDetalle = lazy(() => import("./pages/BolicheDetalle.jsx"));
const Usuarios = lazy(() => import("./pages/Usuarios.jsx"));

// Mapa de rutas de toda la app.
//   Públicas:  /  /login  /registro
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

          <Route
            element={
              <RutaProtegida>
                <Layout />
              </RutaProtegida>
            }
          >
            <Route path="/boliches" element={<RutaProtegida roles={["superadmin", "admin"]}><Boliches /></RutaProtegida>} />
            <Route path="/boliches/:id" element={<BolicheDetalle />} />
            <Route path="/usuarios" element={<RutaProtegida roles={["superadmin"]}><Usuarios /></RutaProtegida>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}
