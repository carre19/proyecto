import pool from "../data/db.js";
import { eventoDelBoliche } from "../utils/evento.js";
import { numeroOpcional, parseId, textoObligatorio, textoOpcional } from "../utils/validaciones.js";
import { responderErrorDeBase } from "../utils/usuarios.js";

// Personal externo: no tiene panel propio; el admin lleva una ficha por persona (rol, contactos, cuánto cobra, en qué eventos
// estuvo) y define cuánta gente de seguridad, limpieza y barman va a cada evento.
const ROLES = ["encargado", "puerta", "boleteria", "seguridad", "barman", "limpieza", "dj_artista", "guardarropa", "mozo_vip"];
const COBROS = ["por_evento", "por_hora", "mensual"];
const CONTACTOS = ["telefono", "whatsapp", "email", "instagram", "otro"];
const ROLES_DOTACION = ["seguridad", "limpieza", "barman"];

const FICHA = `SELECT p.id_personal, p.nombre, p.apellido, p.nombre_completo, p.rol_local, p.monto_cobro, p.cobro_tipo, p.notas, p.activo,
    COALESCE((SELECT json_agg(json_build_object('id_contacto', c.id_contacto, 'tipo', c.tipo, 'valor', c.valor) ORDER BY c.id_contacto) FROM personal_contacto c WHERE c.id_boliche = p.id_boliche AND c.id_personal = p.id_personal), '[]') AS contactos,
    (SELECT count(*)::int FROM personal_evento pe WHERE pe.id_boliche = p.id_boliche AND pe.id_personal = p.id_personal) AS eventos
    FROM personal p`;

const validarContacto = (c) => {
    if (!CONTACTOS.includes(c?.tipo)) return { error: `el tipo de contacto debe ser uno de: ${CONTACTOS.join(", ")}` };
    const valor = textoObligatorio(c?.valor, "el dato de contacto", 150);
    if (valor.error) return { error: valor.error };

    return { contacto: { tipo: c.tipo, valor: valor.valor } };
};

const validarFicha = (body, parcial) => {
    const datos = {};
    const hay = (campo) => body?.[campo] !== undefined;
    for (const [campo, etiqueta] of [["nombre", "el nombre"], ["apellido", "el apellido"]]) {
        if (!parcial || hay(campo)) {
            const texto = textoObligatorio(body?.[campo], etiqueta, 100);
            if (texto.error) return { error: texto.error };
            datos[campo] = texto.valor;
        }
    }
    if (!parcial || hay("rol_local")) {
        if (!ROLES.includes(body?.rol_local)) return { error: `el rol debe ser uno de: ${ROLES.join(", ")}` };
        datos.rol_local = body.rol_local;
    }
    if (hay("cobro_tipo")) {
        if (!COBROS.includes(body.cobro_tipo)) return { error: `el tipo de cobro debe ser uno de: ${COBROS.join(", ")}` };
        datos.cobro_tipo = body.cobro_tipo;
    }
    if (hay("monto_cobro")) {
        const monto = numeroOpcional(body.monto_cobro, "lo que cobra", { min: 0, max: 100000000, entero: true });
        if (monto.error) return { error: monto.error };
        datos.monto_cobro = monto.valor;
    }
    if (hay("notas")) {
        const notas = textoOpcional(body.notas, "las notas", 1000);
        if (notas.error) return { error: notas.error };
        datos.notas = notas.valor;
    }
    if (hay("activo")) {
        if (typeof body.activo !== "boolean") return { error: "activo debe ser verdadero o falso" };
        datos.activo = body.activo;
    }

    return { datos };
};

// GET /boliches/:id/personal[?rol=][&activo=true]
export const listarPersonal = async (req, res) => {
    try {
        const rol = ROLES.includes(req.query.rol) ? req.query.rol : null;
        const filas = (await pool.query(`${FICHA} WHERE p.id_boliche = $1 AND ($2::text IS NULL OR p.rol_local = $2) AND ($3::boolean IS NOT TRUE OR p.activo) ORDER BY p.nombre_completo`,
            [req.boliche.id_boliche, rol, req.query.activo === "true"])).rows;

        res.json(filas);
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo obtener el personal" });
    }
};

