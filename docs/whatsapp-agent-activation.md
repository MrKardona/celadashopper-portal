# Agente WhatsApp — Guía de Activación

Sigue estos pasos en orden para activar el agente en producción.

---

## Paso 1: Credenciales en .env.local

Edita `.env.local` y rellena los valores reales:

| Variable | Dónde obtenerla |
|---|---|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API Keys |
| `KOMMO_DOMAIN` | Tu subdominio de Kommo (ej: `celadashopper`) |
| `KOMMO_API_TOKEN` | Kommo → Configuración → Integraciones → API |
| `KOMMO_WEBHOOK_SECRET` | Invéntalo tú (ej: `wh_celada_2026_secret`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → service_role |

---

## Paso 2: Ejecutar migración en Supabase

1. Ir a Supabase Dashboard → SQL Editor
2. Copiar y pegar el contenido de `supabase/migrations/20260426_whatsapp.sql`
3. Ejecutar — debe decir "Success. No rows returned"
4. Verificar: `SELECT table_name FROM information_schema.tables WHERE table_name IN ('conversaciones_whatsapp', 'plantillas_notificacion');` → debe retornar 2 filas

---

## Paso 3: Configurar secretos en Supabase Edge Functions

Supabase Dashboard → Settings → Edge Functions → Secrets:

```
ANTHROPIC_API_KEY = sk-ant-...
KOMMO_DOMAIN = celadashopper
KOMMO_API_TOKEN = ...
KOMMO_WEBHOOK_SECRET = ...
```

(SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya están disponibles automáticamente en Edge Functions)

---

## Paso 4: Deploy a Vercel

```bash
npx vercel --prod
```

Anota la URL: `https://celadashopper-portal.vercel.app` (o la que asigne Vercel)

---

## Paso 5: Deploy Edge Functions a Supabase

```bash
# El project-ref está en Supabase Dashboard → Settings → General
npx supabase functions deploy process-whatsapp --project-ref <tu-project-ref>
npx supabase functions deploy notify-whatsapp --project-ref <tu-project-ref>
```

---

## Paso 6: Registrar webhook en Kommo

1. Kommo → Configuración → Integraciones → Webhooks → Agregar
2. URL: `https://celadashopper-portal.vercel.app/api/whatsapp/webhook`
3. Eventos: marcar **"Nuevo mensaje entrante"**
4. Secret: el mismo valor de `KOMMO_WEBHOOK_SECRET`
5. Guardar

---

## Paso 7: Configurar Database Webhook en Supabase

Supabase Dashboard → Database → Webhooks → Create webhook:

| Campo | Valor |
|---|---|
| Name | `on_paquete_estado_change` |
| Table | `paquetes` |
| Events | `UPDATE` |
| URL | `https://<project-ref>.supabase.co/functions/v1/notify-whatsapp` |
| Authorization header | `Bearer <SUPABASE_SERVICE_ROLE_KEY>` |

---

## Paso 8: Pruebas E2E

### Prueba 1 — Cliente existente
Desde un número registrado en Supabase, enviar por WhatsApp:
> "Hola, ¿dónde está mi paquete?"

✅ Esperado: respuesta en <10s mencionando nombre del cliente y estado del paquete

### Prueba 2 — Cliente nuevo
Desde un número NO registrado:
> "Hola, quiero saber cómo funciona el servicio"

✅ Esperado: el agente explica el servicio y pregunta si quiere registrarse

### Prueba 3 — Escalada
> "Mi paquete llegó dañado, quiero hablar con alguien"

✅ Esperado: agente responde que conectará con el equipo + nota aparece en Kommo

### Prueba 4 — Notificación proactiva
En Supabase SQL Editor:
```sql
UPDATE paquetes SET estado = 'recibido_usa' WHERE id = '<uuid-de-prueba>';
```

✅ Esperado: WhatsApp automático al cliente en <30s

---

## Arquitectura desplegada

```
Cliente WhatsApp
      ↓
Kommo CRM (webhook firmado HMAC)
      ↓
Next.js /api/whatsapp/webhook (Vercel)
      ↓ fire-and-forget
Supabase Edge Function: process-whatsapp
      ↓
Claude API → decisión + texto
      ↓
Supabase (guardar historial) + Kommo (enviar respuesta)

── Flujo proactivo ──────────────────────
Agente USA actualiza estado en portal
      ↓
Supabase Database Webhook
      ↓
Edge Function: notify-whatsapp
      ↓
Kommo → WhatsApp al cliente
```
