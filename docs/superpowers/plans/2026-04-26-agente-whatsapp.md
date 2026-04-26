# Agente IA WhatsApp — CeladaShopper — Plan de Implementación

> **Para agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan sintaxis checkbox (`- [ ]`) para seguimiento.

**Goal:** Construir un agente IA que atiende clientes de CeladaShopper 24/7 por WhatsApp — consulta paquetes, cotiza a nuevos clientes, confirma envíos y escala a humano cuando es necesario.

**Architecture:** El webhook de Kommo recibe mensajes de WhatsApp y los delega a una Supabase Edge Function que corre el pipeline completo: resolver cliente, construir contexto, llamar Claude API, ejecutar acción y responder por Kommo. Las notificaciones proactivas se disparan con un trigger de Supabase cuando el agente USA cambia el estado de un paquete.

**Tech Stack:** Next.js 16 (App Router), Supabase (PostgreSQL + Edge Functions), Claude API (@anthropic-ai/sdk), Kommo CRM API, TypeScript, Vitest

---

## Mapa de Archivos

```
CREAR:
src/app/api/whatsapp/webhook/route.ts     — recibe webhook Kommo, verifica HMAC, delega
src/lib/kommo/types.ts                     — tipos del payload webhook de Kommo
src/lib/kommo/client.ts                    — cliente HTTP para Kommo API
src/lib/whatsapp/client-resolver.ts        — busca cliente por teléfono en Supabase
src/lib/whatsapp/context-builder.ts        — arma contexto para Claude
src/lib/whatsapp/agent.ts                  — llama Claude API, retorna AgentResponse
src/lib/whatsapp/action-executor.ts        — ejecuta acciones (registrar, confirmar, escalar)
supabase/functions/process-whatsapp/index.ts  — Edge Function: pipeline completo
supabase/functions/notify-whatsapp/index.ts   — Edge Function: notificaciones proactivas
supabase/migrations/20260426_whatsapp.sql  — tablas conversaciones + plantillas
src/__tests__/whatsapp/client-resolver.test.ts
src/__tests__/whatsapp/context-builder.test.ts
src/__tests__/whatsapp/agent.test.ts
src/__tests__/whatsapp/action-executor.test.ts

MODIFICAR:
src/types/index.ts                         — agregar ConversacionWhatsapp, PlantillaNotificacion
package.json                               — agregar @anthropic-ai/sdk, vitest
.env.local                                 — agregar KOMMO_*, ANTHROPIC_API_KEY
supabase/schema.sql                        — agregar tablas nuevas al final
```

---

## Task 1: Instalar dependencias y configurar variables de entorno

**Files:**
- Modify: `package.json`
- Modify: `.env.local`

- [ ] **Step 1: Instalar dependencias**

```bash
cd "C:\Users\pc1\cloudea\carpeta CODE\celadashopper-portal"
npm install @anthropic-ai/sdk
npm install -D vitest @vitest/coverage-v8
```

Expected output: `added X packages`

- [ ] **Step 2: Agregar script de tests en package.json**

En `package.json`, agregar en `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Agregar variables de entorno en .env.local**

Abrir `.env.local` y agregar al final:
```bash
# Claude API
ANTHROPIC_API_KEY=sk-ant-...   # obtener en console.anthropic.com

# Kommo CRM
KOMMO_DOMAIN=tuempresa          # ej: celadashopper (sin .kommo.com)
KOMMO_API_TOKEN=...             # obtener en Kommo → Configuración → Integraciones → API
KOMMO_WEBHOOK_SECRET=...        # string aleatorio que pones en Kommo al registrar el webhook

# Supabase (ya existen, verificar que estén)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # AGREGAR: obtener en Supabase → Settings → API
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .env.local
git commit -m "chore: add anthropic sdk and vitest for whatsapp agent"
```

---

## Task 2: Migración de base de datos

**Files:**
- Create: `supabase/migrations/20260426_whatsapp.sql`
- Modify: `supabase/schema.sql`

- [ ] **Step 1: Crear archivo de migración**

Crear `supabase/migrations/20260426_whatsapp.sql`:

```sql
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
```

- [ ] **Step 2: Ejecutar migración en Supabase**

Ir a Supabase Dashboard → SQL Editor → copiar y ejecutar el contenido de `20260426_whatsapp.sql`.

Expected: "Success. No rows returned"

- [ ] **Step 3: Verificar tablas creadas**

En Supabase SQL Editor:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('conversaciones_whatsapp', 'plantillas_notificacion');
```

Expected: 2 filas

- [ ] **Step 4: Agregar al schema.sql principal**

Copiar el contenido del archivo de migración al final de `supabase/schema.sql` (después de la última línea).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260426_whatsapp.sql supabase/schema.sql
git commit -m "feat: add whatsapp conversation and notification template tables"
```

---

## Task 3: Tipos TypeScript nuevos

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Agregar tipos al final de src/types/index.ts**

```typescript
// ============================================================
// TIPOS: Agente WhatsApp
// ============================================================

export interface ConversacionWhatsapp {
  id: string
  cliente_id: string | null
  telefono: string
  rol: 'cliente' | 'agente' | 'sistema'
  mensaje: string
  accion_ejecutada: AccionAgente | null
  escalada: boolean
  created_at: string
}

export interface PlantillaNotificacion {
  id: string
  evento: EventoNotificacion
  texto_plantilla: string
  activa: boolean
  created_at: string
}

export type EventoNotificacion =
  | 'paquete_recibido_usa'
  | 'paquete_en_transito'
  | 'paquete_listo_recoger'

export type AccionAgente =
  | 'ninguna'
  | 'registrar_cliente'
  | 'confirmar_envio'
  | 'escalar'

export interface AgentResponse {
  respuesta: string
  accion: AccionAgente
  datos_accion: RegistrarClienteData | ConfirmarEnvioData | EscalarData | Record<string, never>
}

export interface RegistrarClienteData {
  nombre: string
  ciudad: BodegaDestino
  telefono: string
  email?: string
}

export interface ConfirmarEnvioData {
  paquete_id: string
}

export interface EscalarData {
  motivo: string
  kommo_contact_id: number
}

