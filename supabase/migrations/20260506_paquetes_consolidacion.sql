-- 20260506_paquetes_consolidacion.sql
-- Permitir que el cliente indique al reportar si su paquete necesita
-- consolidarse con otros antes de despachar a Colombia.
-- El admin ve este flag en el listado de paquetes para decidir si
-- agrupar varios envíos del mismo cliente o despachar de inmediato.
ALTER TABLE paquetes
  ADD COLUMN IF NOT EXISTS requiere_consolidacion BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notas_consolidacion TEXT;

CREATE INDEX IF NOT EXISTS idx_paquetes_requiere_consolidacion
  ON paquetes(requiere_consolidacion)
  WHERE requiere_consolidacion = true;
