# Diseño: Agente IA WhatsApp — CeladaShopper
**Fecha:** 2026-04-26
**Estado:** Aprobado
**Versión:** 1.0

---

## Contexto

CeladaShopper es un servicio de casillero USA→Colombia con ~50 clientes activos y 100+ paquetes/semana. El objetivo es reemplazar la comunicación manual con clientes por un **Agente IA en WhatsApp** que opere 24/7, reduzca fricción y automatice las operaciones del negocio.

**Decisión estratégica:** El canal principal del cliente es WhatsApp. El portal web (Módulo 1) queda como respaldo. El portal operativo (Módulo 2 — agente USA) se mantiene activo para operaciones internas.

---

## Arquitectura

### Flujo Reactivo (cliente escribe primero)

```
Cliente escribe en WhatsApp
        ↓
Kommo CRM recibe mensaje
        ↓
Webhook (firmado HMAC) → Next.js /api/whatsapp/webhook
        ↓
┌─────────────────────────────────┐
│  1. Verificar firma Kommo        │
│  2. Resolver cliente (teléfono) │
│  3. Cargar contexto Supabase    │
│  4. Claude API → decisión+texto │
│  5. Ejecutar acción             │
│  6. Guardar en historial        │
│  7. Kommo API → respuesta WA    │
└─────────────────────────────────┘
```

### Flujo Proactivo (notificaciones automáticas)

```
Agente USA cambia estado de paquete en portal
        ↓
Supabase Database Trigger
        ↓
Supabase Edge Function
        ↓
Kommo Broadcasts API (plantilla pre-aprobada Meta)
        ↓
WhatsApp al cliente
```

### Flujo de Escalada

```
Claude detecta caso complejo (queja, negociación, problema)
        ↓
Kommo API → reasignar conversación a agente humano
        ↓
Mensaje al cliente: "Te conecto con nuestro equipo 🙏"
        ↓
Agente humano ve contexto completo en Kommo
```

---

## Componentes

### 1. Webhook Receiver
- **Ruta:** `POST /api/whatsapp/webhook`
- **Responsabilidad:** Recibir eventos de Kommo, verificar firma HMAC, responder 200 inmediatamente, delegar procesamiento a Supabase Edge Function (evita timeout de Vercel serverless ~10s)
- **Tipos de mensaje soportados:** texto, imagen, audio (audio → pide texto)
- **Prerequisito deploy:** Configurar URL del webhook en Kommo → Configuración → Integraciones

### 2. Cliente Resolver
- Busca cliente en Supabase por número de teléfono (`+57XXXXXXXXXX`)
- **Existe:** carga perfil + paquetes activos
- **No existe:** inicia flujo de cotización para cliente nuevo

### 3. Context Builder
Arma el contexto que recibe Claude:
- Datos del cliente (nombre, ciudad, saldo pendiente)
- Paquetes activos (estado, peso, costo, URLs de fotos en Supabase Storage)
- Últimos 10 mensajes de la conversación
- Tarifas vigentes por categoría de producto
- Fecha y hora actual (zona Colombia)

### 4. Claude Agent
**System prompt incluye:**
- Identidad: quién es CeladaShopper, cómo funciona el servicio
- Tono: cercano, profesional, emojis moderados, respuestas cortas (WhatsApp-friendly)
- Capacidades: consultar paquetes, cotizar, registrar clientes nuevos, confirmar envíos
- Reglas de escalada: quejas serias, negociaciones de precio, problemas con pagos

**Retorna JSON estructurado:**
```json
{
  "respuesta": "texto para enviar al cliente",
  "accion": "ninguna | registrar_cliente | confirmar_envio | escalar",
  "datos_accion": {}
}
```

### 5. Action Executor

| Acción | Qué hace |
|---|---|
| `ninguna` | Solo envía la respuesta |
| `registrar_cliente` | Crea cliente en Supabase + contacto en Kommo |
| `confirmar_envio` | Actualiza estado del paquete en Supabase |
| `escalar` | Reasigna conversación en Kommo + nota de contexto para el agente |