export interface ClienteConPaquetes {
  perfil: Perfil
  paquetes: Paquete[]
  tarifas: TarifaCategoria[]
}

export interface KommoWebhookPayload {
  account: { id: number; subdomain: string }
  message: {
    add?: KommoIncomingMessage[]
  }
}

export interface KommoIncomingMessage {
  id: string
  chat_id: string
  contact_id: number
  author_id: number
  author_type: 'contact' | 'user' | 'bot'
  type: 'text' | 'image' | 'audio' | 'video' | 'file' | 'sticker'
  text?: string
  media?: { url: string }
  created_at: number
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add whatsapp agent TypeScript types"
```

---

## Task 4: Cliente HTTP de Kommo

**Files:**
- Create: `src/lib/kommo/client.ts`

- [ ] **Step 1: Crear src/lib/kommo/client.ts**

```typescript
// src/lib/kommo/client.ts
// Cliente HTTP para Kommo CRM API
// Docs: https://developers.kommo.com/reference

const KOMMO_DOMAIN = process.env.KOMMO_DOMAIN!
const KOMMO_API_TOKEN = process.env.KOMMO_API_TOKEN!
const BASE_URL = `https://${KOMMO_DOMAIN}.kommo.com/api/v4`

async function kommoFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${KOMMO_API_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Kommo API error ${res.status}: ${body}`)
  }
  return res.json()
}

/**
 * Envía un mensaje de texto al cliente por WhatsApp via Kommo Chats API
 * El chat_id identifica la conversación en Kommo (viene en el webhook)
 */
export async function sendTextMessage(chatId: string, text: string): Promise<void> {
  await kommoFetch(`/chats/${chatId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ type: 'text', text }),
  })
}

/**
 * Obtiene los datos de un contacto de Kommo por su ID
 * Incluye el número de teléfono para matchear con Supabase
 */
export async function getContact(contactId: number): Promise<{
  id: number
  name: string
  phone?: string
}> {
  const data = await kommoFetch(`/contacts/${contactId}`)
  const phoneField = data.custom_fields_values?.find(
    (f: { field_code: string }) => f.field_code === 'PHONE'
  )
  const phone = phoneField?.values?.[0]?.value as string | undefined
  return { id: data.id, name: data.name, phone }
}

/**
 * Reasigna una conversación a un agente humano en Kommo
 * Agrega una nota con el contexto para que el agente entienda la situación
 */
export async function escalateToHuman(
  contactId: number,
  chatId: string,
  contextoEscalada: string
): Promise<void> {
  // Agregar nota al contacto con el contexto
  await kommoFetch(`/contacts/${contactId}/notes`, {
    method: 'POST',
    body: JSON.stringify({
      note_type: 'common',
      params: { text: `🤖 Escalada automática del agente IA:\n\n${contextoEscalada}` },
    }),
  })

  // Quitar asignación del bot (asignar a null para que un humano lo tome)
  await kommoFetch(`/chats/${chatId}`, {
    method: 'PATCH',
    body: JSON.stringify({ responsible_user_id: null }),
  })
}

/**
 * Verifica la firma HMAC del webhook de Kommo
 * Kommo envía X-Kommo-Signature: sha256=<hash>
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false
  const crypto = require('crypto') as typeof import('crypto')
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/kommo/client.ts
git commit -m "feat: add Kommo CRM HTTP client"
```

---

## Task 5: Client Resolver

**Files:**
- Create: `src/lib/whatsapp/client-resolver.ts`
- Create: `src/__tests__/whatsapp/client-resolver.test.ts`

- [ ] **Step 1: Escribir el test primero**

Crear `src/__tests__/whatsapp/client-resolver.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolveClient } from '../../lib/whatsapp/client-resolver'

// Mock de Supabase
vi.mock('../../lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

describe('resolveClient', () => {
  it('normaliza teléfono colombiano sin código de país', async () => {
    const { createClient } = await import('../../lib/supabase/server')
    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockResolvedValue({ data: [], error: null }),
    }
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

    await resolveClient('3001234567')

    expect(mockSupabase.or).toHaveBeenCalledWith(
      expect.stringContaining('+573001234567')
    )
  })

  it('retorna null si el cliente no existe', async () => {
    const { createClient } = await import('../../lib/supabase/server')
    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockResolvedValue({ data: [], error: null }),
    }
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

    const result = await resolveClient('+573001234567')
    expect(result).toBeNull()
  })

  it('retorna el cliente con sus paquetes activos si existe', async () => {
    const { createClient } = await import('../../lib/supabase/server')
    const mockPerfil = {
      id: 'uuid-123',
      nombre_completo: 'Juan Pérez',
      whatsapp: '+573001234567',
      paquetes: [{ id: 'pkg-1', estado: 'recibido_usa', descripcion: 'Nike Shoes' }],
    }
    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockResolvedValue({ data: [mockPerfil], error: null }),
    }
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

    const result = await resolveClient('+573001234567')
    expect(result).not.toBeNull()
    expect(result?.perfil.nombre_completo).toBe('Juan Pérez')
  })
})
```

- [ ] **Step 2: Correr el test — verificar que falla**

```bash
cd "C:\Users\pc1\cloudea\carpeta CODE\celadashopper-portal"
npx vitest run src/__tests__/whatsapp/client-resolver.test.ts
```

Expected: FAIL — "Cannot find module '../../lib/whatsapp/client-resolver'"

- [ ] **Step 3: Implementar client-resolver.ts**

Crear `src/lib/whatsapp/client-resolver.ts`:

```typescript
// src/lib/whatsapp/client-resolver.ts
// Busca un cliente en Supabase por su número de WhatsApp

import { createClient } from '../supabase/server'
import type { ClienteConPaquetes } from '@/types'

/**
 * Normaliza un número de teléfono al formato internacional colombiano +57XXXXXXXXXX
 * Acepta: 3001234567 | 573001234567 | +573001234567
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('57') && digits.length === 12) return `+${digits}`
  if (digits.length === 10) return `+57${digits}`
  return `+${digits}`
}

/**
 * Busca un cliente por número de WhatsApp o teléfono.
 * Retorna el perfil con sus paquetes activos y las tarifas vigentes.
 * Retorna null si el cliente no está registrado.
 */
