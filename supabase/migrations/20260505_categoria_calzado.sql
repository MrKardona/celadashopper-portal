-- 20260505_categoria_calzado.sql
-- Agrega 'calzado' al enum de categorías de productos.
-- ALTER TYPE ... ADD VALUE no puede ejecutarse en la misma transacción que
-- otros DDL, por eso queda en su propia migración.
ALTER TYPE categoria_producto ADD VALUE IF NOT EXISTS 'calzado';
