# Agente WhatsApp — Estado y Guía de Activación

Última actualización: 2026-04-26

---

## Estado actual del pipeline

| Paso | Estado | Detalle |
|---|---|---|
| Kommo webhook recibe mensajes | ✅ ACTIVO | Webhook ID 47241388, URL Vercel |
| Next.js parsea form-encoded | ✅ ARREGLADO | Bug índice numérico resuelto |
| `after()` garantiza fetch en serverless | ✅ ARREGLADO | No se cancela al retornar 200 |
| Edge Function responde (no 401) | ✅ ARREGLADO | Redeployada con --no-verify-jwt |
| Claude genera respuesta | ✅ FUNCIONANDO | ~5s de latencia |
| Historial guardado en Supabase | ✅ FUNCIONANDO | tabla conversaciones_whatsapp |
| Respuesta llega al WhatsApp del cliente | ⏳ PENDIENTE | Ver sección abajo |

---

## El único paso pendiente: enviar la respuesta al cliente

### Opción A — Obtener channel secret de Kommo (RECOMENDADO)

1. Kommo → **Ajustes** → **Integración** → **WhatsApp Business**
2. Clic en **Cuentas**
3. Busca el campo **"Secret"** o **"Channel Secret"** del número activo
4. Copia ese valor
5. En Supabase Dashboard → Settings → Edge Functions → Secrets → agregar:
   ```
   KOMMO_AMOJO_SECRET = <el secret que copiaste>
   ```
6. Redeplegar:
   ```bash
   npx supabase functions deploy process-whatsapp --project-ref igijeqhyppvpennjdkiu --no-verify-jwt
   ```

### Opción B — Nuevo token Kommo con scope `chats`

El token actual solo tiene: `crm, files, notifications, push_notifications, files_delete`

Para generar uno con `chats`:
1. Kommo → Ajustes → Integración → API → Crear nueva integración OAuth2
2. Marcar scope **"Chats"** además de los anteriores
3. Reemplazar `KOMMO_API_TOKEN` en Supabase Edge Function Secrets

### Fallback activo mientras tanto

Si ninguna de las opciones anteriores está configurada, el bot **sí genera la respuesta** pero la guarda como nota interna en el lead de Kommo (`🤖 BOT RESPONDERÍA: ...`). El agente humano puede verla y responder manualmente.

---

## Arquitectura desplegada

```
Cliente WhatsApp
      ↓
Kommo CRM (webhook ID 47241388, form-encoded)
      ↓
Next.js /api/whatsapp/webhook (Vercel)
  — parseFormPayload: convierte message[add][0][id] → {message:{add:[{id:...}]}}
  — after(): garantiza que el fetch no se cancele en serverless
      ↓
Supabase Edge Function: process-whatsapp (igijeqhyppvpennjdkiu, --no-verify-jwt)
  1. Obtiene teléfono del contacto via Kommo API
  2. Busca cliente en Supabase (perfiles + paquetes + fotos)
  3. Carga historial (últimas 10 conversaciones)
  4. Construye contexto para Claude
  5. Llama Claude API (claude-sonnet-4-5, max_tokens:1024)
  6. Ejecuta acción si la hay (registrar_cliente / confirmar_envio / escalar)
  7. Guarda historial en conversaciones_whatsapp
  8. Envía respuesta (amojo → chats → nota fallback)
      ↓
Claude API → respuesta en JSON {respuesta, accion, datos_accion}
      ↓
Kommo → WhatsApp al cliente (cuando KOMMO_AMOJO_SECRET esté configurado)

── Flujo proactivo ──────────────────────
Agente USA actualiza estado en portal
      ↓
Supabase Database Webhook
      ↓
Edge Function: notify-whatsapp
      ↓
Kommo → WhatsApp al cliente
```

---

## Variables de entorno necesarias

### En Vercel (ya configuradas)
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

### En Supabase Edge Function Secrets
```
ANTHROPIC_API_KEY         ✅ configurado
KOMMO_DOMAIN              ✅ configurado (celadashopper)
KOMMO_API_TOKEN           ✅ configurado
KOMMO_AMOJO_SECRET        ⏳ PENDIENTE — obtener de Kommo → WhatsApp Business → Cuentas
```

---

## Comandos útiles

```bash
# Redeplegar Edge Function
npx supabase functions deploy process-whatsapp --project-ref igijeqhyppvpennjdkiu --no-verify-jwt

# Ver logs en tiempo real
npx supabase functions logs process-whatsapp --project-ref igijeqhyppvpennjdkiu --follow

# Probar manualmente la Edge Function
curl -X POST https://igijeqhyppvpennjdkiu.supabase.co/functions/v1/process-whatsapp \
  -H "Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"mensaje":{"text":"Hola","contact_id":12345,"chat_id":"abc","entity_id":"1"}}'
```

---

## Pruebas E2E

### Prueba 1 — Pipeline completo (lo que ya funciona)
Enviar WhatsApp desde número registrado en Supabase. En logs de Supabase Edge Function debe verse:
```
[step1] Teléfono normalizado: +573XXXXXXXX
[step2] Cliente encontrado: [Nombre]
[step5] Claude status: 200
[step7] Guardando historial...
[step8] fallback note status: 201 — respuesta guardada como nota interna
```

### Prueba 2 — Verificar nota fallback en Kommo
Ir al lead del cliente en Kommo → debe aparecer nota `🤖 BOT RESPONDERÍA: [respuesta de Claude]`

### Prueba 3 — Respuesta real al cliente (después de configurar KOMMO_AMOJO_SECRET)
```
[step8] amojo send status: 200
```
Y el cliente recibe la respuesta en su WhatsApp en <10 segundos.
