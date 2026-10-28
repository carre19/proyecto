import bcrypt from "bcryptjs";

// Inserta un usuario con su contraseña cifrada. "db" puede ser el pool o un cliente de transacción.
// Lanza el error de la base si el email ya existe (código 23505): quien llama lo traduce a un 409.
export const insertarUsuario = async (db, datos, rol) => {
    const hash = await bcrypt.hash(datos.password, 10);
    const resultado = await db.query(`
        INSERT INTO usuario (email, password_hash, nombre, apellido, dni, telefono, rol)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id_usuario, email, nombre, apellido, nombre_completo, dni, telefono, rol, activo`,
        [datos.email, hash, datos.nombre, datos.apellido, datos.dni, datos.telefono, rol]);

    return resultado.rows[0];
};

// Respuesta de error para la base: email repetido, o un error propio de las reglas de la base (RAISE EXCEPTION).
// Devuelve true si ya respondió.
export const responderErrorDeBase = (error, res) => {
    if(error.code === "23505"){
        const mensaje = error.constraint === "boliche_subdominio_key" ? "ese subdominio ya está en uso"
            : error.constraint === "usuario_email_key" ? "ese email ya está registrado"
            : error.constraint === "tipo_entrada_nombre_key" ? "ya hay una entrada con ese nombre en este evento"
            : error.constraint === "bebida_nombre_key" ? "ya cargaste una bebida con ese nombre en esa categoría"
            : error.constraint === "mesa_vip_nombre_key" ? "ya hay una mesa VIP con ese nombre"
            : error.constraint === "boliche_foto_portada_key" ? "el boliche ya tiene una foto de portada"
            : error.constraint === "entrada_dni_evento_key" ? `el DNI ${/dni\)=\(\d+, (\d+)\)/.exec(error.detail ?? "")?.[1] ?? ""} ya tiene una entrada para este evento (la entrada es personal)`.replace("DNI  ", "DNI ")
            : "ese dato ya existe";
        res.status(409).json({mensaje});
        return true;
    }
    if(error.code === "P0001"){
        res.status(400).json({mensaje: error.message});
        return true;
    }
    if(error.code === "23503" && ["entrada_tipo_fkey", "compra_evento_fkey", "entrada_compra_fkey"].includes(error.constraint)){
        res.status(409).json({mensaje: error.constraint === "entrada_tipo_fkey" ? "ya se vendieron entradas de este tipo: no se puede borrar" : "ya hay ventas en este evento: cancelalo en vez de borrarlo"});
        return true;
    }
    if(error.code === "23514" || error.code === "23503"){
        res.status(400).json({mensaje: "alguno de los datos no cumple las reglas"});
        return true;
    }

    return false;
};