export async function resolveClient(
  rawPhone: string
): Promise<ClienteConPaquetes | null> {
  const supabase = await createClient()
  const phone = normalizePhone(rawPhone)

  // Buscar por whatsapp o teléfono (alguno puede tener el número)
  const { data: perfiles, error } = await supabase
    .from('perfiles')
    .select(`
      *,
      paquetes (
        id, descripcion, categoria, estado, peso_libras, peso_facturable,
        costo_servicio, factura_pagada, bodega_destino, tracking_casilla,
        tienda, created_at, updated_at,
        fotos_paquetes ( id, url, descripcion )
      )
    `)
    .or(`whatsapp.eq.${phone},telefono.eq.${phone}`)
    .eq('activo', true)
    .limit(1)

  if (error || !perfiles || perfiles.length === 0) return null

  const perfil = perfiles[0]

  // Solo paquetes no entregados ni devueltos
  const paquetesActivos = (perfil.paquetes || []).filter(
    (p: { estado: string }) =>
      !['entregado', 'devuelto'].includes(p.estado)
  )

  // Cargar tarifas vigentes
  const { data: tarifas } = await supabase
    .from('categorias_tarifas')
    .select('*')
    .eq('activo', true)

  return {
    perfil,
    paquetes: paquetesActivos,
    tarifas: tarifas || [],
  }
}
```

- [ ] **Step 4: Correr el test — verificar que pasa**

```bash
npx vitest run src/__tests__/whatsapp/client-resolver.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/whatsapp/client-resolver.ts src/__tests__/whatsapp/client-resolver.test.ts
git commit -m "feat: add WhatsApp client resolver with phone normalization"
```

---

## Task 6: Context Builder

**Files:**
- Create: `src/lib/whatsapp/context-builder.ts`
- Create: `src/__tests__/whatsapp/context-builder.test.ts`

- [ ] **Step 1: Escribir el test primero**

Crear `src/__tests__/whatsapp/context-builder.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildContext } from '../../lib/whatsapp/context-builder'
import type { ClienteConPaquetes, ConversacionWhatsapp } from '../../types'

