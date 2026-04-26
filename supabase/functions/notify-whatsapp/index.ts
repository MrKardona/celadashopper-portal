// supabase/functions/notify-whatsapp/index.ts
// Envía notificaciones proactivas cuando cambia el estado de un paquete
// Disparada por trigger SQL en tabla paquetes via pg_net

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const KOMMO_DOMAIN = Deno.env.get('KOMMO_DOMAIN')!
const KOMMO_API_TOKEN = Deno.env.get('KOMMO_API_TOKEN')!
const KOMMO_AMOJO_SECRET = Deno.env.get('KOMMO_AMOJO_SECRET') || ''
const KOMMO_AMOJO_ID = '70e6072b-1101-422f-900b-43155b2e0e33'

const EVENTO_MAP: Record<string, string> = {
  recibido_usa: 'paquete_recibido_usa',
  en_transito: 'paquete_en_transito',
  en_bodega_local: 'paquete_listo_recoger',
}

Deno.serve(async (req) => {
  let body: { record: Record<string, unknown>; old_record: Record<string, unknown> }
  try {
    body = await req.json()
  } catch {
    return new Response('Bad JSON', { status: 400 })
  }

  const { record, old_record } = body
  console.log('[notify-whatsapp] Estado nuevo:', record.estado, '| anterior:', old_record?.estado)

  if (record.estado === old_record?.estado) {
    return new Response('No state change', { status: 200 })
  }

  const eventoKey = EVENTO_MAP[record.estado as string]
  if (!eventoKey) {
    console.log('[notify-whatsapp] Sin plantilla para estado:', record.estado)
    return new Response('No notification for this state', { status: 200 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const [{ data: perfil }, { data: plantilla }, { data: fotos }] = await Promise.all([
    supabase.from('perfiles').select('nombre_completo, whatsapp, telefono').eq('id', record.cliente_id).single(),
    supabase.from('plantillas_notificacion').select('texto_plantilla').eq('evento', eventoKey).eq('activa', true).single(),
    supabase.from('fotos_paquetes').select('url').eq('paquete_id', record.id).limit(1),
  ])

  if (!perfil || !plantilla) {
    console.error('[notify-whatsapp] Faltan datos: perfil=', !!perfil, 'plantilla=', !!plantilla)
    return new Response('Missing data', { status: 400 })
  }

  const telefono: string = (perfil.whatsapp || perfil.telefono) as string
  if (!telefono) return new Response('No phone', { status: 400 })

  const texto = (plantilla.texto_plantilla as string)
    .replace('{{nombre}}', perfil.nombre_completo as string)
    .replace('{{descripcion}}', (record.descripcion as string) || '')
    .replace('{{peso}}', (record.peso_facturable as number)?.toString() || '?')
    .replace('{{costo}}', (record.costo_servicio as number)?.toLocaleString('es-CO') || '?')
    .replace('{{bodega}}', (record.bodega_destino as string) || '')

  console.log('[notify-whatsapp] Mensaje a enviar:', texto.slice(0, 80))

  let enviado = false

  // Intento 1: amojo API con HMAC-SHA1
  if (KOMMO_AMOJO_SECRET) {
    try {
      // Primero buscar el chat_id del contacto
      const contactsRes = await fetch(
        `https://${KOMMO_DOMAIN}.kommo.com/api/v4/contacts?query=${encodeURIComponent(telefono)}&limit=1`,
        { headers: { Authorization: `Bearer ${KOMMO_API_TOKEN}` } }
      )
      const contactsData = await contactsRes.json()
      const chatId = contactsData?._embedded?.contacts?.[0]?.id?.toString()

      if (chatId) {
        const encoder = new TextEncoder()
        const bodyStr = JSON.stringify({
          conversation_id: chatId,
          event_type: 'new_message',
          payload: {
            timestamp: Math.floor(Date.now() / 1000),
            msgid: crypto.randomUUID(),
            type: 'text',
            text: texto,
          },
        })
        const dateStr = new Date().toUTCString()
        const contentMd5 = btoa(String.fromCharCode(...new Uint8Array(
          await crypto.subtle.digest('MD5', encoder.encode(bodyStr))
        )))
        const uri = `/v2/origin/custom/${KOMMO_AMOJO_ID}`
        const stringToSign = `POST\n${contentMd5}\napplication/json\n${dateStr}\n${uri}`
        const key = await crypto.subtle.importKey('raw', encoder.encode(KOMMO_AMOJO_SECRET), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
        const sigBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(stringToSign))
        const sig = btoa(String.fromCharCode(...new Uint8Array(sigBytes)))

        const amojoRes = await fetch(`https://amojo.kommo.com${uri}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Date: dateStr, 'Content-MD5': contentMd5, 'X-Signature': `sha1=${sig}` },
          body: bodyStr,
        })
        console.log('[notify-whatsapp] amojo status:', amojoRes.status)
        if (amojoRes.ok) enviado = true
      }
    } catch (e) {
      console.error('[notify-whatsapp] amojo error:', e)
    }
  }

  // Intento 2: buscar chat por teléfono y enviar por chats API
  if (!enviado) {
    try {
      const chatsRes = await fetch(
        `https://${KOMMO_DOMAIN}.kommo.com/api/v4/chats?contact_phone=${encodeURIComponent(telefono)}&limit=1`,
        { headers: { Authorization: `Bearer ${KOMMO_API_TOKEN}` } }
      )
      console.log('[notify-whatsapp] chats search status:', chatsRes.status)
      if (chatsRes.ok) {
        const chatsData = await chatsRes.json()
        const chatId: string | undefined = chatsData?._embedded?.chats?.[0]?.id
        if (chatId) {
          const msgRes = await fetch(`https://${KOMMO_DOMAIN}.kommo.com/api/v4/chats/${chatId}/messages`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${KOMMO_API_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'text', text: texto }),
          })
          console.log('[notify-whatsapp] chat message status:', msgRes.status)
          if (msgRes.ok) enviado = true

          // Foto si aplica
          if (enviado && eventoKey === 'paquete_recibido_usa' && fotos && fotos.length > 0) {
            await fetch(`https://${KOMMO_DOMAIN}.kommo.com/api/v4/chats/${chatId}/messages`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${KOMMO_API_TOKEN}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'picture', media: { url: (fotos[0] as { url: string }).url } }),
            })
          }
        }
      }
    } catch (e) {
      console.error('[notify-whatsapp] chat API error:', e)
    }
  }

  // Fallback: nota interna en el lead de Kommo — el agente ve el mensaje y puede reenviarlo
  if (!enviado) {
    try {
      // Buscar contacto por teléfono
      const contactsRes = await fetch(
        `https://${KOMMO_DOMAIN}.kommo.com/api/v4/contacts?query=${encodeURIComponent(telefono)}&limit=1&with=leads`,
        { headers: { Authorization: `Bearer ${KOMMO_API_TOKEN}` } }
      )
      const contactsData = await contactsRes.json()
      const contact = contactsData?._embedded?.contacts?.[0]
      const leadId = contact?._embedded?.leads?.[0]?.id

      if (leadId) {
        const noteRes = await fetch(`https://${KOMMO_DOMAIN}.kommo.com/api/v4/leads/notes`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${KOMMO_API_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify([{
            entity_id: leadId,
            note_type: 'common',
            params: { text: `📱 ENVIAR A CLIENTE (${telefono}):\n\n${texto}` },
          }]),
        })
        console.log('[notify-whatsapp] fallback note status:', noteRes.status)
      } else {
        console.error('[notify-whatsapp] No se encontró lead para teléfono:', telefono)
      }
    } catch (e) {
      console.error('[notify-whatsapp] fallback error:', e)
    }
  }

  // Registrar en tabla notificaciones
  await supabase.from('notificaciones').insert({
    cliente_id: record.cliente_id,
    paquete_id: record.id,
    tipo: 'estado',
    titulo: `Paquete ${record.estado}`,
    mensaje: texto,
    enviada_whatsapp: enviado,
  })

  console.log('[notify-whatsapp] Finalizado. Enviado por WhatsApp:', enviado)
  return new Response(JSON.stringify({ ok: true, enviado }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
