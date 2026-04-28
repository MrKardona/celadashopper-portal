// src/app/api/notificaciones/registro/route.ts
// Envía confirmación de registro al cliente por WhatsApp y email

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { sendProactiveWhatsApp } from '@/lib/kommo/proactive'
import { sendEmail } from '@/lib/email/send'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BODEGA_LABELS: Record<string, string> = {
  medellin: 'Medellín',
  bogota: 'Bogotá',
  barranquilla: 'Barranquilla',
}

const USA_ADDRESS = process.env.CELADASHOPPER_USA_ADDRESS ?? '[DIRECCIÓN USA — configura CELADASHOPPER_USA_ADDRESS en .env.local]'

function buildWhatsAppMessage(params: {
  nombre: string
  numero_casilla: string
  tracking_casilla: string
  descripcion: string
  tienda: string
  bodega_destino: string
  tarifa_info: string
}): string {
  const bodega = BODEGA_LABELS[params.bodega_destino] ?? params.bodega_destino
  return `📦 *¡Pedido registrado en CeladaShopper!*

Hola ${params.nombre} 👋
Tu pedido fue registrado exitosamente.

*🔑 Tracking:* \`${params.tracking_casilla}\`
*📦 Producto:* ${params.descripcion}
*🏪 Tienda:* ${params.tienda}
*🏙️ Entrega en:* ${bodega}

📮 *Dirección de envío en USA:*
${params.nombre}
*${params.numero_casilla}*
${USA_ADDRESS}

💰 *Tarifa estimada:*
${params.tarifa_info}

Te avisamos cuando llegue a nuestra bodega con fotos y el costo exacto. 🚀
¿Preguntas? Escríbenos aquí por WhatsApp.`
}

