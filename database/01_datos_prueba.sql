-- =====================================================
-- DATOS DE PRUEBA (solo para desarrollo)
-- Todas las cuentas de ejemplo tienen la contraseña: demo12345
-- Las contraseñas se guardan con bcrypt (pgcrypto), igual que las que genera la aplicación.
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

INSERT INTO public.usuario (email, password_hash, nombre, apellido, dni, telefono, rol) VALUES
  ('superadmin@demo.com', crypt('demo12345', gen_salt('bf', 10)), 'Super',   'Admin',    '30000001', '351 000 0001', 'superadmin'),
  ('admin1@demo.com',     crypt('demo12345', gen_salt('bf', 10)), 'Ana',     'Dueña',    '30000002', '351 000 0002', 'admin'),
  ('admin2@demo.com',     crypt('demo12345', gen_salt('bf', 10)), 'Bruno',   'Dueño',    '30000003', '351 000 0003', 'admin'),
  ('manager1@demo.com',   crypt('demo12345', gen_salt('bf', 10)), 'Marcos',  'Manager',  '30000004', '351 000 0004', 'rrpp_manager'),
  ('rrpp1@demo.com',      crypt('demo12345', gen_salt('bf', 10)), 'Rocío',   'Ramos',    '30000005', '351 000 0005', 'rrpp'),
  ('rrpp2@demo.com',      crypt('demo12345', gen_salt('bf', 10)), 'Ramiro',  'Romero',   '30000006', '351 000 0006', 'rrpp'),
  ('cliente@demo.com',    crypt('demo12345', gen_salt('bf', 10)), 'Carla',   'Cliente',  '30000007', '351 000 0007', 'cliente');

INSERT INTO public.boliche (nombre, subdominio, descripcion, direccion, latitud, longitud, capacidad, instagram, whatsapp, tipo_cobro, monto_mensual) VALUES
  ('Boliche Uno', 'boliche-uno', 'El boliche de la costanera: música electrónica todos los sábados.', 'Costanera 1200, Córdoba', -31.420100, -64.188800, 800, '@boliche.uno', '351 111 0001', 'mensual', 150000),
  ('Bar Dos',     'bar-dos',     'Bar con shows en vivo y tragos de autor.',                       'Av. Colón 450, Córdoba',   -31.415500, -64.183000, 250, '@bar.dos',     '351 111 0002', 'mensual', 90000),
  ('Club Tres',   'club-tres',   'Club bailable en Nueva Córdoba.',                                'Obispo Trejo 300, Córdoba', -31.423000, -64.186500, 1200, '@club.tres',  '351 111 0003', 'mensual', 220000);

-- Ana administra Boliche Uno y Bar Dos; Bruno administra Club Tres.
INSERT INTO public.boliche_admin (id_boliche, id_usuario)
SELECT b.id_boliche, u.id_usuario FROM public.boliche b JOIN public.usuario u ON
  (u.email = 'admin1@demo.com' AND b.subdominio IN ('boliche-uno', 'bar-dos')) OR
  (u.email = 'admin2@demo.com' AND b.subdominio = 'club-tres');

-- Equipo de Boliche Uno: un manager y dos RRPP (Rocío depende del manager; Ramiro va directo con el admin).
INSERT INTO public.boliche_equipo (id_boliche, id_usuario, rol, comision_pct)
SELECT b.id_boliche, u.id_usuario, 'rrpp_manager', 0 FROM public.boliche b, public.usuario u
 WHERE b.subdominio = 'boliche-uno' AND u.email = 'manager1@demo.com';

INSERT INTO public.boliche_equipo (id_boliche, id_usuario, rol, id_manager, comision_pct)
SELECT b.id_boliche, u.id_usuario, 'rrpp',
       CASE WHEN u.email = 'rrpp1@demo.com' THEN (SELECT id_usuario FROM public.usuario WHERE email = 'manager1@demo.com') END,
       CASE WHEN u.email = 'rrpp1@demo.com' THEN 10 ELSE 8 END
  FROM public.boliche b, public.usuario u
 WHERE b.subdominio = 'boliche-uno' AND u.email IN ('rrpp1@demo.com', 'rrpp2@demo.com');

