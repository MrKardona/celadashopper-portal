-- 20260505_user_deletion_cascade.sql
-- Permitir borrar usuarios sin que las FKs lo bloqueen.
--   paquetes/consolidaciones: SET NULL (preservar histórico operativo)
--   notificaciones/conversaciones: CASCADE (no tienen sentido sin el cliente)
--   fotos/eventos/cajas (creado_por agentes): SET NULL

ALTER TABLE paquetes DROP CONSTRAINT IF EXISTS paquetes_cliente_id_fkey;
ALTER TABLE paquetes ADD CONSTRAINT paquetes_cliente_id_fkey
  FOREIGN KEY (cliente_id) REFERENCES perfiles(id) ON DELETE SET NULL;

ALTER TABLE paquetes DROP CONSTRAINT IF EXISTS paquetes_agente_recepcion_id_fkey;
ALTER TABLE paquetes ADD CONSTRAINT paquetes_agente_recepcion_id_fkey
  FOREIGN KEY (agente_recepcion_id) REFERENCES perfiles(id) ON DELETE SET NULL;

ALTER TABLE consolidaciones DROP CONSTRAINT IF EXISTS consolidaciones_cliente_id_fkey;
ALTER TABLE consolidaciones ADD CONSTRAINT consolidaciones_cliente_id_fkey
  FOREIGN KEY (cliente_id) REFERENCES perfiles(id) ON DELETE SET NULL;

ALTER TABLE consolidaciones DROP CONSTRAINT IF EXISTS consolidaciones_agente_id_fkey;
ALTER TABLE consolidaciones ADD CONSTRAINT consolidaciones_agente_id_fkey
  FOREIGN KEY (agente_id) REFERENCES perfiles(id) ON DELETE SET NULL;

ALTER TABLE notificaciones DROP CONSTRAINT IF EXISTS notificaciones_cliente_id_fkey;
ALTER TABLE notificaciones ADD CONSTRAINT notificaciones_cliente_id_fkey
  FOREIGN KEY (cliente_id) REFERENCES perfiles(id) ON DELETE CASCADE;

ALTER TABLE conversaciones_whatsapp DROP CONSTRAINT IF EXISTS conversaciones_whatsapp_cliente_id_fkey;
ALTER TABLE conversaciones_whatsapp ADD CONSTRAINT conversaciones_whatsapp_cliente_id_fkey
  FOREIGN KEY (cliente_id) REFERENCES perfiles(id) ON DELETE CASCADE;

ALTER TABLE fotos_paquetes DROP CONSTRAINT IF EXISTS fotos_paquetes_subida_por_fkey;
ALTER TABLE fotos_paquetes ADD CONSTRAINT fotos_paquetes_subida_por_fkey
  FOREIGN KEY (subida_por) REFERENCES perfiles(id) ON DELETE SET NULL;

ALTER TABLE eventos_paquete DROP CONSTRAINT IF EXISTS eventos_paquete_agente_id_fkey;
ALTER TABLE eventos_paquete ADD CONSTRAINT eventos_paquete_agente_id_fkey
  FOREIGN KEY (agente_id) REFERENCES perfiles(id) ON DELETE SET NULL;

ALTER TABLE cajas_consolidacion DROP CONSTRAINT IF EXISTS cajas_consolidacion_creada_por_fkey;
ALTER TABLE cajas_consolidacion ADD CONSTRAINT cajas_consolidacion_creada_por_fkey
  FOREIGN KEY (creada_por) REFERENCES perfiles(id) ON DELETE SET NULL;
