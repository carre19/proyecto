-- =====================================================
-- MIGRACIÓN - Enlace público único por evento
-- Cada evento recibe un token aleatorio (uuid) con el que el cliente abre
-- /evento/<token> para ver su propuesta y aceptarla o rechazarla, sin cuenta.
-- Es aditiva: no modifica columnas existentes y los eventos actuales reciben su token.
-- =====================================================

BEGIN;

ALTER TABLE public.evento
    ADD COLUMN IF NOT EXISTS token_publico uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS evento_token_publico_key
    ON public.evento (token_publico);

COMMIT;