INSERT INTO public.evento (id_boliche, nombre, fecha_hora, artistas, edad_minima, dress_code, tiene_vip, mesas_vip, descripcion, id_creador)
SELECT b.id_boliche, e.nombre, now() + e.dias * interval '1 day' + interval '23 hours', e.artistas, e.edad, e.dress, e.vip, e.mesas, e.descripcion,
       (SELECT id_usuario FROM public.usuario WHERE email = e.creador)
  FROM public.boliche b
  JOIN (VALUES
    ('boliche-uno', 'Noche Electrónica',  3, ARRAY['DJ Nova','Kaia'],       18, 'Elegante sport', true,  12, 'La noche más grande del mes.',         'admin1@demo.com'),
    ('boliche-uno', 'Fiesta Retro',      10, ARRAY['DJ Vinilo'],            18, 'Años 90',        false, NULL, 'Clásicos de los 80 y 90.',            'manager1@demo.com'),
    ('bar-dos',     'Jueves de Rock',     2, ARRAY['Los Pájaros','Tango 7'], 21, 'Libre',          false, NULL, 'Bandas en vivo toda la noche.',       'admin1@demo.com'),
    ('club-tres',   'Latin Night',        5, ARRAY['DJ Sol'],               18, 'Casual',         true,  8,    'Reggaeton, cumbia y salsa.',          'admin2@demo.com')
  ) AS e(sub, nombre, dias, artistas, edad, dress, vip, mesas, descripcion, creador) ON e.sub = b.subdominio;

-- ---------- Fase 1B: entradas, bebidas y mesas VIP de ejemplo (Boliche Uno) ----------

-- Entradas de "Noche Electrónica" (capacidad del boliche: 800; los cupos suman 700).
INSERT INTO public.tipo_entrada (id_boliche, id_evento, nombre, tipo, precio_virtual, precio_puerta, cupo, estado, orden)
SELECT e.id_boliche, e.id_evento, t.nombre, t.tipo, t.virtual, t.puerta, t.cupo, t.estado, t.orden
  FROM public.evento e
  JOIN public.boliche b ON b.id_boliche = e.id_boliche AND b.subdominio = 'boliche-uno'
  JOIN (VALUES
    ('Tanda 1', 'tanda', 8000, 10000, 250, 'agotada', 1),
    ('Tanda 2', 'tanda', 10000, 12000, 250, 'disponible', 2),
    ('Tanda 3', 'tanda', 12000, 15000, 100, 'no_disponible', 3),
    ('VIP', 'vip', 25000, 30000, 100, 'disponible', 4)
  ) AS t(nombre, tipo, virtual, puerta, cupo, estado, orden) ON true
 WHERE e.nombre = 'Noche Electrónica';

INSERT INTO public.tipo_entrada (id_boliche, id_evento, nombre, tipo, precio_virtual, precio_puerta, cupo, orden)
SELECT e.id_boliche, e.id_evento, 'General', 'tanda', 6000, 8000, 500, 1
  FROM public.evento e JOIN public.boliche b ON b.id_boliche = e.id_boliche AND b.subdominio = 'boliche-uno'
 WHERE e.nombre = 'Fiesta Retro';

-- Carta de bebidas de Boliche Uno.
INSERT INTO public.bebida (id_boliche, categoria, nombre, descripcion, precio, disponible)
SELECT b.id_boliche, x.categoria, x.nombre, x.descripcion, x.precio, x.disponible
  FROM public.boliche b
  JOIN (VALUES
    ('Tragos', 'Fernet con coca', 'Fernet Branca con Coca-Cola', 5000, true),
    ('Tragos', 'Gin tonic', 'Gin, tónica y pepino', 6500, true),
    ('Tragos', 'Aperol spritz', 'Aperol, espumante y soda', 7000, false),
    ('Cervezas', 'Cerveza rubia (1 litro)', 'Lager de barril', 4500, true),
    ('Cervezas', 'Cerveza IPA (500 ml)', 'Artesanal', 5500, true),
    ('Botellas', 'Botella de vodka', 'Con mixers y hielo', 60000, true),
    ('Botellas', 'Botella de whisky', 'Con mixers y hielo', 95000, true)
  ) AS x(categoria, nombre, descripcion, precio, disponible) ON true
 WHERE b.subdominio = 'boliche-uno';

