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
  const now = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })
  let contexto = `FECHA Y HORA COLOMBIA: ${now}\n\n`

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

  let agentResponse = { respuesta: rawText, accion: 'ninguna', datos_accion: {} as Record<string, unknown> }
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
