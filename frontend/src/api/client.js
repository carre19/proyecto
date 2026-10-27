import api from "../services/api.js";

// CRUD estándar, mismo contrato que los controllers del back:
// GET /, GET /:id, POST /, PUT /:id, DELETE /:id
export function crearApi(recurso) {
  return {
    obtenerTodos: () => api.get(recurso).then((res) => res.data),
    obtenerUno: (id) => api.get(`${recurso}/${id}`).then((res) => res.data),
    crear: (datos) => api.post(recurso, datos).then((res) => res.data),
    editar: (id, datos) => api.put(`${recurso}/${id}`, datos).then((res) => res.data),
    eliminar: (id) => api.delete(`${recurso}/${id}`).then((res) => res.data),
  };
}
