-- ============================================================
-- CeladaShopper - Esquema completo de base de datos
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- Tipos enumerados
CREATE TYPE estado_paquete AS ENUM (
  'reportado',
  'recibido_usa',
  'en_consolidacion',
  'listo_envio',
  'en_transito',
  'en_colombia',
  'en_bodega_local',
  'en_camino_cliente',
  'entregado',
  'retenido',
  'devuelto'
);

CREATE TYPE categoria_producto AS ENUM (
  'celular',
  'computador',
  'ipad_tablet',
  'ropa_accesorios',
  'electrodomestico',
  'juguetes',
  'cosmeticos',
  'suplementos',
  'libros',
  'otro'
);

CREATE TYPE bodega_destino AS ENUM (
  'medellin',
  'bogota',
  'barranquilla'
);

CREATE TYPE rol_usuario AS ENUM (
  'cliente',
  'agente_usa',
  'admin'
);

-- ============================================================
-- TABLA: perfiles (extiende auth.users de Supabase)
-- ============================================================
CREATE TABLE perfiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre_completo TEXT NOT NULL,
  email TEXT NOT NULL,
  telefono TEXT,
  whatsapp TEXT,
  numero_casilla TEXT UNIQUE, -- ej: CS-0042
  ciudad TEXT,
  rol rol_usuario NOT NULL DEFAULT 'cliente',
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: categorias_tarifas
-- ============================================================
CREATE TABLE categorias_tarifas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria categoria_producto NOT NULL UNIQUE,
  nombre_display TEXT NOT NULL,
  tarifa_por_libra DECIMAL(10,2) NOT NULL,
  descripcion TEXT,
  activo BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tarifas iniciales de CeladaShopper
INSERT INTO categorias_tarifas (categoria, nombre_display, tarifa_por_libra) VALUES
  ('celular', 'Celulares', 0),           -- se actualiza con valor real
  ('computador', 'Computadores', 0),
  ('ipad_tablet', 'iPad / Tablets', 0),
  ('ropa_accesorios', 'Ropa y Accesorios', 0),
  ('electrodomestico', 'Electrodomésticos', 0),
  ('juguetes', 'Juguetes', 0),
  ('cosmeticos', 'Cosméticos', 0),
  ('suplementos', 'Suplementos', 0),
  ('libros', 'Libros', 0),
  ('otro', 'Otro', 0);

-- ============================================================
-- TABLA: paquetes
-- ============================================================
CREATE TABLE paquetes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relaciones
  cliente_id UUID NOT NULL REFERENCES perfiles(id),

  -- Datos reportados por el cliente
  tracking_origen TEXT,                    -- tracking del courier (Amazon, FedEx, UPS, etc.)
  tienda TEXT NOT NULL,                    -- "Amazon", "Nike", "Shein", etc.
  descripcion TEXT NOT NULL,
  categoria categoria_producto NOT NULL,
  valor_declarado DECIMAL(10,2),           -- en USD
  fecha_compra DATE,
  fecha_estimada_llegada DATE,
  notas_cliente TEXT,

  -- Datos registrados por el agente en USA
  tracking_casilla TEXT UNIQUE,            -- tracking interno CeladaShopper (generado)
  tracking_usaco TEXT,                     -- tracking de USACO (courier de despacho)
  peso_libras DECIMAL(8,3),
  dimensiones_largo DECIMAL(8,2),
  dimensiones_ancho DECIMAL(8,2),
  dimensiones_alto DECIMAL(8,2),
  peso_volumetrico DECIMAL(8,3),
  peso_facturable DECIMAL(8,3),           -- max(real, volumetrico)

  -- Estado y ubicacion
  estado estado_paquete NOT NULL DEFAULT 'reportado',
  bodega_destino bodega_destino NOT NULL DEFAULT 'medellin',
  ubicacion_actual TEXT,

  -- Consolidacion
  consolidacion_id UUID,                   -- FK a consolidaciones (se agrega despues)
  es_consolidado BOOLEAN DEFAULT false,

  -- Facturacion
  tarifa_aplicada DECIMAL(10,2),           -- tarifa por libra al momento de facturar
  costo_servicio DECIMAL(10,2),            -- peso_facturable * tarifa_aplicada
  factura_id TEXT,                         -- ID en Zoho Inventory
  factura_pagada BOOLEAN DEFAULT false,

  -- Metadatos
  agente_recepcion_id UUID REFERENCES perfiles(id),
  fecha_recepcion_usa TIMESTAMPTZ,
  fecha_despacho_usa TIMESTAMPTZ,
  fecha_llegada_colombia TIMESTAMPTZ,
  fecha_entrega TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: fotos_paquetes
-- ============================================================
CREATE TABLE fotos_paquetes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paquete_id UUID NOT NULL REFERENCES paquetes(id) ON DELETE CASCADE,
  url TEXT NOT NULL,                       -- URL en Supabase Storage
  storage_path TEXT NOT NULL,
  descripcion TEXT,                        -- "exterior", "contenido", "etiqueta", "dano"
  subida_por UUID REFERENCES perfiles(id),
  notificado_cliente BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: consolidaciones
-- ============================================================
CREATE TABLE consolidaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES perfiles(id),
  tracking_usaco TEXT,                     -- tracking USACO del envio consolidado
  peso_total_libras DECIMAL(8,3),
  costo_total DECIMAL(10,2),
  bodega_destino bodega_destino NOT NULL DEFAULT 'medellin',
  estado estado_paquete NOT NULL DEFAULT 'en_consolidacion',
  notas TEXT,
  agente_id UUID REFERENCES perfiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agregar FK de paquetes a consolidaciones
