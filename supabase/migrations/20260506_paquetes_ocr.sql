-- 20260506_paquetes_ocr.sql
-- Soporte para análisis OCR con Claude Vision al recibir paquetes en USA.
-- Guarda lo extraído por el modelo y de qué forma se hizo el match con el cliente
-- para auditoría y para construir un panel de "paquetes sin asignar".

ALTER TABLE paquetes
  ADD COLUMN IF NOT EXISTS ocr_data JSONB,
  ADD COLUMN IF NOT EXISTS ocr_match_tipo TEXT;

-- tracking | casillero | nombre | manual | null (sin asignar)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'paquetes_ocr_match_tipo_check') THEN
    ALTER TABLE paquetes
      ADD CONSTRAINT paquetes_ocr_match_tipo_check
      CHECK (ocr_match_tipo IS NULL OR ocr_match_tipo IN ('tracking','casillero','nombre','manual'));
  END IF;
END $$;

-- Índice parcial para listar rápido los paquetes sin asignar
CREATE INDEX IF NOT EXISTS idx_paquetes_sin_asignar
  ON paquetes(created_at DESC)
  WHERE cliente_id IS NULL;
