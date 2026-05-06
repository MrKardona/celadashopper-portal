-- 20260505_categoria_tarifa_especial.sql
-- Agrega 'tarifa_especial' al enum de categorías. Esta categoría no tiene
-- reglas en tarifas_rangos: el costo se determina manualmente al hacer la
-- consolidación completa del paquete.
ALTER TYPE categoria_producto ADD VALUE IF NOT EXISTS 'tarifa_especial';
