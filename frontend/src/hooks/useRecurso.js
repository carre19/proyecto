import { useCallback, useEffect, useState } from "react";
import { mensajeError } from "../services/api.js";

// Carga la lista de un recurso y expone guardar/eliminar con su manejo de errores.
export default function useRecurso(api, nombreId) {
  const [items, setItems] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const recargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const datos = await api.obtenerTodos();
      setItems(Array.isArray(datos) ? datos : []);
    } catch (e) {
      setItems([]);
      setError(mensajeError(e, "No se pudo cargar la lista"));
    } finally {
      setCargando(false);
    }
  }, [api]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  // Si se edita, se envía el registro completo mezclado con los cambios (los PUT del back
  // reemplazan todos los campos). Lanza el error para que lo muestre el formulario.
  const guardar = async (item, valores) => {
    try {
      if (item) await api.editar(item[nombreId], { ...item, ...valores });
      else await api.crear(valores);
    } catch (e) {
      throw new Error(mensajeError(e, "No se pudo guardar"));
    }
    await recargar();
  };

  const eliminar = async (item) => {
    try {
      await api.eliminar(item[nombreId]);
    } catch (e) {
      throw new Error(mensajeError(e, "No se pudo eliminar"));
    }
    await recargar();
  };

  return { items, cargando, error, recargar, guardar, eliminar };
}
