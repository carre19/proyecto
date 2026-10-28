import pool from "../data/db.js";
import { eventoDelBoliche } from "../utils/evento.js";
import { numeroOpcional, parseId, textoObligatorio, textoOpcional } from "../utils/validaciones.js";
import { responderErrorDeBase } from "../utils/usuarios.js";

// Proveedores, gastos e ingresos del local, y los resúmenes en tres niveles: de cada noche, de cada boliche y del admin con todos
// sus boliches juntos. Todo en pesos enteros. Lo gestionan el admin y el superadmin.

const fechaValida = (texto) => /^\d{4}-\d{2}-\d{2}$/.test(texto) && !Number.isNaN(new Date(`${texto}T00:00:00Z`).getTime()) && new Date(`${texto}T00:00:00Z`).toISOString().startsWith(texto);

// ---------- Proveedores ----------

const SELECT_PROVEEDOR = `
    SELECT p.id_proveedor, p.nombre, p.rubro, p.contacto, p.notas, p.activo,
           COALESCE(g.total, 0)::int AS total_gastado, COALESCE(g.cantidad, 0)::int AS cantidad_gastos
      FROM proveedor p LEFT JOIN (SELECT id_proveedor, sum(monto) AS total, count(*) AS cantidad FROM gasto GROUP BY id_proveedor) g ON g.id_proveedor = p.id_proveedor`;

const validarProveedor = (body, parcial) => {
    const datos = {};
    const hay = (campo) => body?.[campo] !== undefined;
    if (!parcial || hay("nombre")) {
        const nombre = textoObligatorio(body?.nombre, "el nombre", 120);
        if (nombre.error) return { error: nombre.error };
        datos.nombre = nombre.valor;
    }
    for (const [campo, maximo, etiqueta] of [["rubro", 80, "el rubro"], ["contacto", 200, "el contacto"], ["notas", 1000, "las notas"]]) {
        if (hay(campo)) {
            const texto = textoOpcional(body[campo], etiqueta, maximo);
            if (texto.error) return { error: texto.error };
            datos[campo] = texto.valor;
        }
    }
    if (hay("activo")) {
        if (typeof body.activo !== "boolean") return { error: "activo debe ser verdadero o falso" };
        datos.activo = body.activo;
    }

    return { datos };
};

export const listarProveedores = async (req, res) => {
    try {
        res.json((await pool.query(`${SELECT_PROVEEDOR} WHERE p.id_boliche = $1 ORDER BY p.nombre`, [req.boliche.id_boliche])).rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "no se pudieron obtener los proveedores" });
    }
};

export const crearProveedor = async (req, res) => {
    try {
        const { error, datos } = validarProveedor(req.body, false);
        if (error) return res.status(400).json({ mensaje: error });
        const creado = (await pool.query(`INSERT INTO proveedor (id_boliche, nombre, rubro, contacto, notas) VALUES ($1, $2, $3, $4, $5) RETURNING id_proveedor`,
            [req.boliche.id_boliche, datos.nombre, datos.rubro ?? null, datos.contacto ?? null, datos.notas ?? null])).rows[0];

        res.status(201).json((await pool.query(`${SELECT_PROVEEDOR} WHERE p.id_proveedor = $1`, [creado.id_proveedor])).rows[0]);
    } catch (error) {
        if (error.code === "23505") return res.status(409).json({ mensaje: "ya cargaste un proveedor con ese nombre" });
        if (responderErrorDeBase(error, res)) return;
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo crear el proveedor" });
    }
};

export const editarProveedor = async (req, res) => {
    try {
        const id = parseId(req.params.idProveedor);
        if (id === null) return res.status(400).json({ mensaje: "el id del proveedor no es valido" });
        const { error, datos } = validarProveedor(req.body, true);
        if (error) return res.status(400).json({ mensaje: error });
        const campos = Object.keys(datos);
        if (campos.length === 0) return res.status(400).json({ mensaje: "no hay nada para modificar" });
        const editado = await pool.query(`UPDATE proveedor SET ${campos.map((c, i) => `${c} = $${i + 1}`).join(", ")} WHERE id_boliche = $${campos.length + 1} AND id_proveedor = $${campos.length + 2} RETURNING id_proveedor`,
            [...campos.map((c) => datos[c]), req.boliche.id_boliche, id]);
        if (editado.rowCount === 0) return res.status(404).json({ mensaje: "ese proveedor no existe" });

        res.json((await pool.query(`${SELECT_PROVEEDOR} WHERE p.id_proveedor = $1`, [id])).rows[0]);
    } catch (error) {
        if (error.code === "23505") return res.status(409).json({ mensaje: "ya cargaste un proveedor con ese nombre" });
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo modificar el proveedor" });
    }
};