ALTER TABLE paquetes ADD CONSTRAINT fk_consolidacion
  FOREIGN KEY (consolidacion_id) REFERENCES consolidaciones(id);

-- ============================================================
-- TABLA: eventos_paquete (historial de estados)
-- ============================================================
CREATE TABLE eventos_paquete (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paquete_id UUID NOT NULL REFERENCES paquetes(id) ON DELETE CASCADE,
  estado_anterior estado_paquete,
  estado_nuevo estado_paquete NOT NULL,
  descripcion TEXT,
  ubicacion TEXT,
  agente_id UUID REFERENCES perfiles(id),
  notificado_cliente BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: notificaciones
-- ============================================================
CREATE TABLE notificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES perfiles(id),
  paquete_id UUID REFERENCES paquetes(id),
  tipo TEXT NOT NULL,                      -- "foto", "estado", "factura", "entrega"
  titulo TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  leida BOOLEAN DEFAULT false,
  enviada_whatsapp BOOLEAN DEFAULT false,
  enviada_email BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDICES para performance
-- ============================================================
CREATE INDEX idx_paquetes_cliente ON paquetes(cliente_id);
CREATE INDEX idx_paquetes_estado ON paquetes(estado);
CREATE INDEX idx_paquetes_tracking ON paquetes(tracking_origen);
CREATE INDEX idx_paquetes_tracking_casilla ON paquetes(tracking_casilla);
CREATE INDEX idx_eventos_paquete ON eventos_paquete(paquete_id);
CREATE INDEX idx_fotos_paquete ON fotos_paquetes(paquete_id);
CREATE INDEX idx_notificaciones_cliente ON notificaciones(cliente_id, leida);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) - Control de acceso
-- ============================================================
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE paquetes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fotos_paquetes ENABLE ROW LEVEL SECURITY;
ALTER TABLE consolidaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos_paquete ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias_tarifas ENABLE ROW LEVEL SECURITY;

-- Perfiles: cada usuario ve el suyo; admin ve todos
CREATE POLICY "usuario_ve_su_perfil" ON perfiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "admin_ve_todos_perfiles" ON perfiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin')
  );

CREATE POLICY "usuario_actualiza_su_perfil" ON perfiles
  FOR UPDATE USING (auth.uid() = id);

-- Paquetes: cliente ve los suyos; agente y admin ven todos
CREATE POLICY "cliente_ve_sus_paquetes" ON paquetes
  FOR SELECT USING (cliente_id = auth.uid());

CREATE POLICY "cliente_reporta_paquete" ON paquetes
  FOR INSERT WITH CHECK (cliente_id = auth.uid());

CREATE POLICY "agente_admin_ve_todos" ON paquetes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE id = auth.uid() AND rol IN ('agente_usa', 'admin')
    )
  );

-- Fotos: cliente ve las de sus paquetes; agente/admin gestionan
CREATE POLICY "cliente_ve_fotos_sus_paquetes" ON fotos_paquetes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM paquetes WHERE id = paquete_id AND cliente_id = auth.uid()
    )
  );

CREATE POLICY "agente_admin_gestiona_fotos" ON fotos_paquetes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE id = auth.uid() AND rol IN ('agente_usa', 'admin')
    )
  );

-- Notificaciones: cada cliente ve las suyas
CREATE POLICY "cliente_ve_sus_notificaciones" ON notificaciones
  FOR SELECT USING (cliente_id = auth.uid());

CREATE POLICY "admin_gestiona_notificaciones" ON notificaciones
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin', 'agente_usa'))
  );

-- Tarifas: todos pueden ver
CREATE POLICY "todos_ven_tarifas" ON categorias_tarifas
  FOR SELECT USING (true);

CREATE POLICY "admin_gestiona_tarifas" ON categorias_tarifas
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin')
  );

-- Eventos: cliente ve los de sus paquetes
CREATE POLICY "cliente_ve_eventos_sus_paquetes" ON eventos_paquete
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM paquetes WHERE id = paquete_id AND cliente_id = auth.uid()
    )
  );

CREATE POLICY "agente_admin_gestiona_eventos" ON eventos_paquete
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE id = auth.uid() AND rol IN ('agente_usa', 'admin')
    )
  );

-- ============================================================
-- FUNCION: crear perfil automaticamente al registrarse
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.perfiles (id, nombre_completo, email, numero_casilla)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre_completo', 'Usuario'),
    NEW.email,
    'CS-' || LPAD(CAST(nextval('casilla_seq') AS TEXT), 4, '0')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Secuencia para numero de casilla
CREATE SEQUENCE casilla_seq START 100;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- FUNCION: generar tracking interno CeladaShopper
-- ============================================================
CREATE OR REPLACE FUNCTION generar_tracking_casilla()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tracking_casilla IS NULL THEN
    NEW.tracking_casilla := 'CLD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
      UPPER(SUBSTRING(gen_random_uuid()::TEXT, 1, 6));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_tracking_casilla
  BEFORE INSERT ON paquetes
  FOR EACH ROW EXECUTE FUNCTION generar_tracking_casilla();

-- ============================================================
-- FUNCION: registrar evento cuando cambia estado del paquete
-- ============================================================
CREATE OR REPLACE FUNCTION registrar_evento_estado()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.estado IS DISTINCT FROM NEW.estado THEN
    INSERT INTO eventos_paquete (paquete_id, estado_anterior, estado_nuevo, agente_id)
    VALUES (NEW.id, OLD.estado, NEW.estado, auth.uid());
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_paquete_estado_change
  BEFORE UPDATE ON paquetes
  FOR EACH ROW EXECUTE FUNCTION registrar_evento_estado();

-- ============================================================
-- WhatsApp Agent tables (added 2026-04-26)
-- ============================================================

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
