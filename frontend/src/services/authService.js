// Llamadas de autenticación al back. Devuelven directamente el cuerpo de la respuesta.
// login -> { token, usuario } | registrar -> usuario nuevo (siempre cliente) | obtenerPerfil -> usuario actual
// El usuario trae { id, nombre, apellido, nombre_completo, email, rol, boliches: [{ id_boliche, nombre, subdominio, activo }] }.
import api from "./api";

export const login = (email, password) =>
  api.post("/auth/login", { email, password }).then((res) => res.data);

export const registrar = (datos) =>
  api.post("/auth/register", datos).then((res) => res.data);

export const obtenerPerfil = () =>
  api.get("/auth/perfil").then((res) => res.data);

// Verificación en dos pasos (admins). El login puede devolver { requiere_verificacion, ticket } en vez de la sesión:
// con el ticket y el código de la app (o uno de recuperación) se completa con verificarSegundoPaso.
export const verificarSegundoPaso = (ticket, codigo) =>
  api.post("/auth/2fa/verificar", { ticket, codigo }).then((res) => res.data);
export const estado2fa = () => api.get("/auth/2fa").then((res) => res.data);
export const preparar2fa = () => api.post("/auth/2fa/preparar").then((res) => res.data);
export const activar2fa = (codigo) => api.post("/auth/2fa/activar", { codigo }).then((res) => res.data);
export const desactivar2fa = (password, codigo) => api.post("/auth/2fa/desactivar", { password, codigo }).then((res) => res.data);