// Los gastos de un proveedor no se pierden: si ya tiene gastos, se desactiva en vez de borrarlo.
export const eliminarProveedor = async (req, res) => {
    try {
        const id = parseId(req.params.idProveedor);
        if (id === null) return res.status(400).json({ mensaje: "el id del proveedor no es valido" });
        const proveedor = (await pool.query(`${SELECT_PROVEEDOR} WHERE p.id_boliche = $1 AND p.id_proveedor = $2`, [req.boliche.id_boliche, id])).rows[0];
        if (!proveedor) return res.status(404).json({ mensaje: "ese proveedor no existe" });
        if (proveedor.cantidad_gastos > 0) return res.status(409).json({ mensaje: "este proveedor ya tiene gastos registrados: desactivalo en vez de borrarlo" });
        await pool.query(`DELETE FROM proveedor WHERE id_proveedor = $1`, [id]);

        res.json({ mensaje: "proveedor eliminado" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo eliminar el proveedor" });
    }
};

// ---------- Gastos e ingresos (mismo formato; el gasto además puede ser de un proveedor) ----------

const movimientos = (tabla, id) => {
    const esGasto = tabla === "gasto";
    const SELECT = `
        SELECT m.${id} AS id, m.id_evento, ev.nombre AS evento, ${esGasto ? "m.id_proveedor, p.nombre AS proveedor," : ""} m.concepto, m.categoria, m.monto, m.fecha::text AS fecha, m.nota
          FROM ${tabla} m LEFT JOIN evento ev ON ev.id_boliche = m.id_boliche AND ev.id_evento = m.id_evento
          ${esGasto ? "LEFT JOIN proveedor p ON p.id_boliche = m.id_boliche AND p.id_proveedor = m.id_proveedor" : ""}`;

    // Valida el cuerpo y que el evento y el proveedor sean DE ESTE boliche. Devuelve {error} o {datos}.
    const validar = async (req, parcial) => {
        const body = req.body;
        const datos = {};
        const hay = (campo) => body?.[campo] !== undefined;
        if (!parcial || hay("concepto")) {
            const concepto = textoObligatorio(body?.concepto, "el concepto", 150);
            if (concepto.error) return { error: concepto.error };
            datos.concepto = concepto.valor;
        }
        if (hay("categoria") || hay("nota")) {
            for (const [campo, maximo, etiqueta] of [["categoria", 60, "la categoría"], ["nota", 1000, "la nota"]]) {
                if (hay(campo)) {
                    const texto = textoOpcional(body[campo], etiqueta, maximo);
                    if (texto.error) return { error: texto.error };
                    datos[campo] = texto.valor;
                }
            }
        }
        if (!parcial || hay("monto")) {
            const monto = numeroOpcional(body?.monto, "el monto", { min: 1, max: 1000000000, entero: true });
            if (monto.error || monto.valor === null) return { error: monto.error ?? "el monto es obligatorio" };
            datos.monto = monto.valor;
        }
        if (hay("fecha")) {
            if (typeof body.fecha !== "string" || !fechaValida(body.fecha)) return { error: "la fecha tiene que tener el formato AAAA-MM-DD" };
            datos.fecha = body.fecha;
        }
        if (hay("id_evento")) {
            if (body.id_evento === null) datos.id_evento = null;
            else {
                const idEvento = parseId(body.id_evento);
                if (idEvento === null || !(await pool.query(`SELECT 1 FROM evento WHERE id_boliche = $1 AND id_evento = $2`, [req.boliche.id_boliche, idEvento])).rows.length) return { error: "ese evento no existe en este boliche" };
                datos.id_evento = idEvento;
            }
        }
        if (esGasto && hay("id_proveedor")) {
            if (body.id_proveedor === null) datos.id_proveedor = null;
            else {
                const idProveedor = parseId(body.id_proveedor);
                if (idProveedor === null || !(await pool.query(`SELECT 1 FROM proveedor WHERE id_boliche = $1 AND id_proveedor = $2`, [req.boliche.id_boliche, idProveedor])).rows.length) return { error: "ese proveedor no existe en este boliche" };
                datos.id_proveedor = idProveedor;
            }
        }

        return { datos };
    };

    return {
        listar: async (req, res) => {
            try {
                const { evento, desde, hasta, proveedor } = req.query;
                if ((desde && !fechaValida(desde)) || (hasta && !fechaValida(hasta))) return res.status(400).json({ mensaje: "las fechas tienen que tener el formato AAAA-MM-DD" });
                const idEvento = evento && evento !== "general" ? parseId(evento) : null;
                if (evento && evento !== "general" && idEvento === null) return res.status(400).json({ mensaje: "el evento no es valido" });
                const idProveedor = esGasto && proveedor ? parseId(proveedor) : null;
                const filas = (await pool.query(`${SELECT}
                    WHERE m.id_boliche = $1 AND ($2::int IS NULL OR m.id_evento = $2) AND ($3::boolean IS NOT TRUE OR m.id_evento IS NULL)
                      AND ($4::date IS NULL OR m.fecha >= $4) AND ($5::date IS NULL OR m.fecha <= $5) ${esGasto ? "AND ($6::int IS NULL OR m.id_proveedor = $6)" : ""}
                    ORDER BY m.fecha DESC, m.${id} DESC`, [req.boliche.id_boliche, idEvento, evento === "general", desde ?? null, hasta ?? null, ...(esGasto ? [idProveedor] : [])])).rows;

                res.json({ total: filas.reduce((t, f) => t + f.monto, 0), items: filas });
            } catch (error) {
                console.error(error);
                res.status(500).json({ mensaje: "no se pudieron obtener los registros" });
            }
        },
        crear: async (req, res) => {
            try {
                const { error, datos } = await validar(req, false);
                if (error) return res.status(400).json({ mensaje: error });
                const columnas = ["id_boliche", "creado_por", ...Object.keys(datos)];
                const creado = (await pool.query(`INSERT INTO ${tabla} (${columnas.join(", ")}) VALUES (${columnas.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING ${id} AS id`,
                    [req.boliche.id_boliche, req.usuario.id, ...Object.values(datos)])).rows[0];

                res.status(201).json((await pool.query(`${SELECT} WHERE m.${id} = $1`, [creado.id])).rows[0]);
            } catch (error) {
                if (responderErrorDeBase(error, res)) return;
                console.error(error);
                res.status(500).json({ mensaje: "no se pudo registrar" });
            }
        },
        editar: async (req, res) => {
            try {
                const idMov = parseId(req.params.idMovimiento);
                if (idMov === null) return res.status(400).json({ mensaje: "el id no es valido" });
                const { error, datos } = await validar(req, true);
                if (error) return res.status(400).json({ mensaje: error });
                const campos = Object.keys(datos);
                if (campos.length === 0) return res.status(400).json({ mensaje: "no hay nada para modificar" });
                const editado = await pool.query(`UPDATE ${tabla} SET ${campos.map((c, i) => `${c} = $${i + 1}`).join(", ")} WHERE id_boliche = $${campos.length + 1} AND ${id} = $${campos.length + 2}`,
                    [...Object.values(datos), req.boliche.id_boliche, idMov]);
                if (editado.rowCount === 0) return res.status(404).json({ mensaje: "ese registro no existe" });

                res.json((await pool.query(`${SELECT} WHERE m.${id} = $1`, [idMov])).rows[0]);
            } catch (error) {
                if (responderErrorDeBase(error, res)) return;
                console.error(error);
                res.status(500).json({ mensaje: "no se pudo modificar" });
            }
        },
        eliminar: async (req, res) => {
            try {
                const idMov = parseId(req.params.idMovimiento);
                if (idMov === null) return res.status(400).json({ mensaje: "el id no es valido" });
                const borrado = await pool.query(`DELETE FROM ${tabla} WHERE id_boliche = $1 AND ${id} = $2`, [req.boliche.id_boliche, idMov]);
                if (borrado.rowCount === 0) return res.status(404).json({ mensaje: "ese registro no existe" });

                res.json({ mensaje: "registro eliminado" });
            } catch (error) {
                console.error(error);
                res.status(500).json({ mensaje: "no se pudo eliminar" });
            }
        },
    };
};

export const gastos = movimientos("gasto", "id_gasto");
export const ingresos = movimientos("ingreso", "id_ingreso");

// ---------- Resúmenes ----------

// Ingresos (entradas pagadas + los cargados a mano) menos gastos (los cargados, lo pagado al personal y las comisiones de RRPP).
// El 6 % de la plataforma NO es del local: lo paga el cliente aparte. Con idEvento es el resumen de esa noche; sin él, el del boliche
// (con los movimientos generales). desde/hasta filtran por la fecha de cada registro.
const resumen = async (idBoliche, { idEvento = null, desde = null, hasta = null } = {}) => {
    const fila = (await pool.query(`
        SELECT
          (SELECT COALESCE(sum(c.subtotal - c.descuento), 0) FROM compra c WHERE c.id_boliche = $1 AND c.estado = 'pagada' AND ($2::int IS NULL OR c.id_evento = $2)
             AND ($3::date IS NULL OR c.pagada_en::date >= $3) AND ($4::date IS NULL OR c.pagada_en::date <= $4)) AS entradas,
          (SELECT COALESCE(sum(i.monto), 0) FROM ingreso i WHERE i.id_boliche = $1 AND ($2::int IS NULL OR i.id_evento = $2)
             AND ($3::date IS NULL OR i.fecha >= $3) AND ($4::date IS NULL OR i.fecha <= $4)) AS ingresos_cargados,
          (SELECT COALESCE(sum(g.monto), 0) FROM gasto g WHERE g.id_boliche = $1 AND ($2::int IS NULL OR g.id_evento = $2)
             AND ($3::date IS NULL OR g.fecha >= $3) AND ($4::date IS NULL OR g.fecha <= $4)) AS gastos_cargados,
          (SELECT COALESCE(sum(pe.monto_pagado), 0) FROM personal_evento pe JOIN evento ev ON ev.id_boliche = pe.id_boliche AND ev.id_evento = pe.id_evento
            WHERE pe.id_boliche = $1 AND ($2::int IS NULL OR pe.id_evento = $2) AND ($3::date IS NULL OR ev.fecha_hora::date >= $3) AND ($4::date IS NULL OR ev.fecha_hora::date <= $4)) AS personal,
          (SELECT COALESCE(sum(e.comision), 0) FROM entrada e JOIN compra c ON c.id_compra = e.id_compra WHERE e.id_boliche = $1 AND e.estado IN ('valida', 'usada')
             AND ($2::int IS NULL OR e.id_evento = $2) AND ($3::date IS NULL OR c.pagada_en::date >= $3) AND ($4::date IS NULL OR c.pagada_en::date <= $4)) AS comisiones_rrpp`,
        [idBoliche, idEvento, desde, hasta])).rows[0];

    const n = Object.fromEntries(Object.entries(fila).map(([k, v]) => [k, Number(v)]));
    const ingresos = n.entradas + n.ingresos_cargados;
    const gastosTotal = n.gastos_cargados + n.personal + n.comisiones_rrpp;

    return {
        ingresos: { entradas: n.entradas, cargados: n.ingresos_cargados, total: ingresos },
        gastos: { cargados: n.gastos_cargados, personal: n.personal, comisiones_rrpp: n.comisiones_rrpp, total: gastosTotal },
        balance: ingresos - gastosTotal,
    };
};

const periodo = (req, res) => {
    const { desde, hasta } = req.query;
    if ((desde && !fechaValida(desde)) || (hasta && !fechaValida(hasta))) {
        res.status(400).json({ mensaje: "las fechas tienen que tener el formato AAAA-MM-DD" });
        return null;
    }

    return { desde: desde ?? null, hasta: hasta ?? null };
};

// GET /boliches/:id/eventos/:idEvento/finanzas — nivel 1: una noche.
export const finanzasDelEvento = async (req, res) => {
    try {
        const evento = await eventoDelBoliche(req, res);
        if (!evento) return;
        res.json({ evento: evento.nombre, ...(await resumen(req.boliche.id_boliche, { idEvento: evento.id_evento })) });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo obtener el resumen" });
    }
};

// GET /boliches/:id/finanzas[?desde=&hasta=] — nivel 2: el boliche entero, con el detalle de cada evento.
export const finanzasDelBoliche = async (req, res) => {
    try {
        const p = periodo(req, res);
        if (!p) return;
        const eventos = (await pool.query(`SELECT id_evento, nombre, fecha_hora FROM evento WHERE id_boliche = $1 ORDER BY fecha_hora DESC`, [req.boliche.id_boliche])).rows;
        const porEvento = await Promise.all(eventos.map(async (e) => ({ ...e, ...(await resumen(req.boliche.id_boliche, { idEvento: e.id_evento, ...p })) })));

        res.json({ boliche: req.boliche.nombre, ...(await resumen(req.boliche.id_boliche, p)), eventos: porEvento });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo obtener el resumen" });
    }
};

// GET /finanzas[?desde=&hasta=] — nivel 3: el admin con todos sus boliches juntos (el superadmin, todos los de la plataforma).
export const finanzasGenerales = async (req, res) => {
    try {
        const p = periodo(req, res);
        if (!p) return;
        const boliches = (await pool.query(`SELECT id_boliche, nombre FROM boliche WHERE ($1::boolean OR id_boliche = ANY($2)) ORDER BY nombre`, [req.usuario.rol === "superadmin", req.usuario.boliches])).rows;
        const porBoliche = await Promise.all(boliches.map(async (b) => ({ ...b, ...(await resumen(b.id_boliche, p)) })));
        const suma = (ruta) => porBoliche.reduce((t, b) => t + ruta(b), 0);

        res.json({
            ingresos: { entradas: suma((b) => b.ingresos.entradas), cargados: suma((b) => b.ingresos.cargados), total: suma((b) => b.ingresos.total) },
            gastos: { cargados: suma((b) => b.gastos.cargados), personal: suma((b) => b.gastos.personal), comisiones_rrpp: suma((b) => b.gastos.comisiones_rrpp), total: suma((b) => b.gastos.total) },
            balance: suma((b) => b.balance),
            boliches: porBoliche,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "no se pudo obtener el resumen general" });
    }
};
