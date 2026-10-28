// Cada boliche tiene su página en un subdominio de la plataforma (por ejemplo, boliche-uno.noctis.com.ar). El dominio de la
// plataforma se define al construir el front con VITE_DOMINIO_BASE (todavía no está definido: sin él, las páginas se ven en /b/:subdominio).
const RESERVADOS = ["www", "app", "admin", "api"];

// El subdominio del boliche si se entró por uno, o null.
export function subdominioActual() {
  const base = import.meta.env.VITE_DOMINIO_BASE?.toLowerCase();
  if (!base) return null;
  const host = window.location.hostname.toLowerCase();
  if (!host.endsWith(`.${base}`)) return null;
  const sub = host.slice(0, -(base.length + 1));
  return /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(sub) && !RESERVADOS.includes(sub) ? sub : null;
}
