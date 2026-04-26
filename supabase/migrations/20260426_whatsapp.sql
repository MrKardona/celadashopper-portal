-- Run this in Supabase Dashboard → SQL Editor
-- Project: CeladaShopper Portal
-- Date: 2026-04-26

-- Historial de conversaciones WhatsApp por cliente
CREATE TABLE IF NOT EXISTS conversaciones_whatsapp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES perfiles(id),   -- NULL si cliente aún no registrado
  telefono VARCHAR(20) NOT NULL,              -- +573001234567
  rol VARCHAR(10) NOT NULL CHECK (rol IN ('cliente', 'agente', 'sistema')),
  mensaje TEXT NOT NULL,
  accion_ejecutada VARCHAR(50),              -- ninguna|registrar_cliente|confirmar_envio|escalar
  escalada BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversaciones_telefono ON conversaciones_whatsapp(telefono, created_at DESC);
CREATE INDEX idx_conversaciones_cliente ON conversaciones_whatsapp(cliente_id, created_at DESC);

-- Plantillas de notificación proactiva (mensajes pre-aprobados por Meta/WhatsApp)
CREATE TABLE IF NOT EXISTS plantillas_notificacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento VARCHAR(50) NOT NULL UNIQUE,
  -- Valores: paquete_recibido_usa | paquete_en_transito | paquete_listo_recoger
  texto_plantilla TEXT NOT NULL,
  activa BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plantillas iniciales
INSERT INTO plantillas_notificacion (evento, texto_plantilla) VALUES
  ('paquete_recibido_usa',
   '📦 Hola {{nombre}}, tu paquete *{{descripcion}}* llegó a nuestra bodega en USA.\n\n⚖️ Peso: {{peso}} lbs\n💰 Costo: ${{costo}}\n\n¿Lo procesamos para enviarlo a Colombia? Responde *SÍ* para confirmar.'),
  ('paquete_en_transito',
   '✈️ Hola {{nombre}}, tu paquete *{{descripcion}}* ya está en camino a Colombia. Te avisamos cuando llegue a bodega.'),
  ('paquete_listo_recoger',
   '🎉 Hola {{nombre}}, tu paquete *{{descripcion}}* está listo para recoger en bodega {{bodega}}. ¿Cuándo pasas?')
ON CONFLICT (evento) DO NOTHING;

-- RLS para nuevas tablas
ALTER TABLE conversaciones_whatsapp ENABLE ROW LEVEL SECURITY;
ALTER TABLE plantillas_notificacion ENABLE ROW LEVEL SECURITY;

-- Solo service_role puede escribir conversaciones (Edge Functions usan service_role)
CREATE POLICY "service_role_gestiona_conversaciones" ON conversaciones_whatsapp
  FOR ALL USING (auth.role() = 'service_role');

-- Admin puede ver conversaciones
CREATE POLICY "admin_ve_conversaciones" ON conversaciones_whatsapp
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin')
  );

-- Todos pueden ver plantillas
CREATE POLICY "todos_ven_plantillas" ON plantillas_notificacion
  FOR SELECT USING (true);

CREATE POLICY "admin_gestiona_plantillas" ON plantillas_notificacion
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin')
  );