function buildEmailHtml(params: {
  nombre: string
  numero_casilla: string
  tracking_casilla: string
  descripcion: string
  tienda: string
  bodega_destino: string
  tarifa_info: string
  tarifas_tabla: string
}): string {
  const bodega = BODEGA_LABELS[params.bodega_destino] ?? params.bodega_destino
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

  <!-- Header -->
  <div style="background:#ea580c;padding:24px 32px;">
    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">📦 ¡Pedido registrado!</h1>
    <p style="margin:4px 0 0;color:#fed7aa;font-size:14px;">CeladaShopper — Tu casillero USA → Colombia</p>
  </div>

  <!-- Body -->
  <div style="padding:32px;">
    <p style="margin:0 0 16px;color:#374151;font-size:15px;">Hola <strong>${params.nombre}</strong>,</p>
    <p style="margin:0 0 24px;color:#374151;font-size:15px;">Tu pedido fue registrado exitosamente en nuestro sistema. Aquí tienes todos los detalles.</p>

    <!-- Tracking box -->
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0 0 4px;color:#9a3412;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Número de seguimiento</p>
      <p style="margin:0;color:#ea580c;font-size:24px;font-weight:700;font-family:monospace;">${params.tracking_casilla}</p>
      <p style="margin:4px 0 0;color:#9a3412;font-size:12px;">Guarda este número para consultar el estado de tu paquete</p>
    </div>

    <!-- Package details -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:14px;width:40%;">📦 Producto</td>
        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#111827;font-size:14px;font-weight:500;">${params.descripcion}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:14px;">🏪 Tienda</td>
        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#111827;font-size:14px;font-weight:500;">${params.tienda}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#6b7280;font-size:14px;">🏙️ Ciudad de entrega</td>
        <td style="padding:8px 0;color:#111827;font-size:14px;font-weight:500;">${bodega}</td>
      </tr>
    </table>

    <!-- USA Address box -->
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0 0 8px;color:#166534;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">📮 Dirección de envío en USA</p>
      <p style="margin:0;color:#15803d;font-size:14px;line-height:1.7;">
        <strong>${params.nombre}</strong><br>
        <strong style="font-size:16px;">${params.numero_casilla}</strong><br>
        ${USA_ADDRESS}
      </p>
    </div>

    <!-- Tarifa estimada -->
    <div style="background:#f8fafc;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0 0 8px;color:#374151;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">💰 Tarifa estimada para tu categoría</p>
      <p style="margin:0;color:#374151;font-size:14px;">${params.tarifa_info}</p>
    </div>

    <!-- Tarifas tabla -->
    <details style="margin-bottom:24px;">
      <summary style="cursor:pointer;color:#ea580c;font-size:14px;font-weight:600;margin-bottom:8px;">Ver tabla de tarifas completa</summary>
      <div style="margin-top:8px;font-size:13px;color:#374151;line-height:1.8;">${params.tarifas_tabla}</div>
    </details>

    <!-- Next steps -->
    <div style="background:#f0f9ff;border-left:3px solid #0ea5e9;padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:24px;">
      <p style="margin:0 0 6px;color:#0369a1;font-size:14px;font-weight:700;">¿Qué sigue?</p>
      <ol style="margin:0;padding-left:20px;color:#0369a1;font-size:14px;">
        <li>Asegúrate de usar la dirección USA de arriba como destino de tu compra</li>
        <li>Cuando tu paquete llegue, te enviamos fotos por WhatsApp</li>
        <li>Te confirmamos el peso y el costo antes de enviarlo a Colombia</li>
        <li>Envío a Colombia: 8–12 días hábiles</li>
      </ol>
    </div>

    <p style="margin:0;color:#6b7280;font-size:13px;">¿Tienes preguntas? Escríbenos por WhatsApp o responde a este correo.</p>
  </div>

  <!-- Footer -->
  <div style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
    <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">CeladaShopper · Tu casillero USA → Colombia · portal.celadashopper.com</p>
  </div>
</div>
</body>
</html>`
}

export async function POST(req: NextRequest) {
  try {
    // Autenticar usuario
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const body = await req.json()
    const { tracking_casilla } = body as { tracking_casilla: string }
    if (!tracking_casilla) {
      return NextResponse.json({ error: 'tracking_casilla requerido' }, { status: 400 })
    }

    // Cargar perfil + paquete + tarifa en paralelo
    const [perfilResult, paqueteResult, tarifasResult] = await Promise.all([
      supabaseAdmin.from('perfiles').select('*').eq('id', user.id).single(),
      supabaseAdmin.from('paquetes').select('*').eq('tracking_casilla', tracking_casilla).single(),
      supabaseAdmin.from('categorias_tarifas').select('*').eq('activo', true).order('nombre_display'),
    ])

    if (perfilResult.error || !perfilResult.data) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }
    if (paqueteResult.error || !paqueteResult.data) {
      return NextResponse.json({ error: 'Paquete no encontrado' }, { status: 404 })
    }

    const perfil = perfilResult.data
    const paquete = paqueteResult.data
    const tarifas = tarifasResult.data ?? []

    // Construir info de tarifa para este paquete
    const tarifa = tarifas.find((t: { categoria: string }) => t.categoria === paquete.categoria)
    let tarifaInfo = 'Consultar con el equipo'
    if (tarifa) {
      if (tarifa.tarifa_tipo === 'fijo_por_unidad') {
        tarifaInfo = `$${tarifa.precio_fijo} USD por unidad (${tarifa.nombre_display})`
      } else {
        tarifaInfo = `$${tarifa.tarifa_por_libra} USD/lb (${tarifa.nombre_display})`
      }
      if (tarifa.descripcion) {
        tarifaInfo += ` — ${tarifa.descripcion}`
      }
    }

    // Tabla de tarifas para email
    const tarifasTabla = tarifas
      .map((t: { nombre_display: string; tarifa_tipo: string; precio_fijo: number; tarifa_por_libra: number }) => {
        const precio = t.tarifa_tipo === 'fijo_por_unidad'
          ? `$${t.precio_fijo} fijo/unidad`
          : `$${t.tarifa_por_libra}/lb`
        return `• <strong>${t.nombre_display}:</strong> ${precio}`
      })
      .join('<br>')

    const nombre = perfil.nombre_completo
    const numeroCasilla = perfil.numero_casilla ?? 'Sin asignar'
    const phone = perfil.whatsapp ?? perfil.telefono ?? ''
    const email = perfil.email

    const messageParams = {
      nombre,
      numero_casilla: numeroCasilla,
      tracking_casilla,
      descripcion: paquete.descripcion,
      tienda: paquete.tienda,
      bodega_destino: paquete.bodega_destino,
      tarifa_info: tarifaInfo,
      tarifas_tabla: tarifasTabla,
    }

    // Enviar WhatsApp y email en paralelo
    const [waResult, emailResult] = await Promise.allSettled([
      phone
        ? sendProactiveWhatsApp(phone, buildWhatsAppMessage(messageParams))
        : Promise.resolve({ enviado: false, metodo: 'sin_contacto' as const }),
      email
        ? sendEmail({
            to: email,
            subject: `📦 Pedido registrado — ${tracking_casilla} | CeladaShopper`,
            html: buildEmailHtml(messageParams),
          })
        : Promise.resolve({ enviado: false, error: 'Sin email' }),
    ])

    const waOk = waResult.status === 'fulfilled' && waResult.value.enviado
    const emailOk = emailResult.status === 'fulfilled' && emailResult.value.enviado

    // Guardar en tabla notificaciones
    await supabaseAdmin.from('notificaciones').insert({
      cliente_id: user.id,
      paquete_id: paquete.id,
      tipo: 'registro',
      titulo: '¡Pedido registrado!',
      mensaje: `Tu pedido ${tracking_casilla} fue registrado. Tarifa: ${tarifaInfo}`,
      enviada_whatsapp: waOk,
      enviada_email: emailOk,
    })

    return NextResponse.json({
      ok: true,
      whatsapp: waResult.status === 'fulfilled' ? waResult.value : { enviado: false },
      email: emailResult.status === 'fulfilled' ? emailResult.value : { enviado: false },
    })
  } catch (err) {
    console.error('[notificaciones/registro] Error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