const mockCliente: ClienteConPaquetes = {
  perfil: {
    id: 'uuid-123',
    nombre_completo: 'Juan Pérez',
    email: 'juan@test.com',
    whatsapp: '+573001234567',
    ciudad: 'medellin',
    rol: 'cliente',
    activo: true,
    numero_casilla: 'CS-0042',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  paquetes: [
    {
      id: 'pkg-1',
      cliente_id: 'uuid-123',
      descripcion: 'Nike Air Max',
      tienda: 'Amazon',
      categoria: 'ropa_accesorios',
      estado: 'recibido_usa',
      bodega_destino: 'medellin',
      peso_libras: 1.8,
      peso_facturable: 1.8,
      costo_servicio: 22000,
      factura_pagada: false,
      tracking_casilla: 'CLD-20260401-ABC123',
      created_at: '2026-04-01T00:00:00Z',
      updated_at: '2026-04-25T00:00:00Z',
      fotos_paquetes: [{ id: 'f1', paquete_id: 'pkg-1', url: 'https://storage.supabase.co/foto.jpg', storage_path: 'fotos/foto.jpg', created_at: '2026-04-01T00:00:00Z' }],
    },
  ],
  tarifas: [],
}

const mockHistorial: ConversacionWhatsapp[] = []

describe('buildContext', () => {
  it('incluye el nombre del cliente en el contexto', () => {
    const ctx = buildContext(mockCliente, mockHistorial)
    expect(ctx).toContain('Juan Pérez')
  })

  it('incluye el estado del paquete', () => {
    const ctx = buildContext(mockCliente, mockHistorial)
    expect(ctx).toContain('recibido_usa')
  })

  it('incluye URL de foto cuando existe', () => {
    const ctx = buildContext(mockCliente, mockHistorial)
    expect(ctx).toContain('https://storage.supabase.co/foto.jpg')
  })

  it('indica cliente nuevo cuando no hay perfil', () => {
    const ctx = buildContext(null, mockHistorial)
    expect(ctx).toContain('CLIENTE NUEVO')
  })
})
```

- [ ] **Step 2: Correr el test — verificar que falla**

```bash
npx vitest run src/__tests__/whatsapp/context-builder.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implementar context-builder.ts**

Crear `src/lib/whatsapp/context-builder.ts`:

```typescript
// src/lib/whatsapp/context-builder.ts
// Construye el contexto que recibe Claude para generar una respuesta

import type { ClienteConPaquetes, ConversacionWhatsapp } from '@/types'
import { ESTADO_LABELS } from '@/types'

/**
 * Construye un string de contexto estructurado para el system prompt de Claude.
 * Incluye: datos del cliente, paquetes activos con fotos, historial de conversación y tarifas.
 */
export function buildContext(
  cliente: ClienteConPaquetes | null,
  historial: ConversacionWhatsapp[]
): string {
  const ahora = new Date().toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'full',
    timeStyle: 'short',
  })

  if (!cliente) {
    return `
FECHA Y HORA COLOMBIA: ${ahora}
TIPO DE CLIENTE: CLIENTE NUEVO (no registrado en el sistema)
INSTRUCCIÓN: Saluda, explica el servicio, da tarifas si pregunta, y si está interesado recopila: nombre completo, ciudad (medellin/bogota/barranquilla), y email opcional.
`.trim()
  }

  const { perfil, paquetes, tarifas } = cliente

  const paquetesTexto = paquetes.length === 0
    ? 'Sin paquetes activos.'
    : paquetes.map((p) => {
        const fotos = p.fotos_paquetes?.map((f) => f.url).join(', ') || 'Sin fotos'
        return `
  - ID: ${p.id}
    Tracking: ${p.tracking_casilla || 'Sin asignar'}
    Descripción: ${p.descripcion} (${p.tienda})
    Estado: ${p.estado} — ${ESTADO_LABELS[p.estado]}
    Peso: ${p.peso_facturable ?? '?'} lbs
    Costo: $${p.costo_servicio?.toLocaleString('es-CO') ?? 'Por calcular'}
    Pagado: ${p.factura_pagada ? 'Sí' : 'No'}
    Destino: ${p.bodega_destino}
    Fotos: ${fotos}`.trim()
      }).join('\n')

  const tarifasTexto = tarifas.length === 0
    ? 'Tarifas no disponibles.'
    : tarifas.map((t) =>
        `  ${t.nombre_display}: $${t.tarifa_por_libra.toLocaleString('es-CO')}/lb`
      ).join('\n')

  const historialTexto = historial.length === 0
    ? 'Primera interacción.'
    : historial
        .slice(-10)
        .map((m) => `  [${m.rol.toUpperCase()}]: ${m.mensaje}`)
        .join('\n')

  return `
FECHA Y HORA COLOMBIA: ${ahora}

CLIENTE:
  Nombre: ${perfil.nombre_completo}
  Casilla: ${perfil.numero_casilla || 'Sin asignar'}
  Ciudad: ${perfil.ciudad || 'No especificada'}
  WhatsApp: ${perfil.whatsapp || perfil.telefono}

PAQUETES ACTIVOS (${paquetes.length}):
${paquetesTexto}

TARIFAS VIGENTES (por libra):
${tarifasTexto}

HISTORIAL RECIENTE:
${historialTexto}
`.trim()
}
```

- [ ] **Step 4: Correr el test — verificar que pasa**

```bash
npx vitest run src/__tests__/whatsapp/context-builder.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/whatsapp/context-builder.ts src/__tests__/whatsapp/context-builder.test.ts
git commit -m "feat: add WhatsApp context builder for Claude"
```

---

## Task 7: Claude Agent

**Files:**
- Create: `src/lib/whatsapp/agent.ts`
- Create: `src/__tests__/whatsapp/agent.test.ts`

- [ ] **Step 1: Escribir el test primero**

Crear `src/__tests__/whatsapp/agent.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { runAgent } from '../../lib/whatsapp/agent'

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify({
            respuesta: 'Hola Juan, tu paquete Nike está en bodega USA.',
            accion: 'ninguna',
            datos_accion: {},
          }),
        }],
      }),
    },
  })),
}))

describe('runAgent', () => {
  it('retorna respuesta y acción válidas', async () => {
    const result = await runAgent(
      '¿Dónde está mi paquete?',
      'CLIENTE:\n  Nombre: Juan\nPAQUETES: Nike Air Max - recibido_usa'
    )
    expect(result.respuesta).toContain('Juan')
    expect(['ninguna', 'registrar_cliente', 'confirmar_envio', 'escalar'])
      .toContain(result.accion)
  })

  it('retorna acción de escalada cuando Claude lo decide', async () => {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    vi.mocked(Anthropic).mockImplementationOnce(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{
            type: 'text',
            text: JSON.stringify({
              respuesta: 'Te conecto con el equipo 🙏',
              accion: 'escalar',
              datos_accion: { motivo: 'queja por daño', kommo_contact_id: 123 },
            }),
          }],
        }),
      },
    }) as any)

    const result = await runAgent('Mi paquete llegó dañado, quiero hablar con alguien', 'CLIENTE: Juan')
    expect(result.accion).toBe('escalar')
  })
})
```

- [ ] **Step 2: Correr el test — verificar que falla**

```bash
npx vitest run src/__tests__/whatsapp/agent.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implementar agent.ts**

Crear `src/lib/whatsapp/agent.ts`:

```typescript
// src/lib/whatsapp/agent.ts
// Llama a Claude API con el contexto del cliente y retorna la respuesta + acción

import Anthropic from '@anthropic-ai/sdk'
import type { AgentResponse } from '@/types'

const SYSTEM_PROMPT = `Eres el asistente virtual de CeladaShopper, un servicio de casillero que ayuda a colombianos a comprar en tiendas de USA y recibir sus paquetes en Colombia.

SOBRE EL SERVICIO:
- El cliente compra en USA (Amazon, Nike, etc.) y usa nuestra dirección en USA como destino
- Nosotros recibimos el paquete, lo pesamos, tomamos fotos y lo enviamos a Colombia
- El costo es por libra y varía según la categoría del producto
- Tenemos bodegas en Medellín (principal), Bogotá y Barranquilla

TONO Y ESTILO:
- Cercano y amigable, como un buen servicio al cliente colombiano
- Respuestas CORTAS — máximo 3-4 líneas por mensaje (esto es WhatsApp)
- Usa emojis con moderación (1-2 por mensaje)
- Habla en español colombiano natural
- Usa *negrita* para datos importantes (estado, costo, peso)

CAPACIDADES:
- Consultar estado y detalles de paquetes activos del cliente
- Informar costos, pesos y fechas
- Confirmar que el cliente quiere procesar un envío
- Cotizar el servicio a clientes nuevos
- Registrar nuevos clientes que quieren usar el servicio
- Escalar a un agente humano cuando el caso lo requiere

CUÁNDO ESCALAR A HUMANO (accion: "escalar"):
- El cliente reporta que su paquete llegó dañado
- El cliente quiere negociar tarifas o pedir descuento especial  
- El cliente tiene un problema con un pago o factura
- El cliente está molesto o insiste en hablar con una persona
- Cualquier situación que requiera autorización o criterio de negocio

CUÁNDO REGISTRAR CLIENTE NUEVO (accion: "registrar_cliente"):
- El cliente nuevo confirmó que quiere usar el servicio
- Ya tienes nombre, ciudad (medellin/bogota/barranquilla) y teléfono
- El email es opcional

CUÁNDO CONFIRMAR ENVÍO (accion: "confirmar_envio"):
- El cliente responde afirmativamente a la pregunta de procesamiento
- Tienes claro qué paquete (paquete_id) está confirmando

FORMATO DE RESPUESTA — DEBES retornar ÚNICAMENTE JSON válido:
{
  "respuesta": "texto que se enviará al cliente por WhatsApp",
  "accion": "ninguna | registrar_cliente | confirmar_envio | escalar",
  "datos_accion": {
    // Para registrar_cliente: { "nombre": "...", "ciudad": "medellin|bogota|barranquilla", "telefono": "...", "email": "..." }
    // Para confirmar_envio: { "paquete_id": "uuid-del-paquete" }
    // Para escalar: { "motivo": "...", "kommo_contact_id": number }
    // Para ninguna: {}
  }
}`

/**
 * Llama a Claude API con el mensaje del cliente y el contexto de Supabase.
 * Retorna la respuesta estructurada con texto y acción a ejecutar.
 */
export async function runAgent(
  mensajeCliente: string,
  contexto: string
): Promise<AgentResponse> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
  })

  const message = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `CONTEXTO ACTUAL:\n${contexto}\n\nMENSAJE DEL CLIENTE: ${mensajeCliente}`,
      },
    ],
  })

  const rawText = message.content[0].type === 'text' ? message.content[0].text : ''

  try {
    // Claude puede envolver el JSON en ```json ... ```, lo limpiamos
    const cleaned = rawText.replace(/```json\n?|\n?```/g, '').trim()
    const parsed = JSON.parse(cleaned) as AgentResponse
    return parsed
  } catch {
    // Si Claude no retorna JSON válido, respuesta de fallback
    return {
      respuesta: rawText || 'Perdona, tuve un problema técnico. ¿Puedes repetir tu mensaje? 🙏',
      accion: 'ninguna',
      datos_accion: {},
    }
  }
}
```

- [ ] **Step 4: Correr el test — verificar que pasa**

```bash
npx vitest run src/__tests__/whatsapp/agent.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/whatsapp/agent.ts src/__tests__/whatsapp/agent.test.ts
git commit -m "feat: add Claude AI agent with CeladaShopper system prompt"
```

---

## Task 8: Action Executor

**Files:**
- Create: `src/lib/whatsapp/action-executor.ts`
- Create: `src/__tests__/whatsapp/action-executor.test.ts`

- [ ] **Step 1: Escribir el test primero**

Crear `src/__tests__/whatsapp/action-executor.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { executeAction } from '../../lib/whatsapp/action-executor'
import type { AgentResponse } from '../../types'