const fichaDe = async (req, res) => {
    const idPersonal = parseId(req.params.idPersonal);
    if (idPersonal === null) {
        res.status(400).json({ mensaje: "el id de la persona no es valido" });
        return null;
    }
    const ficha = (await pool.query(`${FICHA} WHERE p.id_boliche = $1 AND p.id_personal = $2`, [req.boliche.id_boliche, idPersonal])).rows[0];
    if (!ficha) {
        res.status(404).json({ mensaje: "esa persona no existe" });
        return null;
    }

    return ficha;
};

// GET /boliches/:id/personal/:idPersonal — la ficha con su historial: en qué eventos estuvo y cuánto se le pagó.
export const verPersonal = async (req, res) => {
    try {
        const ficha = await fichaDe(req, res);
        if (!ficha) return;
        const historial = (await pool.query(`
            SELECT ev.id_evento, ev.nombre AS evento, ev.fecha_hora, pe.monto_pagado, pe.nota
              FROM personal_evento pe JOIN evento ev ON ev.id_boliche = pe.id_boliche AND ev.id_evento = pe.id_evento
             WHERE pe.id_boliche = $1 AND pe.id_personal = $2 ORDER BY ev.fecha_hora DESC`, [req.boliche.id_boliche, ficha.id_personal])).rows;

        res.json({ ...ficha, historial, total_pagado: historial.reduce((t, h) => t + (h.monto_pagado ?? 0), 0) });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo obtener la ficha" });
    }
};

// POST /boliches/:id/personal {nombre, apellido, rol_local, monto_cobro?, cobro_tipo?, notas?, contactos?: [{tipo, valor}]}
export const crearPersonal = async (req, res) => {
    const cliente = await pool.connect();
    try {
        const { error, datos } = validarFicha(req.body, false);
        if (error) return res.status(400).json({ mensaje: error });
        const contactos = [];
        for (const c of req.body?.contactos ?? []) {
            const v = validarContacto(c);
            if (v.error) return res.status(400).json({ mensaje: v.error });
            contactos.push(v.contacto);
        }

        await cliente.query("BEGIN");
        const nueva = (await cliente.query(`
            INSERT INTO personal (id_boliche, nombre, apellido, rol_local, monto_cobro, cobro_tipo, notas) VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'por_evento'), $7) RETURNING id_personal`,
            [req.boliche.id_boliche, datos.nombre, datos.apellido, datos.rol_local, datos.monto_cobro ?? null, datos.cobro_tipo ?? null, datos.notas ?? null])).rows[0];
        for (const c of contactos) {
            await cliente.query(`INSERT INTO personal_contacto (id_boliche, id_personal, tipo, valor) VALUES ($1, $2, $3, $4)`, [req.boliche.id_boliche, nueva.id_personal, c.tipo, c.valor]);
        }
        await cliente.query("COMMIT");

        res.status(201).json((await pool.query(`${FICHA} WHERE p.id_personal = $1`, [nueva.id_personal])).rows[0]);
    } catch (error) {
        await cliente.query("ROLLBACK");
        if (responderErrorDeBase(error, res)) return;
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo crear la ficha" });
    } finally {
        cliente.release();
    }
};

