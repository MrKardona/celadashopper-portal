// scripts/test-email-reportado.mjs
// Prueba la plantilla "paquete reportado" con todos los datos del pedido + tracker visual.
// Uso: node --env-file=.env.local scripts/test-email-reportado.mjs destino@email.com

import nodemailer from 'nodemailer'

// Inline de la plantilla (replica de plantillas.ts para evitar import TS)
const COLOR_NARANJA = '#ea580c'
const COLOR_FONDO = '#fff7ed'
const SITE_URL = 'https://portal.celadashopper.com'

const HITOS = [
  { icono: '📝', label: 'Reportado' },
  { icono: '🇺🇸', label: 'En Miami' },
  { icono: '✈️', label: 'En camino' },
  { icono: '📍', label: 'Listo' },
  { icono: '✅', label: 'Entregado' },
]

function trackerProgreso(hitoActivo) {
  const celdas = HITOS.map((h, i) => {
    const completado = i < hitoActivo
    const actual = i === hitoActivo
    const bg = actual ? COLOR_NARANJA : completado ? '#fb923c' : '#e7e5e4'
    const colorTexto = actual || completado ? '#ffffff' : '#a8a29e'
    const labelColor = actual ? COLOR_NARANJA : completado ? '#9a3412' : '#a8a29e'
    const peso = actual ? 'bold' : 'normal'
    const ring = actual ? `box-shadow:0 0 0 4px #fed7aa;` : ''
    return `
      <td align="center" style="vertical-align:top;padding:0 2px;width:20%;">
        <div style="background:${bg};color:${colorTexto};width:44px;height:44px;border-radius:50%;line-height:44px;font-size:20px;margin:0 auto;${ring}">${h.icono}</div>
        <p style="margin:8px 0 0 0;font-size:11px;font-weight:${peso};color:${labelColor};font-family:Arial,sans-serif;">${h.label}</p>
      </td>`
  }).join('')
  const porcentaje = Math.round((hitoActivo / (HITOS.length - 1)) * 100)
  return `
    <div style="margin:24px 0 28px 0;padding:20px 12px 16px 12px;background:#ffffff;border:1px solid #fed7aa;border-radius:10px;">
      <p style="margin:0 0 14px 0;text-align:center;font-size:12px;color:#78716c;font-family:Arial,sans-serif;letter-spacing:0.5px;text-transform:uppercase;">Estado del envío</p>
      <div style="position:relative;height:4px;background:#e7e5e4;border-radius:2px;margin:0 22px 12px 22px;">
        <div style="height:4px;background:${COLOR_NARANJA};border-radius:2px;width:${porcentaje}%;"></div>
      </div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>${celdas}</tr></table>
    </div>`
}

const destino = process.argv[2]
if (!destino) {
  console.error('Uso: node --env-file=.env.local scripts/test-email-reportado.mjs destino@email.com')
  process.exit(1)
}

const host = process.env.SMTP_HOST
const port = parseInt(process.env.SMTP_PORT ?? '465', 10)
const transporter = nodemailer.createTransport({
  host, port, secure: port === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
})

const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
<table width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:24px 0;"><tr><td align="center">
<table width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;">
<tr><td style="background:${COLOR_NARANJA};padding:24px 32px;"><span style="color:#fff;font-size:22px;font-weight:bold;">📦 CeladaShopper</span><p style="color:#fed7aa;font-size:13px;margin:4px 0 0 0;">Portal de clientes</p></td></tr>
<tr><td style="padding:32px;background:${COLOR_FONDO};">
<h2 style="color:#1c1917;font-size:24px;margin:0 0 12px 0;">¡Hola Andrés! 👋</h2>
<p style="color:#44403c;font-size:15px;line-height:1.6;margin:0 0 8px 0;">Recibimos tu pedido en <strong>CeladaShopper</strong>. Te confirmaremos cada paso por correo.</p>
${trackerProgreso(0)}
<h3 style="color:#1c1917;font-size:16px;margin:24px 0 12px 0;">Detalles de tu pedido</h3>
<div style="background:#fff;border:1px solid #fed7aa;border-radius:8px;padding:20px;">
<table width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:6px 0;color:#78716c;font-size:13px;">📦 Producto:</td><td style="padding:6px 0;color:#1c1917;font-size:14px;font-weight:bold;text-align:right;">Apple Watch Series 10</td></tr>
<tr><td style="padding:6px 0;color:#78716c;font-size:13px;">🏷️ Categoría:</td><td style="padding:6px 0;color:#1c1917;font-size:14px;font-weight:bold;text-align:right;">Celular</td></tr>
<tr><td style="padding:6px 0;color:#78716c;font-size:13px;">🏬 Tienda:</td><td style="padding:6px 0;color:#1c1917;font-size:14px;font-weight:bold;text-align:right;">Amazon</td></tr>
<tr><td style="padding:6px 0;color:#78716c;font-size:13px;">💵 Valor declarado:</td><td style="padding:6px 0;color:#1c1917;font-size:14px;font-weight:bold;text-align:right;">$425 USD</td></tr>
<tr><td style="padding:6px 0;color:#78716c;font-size:13px;">📍 Ciudad destino:</td><td style="padding:6px 0;color:#1c1917;font-size:14px;font-weight:bold;text-align:right;">Medellín</td></tr>
<tr><td style="padding:6px 0;color:#78716c;font-size:13px;">🔖 Tu número CeladaShopper:</td><td style="padding:6px 0;color:#1c1917;font-size:14px;font-weight:bold;text-align:right;">CLD-7842</td></tr>
</table></div>
<table cellspacing="0" cellpadding="0" style="margin:24px auto;"><tr><td style="border-radius:8px;background:${COLOR_NARANJA};">
<a href="${SITE_URL}/paquetes" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:bold;color:#fff;text-decoration:none;border-radius:8px;">Ver mi paquete →</a>
</td></tr></table>
</td></tr></table></td></tr></table></body></html>`

const info = await transporter.sendMail({
  from: `"CeladaShopper" <${process.env.SMTP_FROM_EMAIL}>`,
  to: destino,
  subject: '📦 Pedido reportado: Apple Watch Series 10 (PRUEBA tracker visual)',
  html,
})
console.log('✅ Email enviado. Revisa tu bandeja.')
console.log('   message_id:', info.messageId)