INSERT INTO public.bebida (id_boliche, categoria, nombre, descripcion, precio)
SELECT b.id_boliche, 'Tragos', 'Margarita', 'Tequila, limón y sal', 6000 FROM public.boliche b WHERE b.subdominio = 'bar-dos';

-- Mesas VIP de Boliche Uno; "Noche Electrónica" ofrece dos, una ya reservada.
INSERT INTO public.mesa_vip (id_boliche, nombre, capacidad, precio, descripcion)
SELECT b.id_boliche, m.nombre, m.capacidad, m.precio, m.descripcion
  FROM public.boliche b
  JOIN (VALUES
    ('Mesa 1', 6, 120000, 'Una botella a elección, mixers y servicio de mozo.'),
    ('Mesa 2', 8, 160000, 'Dos botellas a elección, mixers y servicio de mozo.'),
    ('Mesa Palco', 12, 250000, 'Palco sobre la pista con tres botellas y mozo exclusivo.')
  ) AS m(nombre, capacidad, precio, descripcion) ON true
 WHERE b.subdominio = 'boliche-uno';

INSERT INTO public.evento_mesa_vip (id_boliche, id_evento, id_mesa, estado)
SELECT e.id_boliche, e.id_evento, m.id_mesa, CASE WHEN m.nombre = 'Mesa 1' THEN 'reservada' ELSE 'disponible' END
  FROM public.evento e
  JOIN public.mesa_vip m ON m.id_boliche = e.id_boliche AND m.nombre IN ('Mesa 1', 'Mesa 2')
 WHERE e.nombre = 'Noche Electrónica';

-- ---------- Fase 3: cuenta donde cobra cada boliche (para recibir transferencias desde la página) ----------
INSERT INTO public.boliche_cuenta_cobro (id_boliche, titular, banco, alias, cbu, instrucciones)
SELECT b.id_boliche, c.titular, c.banco, c.alias, c.cbu, 'Transferí el total y poné el código de referencia en el concepto.'
  FROM public.boliche b
  JOIN (VALUES
    ('boliche-uno', 'Boliche Uno S.R.L.', 'Banco Galicia', 'boliche.uno.mp', '0070000000000000000011'),
    ('bar-dos', 'Bar Dos S.A.', 'Mercado Pago', 'bar.dos.cobros', NULL)
  ) AS c(sub, titular, banco, alias, cbu) ON c.sub = b.subdominio;

-- ---------- Fase 4: talonario y lista de invitados de ejemplo (RRPP 1 en "Noche Electrónica") ----------
INSERT INTO public.talonario (id_boliche, id_evento, id_rrpp, codigo, cantidad)
SELECT e.id_boliche, e.id_evento, u.id_usuario, 'DEMORRPP1', 50
  FROM public.evento e JOIN public.boliche b ON b.id_boliche = e.id_boliche AND b.subdominio = 'boliche-uno'
  JOIN public.usuario u ON u.email = 'rrpp1@demo.com' WHERE e.nombre = 'Noche Electrónica';

INSERT INTO public.lista_invitados (id_boliche, id_evento, id_rrpp, nombre)
SELECT e.id_boliche, e.id_evento, u.id_usuario, 'Amigos de Lucas'
  FROM public.evento e JOIN public.boliche b ON b.id_boliche = e.id_boliche AND b.subdominio = 'boliche-uno'
  JOIN public.usuario u ON u.email = 'rrpp1@demo.com' WHERE e.nombre = 'Noche Electrónica';

INSERT INTO public.invitado (id_boliche, id_evento, id_lista, nombre, apellido, dni, telefono, edad)
SELECT l.id_boliche, l.id_evento, l.id_lista, i.nombre, i.apellido, i.dni, i.telefono, i.edad
  FROM public.lista_invitados l JOIN (VALUES
    ('Marcos', 'Ibarra', '35111222', '351 600 0001', 28),
    ('Julia', 'Sosa', '36222333', '351 600 0002', 24)
  ) AS i(nombre, apellido, dni, telefono, edad) ON true
 WHERE l.nombre = 'Amigos de Lucas';

