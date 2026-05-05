-- 20260505_paquetes_direccion_entrega.sql
-- Permitir que cada paquete tenga su propia dirección de entrega.
-- Si los campos quedan en NULL, se usa la dirección del perfil del cliente.
ALTER TABLE paquetes
  ADD COLUMN IF NOT EXISTS direccion_entrega TEXT,
  ADD COLUMN IF NOT EXISTS barrio_entrega TEXT,
  ADD COLUMN IF NOT EXISTS referencia_entrega TEXT;
