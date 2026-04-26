// supabase/functions/notify-whatsapp/index.ts
// Envía notificaciones proactivas a clientes cuando cambia el estado de su paquete
// Invocada por un Database Webhook de Supabase cuando se hace UPDATE en tabla paquetes

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const KOMMO_DOMAIN = Deno.env.get('KOMMO_DOMAIN')!
const KOMMO_API_TOKEN = Deno.env.get('KOMMO_API_TOKEN')!

// Mapeo de estado de paquete → evento de notificación
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

  // Obtener datos del cliente, plantilla y fotos en paralelo
  const [{ data: perfil }, { data: plantilla }, { data: fotos }] = await Promise.all([
    supabase
      .from('perfiles')
      .select('nombre_completo, whatsapp, telefono')
      .eq('id', record.cliente_id)
      .single(),
    supabase
      .from('plantillas_notificacion')
      .select('texto_plantilla')
      .eq('evento', eventoKey)
      .eq('activa', true)
      .single(),
    supabase
      .from('fotos_paquetes')
      .select('url')
      .eq('paquete_id', record.id)
      .limit(1),
  ])

  if (!perfil || !plantilla) {
    console.error('Missing perfil or plantilla for', record.id)
    return new Response('Missing data', { status: 400 })
  }

  const telefono: string = perfil.whatsapp || perfil.telefono
  if (!telefono) return new Response('No phone', { status: 400 })

  // Interpolar variables en la plantilla
  const texto = plantilla.texto_plantilla
    .replace('{{nombre}}', perfil.nombre_completo)
    .replace('{{descripcion}}', record.descripcion || '')
    .replace('{{peso}}', record.peso_facturable?.toString() || '?')
    .replace('{{costo}}', record.costo_servicio?.toLocaleString('es-CO') || '?')
    .replace('{{bodega}}', record.bodega_destino || '')

  // Buscar el chat en Kommo por número de teléfono
  const chatsRes = await fetch(
    `https://${KOMMO_DOMAIN}.kommo.com/api/v4/chats?contact_phone=${encodeURIComponent(telefono)}`,
    { headers: { Authorization: `Bearer ${KOMMO_API_TOKEN}` } }
  )
  const chatsData = await chatsRes.json()
  const chatId: string | undefined = chatsData?._embedded?.chats?.[0]?.id

  if (!chatId) {
    console.error('No Kommo chat found for phone:', telefono)
    return new Response('No chat found', { status: 404 })
  }

  // Enviar mensaje de texto
  await fetch(`https://${KOMMO_DOMAIN}.kommo.com/api/v4/chats/${chatId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KOMMO_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type: 'text', text: texto }),
  })

  // Enviar foto si existe y es notificación de recepción en USA
  if (eventoKey === 'paquete_recibido_usa' && fotos && fotos.length > 0) {
    await fetch(`https://${KOMMO_DOMAIN}.kommo.com/api/v4/chats/${chatId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KOMMO_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: 'picture', media: { url: fotos[0].url } }),
    })
  }

  // Registrar la notificación enviada
  await supabase.from('notificaciones').insert({
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