-- ---------- Fase 5: personal, proveedores, gastos e ingresos de ejemplo (Boliche Uno) ----------
INSERT INTO public.personal (id_boliche, nombre, apellido, rol_local, monto_cobro, cobro_tipo, notas)
SELECT b.id_boliche, p.nombre, p.apellido, p.rol, p.monto, p.cobro, p.notas
  FROM public.boliche b JOIN (VALUES
    ('Gabriel', 'Fuentes', 'seguridad', 25000, 'por_evento', 'Jefe de seguridad, trabaja con su equipo.'),
    ('Valeria', 'Montes', 'barman', 18000, 'por_evento', NULL),
    ('Nicolás', 'Paz', 'dj_artista', 120000, 'por_evento', 'DJ residente de los sábados.'),
    ('Elena', 'Cruz', 'limpieza', 15000, 'por_evento', NULL)
  ) AS p(nombre, apellido, rol, monto, cobro, notas) ON true WHERE b.subdominio = 'boliche-uno';

INSERT INTO public.personal_contacto (id_boliche, id_personal, tipo, valor)
SELECT p.id_boliche, p.id_personal, c.tipo, c.valor FROM public.personal p JOIN (VALUES
    ('Gabriel', 'whatsapp', '351 800 0001'), ('Nicolás', 'instagram', '@nico.dj'), ('Nicolás', 'email', 'nico@dj.com'), ('Valeria', 'telefono', '351 800 0002')
  ) AS c(nombre, tipo, valor) ON c.nombre = p.nombre;

INSERT INTO public.personal_evento (id_boliche, id_evento, id_personal, monto_pagado)
SELECT e.id_boliche, e.id_evento, p.id_personal, p.monto_cobro
  FROM public.evento e JOIN public.boliche b ON b.id_boliche = e.id_boliche AND b.subdominio = 'boliche-uno'
  JOIN public.personal p ON p.id_boliche = e.id_boliche AND p.nombre IN ('Gabriel', 'Nicolás') WHERE e.nombre = 'Noche Electrónica';

INSERT INTO public.evento_dotacion (id_boliche, id_evento, rol_local, cantidad)
SELECT e.id_boliche, e.id_evento, d.rol, d.cantidad FROM public.evento e JOIN public.boliche b ON b.id_boliche = e.id_boliche AND b.subdominio = 'boliche-uno'
  JOIN (VALUES ('seguridad', 4), ('limpieza', 2), ('barman', 3)) AS d(rol, cantidad) ON true WHERE e.nombre = 'Noche Electrónica';

INSERT INTO public.proveedor (id_boliche, nombre, rubro, contacto)
SELECT b.id_boliche, p.nombre, p.rubro, p.contacto FROM public.boliche b JOIN (VALUES
    ('Distribuidora Andina', 'Bebidas', 'ventas@andina.com'), ('Sonido Pro', 'Sonido e iluminación', '351 810 0001')
  ) AS p(nombre, rubro, contacto) ON true WHERE b.subdominio = 'boliche-uno';

INSERT INTO public.gasto (id_boliche, id_evento, id_proveedor, concepto, categoria, monto, fecha)
SELECT b.id_boliche, e.id_evento, pr.id_proveedor, g.concepto, g.categoria, g.monto, CURRENT_DATE
  FROM public.boliche b JOIN (VALUES
    ('Noche Electrónica', 'Distribuidora Andina', 'Reposición de bebidas', 'Insumos', 180000),
    ('Noche Electrónica', 'Sonido Pro', 'Alquiler de sonido', 'Servicios', 95000),
    (NULL, NULL, 'Alquiler del local', 'Fijos', 400000)
  ) AS g(evento, proveedor, concepto, categoria, monto) ON true
  LEFT JOIN public.evento e ON e.id_boliche = b.id_boliche AND e.nombre = g.evento
  LEFT JOIN public.proveedor pr ON pr.id_boliche = b.id_boliche AND pr.nombre = g.proveedor WHERE b.subdominio = 'boliche-uno';

INSERT INTO public.ingreso (id_boliche, id_evento, concepto, categoria, monto, fecha)
SELECT e.id_boliche, e.id_evento, 'Ventas de barra', 'Barra', 350000, CURRENT_DATE
  FROM public.evento e JOIN public.boliche b ON b.id_boliche = e.id_boliche AND b.subdominio = 'boliche-uno' WHERE e.nombre = 'Noche Electrónica';

COMMIT;
