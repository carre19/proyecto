// Borrado de datos personales: la documentación pide guardar los datos de cada cliente hasta 3 meses después de la última vez que
// compró una entrada o interactuó con el sistema. Pasado ese tiempo se borran el nombre, el DNI y el contacto (se anonimizan:
// lo económico, como precios, comisiones y pagos, se conserva para la contabilidad del boliche).
//   "Última interacción" de una compra = lo que sea más tarde entre cuando se hizo y la fecha del evento (no se borra a quien
//   todavía no fue al evento que compró hace meses). La de una persona (DNI) = la más reciente de todas sus compras.
// Decisión (el equipo no la definió, ver README): la regla vale también para las cuentas de clientes, que se eliminan tras 3 meses sin
// actividad ni compras; se puede apagar con RETENCION_CUENTAS=false.
export const MESES_RETENCION = Number(process.env.RETENCION_MESES ?? 3);

// Devuelve cuántos registros anonimizó de cada tipo.
export const limpiarDatosVencidos = async (db, { meses = MESES_RETENCION, cuentas = process.env.RETENCION_CUENTAS !== "false" } = {}) => {
    // Entradas: por DNI. El DNI se reemplaza por un número único que no es de nadie, para no romper la regla de "un DNI por evento".
    const entradas = await db.query(`
        WITH ultima AS (
            SELECT e.dni, max(GREATEST(c.creada_en, ev.fecha_hora)) AS ultima
              FROM entrada e JOIN compra c ON c.id_compra = e.id_compra JOIN evento ev ON ev.id_boliche = e.id_boliche AND ev.id_evento = e.id_evento
             WHERE e.datos_borrados_en IS NULL GROUP BY e.dni)
        UPDATE entrada e SET nombre = '(borrado)', apellido = '(borrado)', dni = '0' || lpad(e.id_entrada::text, 8, '0'), datos_borrados_en = now()
          FROM ultima u WHERE e.datos_borrados_en IS NULL AND e.dni = u.dni AND u.ultima < now() - make_interval(months => $1)
        RETURNING e.id_entrada`, [meses]);

    // Contacto de las compras (donde se avisa el pago) y los avisos enviados.
    const compras = await db.query(`
        UPDATE compra c SET contacto_email = NULL, contacto_telefono = NULL, datos_borrados_en = now()
          FROM evento ev WHERE ev.id_boliche = c.id_boliche AND ev.id_evento = c.id_evento AND c.datos_borrados_en IS NULL
           AND (c.contacto_email IS NOT NULL OR c.contacto_telefono IS NOT NULL) AND GREATEST(c.creada_en, ev.fecha_hora) < now() - make_interval(months => $1)
        RETURNING c.id_compra`, [meses]);
    const avisos = await db.query(`
        UPDATE notificacion n SET destino = '(borrado)', datos_borrados_en = now()
          FROM compra c WHERE c.id_compra = n.id_compra AND c.datos_borrados_en IS NOT NULL AND n.datos_borrados_en IS NULL RETURNING n.id_notificacion`);

    // Invitados de las listas: cuando pasaron 3 meses del evento (o de armarse la lista, lo que sea más tarde).
    const invitados = await db.query(`
        UPDATE invitado i SET nombre = '(borrado)', apellido = '(borrado)', dni = '0' || lpad(i.id_invitado::text, 8, '0'), telefono = NULL, datos_borrados_en = now()
          FROM lista_invitados l JOIN evento ev ON ev.id_boliche = l.id_boliche AND ev.id_evento = l.id_evento
         WHERE l.id_boliche = i.id_boliche AND l.id_lista = i.id_lista AND i.datos_borrados_en IS NULL AND GREATEST(l.creada_en, ev.fecha_hora) < now() - make_interval(months => $1)
        RETURNING i.id_invitado`, [meses]);

    let cuentasBorradas = 0;
    if (cuentas) {
        cuentasBorradas = (await db.query(`
            DELETE FROM usuario u WHERE u.rol = 'cliente' AND u.ultima_actividad < now() - make_interval(months => $1)
               AND NOT EXISTS (SELECT 1 FROM compra c JOIN evento ev ON ev.id_boliche = c.id_boliche AND ev.id_evento = c.id_evento
                                WHERE c.id_cliente = u.id_usuario AND GREATEST(c.creada_en, ev.fecha_hora) >= now() - make_interval(months => $1))
            RETURNING u.id_usuario`, [meses])).rowCount;
    }

    return { entradas: entradas.rowCount, compras: compras.rowCount, avisos: avisos.rowCount, invitados: invitados.rowCount, cuentas: cuentasBorradas };
};
