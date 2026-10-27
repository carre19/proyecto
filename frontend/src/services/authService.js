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