export const editarPersonal = async (req, res) => {
    try {
        const ficha = await fichaDe(req, res);
        if (!ficha) return;
        const { error, datos } = validarFicha(req.body, true);
        if (error) return res.status(400).json({ mensaje: error });
        const campos = Object.keys(datos);
        if (campos.length === 0) return res.status(400).json({ mensaje: "no hay nada para modificar" });
        await pool.query(`UPDATE personal SET ${campos.map((c, i) => `${c} = $${i + 1}`).join(", ")} WHERE id_boliche = $${campos.length + 1} AND id_personal = $${campos.length + 2}`,
            [...campos.map((c) => datos[c]), req.boliche.id_boliche, ficha.id_personal]);

        res.json((await pool.query(`${FICHA} WHERE p.id_personal = $1`, [ficha.id_personal])).rows[0]);
    } catch (error) {
        if (responderErrorDeBase(error, res)) return;
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo modificar la ficha" });
    }
};

// Con historial no se borra (se desactiva): se perdería a quién se le pagó cada noche.
export const eliminarPersonal = async (req, res) => {
    try {
        const ficha = await fichaDe(req, res);
        if (!ficha) return;
        if (ficha.eventos > 0) return res.status(409).json({ mensaje: "esta persona ya trabajó en eventos: desactivala en vez de borrarla" });
        await pool.query(`DELETE FROM personal WHERE id_boliche = $1 AND id_personal = $2`, [req.boliche.id_boliche, ficha.id_personal]);

        res.json({ mensaje: "ficha eliminada" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo eliminar la ficha" });
    }
};

export const agregarContacto = async (req, res) => {
    try {
        const ficha = await fichaDe(req, res);
        if (!ficha) return;
        const v = validarContacto(req.body);
        if (v.error) return res.status(400).json({ mensaje: v.error });
        const contacto = (await pool.query(`INSERT INTO personal_contacto (id_boliche, id_personal, tipo, valor) VALUES ($1, $2, $3, $4) RETURNING id_contacto, tipo, valor`,
            [req.boliche.id_boliche, ficha.id_personal, v.contacto.tipo, v.contacto.valor])).rows[0];

        res.status(201).json(contacto);
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo agregar el contacto" });
    }
};

export const quitarContacto = async (req, res) => {
    try {
        const ficha = await fichaDe(req, res);
        if (!ficha) return;
        const idContacto = parseId(req.params.idContacto);
        if (idContacto === null) return res.status(400).json({ mensaje: "el id del contacto no es valido" });
        const borrado = await pool.query(`DELETE FROM personal_contacto WHERE id_boliche = $1 AND id_personal = $2 AND id_contacto = $3`, [req.boliche.id_boliche, ficha.id_personal, idContacto]);
        if (borrado.rowCount === 0) return res.status(404).json({ mensaje: "ese contacto no existe" });

        res.json({ mensaje: "contacto quitado" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo quitar el contacto" });
    }
};

// GET /boliches/:id/eventos/:idEvento/personal — quién trabaja esa noche y cuánto se le paga, más la dotación pedida.
export const personalDelEvento = async (req, res) => {
    try {
        const evento = await eventoDelBoliche(req, res);
        if (!evento) return;
        const asignados = (await pool.query(`
            SELECT p.id_personal, p.nombre_completo, p.rol_local, pe.monto_pagado, pe.nota
              FROM personal_evento pe JOIN personal p ON p.id_boliche = pe.id_boliche AND p.id_personal = pe.id_personal
             WHERE pe.id_boliche = $1 AND pe.id_evento = $2 ORDER BY p.rol_local, p.nombre_completo`, [req.boliche.id_boliche, evento.id_evento])).rows;
        const pedida = Object.fromEntries((await pool.query(`SELECT rol_local, cantidad FROM evento_dotacion WHERE id_boliche = $1 AND id_evento = $2`, [req.boliche.id_boliche, evento.id_evento])).rows.map((d) => [d.rol_local, d.cantidad]));
        const dotacion = ROLES_DOTACION.map((rol) => ({ rol_local: rol, pedida: pedida[rol] ?? 0, asignada: asignados.filter((a) => a.rol_local === rol).length }));

        res.json({ evento: evento.nombre, dotacion, asignados, total_pagado: asignados.reduce((t, a) => t + (a.monto_pagado ?? 0), 0) });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo obtener el personal del evento" });
    }
};

// PUT /boliches/:id/eventos/:idEvento/personal/:idPersonal {monto_pagado?, nota?} — suma a la persona a la noche (o actualiza lo que se le paga).
export const asignarPersonal = async (req, res) => {
    try {
        const evento = await eventoDelBoliche(req, res);
        if (!evento) return;
        const idPersonal = parseId(req.params.idPersonal);
        if (idPersonal === null) return res.status(400).json({ mensaje: "el id de la persona no es valido" });
        const monto = numeroOpcional(req.body?.monto_pagado, "lo que se le paga", { min: 0, max: 100000000, entero: true });
        const nota = textoOpcional(req.body?.nota, "la nota", 300);
        if (monto.error || nota.error) return res.status(400).json({ mensaje: monto.error ?? nota.error });
        const persona = (await pool.query(`SELECT activo FROM personal WHERE id_boliche = $1 AND id_personal = $2`, [req.boliche.id_boliche, idPersonal])).rows[0];
        if (!persona) return res.status(404).json({ mensaje: "esa persona no existe" });
        if (!persona.activo) return res.status(409).json({ mensaje: "esa persona está desactivada" });

        await pool.query(`
            INSERT INTO personal_evento (id_boliche, id_evento, id_personal, monto_pagado, nota) VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (id_evento, id_personal) DO UPDATE SET monto_pagado = $4, nota = $5`,
            [req.boliche.id_boliche, evento.id_evento, idPersonal, monto.valor, nota.valor]);

        res.json({ mensaje: "persona asignada al evento" });
    } catch (error) {
        if (responderErrorDeBase(error, res)) return;
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo asignar a la persona" });
    }
};

export const quitarDelEvento = async (req, res) => {
    try {
        const evento = await eventoDelBoliche(req, res);
        if (!evento) return;
        const idPersonal = parseId(req.params.idPersonal);
        if (idPersonal === null) return res.status(400).json({ mensaje: "el id de la persona no es valido" });
        const borrado = await pool.query(`DELETE FROM personal_evento WHERE id_boliche = $1 AND id_evento = $2 AND id_personal = $3`, [req.boliche.id_boliche, evento.id_evento, idPersonal]);
        if (borrado.rowCount === 0) return res.status(404).json({ mensaje: "esa persona no estaba en este evento" });

        res.json({ mensaje: "persona quitada del evento" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo quitar a la persona" });
    }
};

// PUT /boliches/:id/eventos/:idEvento/dotacion {seguridad?, limpieza?, barman?} — cuánta gente de cada rol va a la noche.
export const fijarDotacion = async (req, res) => {
    const cliente = await pool.connect();
    try {
        const evento = await eventoDelBoliche(req, res);
        if (!evento) return;
        const pedidas = ROLES_DOTACION.filter((rol) => req.body?.[rol] !== undefined);
        if (pedidas.length === 0) return res.status(400).json({ mensaje: `indicá cuánta gente va de: ${ROLES_DOTACION.join(", ")}` });
        for (const rol of pedidas) {
            if (!Number.isInteger(req.body[rol]) || req.body[rol] < 0 || req.body[rol] > 500) return res.status(400).json({ mensaje: `${rol}: tiene que ser un número entero entre 0 y 500` });
        }

        await cliente.query("BEGIN");
        for (const rol of pedidas) {
            await cliente.query(`
                INSERT INTO evento_dotacion (id_boliche, id_evento, rol_local, cantidad) VALUES ($1, $2, $3, $4)
                ON CONFLICT (id_evento, rol_local) DO UPDATE SET cantidad = $4`, [req.boliche.id_boliche, evento.id_evento, rol, req.body[rol]]);
        }
        await cliente.query("COMMIT");

        return personalDelEvento(req, res);
    } catch (error) {
        await cliente.query("ROLLBACK");
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo guardar la dotación" });
    } finally {
        cliente.release();
    }
};
