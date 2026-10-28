import pool from "../data/db.js";
import { enmascarar, puedeVerDni } from "../utils/compras.js";
import { eventoDelBoliche, equipoVisible } from "../utils/evento.js";
import { REGEX_DNI, parseId, textoObligatorio, textoOpcional } from "../utils/validaciones.js";
import { responderErrorDeBase } from "../utils/usuarios.js";

// Listas de invitados: las arma cada RRPP para un evento. El manager ve las de su equipo y el admin todas.
// Cada invitado lleva nombre, apellido, DNI, teléfono y edad; la edad tiene que alcanzar la mínima del evento.

// GET .../eventos/:idEvento/listas
export const listarListas = async (req, res) => {
    try {
        const evento = await eventoDelBoliche(req, res);
        if (!evento) return;
        const alcance = equipoVisible(req.usuario, 3);
        const listas = (await pool.query(`
            SELECT l.id_lista, l.nombre, l.id_rrpp, l.creada_en, u.nombre_completo AS rrpp
              FROM lista_invitados l JOIN boliche_equipo q ON q.id_boliche = l.id_boliche AND q.id_usuario = l.id_rrpp JOIN usuario u ON u.id_usuario = l.id_rrpp
             WHERE l.id_boliche = $1 AND l.id_evento = $2 ${alcance.sql} ORDER BY l.creada_en, l.id_lista`, [req.boliche.id_boliche, evento.id_evento, ...alcance.params])).rows;

        const ver = puedeVerDni(req.usuario.rol);
        const invitados = listas.length === 0 ? [] : (await pool.query(`
            SELECT id_invitado, id_lista, nombre, apellido, dni, telefono, edad, ingreso_en FROM invitado WHERE id_lista = ANY($1) ORDER BY id_invitado`, [listas.map((l) => l.id_lista)])).rows;

        res.json(listas.map((l) => ({
            ...l,
            invitados: invitados.filter((i) => i.id_lista === l.id_lista).map(({ id_lista, dni, telefono, ...i }) => ({ ...i, dni: ver ? dni : enmascarar(dni), telefono: ver ? telefono : null })),
        })));
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "no se pudieron obtener las listas" });
    }
};

// La lista de la ruta, solo si es de este RRPP (las listas las arma y las toca su dueño).
const listaPropia = async (req, res, db) => {
    const idLista = parseId(req.params.idLista);
    if (idLista === null) {
        res.status(400).json({ mensaje: "el id de la lista no es valido" });
        return null;
    }
    const lista = (await db.query(`SELECT * FROM lista_invitados WHERE id_boliche = $1 AND id_evento = $2 AND id_lista = $3 AND id_rrpp = $4`,
        [req.boliche.id_boliche, Number(req.params.idEvento), idLista, req.usuario.id])).rows[0];
    if (!lista) {
        res.status(404).json({ mensaje: "esa lista no existe" });
        return null;
    }

    return lista;
};

// POST .../listas {nombre}
export const crearLista = async (req, res) => {
    try {
        const evento = await eventoDelBoliche(req, res);
        if (!evento) return;
        const nombre = textoObligatorio(req.body?.nombre, "el nombre de la lista", 100);
        if (nombre.error) return res.status(400).json({ mensaje: nombre.error });
        const lista = (await pool.query(`INSERT INTO lista_invitados (id_boliche, id_evento, id_rrpp, nombre) VALUES ($1, $2, $3, $4) RETURNING id_lista, nombre, id_rrpp, creada_en`,
            [req.boliche.id_boliche, evento.id_evento, req.usuario.id, nombre.valor])).rows[0];

        res.status(201).json({ ...lista, invitados: [] });
    } catch (error) {
        if (responderErrorDeBase(error, res)) return;
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo crear la lista" });
    }
};

export const editarLista = async (req, res) => {
    try {
        const lista = await listaPropia(req, res, pool);
        if (!lista) return;
        const nombre = textoObligatorio(req.body?.nombre, "el nombre de la lista", 100);
        if (nombre.error) return res.status(400).json({ mensaje: nombre.error });
        await pool.query(`UPDATE lista_invitados SET nombre = $2 WHERE id_lista = $1`, [lista.id_lista, nombre.valor]);

        res.json({ id_lista: lista.id_lista, nombre: nombre.valor });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo modificar la lista" });
    }
};

