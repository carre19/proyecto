// Tema claro/oscuro compartido por toda la app. Se guarda en el atributo data-theme de <html>
// (los estilos lo leen, ver styles/base.css) y en localStorage. Al cambiarlo se muestra el splash.
import { mostrarSplash } from "./splash.js";

const CLAVE = "noctis-tema";
const oyentes = new Set();

function guardado() {
  try {
    const valor = localStorage.getItem(CLAVE);
    return valor === "light" || valor === "dark" ? valor : null;
  } catch {
    return null; // sin acceso a localStorage: se usa la preferencia del sistema
  }
}

// Tema vigente: el de <html> (lo pone index.html al cargar), o el guardado, o el del sistema.
export function temaActual() {
  const enHtml = document.documentElement.dataset.theme;
  if (enHtml === "light" || enHtml === "dark") return enHtml;
  return guardado() ?? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
}

export function suscribirTema(oyente) {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

// Cambia el tema, avisa a los componentes y muestra el splash por encima.
export function alternarTema() {
  const siguiente = temaActual() === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = siguiente;
  try {
    localStorage.setItem(CLAVE, siguiente);
  } catch {
    // no se pudo guardar la preferencia
  }
  oyentes.forEach((oyente) => oyente());
  mostrarSplash();
}