vi.mock('../../lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({ error: null }),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ error: null }),
  }),
}))

vi.mock('../../lib/kommo/client', () => ({
  escalateToHuman: vi.fn().mockResolvedValue(undefined),
}))

describe('executeAction', () => {
  it('no hace nada para accion ninguna', async () => {
    const response: AgentResponse = {
      respuesta: 'Tu paquete está en USA.',
      accion: 'ninguna',
      datos_accion: {},
    }
    // No debe lanzar error
    await expect(executeAction(response, '+573001234567', 'chat-123', 123)).resolves.toBeUndefined()
  })

  it('llama escalateToHuman para accion escalar', async () => {
    const { escalateToHuman } = await import('../../lib/kommo/client')
    const response: AgentResponse = {
      respuesta: 'Te conecto con el equipo.',
      accion: 'escalar',
      datos_accion: { motivo: 'paquete dañado', kommo_contact_id: 456 },
    }
    await executeAction(response, '+573001234567', 'chat-123', 456)
    expect(escalateToHuman).toHaveBeenCalledWith(456, 'chat-123', 'paquete dañado')
  })
})
```

- [ ] **Step 2: Correr el test — verificar que falla**

```bash
npx vitest run src/__tests__/whatsapp/action-executor.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implementar action-executor.ts**

Crear `src/lib/whatsapp/action-executor.ts`:

```typescript
// src/lib/whatsapp/action-executor.ts
// Ejecuta las acciones decididas por el agente Claude

import { createClient } from '../supabase/server'
import { escalateToHuman } from '../kommo/client'
import type {
  AgentResponse,
  RegistrarClienteData,
  ConfirmarEnvioData,
  EscalarData,
} from '@/types'

/**
 * Ejecuta la acción retornada por Claude.
 * Las acciones modifican Supabase y/o Kommo según corresponda.
 */
export async function executeAction(
  response: AgentResponse,
  telefono: string,
  chatId: string,
  kommoContactId: number
): Promise<void> {
  const { accion, datos_accion } = response

  switch (accion) {
    case 'ninguna':
      return

    case 'registrar_cliente': {
      const datos = datos_accion as RegistrarClienteData
      const supabase = await createClient()

      // Generar número de casilla: CS-XXXX
      const numero_casilla = `CS-${Date.now().toString().slice(-4)}`

      await supabase.from('perfiles').insert({
        nombre_completo: datos.nombre,
        email: datos.email || `wa_${telefono.replace('+', '')}@celadashopper.com`,
        telefono,
        whatsapp: telefono,
        ciudad: datos.ciudad,
        numero_casilla,
        rol: 'cliente',
        activo: true,
      })
      break
    }

    case 'confirmar_envio': {
      const datos = datos_accion as ConfirmarEnvioData
      const supabase = await createClient()

      await supabase
        .from('paquetes')
        .update({ estado: 'listo_envio', updated_at: new Date().toISOString() })
        .eq('id', datos.paquete_id)
      break
    }

    case 'escalar': {
      const datos = datos_accion as EscalarData
      await escalateToHuman(
        datos.kommo_contact_id || kommoContactId,
        chatId,
        datos.motivo
      )
      break
    }
  }
}
```

- [ ] **Step 4: Correr el test — verificar que pasa**

```bash
npx vitest run src/__tests__/whatsapp/action-executor.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/whatsapp/action-executor.ts src/__tests__/whatsapp/action-executor.test.ts
git commit -m "feat: add action executor for WhatsApp agent"
```

---

## Task 9: Webhook Receiver (Next.js API Route)

**Files:**
- Create: `src/app/api/whatsapp/webhook/route.ts`

- [ ] **Step 1: Crear el webhook receiver**

Crear `src/app/api/whatsapp/webhook/route.ts`:

