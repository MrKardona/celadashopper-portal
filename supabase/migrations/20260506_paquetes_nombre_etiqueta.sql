-- 20260506_paquetes_nombre_etiqueta.sql
-- Guarda el nombre del destinatario tal como aparece en la etiqueta del courier
-- (extraído por OCR o ingresado manualmente). Permite que el admin busque
-- paquetes por ese nombre incluso cuando el paquete quedó sin asignar o
-- cuando el nombre en la etiqueta no coincide con el del cliente registrado.

ALTER TABLE paquetes
  ADD COLUMN IF NOT EXISTS nombre_etiqueta TEXT;

-- Índice GIN para búsqueda full-text rápida (case y acento insensitive)
CREATE INDEX IF NOT EXISTS idx_paquetes_nombre_etiqueta_fts
  ON paquetes USING gin (to_tsvector('simple', COALESCE(nombre_etiqueta, '')));
