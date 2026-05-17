-- 20260505_tarifas_completas.sql
-- Extiende tarifas_rangos con todos los componentes de cálculo y agrega
-- las reglas para iPad/Tablet, categorías pequeñas y calzado.
--
-- Pre-req: este enum debe haber sido extendido antes (ver migración previa
-- categoria_calzado): ALTER TYPE categoria_producto ADD VALUE 'calzado'.

ALTER TABLE tarifas_rangos
  ADD COLUMN IF NOT EXISTS cargo_fijo            NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tarifa_por_libra      NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS peso_minimo_facturable NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS valor_min             NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS valor_max             NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS prioridad             INTEGER NOT NULL DEFAULT 100;

-- iPad/Tablet
INSERT INTO tarifas_rangos (
  categoria, condicion, min_unidades, max_unidades,
  precio_por_unidad, seguro_porcentaje, cargo_fijo, tarifa_por_libra,
  peso_minimo_facturable, valor_min, valor_max, prioridad, notas
) VALUES
  ('ipad_tablet', NULL, 1, NULL, 45.00, 4.00, 0, 0, NULL, 200.01, NULL, 10,
   'iPad/Tablet con valor > $200: $45/u + 4% seguro'),
  ('ipad_tablet', NULL, 1, NULL, 0, 0, 18.00, 2.20, NULL, NULL, 200.00, 20,
   'iPad/Tablet con valor ≤ $200: $18 fijo + $2.20/lb');

-- Categorías pequeñas con tarifa normal y comercial
DO $$
DECLARE
  cat TEXT;
  cats TEXT[] := ARRAY['ropa_accesorios','cosmeticos','suplementos','libros','electrodomestico'];
BEGIN
  FOREACH cat IN ARRAY cats LOOP
    DELETE FROM tarifas_rangos WHERE categoria = cat;

    INSERT INTO tarifas_rangos (
      categoria, condicion, min_unidades, max_unidades,
      precio_por_unidad, seguro_porcentaje, cargo_fijo, tarifa_por_libra,
      peso_minimo_facturable, valor_min, valor_max, prioridad, notas
    ) VALUES (
      cat, NULL, 1, 6, 0, 0, 18.00, 2.20, NULL, NULL, 200.00, 10,
      'Normal: hasta 6 uds y valor ≤ $200 → $18 fijo + $2.20/lb'
    );

    INSERT INTO tarifas_rangos (
      categoria, condicion, min_unidades, max_unidades,
      precio_por_unidad, seguro_porcentaje, cargo_fijo, tarifa_por_libra,
      peso_minimo_facturable, valor_min, valor_max, prioridad, notas
    ) VALUES (
      cat, NULL, 1, 6, 0, 0, 0, 6.50, 5.00, 200.01, NULL, 20,
      'Comercial por valor: 1-6 uds y valor > $200 → $6.50/lb (mín 5 lb)'
    );

    INSERT INTO tarifas_rangos (
      categoria, condicion, min_unidades, max_unidades,
      precio_por_unidad, seguro_porcentaje, cargo_fijo, tarifa_por_libra,
      peso_minimo_facturable, valor_min, valor_max, prioridad, notas
    ) VALUES (
      cat, NULL, 7, NULL, 0, 0, 0, 6.50, 5.00, NULL, NULL, 30,
      'Comercial por cantidad: 7+ uds → $6.50/lb (mín 5 lb)'
    );
  END LOOP;
END $$;

-- Calzado (categoría nueva)
INSERT INTO tarifas_rangos (
  categoria, condicion, min_unidades, max_unidades,
  precio_por_unidad, seguro_porcentaje, cargo_fijo, tarifa_por_libra,
  peso_minimo_facturable, valor_min, valor_max, prioridad, notas
) VALUES
  ('calzado', NULL, 1, 1, 20.00, 0, 0, 0, NULL, NULL, NULL, 10, '1 par: $20 fijo'),
  ('calzado', NULL, 2, NULL, 17.50, 0, 0, 0, NULL, NULL, NULL, 20, '2+ pares: $17.50 por par');
