import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

// Envuelve las páginas privadas: sin sesión (o sin token) redirige a /login.
function RutaProtegida({ children }) {
  const { usuario } = useAuth();

  if (!usuario || !localStorage.getItem("token")) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default RutaProtegida;
