'use client'

import { useState } from 'react'
import { MessageCircle, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

const tw = 'rgba(255,255,255,'

interface Props {
  telefonoSugerido?: string | null
}

type Resultado = {
  tipo: 'ok' | 'error' | 'aviso'
  texto: string
}

export default function PruebaWhatsappButton({ telefonoSugerido }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [telefono, setTelefono] = useState(telefonoSugerido ?? '')
  const [via, setVia] = useState<'kommo' | 'meta'>('kommo')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<Resultado | null>(null)

  async function enviar() {
    if (!telefono.trim()) return
    setEnviando(true)
    setResultado(null)
    const res = await fetch('/api/admin/whatsapp-prueba', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telefono: telefono.trim(), via }),
    })
    const data = await res.json() as {
      ok?: boolean; via?: string; metodo?: string; mensaje?: string; error?: string
    }
    setEnviando(false)
    if (!res.ok) {
      setResultado({ tipo: 'error', texto: data.error ?? 'Falló el envío' })
      return
    }
    if (data.via === 'kommo' && data.metodo === 'sin_contacto') {
      setResultado({ tipo: 'aviso', texto: data.mensaje ?? 'Sin contacto en Kommo. El cliente debe escribir primero al WhatsApp del negocio.' })
      return
    }
    if (data.via === 'kommo' && data.metodo === 'tarea') {
      setResultado({ tipo: 'aviso', texto: data.mensaje ?? 'Sin chat activo. Se creó una tarea en Kommo.' })
      return
    }
    setResultado({
      tipo: 'ok',
      texto: data.via === 'meta'
        ? 'Mensaje enviado por Meta directo. Revisa tu WhatsApp.'
        : 'Mensaje enviado por Kommo. Revisa tu WhatsApp.',
    })
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setAbierto(v => !v)}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
        style={{ border: '1px solid rgba(52,211,153,0.3)', color: '#34d399', background: 'rgba(52,211,153,0.08)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(52,211,153,0.15)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(52,211,153,0.08)')}
      >
        <MessageCircle className="h-4 w-4" />
        {abierto ? 'Ocultar prueba' : 'Probar WhatsApp'}
      </button>

      {abierto && (
        <div className="space-y-3 p-3 rounded-xl"
          style={{ background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.15)' }}>
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: `${tw}0.55)` }}>Teléfono destino</label>
            <input
              type="tel"
              value={telefono}
              onChange={e => setTelefono(e.target.value)}
              placeholder="+573001234567"
              className="glass-input w-full px-3 py-2 text-sm rounded-xl focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: `${tw}0.55)` }}>Método de envío</label>
            <div className="flex gap-2">
              {(['kommo', 'meta'] as const).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVia(v)}
                  className="flex-1 px-3 py-2 text-xs rounded-xl transition-colors"
                  style={via === v
                    ? { background: 'rgba(52,211,153,0.2)', color: '#34d399', border: '1px solid rgba(52,211,153,0.4)' }
                    : { border: `1px solid ${tw}0.1)`, color: `${tw}0.5)` }}
                  onMouseEnter={e => { if (via !== v) e.currentTarget.style.background = `${tw}0.04)` }}
                  onMouseLeave={e => { if (via !== v) e.currentTarget.style.background = 'transparent' }}
                >
                  {v === 'kommo' ? 'Vía Kommo' : 'Vía Meta directo'}
                </button>
              ))}
            </div>
            <p className="text-[11px] mt-1" style={{ color: `${tw}0.35)` }}>
              {via === 'kommo'
                ? 'Usa el chat existente en Kommo. Requiere que el cliente haya escrito antes.'
                : 'Llama a la API de Meta directamente. Requiere ventana de 24h o plantilla aprobada.'}
            </p>
          </div>

          <button
            type="button"
            onClick={enviar}
            disabled={enviando || !telefono.trim()}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
            style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(52,211,153,0.25)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(52,211,153,0.15)')}
          >
            {enviando
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
              : 'Enviar mensaje de prueba'}
          </button>

          {resultado && (
            <div className="flex items-start gap-2 text-xs p-2.5 rounded-xl"
              style={resultado.tipo === 'ok'
                ? { background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', color: '#34d399' }
                : resultado.tipo === 'aviso'
                  ? { background: 'rgba(245,184,0,0.08)', border: '1px solid rgba(245,184,0,0.2)', color: '#F5B800' }
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