```typescript
// src/app/api/whatsapp/webhook/route.ts
// Recibe webhooks de Kommo CRM, verifica la firma y delega a Edge Function

import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature } from '@/lib/kommo/client'
import type { KommoWebhookPayload } from '@/types'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-kommo-signature')
  const secret = process.env.KOMMO_WEBHOOK_SECRET!

  // 1. Verificar firma HMAC (seguridad)
  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    console.error('Webhook signature verification failed')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: KommoWebhookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // 2. Solo procesar mensajes entrantes de clientes
  const mensajesEntrantes = payload.message?.add?.filter(
    (m) => m.author_type === 'contact'
  )

  if (!mensajesEntrantes || mensajesEntrantes.length === 0) {
    return NextResponse.json({ ok: true })
  }

  // 3. Responder 200 INMEDIATAMENTE a Kommo (< 5 segundos requerido)
  // Disparar procesamiento asíncrono en Supabase Edge Function
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  // Fire-and-forget: no esperamos la respuesta
  fetch(`${supabaseUrl}/functions/v1/process-whatsapp`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mensaje: mensajesEntrantes[0],
      account: payload.account,
    }),
  }).catch((err) => console.error('Edge Function call failed:', err))

  return NextResponse.json({ ok: true })
}

// GET para verificación del webhook en Kommo (la primera vez que configuras)
export async function GET(req: NextRequest) {
  const challenge = req.nextUrl.searchParams.get('hub.challenge')
  if (challenge) return new NextResponse(challenge)
  return NextResponse.json({ status: 'WhatsApp webhook active' })
}
```

- [ ] **Step 2: Probar el endpoint manualmente**

```bash
cd "C:\Users\pc1\cloudea\carpeta CODE\celadashopper-portal"
npm run dev
```

En otra terminal:
```bash
curl -X GET http://localhost:3000/api/whatsapp/webhook
```

Expected: `{"status":"WhatsApp webhook active"}`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/whatsapp/webhook/route.ts
git commit -m "feat: add Kommo webhook receiver with HMAC verification"
```

---

## Task 10: Supabase Edge Function — Pipeline Principal

**Files:**
- Create: `supabase/functions/process-whatsapp/index.ts`

- [ ] **Step 1: Crear la Edge Function**

Crear `supabase/functions/process-whatsapp/index.ts`:

```typescript
// supabase/functions/process-whatsapp/index.ts
// Pipeline completo del agente WhatsApp
// Se ejecuta como Supabase Edge Function (Deno runtime)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const KOMMO_DOMAIN = Deno.env.get('KOMMO_DOMAIN')!
const KOMMO_API_TOKEN = Deno.env.get('KOMMO_API_TOKEN')!

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const { mensaje, account } = await req.json()
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // 1. Obtener teléfono del contacto desde Kommo
  const contactRes = await fetch(
    `https://${KOMMO_DOMAIN}.kommo.com/api/v4/contacts/${mensaje.contact_id}`,
    { headers: { Authorization: `Bearer ${KOMMO_API_TOKEN}` } }
  )
  const contactData = await contactRes.json()
  const phoneField = contactData.custom_fields_values?.find(
    (f: { field_code: string }) => f.field_code === 'PHONE'
  )
  const rawPhone: string = phoneField?.values?.[0]?.value || ''

  if (!rawPhone) {
    console.error('No phone found for contact', mensaje.contact_id)
    return new Response('No phone', { status: 400 })
  }

  // Normalizar teléfono
  const digits = rawPhone.replace(/\D/g, '')
  const telefono = digits.startsWith('57') ? `+${digits}` : `+57${digits}`

  // 2. Resolver cliente en Supabase
  const { data: perfiles } = await supabase
    .from('perfiles')
    .select(`*, paquetes(*, fotos_paquetes(*))`)
    .or(`whatsapp.eq.${telefono},telefono.eq.${telefono}`)
    .eq('activo', true)
    .limit(1)

  const clienteExiste = perfiles && perfiles.length > 0
  const perfil = clienteExiste ? perfiles[0] : null

  const { data: tarifas } = await supabase
    .from('categorias_tarifas')
    .select('*')
    .eq('activo', true)

  // 3. Cargar historial de conversación (últimos 10 mensajes)
  const { data: historial } = await supabase
    .from('conversaciones_whatsapp')
    .select('*')
    .eq('telefono', telefono)
    .order('created_at', { ascending: false })
    .limit(10)

  const historialOrdenado = (historial || []).reverse()

  // 4. Construir contexto para Claude
  let contexto = `FECHA Y HORA COLOMBIA: ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}\n\n`

  if (!perfil) {
    contexto += 'TIPO DE CLIENTE: CLIENTE NUEVO (no registrado)\nINSTRUCCIÓN: Saluda, explica el servicio y recopila datos si está interesado.'
  } else {
    const paquetesActivos = (perfil.paquetes || []).filter(
      (p: { estado: string }) => !['entregado', 'devuelto'].includes(p.estado)
    )
    contexto += `CLIENTE:\n  Nombre: ${perfil.nombre_completo}\n  Casilla: ${perfil.numero_casilla}\n  Ciudad: ${perfil.ciudad}\n\n`
    contexto += `PAQUETES ACTIVOS (${paquetesActivos.length}):\n`
    paquetesActivos.forEach((p: {
      tracking_casilla: string; descripcion: string; tienda: string;
      estado: string; peso_facturable: number; costo_servicio: number;
      factura_pagada: boolean; id: string; fotos_paquetes: Array<{ url: string }>
    }) => {
      const fotos = p.fotos_paquetes?.map((f) => f.url).join(', ') || 'Sin fotos'
      contexto += `  - ${p.tracking_casilla}: ${p.descripcion} (${p.tienda}) — ${p.estado} — ${p.peso_facturable}lbs — $${p.costo_servicio} — Fotos: ${fotos} — ID: ${p.id}\n`
    })
    contexto += `\nTARIFAS:\n`
    ;(tarifas || []).forEach((t: { nombre_display: string; tarifa_por_libra: number }) => {
      contexto += `  ${t.nombre_display}: $${t.tarifa_por_libra}/lb\n`
    })
  }

  if (historialOrdenado.length > 0) {
    contexto += '\nHISTORIAL:\n'
    historialOrdenado.forEach((m: { rol: string; mensaje: string }) => {
      contexto += `  [${m.rol.toUpperCase()}]: ${m.mensaje}\n`
    })
  }

  // 5. Llamar Claude API
  const SYSTEM_PROMPT = `Eres el asistente virtual de CeladaShopper, servicio de casillero USA→Colombia.
Respuestas CORTAS (máximo 3-4 líneas), WhatsApp-friendly, emojis moderados, español colombiano.
SIEMPRE responde con JSON válido: {"respuesta": "...", "accion": "ninguna|registrar_cliente|confirmar_envio|escalar", "datos_accion": {}}
Escala cuando: paquete dañado, negociación de precios, problemas de pago, cliente molesto.`

  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `CONTEXTO:\n${contexto}\n\nMENSAJE DEL CLIENTE: ${mensaje.text || '[mensaje no-texto]'}`,
      }],
    }),
  })

  const claudeData = await claudeRes.json()
  const rawText: string = claudeData.content?.[0]?.text || ''

  let agentResponse = { respuesta: rawText, accion: 'ninguna', datos_accion: {} }
  try {
    const cleaned = rawText.replace(/```json\n?|\n?```/g, '').trim()
    agentResponse = JSON.parse(cleaned)
  } catch {
    agentResponse.respuesta = rawText || 'Perdona, tuve un problema técnico. ¿Puedes repetir? 🙏'
  }

  // 6. Ejecutar acción
  if (agentResponse.accion === 'registrar_cliente') {
    const d = agentResponse.datos_accion as { nombre: string; ciudad: string; email?: string }
    await supabase.from('perfiles').insert({
      nombre_completo: d.nombre,
      email: d.email || `wa_${telefono.replace('+', '')}@celadashopper.com`,
      telefono,
      whatsapp: telefono,
      ciudad: d.ciudad,
      numero_casilla: `CS-${Date.now().toString().slice(-4)}`,
      rol: 'cliente',
      activo: true,
    })
  } else if (agentResponse.accion === 'confirmar_envio') {
    const d = agentResponse.datos_accion as { paquete_id: string }
    await supabase
      .from('paquetes')
      .update({ estado: 'listo_envio', updated_at: new Date().toISOString() })
      .eq('id', d.paquete_id)
  } else if (agentResponse.accion === 'escalar') {
    const d = agentResponse.datos_accion as { motivo: string; kommo_contact_id?: number }
    const contactId = d.kommo_contact_id || mensaje.contact_id
    // Agregar nota en Kommo
    await fetch(`https://${KOMMO_DOMAIN}.kommo.com/api/v4/contacts/${contactId}/notes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KOMMO_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ note_type: 'common', params: { text: `🤖 Escalada IA: ${d.motivo}` } }),
    })
  }

  // 7. Guardar en historial
  await supabase.from('conversaciones_whatsapp').insert([
    { telefono, cliente_id: perfil?.id || null, rol: 'cliente', mensaje: mensaje.text || '[no-texto]' },
    { telefono, cliente_id: perfil?.id || null, rol: 'agente', mensaje: agentResponse.respuesta, accion_ejecutada: agentResponse.accion, escalada: agentResponse.accion === 'escalar' },
  ])

  // 8. Enviar respuesta por Kommo
  await fetch(`https://${KOMMO_DOMAIN}.kommo.com/api/v4/chats/${mensaje.chat_id}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KOMMO_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'text', text: agentResponse.respuesta }),
  })

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

