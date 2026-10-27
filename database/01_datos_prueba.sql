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

COMMIT;
