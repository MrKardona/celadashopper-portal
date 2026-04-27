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

  let mensaje: Record<string, unknown> = {}
  try {
    const body = await req.json()
    mensaje = body.mensaje
    console.log('[process-whatsapp] Mensaje recibido:', JSON.stringify(mensaje))
  } catch (e) {
    console.error('[process-whatsapp] Error parseando body:', e)
    return new Response('Bad JSON', { status: 400 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  try {
    // 1. Obtener teléfono del contacto desde Kommo
    console.log('[step1] Obteniendo contacto', mensaje.contact_id, 'de Kommo')
    const contactRes = await fetch(
      `https://${KOMMO_DOMAIN}.kommo.com/api/v4/contacts/${mensaje.contact_id}`,
      { headers: { Authorization: `Bearer ${KOMMO_API_TOKEN}` } }
    )
    const contactText = await contactRes.text()
    console.log('[step1] Kommo status:', contactRes.status, 'body:', contactText.slice(0, 300))

    let contactData: Record<string, unknown> = {}
    try {
      contactData = JSON.parse(contactText)
    } catch {
      console.error('[step1] Kommo no devolvió JSON válido')
      return new Response('Kommo contact parse error', { status: 502 })
    }

    const customFields = (contactData.custom_fields_values as Array<{ field_code: string; values: Array<{ value: string }> }>) || []
    const phoneField = customFields.find(
      (f) => f.field_code === 'PHONE'
    )
    const rawPhone: string = phoneField?.values?.[0]?.value || ''
    console.log('[step1] Teléfono encontrado:', rawPhone)

    if (!rawPhone) {
      console.error('[step1] No phone found for contact', mensaje.contact_id)
      return new Response('No phone', { status: 400 })
    }

    // Normalizar teléfono
    const digits = rawPhone.replace(/\D/g, '')
    const telefono = digits.startsWith('57') ? `+${digits}` : `+57${digits}`
    console.log('[step1] Teléfono normalizado:', telefono)

    // 2. Resolver cliente en Supabase
    console.log('[step2] Buscando cliente en Supabase...')
    const { data: perfiles, error: perfilError } = await supabase
      .from('perfiles')
      .select(`*, paquetes(*, fotos_paquetes(*))`)
      .or(`whatsapp.eq.${telefono},telefono.eq.${telefono}`)
      .eq('activo', true)
      .limit(1)

    if (perfilError) console.error('[step2] Error Supabase perfiles:', perfilError)

    const clienteExiste = perfiles && perfiles.length > 0
    const perfil = clienteExiste ? perfiles[0] : null
    console.log('[step2] Cliente encontrado:', clienteExiste ? perfil?.nombre_completo : 'NUEVO')

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
    console.log('[step5] Llamando Claude API...')
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
    console.log('[step5] Claude status:', claudeRes.status, 'response:', JSON.stringify(claudeData).slice(0, 300))
    const rawText: string = (claudeData.content?.[0] as { text: string })?.text || ''

    let agentResponse = { respuesta: rawText, accion: 'ninguna', datos_accion: {} as Record<string, unknown> }
    try {
      const cleaned = rawText.replace(/```json\n?|\n?```/g, '').trim()
      agentResponse = JSON.parse(cleaned)
    } catch {
      agentResponse.respuesta = rawText || 'Perdona, tuve un problema técnico. ¿Puedes repetir? 🙏'
    }
    console.log('[step5] Respuesta agente:', agentResponse.respuesta.slice(0, 100), '| accion:', agentResponse.accion)

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
    console.log('[step7] Guardando historial...')
    await supabase.from('conversaciones_whatsapp').insert([
      { telefono, cliente_id: perfil?.id || null, rol: 'cliente', mensaje: mensaje.text || '[no-texto]' },
      { telefono, cliente_id: perfil?.id || null, rol: 'agente', mensaje: agentResponse.respuesta, accion_ejecutada: agentResponse.accion, escalada: agentResponse.accion === 'escalar' },
    ])

    // 8. Enviar respuesta via Salesbot: guardar en campo "Respuesta Bot" + mover lead a etapa "BOT Listo"
    // El Salesbot "ENVIAR RESPUESTA CLAUDE" se dispara cuando el lead entra a la etapa BOT Listo
    // y envía el contenido de {{Respuesta Bot}} por WhatsApp automáticamente
    const BOT_LISTO_STAGE_ID = 105067216  // Etapa "BOT Listo" en pipeline 10274719
    const RESPUESTA_BOT_FIELD_ID = 1023745 // Campo personalizado "Respuesta Bot" en leads

    console.log('[step8] Buscando lead para contact_id:', mensaje.contact_id)
    let enviado = false

    try {
      // Buscar el lead activo del contacto
      const leadsRes = await fetch(
        `https://${KOMMO_DOMAIN}.kommo.com/api/v4/leads?filter[contact_id]=${mensaje.contact_id}&limit=1&order[id]=desc`,
        { headers: { Authorization: `Bearer ${KOMMO_API_TOKEN}` } }
      )
      const leadsData = await leadsRes.json()
      const lead = leadsData?._embedded?.leads?.[0]
      const leadId = lead?.id
      const prevStatusId = lead?.status_id

      console.log('[step8] Lead encontrado:', leadId, '| etapa actual:', prevStatusId)

      if (leadId) {
        // Paso A: Guardar respuesta en campo "Respuesta Bot"
        const updateRes = await fetch(`https://${KOMMO_DOMAIN}.kommo.com/api/v4/leads/${leadId}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${KOMMO_API_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            custom_fields_values: [{
              field_id: RESPUESTA_BOT_FIELD_ID,
              values: [{ value: agentResponse.respuesta }],
            }],
          }),
        })
        console.log('[step8] Campo Respuesta Bot actualizado:', updateRes.status)

        // Paso B: Mover lead a etapa "BOT Listo" — esto dispara el Salesbot
        const stageRes = await fetch(`https://${KOMMO_DOMAIN}.kommo.com/api/v4/leads/${leadId}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${KOMMO_API_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status_id: BOT_LISTO_STAGE_ID,
            pipeline_id: 10274719,
          }),
        })
        console.log('[step8] Lead movido a BOT Listo:', stageRes.status)
        if (stageRes.ok) enviado = true
      }
    } catch (e) {
      console.error('[step8] Error moviendo lead:', e)
    }

    // Fallback si no encontramos el lead
    if (!enviado) {
      const entityId = mensaje.entity_id || mensaje.element_id
      if (entityId) {
        await fetch(`https://${KOMMO_DOMAIN}.kommo.com/api/v4/leads/notes`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${KOMMO_API_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify([{
            entity_id: parseInt(entityId as string),
            note_type: 'common',
            params: { text: `🤖 BOT RESPONDERÍA: ${agentResponse.respuesta}` },
          }]),
        })
        console.log('[step8] Fallback: nota guardada en lead')
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('[process-whatsapp] ERROR NO MANEJADO:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
