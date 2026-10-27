export const ID_MAXIMO = 2147483647;
export const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Acepta "5" o 5; devuelve el id como número o null si no es un id válido.
export const parseId = (valor) => {
    const texto = String(valor ?? "");
    if(!/^\d+$/.test(texto)){
        return null;
    }

    const id = Number(texto);
    if(id < 1 || id > ID_MAXIMO){
        return null;
    }

    return id;
};

// Texto opcional: devuelve {error} si no es string o supera el máximo, o {valor} (recortado o null).
export const textoOpcional = (valor, campo, maximo) => {
    if(valor === undefined || valor === null){
        return {valor: null};
    }
    if(typeof valor !== "string"){
        return {error: `${campo} no es valido`};
    }

    const limpio = valor.trim();
    if(limpio.length > maximo){
        return {error: `${campo} no puede superar los ${maximo} caracteres`};
    }

    return {valor: limpio || null};
};

// Texto obligatorio: igual que textoOpcional pero exige contenido.
export const textoObligatorio = (valor, campo, maximo) => {
    if(typeof valor !== "string" || !valor.trim()){
        return {error: `${campo} es obligatorio`};
    }

    return textoOpcional(valor, campo, maximo);
};

// Lista de ids sin repetidos: devuelve {error} o {ids}.
export const listaDeIds = (valor, campo) => {
    if(!Array.isArray(valor)){
        return {error: `${campo} debe ser una lista de ids`};
    }

    const ids = [];
    for(const item of valor){
        const id = parseId(item);
        if(id === null){
            return {error: `${campo} contiene un id no valido`};
        }
        if(!ids.includes(id)){
            ids.push(id);
        }
    }

    return {ids};
};

// ---------- Usuarios y datos comunes de la plataforma ----------

export const PASSWORD_MINIMA = 8;
export const REGEX_DNI = /^\d{7,9}$/;

// Normaliza un email: minúsculas y sin espacios.
export const normalizarEmail = (email) => String(email ?? "").trim().toLowerCase();

// Valida los datos de una persona nueva: {nombre, apellido, email, password, dni?, telefono?}.
// Devuelve {error} o {datos} ya limpios (el email en minúsculas).
export const validarPersona = (body) => {
    const nombre = textoObligatorio(body?.nombre, "el nombre", 100);
    const apellido = textoObligatorio(body?.apellido, "el apellido", 100);
    const telefono = textoOpcional(body?.telefono, "el telefono", 30);
    const dni = textoOpcional(body?.dni === undefined || body?.dni === null ? null : String(body.dni), "el dni", 15);
    const error = nombre.error ?? apellido.error ?? telefono.error ?? dni.error;
    if(error){
        return {error};
    }

    const email = normalizarEmail(body?.email);
    if(!email || email.length > 150 || !REGEX_EMAIL.test(email)){
        return {error: "el email no es valido"};
    }
    if(typeof body?.password !== "string" || body.password.length < PASSWORD_MINIMA){
        return {error: `la contraseña debe tener al menos ${PASSWORD_MINIMA} caracteres`};
    }
    if(dni.valor && !REGEX_DNI.test(dni.valor)){
        return {error: "el dni debe tener entre 7 y 9 numeros, sin puntos"};
    }

    return {datos: {nombre: nombre.valor, apellido: apellido.valor, email, password: body.password, dni: dni.valor, telefono: telefono.valor}};
};

// Devuelve el valor como número dentro del rango, o {error}. Si no viene (undefined/null/""), devuelve {valor: null}.
export const numeroOpcional = (valor, campo, {min = -Infinity, max = Infinity, entero = false} = {}) => {
    if(valor === undefined || valor === null || valor === ""){
        return {valor: null};
    }
    const numero = Number(valor);
    if(!Number.isFinite(numero) || (entero && !Number.isInteger(numero)) || numero < min || numero > max){
        return {error: `${campo} no es valido`};
    }

    return {valor: numero};
};
