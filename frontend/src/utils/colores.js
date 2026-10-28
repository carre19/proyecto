// Colores de la página de cada boliche (dos modos, cuatro colores cada uno). Las mismas reglas de contraste
// que valida el back (src/utils/colores.js): acá sirven para avisar antes de guardar, pero el back es quien decide.
export const MODOS = ["oscuro", "claro"];
export const CAMPOS_COLOR = [
  { name: "fondo", label: "Fondo", ayuda: "El color de la página." },
  { name: "tarjetas", label: "Tarjetas", ayuda: "Eventos, mesas VIP y bebidas." },
  { name: "texto", label: "Texto", ayuda: "Títulos y párrafos." },
  { name: "acento", label: "Acento", ayuda: "Botones, precios y detalles." },
];

// Negro y dorado por defecto. En el modo claro el fondo es crema y el dorado más oscuro, para que se lea.
export const COLORES_POR_DEFECTO = {
  oscuro: { fondo: "#0B0B0B", tarjetas: "#161616", texto: "#F5F0E1", acento: "#D4AF37" },
  claro: { fondo: "#FAF7F0", tarjetas: "#FFFFFF", texto: "#1A1A1A", acento: "#A67C00" },
};

export const esColor = (valor) => typeof valor === "string" && /^#[0-9a-fA-F]{6}$/.test(valor);

const luminancia = (hex) => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

// Contraste entre dos colores (de 1 a 21, fórmula de la accesibilidad web).
export const contraste = (a, b) => {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
};

// Lo que tiene que cumplir cada modo para que la página se lea bien.
export const REGLAS = [
  { a: "texto", b: "fondo", minimo: 4.5, descripcion: "Texto sobre el fondo" },
  { a: "texto", b: "tarjetas", minimo: 4.5, descripcion: "Texto sobre las tarjetas" },
  { a: "acento", b: "fondo", minimo: 3, descripcion: "Acento sobre el fondo" },
];

// Cada regla con el contraste que tiene hoy y si la cumple.
export const evaluarContraste = (colores) =>
  REGLAS.map((r) => {
    const valor = contraste(colores[r.a], colores[r.b]);
    return { ...r, valor, cumple: valor >= r.minimo };
  });

// Negro o blanco, el que mejor se lee encima de un color (por ejemplo, el texto de un botón del color de acento).
export const textoSobre = (color) => (contraste(color, "#000000") >= contraste(color, "#FFFFFF") ? "#000000" : "#FFFFFF");