### 6. Kommo Sender
- Enviar texto → Kommo Chats API
- Enviar foto → Kommo Chats API (URL pública de Supabase Storage)
- Escalar → Kommo CRM API (reasignar conversación)
- Notificaciones proactivas → Kommo Broadcasts API (plantillas)

---

## Base de Datos — Tablas Nuevas

```sql
-- Historial de conversaciones por cliente
CREATE TABLE conversaciones_whatsapp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES clientes(id),
  telefono VARCHAR(20) NOT NULL,
  rol VARCHAR(10) NOT NULL CHECK (rol IN ('cliente', 'agente', 'sistema')),
  mensaje TEXT NOT NULL,
  accion_ejecutada VARCHAR(50),
  escalada BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plantillas de notificación proactiva
CREATE TABLE plantillas_notificacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento VARCHAR(50) NOT NULL UNIQUE,
  -- eventos: paquete_recibido_usa, paquete_en_transito, paquete_listo_recoger
  texto_plantilla TEXT NOT NULL,
  activa BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Eventos que Disparan Notificación Proactiva

| Evento | Mensaje al cliente |
|---|---|
| Paquete recibido en USA | "📦 Tu paquete [nombre] llegó a nuestra bodega. Peso: X lbs. Costo: $X. [foto]" |
| Paquete en tránsito Colombia | "✈️ Tu paquete [nombre] ya viene en camino a Colombia." |
| Paquete listo para recoger | "🎉 Tu paquete [nombre] está listo en bodega [ciudad]. ¿Cuándo lo recoges?" |

---

## Manejo de Errores

| Fallo | Comportamiento |
|---|---|
| Claude API falla | Respuesta genérica + alerta interna al equipo |
| Supabase falla | "Tenemos un problema técnico, te contactamos en 5 min 🙏" |
| Kommo API falla | Reintento x3 con backoff exponencial (1s, 3s, 9s) |
| Mensaje no-texto (audio, sticker) | "Por favor escríbeme en texto 😊" |
| Cliente no identificado | Inicia flujo de cliente nuevo |

---

## Capacidades del Agente

### Para clientes existentes
- Consultar estado de cualquier paquete
- Ver fotos del paquete recibido
- Conocer el costo y peso
- Confirmar procesamiento de envío
- Consultar historial de paquetes anteriores
- Cambiar información de contacto

### Para clientes nuevos
- Explicar el servicio de casillero
- Dar tarifas por categoría de producto
- Registrar datos del cliente interesado
- Crear cuenta y asignar casillero USA

### Escalada automática a humano
- Quejas o reclamos sobre daños
- Negociación de tarifas o descuentos
- Problemas con pagos o facturas
- Cualquier solicitud que Claude marque como compleja

---

## Integraciones Futuras (no en este sprint)

### USACO API (courier USA)
El courier ya proporcionó documentación de API. Cuando se integre:
```
Paquete llega a bodega USA
  → USACO detecta automáticamente vía API
  → Webhook → Supabase (sin intervención manual del agente)
  → Trigger → Notificación WhatsApp al cliente
```
Resultado: el agente USA solo pesa y sube fotos. El registro de llegada es automático.

---

## Lo que NO cambia

- **Módulo 2 (Panel Agente USA):** Se mantiene igual. El agente USA sigue usando el portal para escanear, pesar y subir fotos.
- **Módulo Admin:** Se construye en la siguiente oleada como herramienta interna.
- **Supabase** como única fuente de verdad para todos los módulos.

---

## Stack Técnico

| Componente | Tecnología |
|---|---|
| Webhook receiver | Next.js API Routes |
| Base de datos | Supabase (PostgreSQL) |
| Notificaciones trigger | Supabase Edge Functions |
| Inteligencia artificial | Claude API (Anthropic) |
| Gateway WhatsApp | Kommo CRM (Plan Avanzado) |
| Storage fotos | Supabase Storage |
| Deploy | Vercel |
