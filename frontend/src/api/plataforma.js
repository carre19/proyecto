import api from "../services/api.js";
import { crearApi } from "./client.js";

// Clientes HTTP de la plataforma (ver la referencia de la API en el README).

// Boliches: el superadmin los ve todos; el resto, solo los suyos.
export const bolichesApi = {
  ...crearApi("/boliches"),
  // Admins de un boliche (solo el superadmin).
  agregarAdmin: (idBoliche, idUsuario) => api.post(`/boliches/${idBoliche}/admins`, { id_usuario: idUsuario }).then((res) => res.data),
  quitarAdmin: (idBoliche, idUsuario) => api.delete(`/boliches/${idBoliche}/admins/${idUsuario}`).then((res) => res.data),
};

// Usuarios de todo el sistema (solo el superadmin).
export const usuariosApi = crearApi("/usuarios");

// Recursos que cuelgan de un boliche: "eventos" o "equipo". Tiene la misma forma que crearApi, así sirve con PaginaCrud.
export const apiDeBoliche = (idBoliche, recurso) => {
  const base = `/boliches/${idBoliche}/${recurso}`;
  return {
    obtenerTodos: () => api.get(base).then((res) => res.data),
    obtenerUno: (id) => api.get(`${base}/${id}`).then((res) => res.data),
    crear: (datos) => api.post(base, datos).then((res) => res.data),
    editar: (id, datos) => api.put(`${base}/${id}`, datos).then((res) => res.data),
    eliminar: (id) => api.delete(`${base}/${id}`).then((res) => res.data),
  };
};

// Lo que ve cualquiera, sin cuenta.
export const publicoApi = {
  boliches: () => api.get("/publico/boliches").then((res) => res.data),
  boliche: (subdominio) => api.get(`/publico/boliches/${subdominio}`).then((res) => res.data),
};