export const eliminarLista = async (req, res) => {
    try {
        const lista = await listaPropia(req, res, pool);
        if (!lista) return;
        if (Number((await pool.query(`SELECT count(*) AS n FROM invitado WHERE id_lista = $1 AND ingreso_en IS NOT NULL`, [lista.id_lista])).rows[0].n) > 0) {
            return res.status(409).json({ mensaje: "ya entraron invitados de esta lista: no se puede borrar" });
        }
        await pool.query(`DELETE FROM lista_invitados WHERE id_lista = $1`, [lista.id_lista]);

        res.json({ mensaje: "lista eliminada" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo eliminar la lista" });
    }
};

// Valida los datos de un invitado ("parcial" para editar). Devuelve {error} o {datos}.
const validarInvitado = (body, parcial) => {
    const datos = {};
    const hay = (campo) => body?.[campo] !== undefined;
    for (const [campo, etiqueta] of [["nombre", "el nombre"], ["apellido", "el apellido"]]) {
        if (!parcial || hay(campo)) {
            const texto = textoObligatorio(body?.[campo], etiqueta, 100);
            if (texto.error) return { error: texto.error };
            datos[campo] = texto.valor;
        }
    }
    if (!parcial || hay("dni")) {
        const dni = String(body?.dni ?? "").replace(/[.\s]/g, "");
        if (!REGEX_DNI.test(dni)) return { error: "el DNI debe tener entre 7 y 9 números, sin puntos" };
        datos.dni = dni;
    }
    if (!parcial || hay("edad")) {
        if (!Number.isInteger(body?.edad) || body.edad < 0 || body.edad > 120) return { error: "la edad tiene que ser un número entero" };
        datos.edad = body.edad;
    }
    if (hay("telefono")) {
        const telefono = textoOpcional(body.telefono, "el telefono", 30);
        if (telefono.error) return { error: telefono.error };
        if (telefono.valor && !/^[0-9+() \-]{6,30}$/.test(telefono.valor)) return { error: "el telefono no es valido" };
        datos.telefono = telefono.valor;
    }

    return { datos };
};

// POST .../listas/:idLista/invitados {nombre, apellido, dni, telefono?, edad}
export const agregarInvitado = async (req, res) => {
    try {
        const lista = await listaPropia(req, res, pool);
        if (!lista) return;
        const { error, datos } = validarInvitado(req.body, false);
        if (error) return res.status(400).json({ mensaje: error });
        const invitado = (await pool.query(`
            INSERT INTO invitado (id_boliche, id_evento, id_lista, nombre, apellido, dni, telefono, edad) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id_invitado, nombre, apellido, dni, telefono, edad, ingreso_en`,
            [req.boliche.id_boliche, lista.id_evento, lista.id_lista, datos.nombre, datos.apellido, datos.dni, datos.telefono ?? null, datos.edad])).rows[0];

        res.status(201).json(invitado);
    } catch (error) {
        if (responderErrorDeBase(error, res)) return;
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo agregar al invitado" });
    }
};

const invitadoPropio = async (req, res) => {
    const lista = await listaPropia(req, res, pool);
    if (!lista) return null;
    const idInvitado = parseId(req.params.idInvitado);
    if (idInvitado === null) {
        res.status(400).json({ mensaje: "el id del invitado no es valido" });
        return null;
    }
    const invitado = (await pool.query(`SELECT * FROM invitado WHERE id_lista = $1 AND id_invitado = $2`, [lista.id_lista, idInvitado])).rows[0];
    if (!invitado) {
        res.status(404).json({ mensaje: "ese invitado no está en la lista" });
        return null;
    }
    if (invitado.ingreso_en) {
        res.status(409).json({ mensaje: "ese invitado ya entró: no se puede modificar" });
        return null;
    }

    return invitado;
};

export const editarInvitado = async (req, res) => {
    try {
        const invitado = await invitadoPropio(req, res);
        if (!invitado) return;
        const { error, datos } = validarInvitado(req.body, true);
        if (error) return res.status(400).json({ mensaje: error });
        const campos = Object.keys(datos);
        if (campos.length === 0) return res.status(400).json({ mensaje: "no hay nada para modificar" });
        const editado = (await pool.query(`UPDATE invitado SET ${campos.map((c, i) => `${c} = $${i + 1}`).join(", ")} WHERE id_invitado = $${campos.length + 1} RETURNING id_invitado, nombre, apellido, dni, telefono, edad, ingreso_en`,
            [...campos.map((c) => datos[c]), invitado.id_invitado])).rows[0];

        res.json(editado);
    } catch (error) {
        if (responderErrorDeBase(error, res)) return;
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo modificar al invitado" });
    }
};

export const quitarInvitado = async (req, res) => {
    try {
        const invitado = await invitadoPropio(req, res);
        if (!invitado) return;
        await pool.query(`DELETE FROM invitado WHERE id_invitado = $1`, [invitado.id_invitado]);

        res.json({ mensaje: "invitado quitado de la lista" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo quitar al invitado" });
    }
};
