// Punto de entrada: monta React en #root (ver index.html) y maneja el splash de entrada.
// Proveedores, de afuera hacia adentro:
//   Router (rutas) -> ProveedorTema (Ant Design con los colores del tema) -> AuthProvider (sesión) -> App.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import ProveedorTema from "./components/ProveedorTema.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { iniciarSplash } from "./utils/splash.js";
import "./styles/index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <ProveedorTema>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ProveedorTema>
    </BrowserRouter>
  </StrictMode>
);

// Splash de entrada (ver utils/splash.js).
iniciarSplash();