- [ ] **Step 2: Configurar variables de entorno en Supabase**

En Supabase Dashboard → Settings → Edge Functions → Secrets, agregar:
```
ANTHROPIC_API_KEY = sk-ant-...
KOMMO_DOMAIN = celadashopper
KOMMO_API_TOKEN = ...
```

- [ ] **Step 3: Deploy de la Edge Function**

```bash
cd "C:\Users\pc1\cloudea\carpeta CODE\celadashopper-portal"
npx supabase functions deploy process-whatsapp --project-ref <tu-project-ref>
```

El `project-ref` está en Supabase Dashboard → Settings → General.

Expected: "Deployed successfully"

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/process-whatsapp/index.ts
git commit -m "feat: add process-whatsapp Supabase Edge Function"
```

---

## Task 11: Edge Function — Notificaciones Proactivas

**Files:**
- Create: `supabase/functions/notify-whatsapp/index.ts`

- [ ] **Step 1: Crear la Edge Function de notificaciones**

Crear `supabase/functions/notify-whatsapp/index.ts`:

```typescript
// supabase/functions/notify-whatsapp/index.ts
// Envía notificaciones proactivas a clientes cuando cambia el estado de su paquete
// Invocada por un Database Webhook de Supabase

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const KOMMO_DOMAIN = Deno.env.get('KOMMO_DOMAIN')!
const KOMMO_API_TOKEN = Deno.env.get('KOMMO_API_TOKEN')!

const EVENTO_MAP: Record<string, string> = {
  recibido_usa: 'paquete_recibido_usa',
  en_transito: 'paquete_en_transito',
  en_bodega_local: 'paquete_listo_recoger',
}

