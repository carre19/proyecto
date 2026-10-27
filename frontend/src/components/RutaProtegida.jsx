import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { inicioDe } from "../utils/formato.js";

// Envuelve las páginas privadas: sin sesión (o sin token) redirige a /login.
// Con "roles" (lista), solo deja pasar a esos roles; los demás vuelven a su pantalla de inicio.
function RutaProtegida({ children, roles }) {
  const { usuario } = useAuth();

  if (!usuario || !localStorage.getItem("token")) {
    return <Navigate to="/login" replace />;
  }
  if (roles && !roles.includes(usuario.rol)) {
    return <Navigate to={inicioDe(usuario)} replace />;
  }

  return children;
}

export default RutaProtegida;
