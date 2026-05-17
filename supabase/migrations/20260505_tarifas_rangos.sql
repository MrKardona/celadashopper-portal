-- 20260505_tarifas_rangos.sql
-- Modelo de tarifas escalonadas por condición (nuevo/usado) y rango de cantidad.
-- La tabla 'categorias_tarifas' actual se mantiene intacta (para tarifas por libra).
-- La nueva tabla 'tarifas_rangos' permite definir múltiples tarifas por categoría
-- según condición y cantidad. Lógica de búsqueda:
--   filas WHERE categoria = X AND condicion IS NOT DISTINCT FROM Y
--   AND min_unidades <= N AND (max_unidades IS NULL OR N <= max_unidades)

CREATE TABLE IF NOT EXISTS tarifas_rangos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria       TEXT NOT NULL,
  condicion       TEXT,
  min_unidades    INTEGER NOT NULL DEFAULT 1,
  max_unidades    INTEGER,
  precio_por_unidad NUMERIC(10,2) NOT NULL,
  seguro_porcentaje NUMERIC(5,2) NOT NULL DEFAULT 0,
  activo          BOOLEAN NOT NULL DEFAULT true,
  notas           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (condicion IS NULL OR condicion IN ('nuevo', 'usado')),
  CHECK (min_unidades >= 1),
  CHECK (max_unidades IS NULL OR max_unidades >= min_unidades),
  CHECK (precio_por_unidad >= 0),
  CHECK (seguro_porcentaje >= 0 AND seguro_porcentaje <= 100)
);

CREATE INDEX IF NOT EXISTS idx_tarifas_rangos_lookup
  ON tarifas_rangos (categoria, condicion, activo);

CREATE OR REPLACE FUNCTION trg_tarifas_rangos_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tarifas_rangos_updated_at ON tarifas_rangos;
CREATE TRIGGER tarifas_rangos_updated_at
  BEFORE UPDATE ON tarifas_rangos
  FOR EACH ROW EXECUTE FUNCTION trg_tarifas_rangos_updated_at();

-- Datos iniciales según tarifas confirmadas
INSERT INTO tarifas_rangos (categoria, condicion, min_unidades, max_unidades, precio_por_unidad, seguro_porcentaje, notas)
VALUES
  ('celular',    'nuevo', 1, NULL, 75.00, 0.00, 'Celular nuevo en caja'),
  ('celular',    'usado', 1,    4, 55.00, 0.00, 'Celular usado sin caja, 1 a 4 unidades'),
  ('celular',    'usado', 5,    9, 45.00, 0.00, 'Celular usado sin caja, 5 a 9 unidades'),
  ('celular',    'usado', 10, NULL, 40.00, 0.00, 'Celular usado sin caja, 10 o más unidades'),
  ('computador', 'nuevo', 1, NULL, 75.00, 4.00, 'Computador nuevo + seguro 4%'),
  ('computador', 'usado', 1, NULL, 55.00, 4.00, 'Computador usado + seguro 4%')
ON CONFLICT DO NOTHING;

-- Columnas en paquetes para guardar la condición y cantidad declarada por el cliente.
ALTER TABLE paquetes
  ADD COLUMN IF NOT EXISTS condicion TEXT,
  ADD COLUMN IF NOT EXISTS cantidad  INTEGER DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'paquetes_condicion_check') THEN
    ALTER TABLE paquetes
      ADD CONSTRAINT paquetes_condicion_check
      CHECK (condicion IS NULL OR condicion IN ('nuevo', 'usado'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'paquetes_cantidad_check') THEN
    ALTER TABLE paquetes
      ADD CONSTRAINT paquetes_cantidad_check
      CHECK (cantidad IS NULL OR cantidad >= 1);
  END IF;
END $$;
