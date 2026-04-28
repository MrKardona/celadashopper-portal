// src/lib/email/send.ts
// Envío de emails via Resend (https://resend.com)
// Requiere RESEND_API_KEY en .env.local

interface SendEmailOptions {
  to: string
  subject: string
  html: string
  from?: string
}

interface SendEmailResult {
  enviado: boolean
  error?: string
}

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[Email] RESEND_API_KEY no configurado — email no enviado')
    return { enviado: false, error: 'RESEND_API_KEY no configurado' }
  }

  const from = options.from ?? process.env.EMAIL_FROM ?? 'CeladaShopper <noreply@celadashopper.com>'

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [options.to],
        subject: options.subject,
        html: options.html,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error('[Email] Resend error:', res.status, body)
      return { enviado: false, error: `Resend ${res.status}: ${body}` }
    }

    return { enviado: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Email] Error enviando:', msg)
    return { enviado: false, error: msg }
  }
}
