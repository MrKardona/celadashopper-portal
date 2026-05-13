// src/app/api/notificaciones/registro/route.ts
// Envía confirmación de registro al cliente por WhatsApp y email

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { sendProactiveWhatsApp } from '@/lib/kommo/proactive'
import { sendEmail } from '@/lib/email/send'

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

  // Paleta dark portal
  const BG_OUTER   = '#090915'
  const BG_CARD    = '#11112a'
  const BG_INNER   = '#19193a'
  const BORDER_VIS = '#3a3a68'
  const BORDER_SUB = '#2c2c52'
  const GOLD       = '#F5B800'
  const GOLD_DIM   = '#7a5c00'
  const PURPLE     = '#a5b4fc'
  const GREEN      = '#34d399'
  const TEXT_PRIM  = '#ffffff'
  const TEXT_BODY  = '#b2b2d8'
  const TEXT_MUTE  = '#6868a0'

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:${BG_OUTER};font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
  bgcolor="${BG_OUTER}" style="background-color:${BG_OUTER};padding:32px 0;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0"
        style="max-width:600px;width:100%;background-color:${BG_CARD};border-radius:14px;overflow:hidden;border:1px solid ${BORDER_VIS};">

        <!-- Header -->
        <tr>
          <td bgcolor="${BG_CARD}" style="background-color:${BG_CARD};padding:26px 32px 20px 32px;border-bottom:1px solid ${BORDER_VIS};">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td>
                  <p style="margin:0 0 2px 0;color:${GOLD};font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">CeladaShopper</p>
                  <p style="margin:0;color:${TEXT_MUTE};font-size:12px;">Tu casillero en USA &rarr; Colombia</p>
                </td>
                <td align="right" style="vertical-align:middle;">
                  <span style="display:inline-block;background-color:${GOLD};color:#000;font-size:18px;padding:6px 10px;border-radius:8px;line-height:1;">&#128230;</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td bgcolor="${BG_CARD}" style="background-color:${BG_CARD};padding:32px;">

            <h2 style="color:${TEXT_PRIM};font-size:22px;margin:0 0 6px 0;">&#127881; ¡Pedido registrado!</h2>
            <p style="color:${TEXT_BODY};font-size:15px;line-height:1.65;margin:0 0 24px 0;">
              Hola <strong style="color:${TEXT_PRIM};">${params.nombre}</strong>,
              tu pedido fue registrado exitosamente. Aquí tienes todos los detalles.
            </p>

            <!-- Tracking box -->
            <div style="background-color:${BG_INNER};border:1px solid ${GOLD_DIM};border-radius:10px;padding:18px 20px;margin-bottom:24px;">
              <p style="margin:0 0 4px 0;color:${GOLD};font-size:10px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;">
                &#128278; Número de seguimiento
              </p>
              <p style="margin:0 0 6px 0;color:${GOLD};font-size:26px;font-weight:bold;font-family:'Courier New',monospace;letter-spacing:2px;">
                ${params.tracking_casilla}
              </p>
              <p style="margin:0;color:${TEXT_MUTE};font-size:11px;">Guarda este número para consultar el estado de tu paquete</p>
            </div>

            <!-- Package details -->
            <div style="background-color:${BG_INNER};border:1px solid ${BORDER_VIS};border-radius:10px;padding:18px 20px;margin-bottom:24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="padding:7px 0;color:${TEXT_MUTE};font-size:13px;border-bottom:1px solid ${BORDER_SUB};">&#128230; Producto</td>
                  <td style="padding:7px 0;color:${TEXT_PRIM};font-size:13px;font-weight:bold;text-align:right;border-bottom:1px solid ${BORDER_SUB};">${params.descripcion}</td>
                </tr>
                <tr>
                  <td style="padding:7px 0;color:${TEXT_MUTE};font-size:13px;border-bottom:1px solid ${BORDER_SUB};">&#127978; Tienda</td>
                  <td style="padding:7px 0;color:${TEXT_PRIM};font-size:13px;font-weight:bold;text-align:right;border-bottom:1px solid ${BORDER_SUB};">${params.tienda}</td>
                </tr>
                <tr>
                  <td style="padding:7px 0;color:${TEXT_MUTE};font-size:13px;">&#128205; Ciudad de entrega</td>
                  <td style="padding:7px 0;color:${TEXT_PRIM};font-size:13px;font-weight:bold;text-align:right;">${bodega}</td>
                </tr>
              </table>
            </div>

            <!-- USA Address box -->
            <div style="background-color:${BG_INNER};border:1px solid ${BORDER_VIS};border-radius:10px;padding:18px 20px;margin-bottom:24px;">
              <p style="margin:0 0 10px 0;color:${PURPLE};font-size:10px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;">
                &#128206; Dirección de envío en USA
              </p>
              <p style="margin:0;color:${TEXT_BODY};font-size:14px;line-height:1.8;">
                <strong style="color:${TEXT_PRIM};">${params.nombre}</strong><br>
                <strong style="color:${GOLD};font-size:16px;">${params.numero_casilla}</strong><br>
                <span style="color:${TEXT_BODY};">${USA_ADDRESS}</span>
              </p>
            </div>

            <!-- Tarifa estimada -->
            <div style="background-color:${BG_INNER};border:1px solid ${BORDER_VIS};border-radius:10px;padding:16px 20px;margin-bottom:24px;">
              <p style="margin:0 0 6px 0;color:${GOLD};font-size:10px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;">
                &#128176; Tarifa estimada para tu categoría
              </p>
              <p style="margin:0;color:${TEXT_BODY};font-size:14px;line-height:1.5;">${params.tarifa_info}</p>
            </div>

            <!-- Tarifas tabla -->
            <div style="background-color:${BG_INNER};border:1px solid ${BORDER_SUB};border-radius:10px;padding:16px 20px;margin-bottom:24px;">
              <p style="margin:0 0 8px 0;color:${TEXT_MUTE};font-size:10px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;">
                Tabla de tarifas
              </p>
              <div style="font-size:13px;color:${TEXT_BODY};line-height:1.9;">${params.tarifas_tabla}</div>
            </div>

            <!-- Next steps -->
            <div style="background-color:${BG_INNER};border:1px solid ${GREEN};border-radius:10px;padding:18px 20px;margin-bottom:24px;">
              <p style="margin:0 0 10px 0;color:${GREEN};font-size:13px;font-weight:bold;">&#10003; ¿Qué sigue?</p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr><td style="color:${PURPLE};font-size:13px;padding:3px 0;vertical-align:top;">1.&nbsp;</td><td style="color:${TEXT_BODY};font-size:13px;padding:3px 0;">Usa la dirección USA de arriba como destino de tu compra</td></tr>
                <tr><td style="color:${PURPLE};font-size:13px;padding:3px 0;vertical-align:top;">2.&nbsp;</td><td style="color:${TEXT_BODY};font-size:13px;padding:3px 0;">Cuando llegue a Miami, te enviamos fotos por WhatsApp</td></tr>
                <tr><td style="color:${PURPLE};font-size:13px;padding:3px 0;vertical-align:top;">3.&nbsp;</td><td style="color:${TEXT_BODY};font-size:13px;padding:3px 0;">Te confirmamos peso y costo antes de enviarlo a Colombia</td></tr>
                <tr><td style="color:${PURPLE};font-size:13px;padding:3px 0;vertical-align:top;">4.&nbsp;</td><td style="color:${TEXT_BODY};font-size:13px;padding:3px 0;">Envío a Colombia: 8&ndash;12 días hábiles</td></tr>
              </table>
            </div>

            <p style="margin:0 0 28px 0;color:${TEXT_MUTE};font-size:13px;">
              ¿Tienes preguntas? Escríbenos por WhatsApp o responde a este correo.
            </p>

            <!-- CTA -->
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">
              <tr>
                <td align="center" bgcolor="${GOLD}" style="background-color:${GOLD};border-radius:10px;">
                  <a href="https://portal.celadashopper.com"
                    style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:bold;color:#000000;text-decoration:none;border-radius:10px;">
                    Ir al portal &rarr;
                  </a>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td bgcolor="${BG_OUTER}" style="background-color:${BG_OUTER};padding:20px 32px;border-top:1px solid ${BORDER_SUB};text-align:center;">
            <p style="color:${GOLD};font-size:12px;font-weight:bold;margin:0 0 6px 0;letter-spacing:1px;">CELADASHOPPER</p>
            <p style="color:${TEXT_MUTE};font-size:11px;margin:0 0 6px 0;line-height:1.6;">
              Tu casillero en USA &middot; portal.celadashopper.com
            </p>
            <p style="color:#3a3a60;font-size:10px;margin:0;">Recibiste este correo porque tienes una cuenta activa en CeladaShopper.</p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`
}

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
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
