-- =====================================================
-- DATOS DE PRUEBA
-- Solo para desarrollo local. No cargar en producción.
-- =====================================================

BEGIN;

INSERT INTO public.empresas (nombre, cuit, email, telefono, direccion) VALUES
('Eventos del Centro', '30-71234567-8', 'contacto@eventosdelcentro.com', '351-4001122', 'Av. Colón 1200, Córdoba'),
('Fiestas Norte', '30-70987654-3', 'info@fiestasnorte.com', '351-4553344', 'Rafael Núñez 4500, Córdoba'),
('Producciones Sur', '30-69876543-1', 'hola@produccionessur.com', NULL, NULL);

COMMIT;