Deno.serve(async (req) => {
  const { record, old_record } = await req.json()

  // Solo notificar si realmente cambió el estado
  if (record.estado === old_record?.estado) {
    return new Response('No state change', { status: 200 })
  }

  const eventoKey = EVENTO_MAP[record.estado]
  if (!eventoKey) {
    return new Response('No notification for this state', { status: 200 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Obtener datos del cliente y plantilla
  const [{ data: perfil }, { data: plantilla }, { data: fotos }] = await Promise.all([
    supabase.from('perfiles').select('nombre_completo, whatsapp, telefono').eq('id', record.cliente_id).single(),
    supabase.from('plantillas_notificacion').select('texto_plantilla').eq('evento', eventoKey).eq('activa', true).single(),
    supabase.from('fotos_paquetes').select('url').eq('paquete_id', record.id).limit(1),
  ])

  if (!perfil || !plantilla) return new Response('Missing data', { status: 400 })

  const telefono: string = perfil.whatsapp || perfil.telefono
  if (!telefono) return new Response('No phone', { status: 400 })

  // Interpolar variables en la plantilla
  const texto = plantilla.texto_plantilla
    .replace('{{nombre}}', perfil.nombre_completo)
    .replace('{{descripcion}}', record.descripcion)
    .replace('{{peso}}', record.peso_facturable?.toString() || '?')
    .replace('{{costo}}', record.costo_servicio?.toLocaleString('es-CO') || '?')
    .replace('{{bodega}}', record.bodega_destino)

  // Buscar el chat en Kommo por número de teléfono
  const chatsRes = await fetch(
    `https://${KOMMO_DOMAIN}.kommo.com/api/v4/chats?contact_phone=${encodeURIComponent(telefono)}`,
    { headers: { Authorization: `Bearer ${KOMMO_API_TOKEN}` } }
  )
  const chatsData = await chatsRes.json()
  const chatId: string | undefined = chatsData?._embedded?.chats?.[0]?.id

  if (!chatId) {
    console.error('No chat found for phone:', telefono)
    return new Response('No chat found', { status: 404 })
  }

  // Enviar mensaje de texto
  await fetch(`https://${KOMMO_DOMAIN}.kommo.com/api/v4/chats/${chatId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KOMMO_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'text', text: texto }),
  })

  // Enviar foto si existe y es notificación de recepción
  if (eventoKey === 'paquete_recibido_usa' && fotos && fotos.length > 0) {
    await fetch(`https://${KOMMO_DOMAIN}.kommo.com/api/v4/chats/${chatId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KOMMO_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'picture', media: { url: fotos[0].url } }),
    })
  }

  // Marcar como notificado en la tabla fotos_paquetes
  await supabase
    .from('notificaciones')
    .insert({
      cliente_id: record.cliente_id,
      paquete_id: record.id,
      tipo: 'estado',
      titulo: `Paquete ${record.estado}`,
      mensaje: texto,
      enviada_whatsapp: true,
    })

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

- [ ] **Step 2: Configurar Database Webhook en Supabase**

Ir a Supabase Dashboard → Database → Webhooks → Create webhook:
- **Name:** `on_paquete_estado_change`
- **Table:** `paquetes`
- **Events:** `UPDATE`
- **URL:** `https://<tu-project-ref>.supabase.co/functions/v1/notify-whatsapp`
- **HTTP Headers:** `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`

- [ ] **Step 3: Deploy de la Edge Function**

```bash
npx supabase functions deploy notify-whatsapp --project-ref <tu-project-ref>
```

Expected: "Deployed successfully"

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/notify-whatsapp/index.ts
git commit -m "feat: add notify-whatsapp Edge Function for proactive notifications"
```

---

## Task 12: Configurar Webhook en Kommo y Probar E2E

**Files:** Ninguno — configuración en dashboard de Kommo

- [ ] **Step 1: Deploy del portal a Vercel (si no está)**

```bash
cd "C:\Users\pc1\cloudea\carpeta CODE\celadashopper-portal"
npx vercel --prod
```

Anotar la URL resultante: `https://celadashopper-portal.vercel.app`

- [ ] **Step 2: Registrar webhook en Kommo**

Ir a Kommo → Configuración → Integraciones → Webhooks → Agregar:
- **URL:** `https://celadashopper-portal.vercel.app/api/whatsapp/webhook`
- **Eventos:** Marcar "Nuevo mensaje entrante"
- **Secret:** El mismo valor que pusiste en `KOMMO_WEBHOOK_SECRET`

- [ ] **Step 3: Prueba E2E — cliente existente**

Desde un número de WhatsApp registrado en tu sistema, enviar:
> "Hola, ¿dónde está mi paquete?"

Expected:
- El agente responde en menos de 10 segundos
- La respuesta menciona el nombre del cliente y el estado del paquete
- En Supabase: aparece una fila en `conversaciones_whatsapp`

- [ ] **Step 4: Prueba E2E — cliente nuevo**

Desde un número NO registrado, enviar:
> "Hola, quiero saber cómo funciona el servicio"

Expected:
- El agente explica el servicio
- Da tarifas por categoría
- No crea ningún registro aún (solo cuando confirme interés)

- [ ] **Step 5: Prueba escalada**

Enviar:
> "Mi paquete llegó dañado, quiero hablar con alguien"

Expected:
- El agente responde que conectará con el equipo
- En Kommo: aparece una nota en el contacto con el motivo
- La conversación queda sin agente asignado para que un humano la tome

- [ ] **Step 6: Prueba notificación proactiva**

En Supabase SQL Editor, cambiar el estado de un paquete de prueba:
```sql
UPDATE paquetes
SET estado = 'recibido_usa'
WHERE id = '<uuid-de-paquete-de-prueba>';
```

Expected:
- El cliente recibe un WhatsApp automático en menos de 30 segundos
- Si había fotos subidas, llega la foto también

- [ ] **Step 7: Commit final**

```bash
git add .
git commit -m "feat: WhatsApp AI agent complete - reactive + proactive flows"
```

---

## Self-Review del Plan

### Cobertura del spec:
- ✅ Webhook Receiver con verificación HMAC
- ✅ Cliente Resolver por teléfono
- ✅ Context Builder con paquetes, fotos, historial, tarifas
- ✅ Claude Agent con system prompt de CeladaShopper
- ✅ Action Executor (registrar, confirmar, escalar)
- ✅ Kommo Sender (texto, foto, escalada)
- ✅ Tablas `conversaciones_whatsapp` y `plantillas_notificacion`
- ✅ Flujo proactivo con Supabase Database Webhook
- ✅ Manejo de errores (Claude falla, Supabase falla, Kommo falla)
- ✅ Clientes nuevos → cotización → registro
- ✅ Escalada a humano con nota de contexto en Kommo

### Consistencia de tipos:
- `AgentResponse` definido en Task 3, usado en Tasks 7, 8, 9
- `ClienteConPaquetes` definido en Task 3, usado en Tasks 5, 6
- `KommoWebhookPayload` y `KommoIncomingMessage` definidos en Task 3, usados en Task 9
- `AccionAgente` y `EventoNotificacion` consistentes en todo el plan
