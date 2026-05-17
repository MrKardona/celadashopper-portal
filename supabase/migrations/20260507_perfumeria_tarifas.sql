-- 20260507_perfumeria_tarifas.sql
-- Inserta las reglas de precio para Perfumería (idénticas a Cosméticos):
--   P10: $18 fijo + $2.20/lb para 1-6 uds con valor ≤ $200
--   P20: $6.50/lb (mín 5 lb) para 1-6 uds con valor > $200
--   P30: $6.50/lb (mín 5 lb) para 7+ uds (cualquier valor)
--
-- Pre-req: el enum debe haberse extendido primero
-- (ver 20260507_categoria_perfumeria.sql).

DELETE FROM tarifas_rangos WHERE categoria = 'perfumeria';

INSERT INTO tarifas_rangos (
  categoria, condicion, min_unidades, max_unidades,
  precio_por_unidad, seguro_porcentaje, cargo_fijo, tarifa_por_libra,
  peso_minimo_facturable, valor_min, valor_max, prioridad, notas
) VALUES
  ('perfumeria', NULL, 1, 6, 0, 0, 18.00, 2.20, NULL, NULL, 200.00, 10,
   'Normal: hasta 6 uds y valor ≤ $200 → $18 fijo + $2.20/lb'),
  ('perfumeria', NULL, 1, 6, 0, 0, 0, 6.50, 5.00, 200.01, NULL, 20,
   'Comercial por valor: 1-6 uds y valor > $200 → $6.50/lb (mín 5 lb)'),
  ('perfumeria', NULL, 7, NULL, 0, 0, 0, 6.50, 5.00, NULL, NULL, 30,
   'Comercial por cantidad: 7+ uds → $6.50/lb (mín 5 lb)');

-- Entrada de respaldo en tabla legacy (por si algún flujo hace fallback)
INSERT INTO categorias_tarifas (categoria, nombre_display, tarifa_por_libra, activo)
VALUES ('perfumeria', 'Perfumería', 0, true)
ON CONFLICT (categoria) DO NOTHING;
