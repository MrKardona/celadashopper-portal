-- 20260505_notificaciones_email.sql
-- Audita el resultado del envío de email por notificación.
-- La columna `enviada_email BOOLEAN DEFAULT false` ya existe.
-- Aquí solo agregamos columnas auxiliares para trazabilidad.

ALTER TABLE notificaciones
  ADD COLUMN IF NOT EXISTS email_message_id TEXT,
  ADD COLUMN IF NOT EXISTS email_error TEXT,
  ADD COLUMN IF NOT EXISTS email_destino TEXT;

-- Índice útil para buscar fallos de email en el panel admin.
CREATE INDEX IF NOT EXISTS idx_notificaciones_email_fallidas
  ON notificaciones(created_at DESC)
  WHERE enviada_email = false AND email_error IS NOT NULL;
