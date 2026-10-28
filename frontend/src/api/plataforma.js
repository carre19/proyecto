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

// Recursos que cuelgan de un boliche: "eventos", "equipo", "bebidas", "mesas-vip" o "eventos/:id/entradas". Tiene la misma forma que crearApi, así sirve con PaginaCrud.
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

// Imágenes: el cuerpo de la petición es el archivo mismo (JPG, PNG o WebP, hasta 5 MB). El back reconoce el formato por su contenido.
const subirArchivo = (url, archivo) =>
  api.post(url, archivo, { headers: { "Content-Type": archivo.type }, timeout: 60000 }).then((res) => res.data);

export const imagenesApi = {
  subirFoto: (idBoliche, archivo) => subirArchivo(`/boliches/${idBoliche}/fotos`, archivo),
  borrarFoto: (idBoliche, idFoto) => api.delete(`/boliches/${idBoliche}/fotos/${idFoto}`).then((res) => res.data),
  subirImagenEvento: (idBoliche, idEvento, archivo) => subirArchivo(`/boliches/${idBoliche}/eventos/${idEvento}/imagen`, archivo),
  borrarImagenEvento: (idBoliche, idEvento) => api.delete(`/boliches/${idBoliche}/eventos/${idEvento}/imagen`).then((res) => res.data),
  subirImagenBebida: (idBoliche, idBebida, archivo) => subirArchivo(`/boliches/${idBoliche}/bebidas/${idBebida}/imagen`, archivo),
  borrarImagenBebida: (idBoliche, idBebida) => api.delete(`/boliches/${idBoliche}/bebidas/${idBebida}/imagen`).then((res) => res.data),
  subirImagenMesa: (idBoliche, idMesa, archivo) => subirArchivo(`/boliches/${idBoliche}/mesas-vip/${idMesa}/imagen`, archivo),
  borrarImagenMesa: (idBoliche, idMesa) => api.delete(`/boliches/${idBoliche}/mesas-vip/${idMesa}/imagen`).then((res) => res.data),
};

// Fotos del boliche: una es la portada y el resto, la galería. Todas devuelven la lista completa y actualizada.
export const fotosApi = {
  marcarPortada: (idBoliche, idFoto) => api.put(`/boliches/${idBoliche}/fotos/${idFoto}`, { es_portada: true }).then((res) => res.data),
};

// Colores de la página del boliche. Todas devuelven { claro, oscuro, personalizado, defecto }.
export const temaApi = {
  ver: (idBoliche) => api.get(`/boliches/${idBoliche}/tema`).then((res) => res.data),
  guardar: (idBoliche, modo, colores) => api.put(`/boliches/${idBoliche}/tema`, { modo, ...colores }).then((res) => res.data),
  restablecer: (idBoliche, modo) => api.delete(`/boliches/${idBoliche}/tema`, { params: { modo } }).then((res) => res.data),
};

// Eventos y mesas VIP: qué mesas ofrece cada evento (la lista trae todas las del boliche, indicando cuáles ofrece).
export const mesasDeEventoApi = {
  listar: (idBoliche, idEvento) => api.get(`/boliches/${idBoliche}/eventos/${idEvento}/mesas-vip`).then((res) => res.data),
  ofrecer: (idBoliche, idEvento, idMesa, datos) => api.put(`/boliches/${idBoliche}/eventos/${idEvento}/mesas-vip/${idMesa}`, datos).then((res) => res.data),
};
