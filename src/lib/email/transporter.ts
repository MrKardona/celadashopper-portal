// src/lib/email/transporter.ts
// Transporter SMTP para enviar correos transaccionales vía Hostinger.

import nodemailer from 'nodemailer'
import type { Transporter, SendMailOptions } from 'nodemailer'

let cached: Transporter | null = null

function getTransporter(): Transporter | null {
  if (cached) return cached

  const host = process.env.SMTP_HOST
  const port = parseInt(process.env.SMTP_PORT ?? '465', 10)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) {
    console.error('[email/transporter] SMTP no configurado: faltan SMTP_HOST/SMTP_USER/SMTP_PASS')
    return null
  }

  cached = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 SSL, 587 STARTTLS
    auth: { user, pass },
    // Hostinger requiere estos timeouts más generosos en Vercel Edge
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  })

  return cached
}

export interface ResultadoEmail {
  ok: boolean
  messageId?: string
  error?: string
}

/**
 * Envía un email transaccional. Devuelve {ok, messageId, error}.
 * No tira excepciones — siempre devuelve un resultado para registrar en BD.
 */
export async function enviarEmail(opts: {
  to: string | string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
}): Promise<ResultadoEmail> {
  const transporter = getTransporter()
  if (!transporter) {
    return { ok: false, error: 'SMTP no configurado en Vercel (SMTP_HOST, SMTP_USER, SMTP_PASS)' }
  }

  const fromName = process.env.SMTP_FROM_NAME ?? 'CeladaShopper'
  const fromEmail = process.env.SMTP_FROM_EMAIL ?? process.env.SMTP_USER!

  const mailOptions: SendMailOptions = {
    from: `"${fromName}" <${fromEmail}>`,
    to: Array.isArray(opts.to) ? opts.to.join(', ') : opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text ?? undefined,
    replyTo: opts.replyTo ?? fromEmail,
  }

  try {
    const info = await transporter.sendMail(mailOptions)
    return { ok: true, messageId: info.messageId }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[email/transporter] Error al enviar:', msg)
    return { ok: false, error: msg }
  }
}
