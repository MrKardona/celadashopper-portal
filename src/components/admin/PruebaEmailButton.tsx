'use client'

import { useState } from 'react'
import { Mail, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
      <Button
        type="button"
        variant="outline"
        className="w-full border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 gap-2"
        onClick={() => setAbierto(v => !v)}
      >
        <Mail className="h-4 w-4" />
        {abierto ? 'Ocultar prueba email' : 'Probar Email'}
      </Button>

      {abierto && (
        <div className="space-y-3 p-3 bg-blue-50/50 border border-blue-100 rounded-lg">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Email destino</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="cliente@email.com"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <Button
            type="button"
            onClick={enviar}
            disabled={enviando || !email.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2"
          >
            {enviando
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
              : <><Mail className="h-4 w-4" /> Enviar email de prueba</>}
          </Button>

          {resultado && (
            <div
              className={`flex items-start gap-2 text-xs p-2.5 rounded-md border ${
                resultado.tipo === 'ok'
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
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
