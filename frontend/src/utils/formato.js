// Las fechas de Postgres llegan como "2026-10-24T00:00:00.000Z"; nos quedamos con el día.
export const soloFecha = (valor) => (valor ? String(valor).slice(0, 10) : "");

const aFecha = (valor) => {
  const f = soloFecha(valor);
  return f ? new Date(`${f}T00:00:00`) : null;
};

export const hoyISO = () => {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
};

const cap = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);

// "Vie 24 Oct" (este año) o "Mié 10 Mar 2027" (otro año, para que no sea ambigua)
export const fechaCorta = (valor) => {
  const d = aFecha(valor);
  if (!d) return "Sin fecha";
  const dia = cap(d.toLocaleDateString("es-AR", { weekday: "short" }).replace(".", ""));
  const mes = cap(d.toLocaleDateString("es-AR", { month: "short" }).replace(".", ""));
  const anio = d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : "";
  return `${dia} ${d.getDate()} ${mes}${anio}`;
};

// "MIÉ 22 OCT 2026"
export const fechaLarga = (d = new Date()) =>
  d
    .toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
    .replace(/\./g, "")
    .replace(/,/g, "")
    .replace(/ de /g, " ")
    .toUpperCase();

export const diasHasta = (valor) => {
  const d = aFecha(valor);
  if (!d) return null;
  const hoy = aFecha(hoyISO());
  return Math.round((d - hoy) / 86400000);
};

// Nombre completo de una persona o cliente: lo calcula el back (nombre + apellido); si falta, se arma acá.
export const nombreCompleto = (p) => p?.nombre_completo || [p?.nombre, p?.apellido].filter(Boolean).join(" ") || "";

// Línea de contacto: teléfono y email separados por "·" (lo que haya cargado).
export const contacto = (...datos) => datos.filter(Boolean).join(" · ");

// "Sáb 5 Feb · 23:30": fecha y hora de un evento (viene como fecha completa con zona horaria).
export const fechaHora = (valor) => {
  if (!valor) return "Sin fecha";
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return "Sin fecha";
  const dia = cap(d.toLocaleDateString("es-AR", { weekday: "short" }).replace(".", ""));
  const mes = cap(d.toLocaleDateString("es-AR", { month: "short" }).replace(".", ""));
  const anio = d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : "";
  const hora = d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${dia} ${d.getDate()} ${mes}${anio} · ${hora}`;
};

// El evento que se elige por defecto en una lista: el próximo que todavía no pasó (si no hay, el primero).
export const eventoPorDefecto = (eventos) => {
  const ahora = Date.now();
  const proximos = eventos.filter((e) => new Date(e.fecha_hora).getTime() >= ahora).sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora));
  return (proximos[0] ?? eventos[0])?.id_evento ?? null;
};

// Los 5 roles de la plataforma, como se muestran.
export const ROLES = {
  superadmin: "Superadmin",
  admin: "Admin de boliche",
  rrpp_manager: "RRPP manager",
  rrpp: "RRPP",
  cliente: "Cliente",
};
export const rolDe = (usuario) => ROLES[usuario?.rol] ?? "Sin rol";

// A dónde va cada persona al entrar: el superadmin y el admin a sus boliches, el manager y el RRPP directo a su boliche,
// y el cliente a explorar los boliches.
export const inicioDe = (usuario) => {
  if (!usuario) return "/login";
  if (usuario.rol === "cliente") return "/explorar";
  if ((usuario.rol === "rrpp_manager" || usuario.rol === "rrpp") && usuario.boliches?.length) {
    return `/boliches/${usuario.boliches[0].id_boliche}`;
  }
  return "/boliches";
};

export const iniciales = (nombre = "") =>
  nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("") || "?";

export const etiqueta = (texto = "") => cap(String(texto).replace(/_/g, " "));

export const moneda = (valor) =>
  Number(valor ?? 0).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
