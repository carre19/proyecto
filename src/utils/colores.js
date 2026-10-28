// Colores de la página de cada boliche (ver boliche_tema). Dos modos, cuatro colores cada uno.
export const MODOS = ["claro", "oscuro"];
export const CAMPOS_COLOR = ["fondo", "tarjetas", "texto", "acento"];

// Negro y dorado por defecto. En el modo claro el fondo es crema y el dorado más oscuro, para que se lea.
export const COLORES_POR_DEFECTO = {
    oscuro: {fondo: "#0B0B0B", tarjetas: "#161616", texto: "#F5F0E1", acento: "#D4AF37"},
    claro: {fondo: "#FAF7F0", tarjetas: "#FFFFFF", texto: "#1A1A1A", acento: "#A67C00"},
};

export const esColor = (valor) => typeof valor === "string" && /^#[0-9a-fA-F]{6}$/.test(valor);

const luminancia = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

// Contraste entre dos colores (fórmula de la accesibilidad web, WCAG): de 1 (iguales) a 21 (negro sobre blanco).
export const contraste = (a, b) => {
    const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
    return (claro + 0.05) / (oscuro + 0.05);
};

// Valida los colores de un modo. Devuelve {error} o {colores} (normalizados en mayúsculas).
// Para que la página quede legible: el texto contra el fondo y contra las tarjetas necesita contraste 4,5:1 o más,
// y el acento contra el fondo, 3:1 o más.
export const validarColores = (cuerpo) => {
    const colores = {};
    for (const campo of CAMPOS_COLOR) {
        if (!esColor(cuerpo?.[campo])) {
            return {error: `el color de ${campo} tiene que estar en formato #RRGGBB (por ejemplo #D4AF37)`};
        }
        colores[campo] = cuerpo[campo].toUpperCase();
    }

    const limites = [
        ["texto", "fondo", 4.5, "el texto contra el fondo"],
        ["texto", "tarjetas", 4.5, "el texto contra las tarjetas"],
        ["acento", "fondo", 3, "el acento contra el fondo"],
    ];
    for (const [a, b, minimo, descripcion] of limites) {
        const valor = contraste(colores[a], colores[b]);
        if (valor < minimo) {
            return {error: `${descripcion} tiene poco contraste (${valor.toFixed(1)}:1) y se leería mal: hace falta al menos ${minimo}:1`};
        }
    }

    return {colores};
};
