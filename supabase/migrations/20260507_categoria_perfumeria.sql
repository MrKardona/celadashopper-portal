-- 20260507_categoria_perfumeria.sql
-- Agrega 'perfumeria' al enum de categorías y copia las reglas de cosméticos.
-- ALTER TYPE ... ADD VALUE no puede ejecutarse en la misma transacción que
-- otros DDL, por eso el enum queda en su propia migración.

ALTER TYPE categoria_producto ADD VALUE IF NOT EXISTS 'perfumeria';
