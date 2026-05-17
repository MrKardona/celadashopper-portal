// scripts/test-smtp.mjs
// Prueba de envío SMTP. Uso:
//   node --env-file=.env.local scripts/test-smtp.mjs destino@email.com
//
// Verifica que las variables SMTP_* estén bien configuradas y envía un email de prueba.

import nodemailer from 'nodemailer'

const destino = process.argv[2]
if (!destino) {
  console.error('Uso: node --env-file=.env.local scripts/test-smtp.mjs destino@email.com')
  process.exit(1)
}

const host = process.env.SMTP_HOST
const port = parseInt(process.env.SMTP_PORT ?? '465', 10)
const user = process.env.SMTP_USER
const pass = process.env.SMTP_PASS
const fromName = process.env.SMTP_FROM_NAME ?? 'CeladaShopper'
const fromEmail = process.env.SMTP_FROM_EMAIL ?? user

console.log('━━━ Configuración SMTP ━━━')
console.log('Host:', host)
console.log('Port:', port)
console.log('User:', user)
console.log('Pass:', pass ? '***' + pass.slice(-3) : '(NO CONFIGURADA)')
console.log('From:', `"${fromName}" <${fromEmail}>`)
console.log('Destino:', destino)
console.log()

if (!host || !user || !pass) {
  console.error('❌ Faltan variables SMTP. Revisa .env.local')
  process.exit(1)
}

const transporter = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: { user, pass },
  connectionTimeout: 15_000,
  greetingTimeout: 15_000,
  socketTimeout: 20_000,
})

console.log('Verificando conexión SMTP...')
try {
  await transporter.verify()
  console.log('✅ Conexión SMTP verificada\n')
} catch (err) {
  console.error('❌ Falló verificación:', err.message)
  process.exit(1)
}

console.log('Enviando email de prueba...')
try {
  const info = await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: destino,
    subject: '🧪 Prueba SMTP - CeladaShopper',
    text: 'Si recibiste este correo, el SMTP de Hostinger está funcionando correctamente.',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;background:#fff7ed;border-radius:12px;">
        <h2 style="color:#ea580c;margin:0 0 12px 0;">✅ SMTP funcionando</h2>
        <p>Si ves este correo, el envío desde <strong>noreply@celadashopper.com</strong> funciona correctamente.</p>
        <p style="color:#78716c;font-size:13px;">Las notificaciones automáticas de paquetes ya pueden enviarse a los clientes.</p>
      </div>
    `,
  })
  console.log('✅ Email enviado')
  console.log('   message_id:', info.messageId)
  console.log('   response:  ', info.response)
} catch (err) {
  console.error('❌ Error al enviar:', err.message)
  if (err.code) console.error('   code:', err.code)
  if (err.response) console.error('   response:', err.response)
  process.exit(1)
}
