import { crearApi } from "./client.js";

// Cliente HTTP del recurso /clientes (listar, obtener, crear, editar, eliminar).
export const clientesApi = crearApi("/clientes");
