'use client'

import { useState } from 'react'
import { Mail, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

const tw = 'rgba(255,255,255,'

interface Props {
  emailSugerido?: string | null
  nombreSugerido?: string | null
}

export default function PruebaEmailButton({ emailSugerido, nombreSugerido }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [email, setEmail] = useState(emailSugerido ?? '')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  async function enviar() {
    if (!email.trim()) return
    setEnviando(true)
    setResultado(null)
    const res = await fetch('/api/admin/email-prueba', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), nombre: nombreSugerido }),
    })
    const data = await res.json() as { ok?: boolean; diagnostico?: string; error?: string; message_id?: string }
    setEnviando(false)
    setResultado({
      tipo: data.ok ? 'ok' : 'error',
      texto: data.diagnostico ?? (data.ok ? 'Enviado' : data.error ?? 'Error desconocido'),
    })
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setAbierto(v => !v)}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
        style={{ border: '1px solid rgba(99,130,255,0.3)', color: '#8899ff', background: 'rgba(99,130,255,0.08)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,130,255,0.15)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(99,130,255,0.08)')}
      >
        <Mail className="h-4 w-4" />
        {abierto ? 'Ocultar prueba email' : 'Probar Email'}
      </button>

      {abierto && (
        <div className="space-y-3 p-3 rounded-xl"
          style={{ background: 'rgba(99,130,255,0.06)', border: '1px solid rgba(99,130,255,0.15)' }}>
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: `${tw}0.55)` }}>Email destino</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="cliente@email.com"
              className="glass-input w-full px-3 py-2 text-sm rounded-xl focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={enviar}
            disabled={enviando || !email.trim()}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
            style={{ background: 'rgba(99,130,255,0.15)', color: '#8899ff', border: '1px solid rgba(99,130,255,0.3)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,130,255,0.25)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(99,130,255,0.15)')}
          >
            {enviando
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
              : <><Mail className="h-4 w-4" /> Enviar email de prueba</>}
          </button>

          {resultado && (
            <div className="flex items-start gap-2 text-xs p-2.5 rounded-xl"
              style={resultado.tipo === 'ok'
                ? { background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', color: '#34d399' }
                : { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
              {resultado.tipo === 'ok'
                ? <CheckCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                : <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />}
              <span>{resultado.texto}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
