'use client'

import { useState } from 'react'
import { MessageCircle, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
      ok?: boolean
      via?: string
      metodo?: string
      mensaje?: string
      error?: string
    }

    setEnviando(false)

    if (!res.ok) {
      setResultado({ tipo: 'error', texto: data.error ?? 'Falló el envío' })
      return
    }

    if (data.via === 'kommo' && data.metodo === 'sin_contacto') {
      setResultado({
        tipo: 'aviso',
        texto: data.mensaje ?? 'Sin contacto en Kommo. El cliente debe escribir primero al WhatsApp del negocio.',
      })
      return
    }

    if (data.via === 'kommo' && data.metodo === 'tarea') {
      setResultado({
        tipo: 'aviso',
        texto: data.mensaje ?? 'Sin chat activo. Se creó una tarea en Kommo.',
      })
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
      <Button
        type="button"
        variant="outline"
        className="w-full border-green-200 text-green-700 hover:bg-green-50 hover:border-green-300 gap-2"
        onClick={() => setAbierto(v => !v)}
      >
        <MessageCircle className="h-4 w-4" />
        {abierto ? 'Ocultar prueba' : 'Probar WhatsApp'}
      </Button>

      {abierto && (
        <div className="space-y-3 p-3 bg-green-50/50 border border-green-100 rounded-lg">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Teléfono destino</label>
            <input
              type="tel"
              value={telefono}
              onChange={e => setTelefono(e.target.value)}
              placeholder="+573001234567"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Método de envío</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setVia('kommo')}
                className={`flex-1 px-3 py-2 text-xs rounded-lg border transition-colors ${
                  via === 'kommo'
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                Vía Kommo
              </button>
              <button
                type="button"
                onClick={() => setVia('meta')}
                className={`flex-1 px-3 py-2 text-xs rounded-lg border transition-colors ${
                  via === 'meta'
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                Vía Meta directo
              </button>
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              {via === 'kommo'
                ? 'Usa el chat existente en Kommo. Requiere que el cliente haya escrito antes.'
                : 'Llama a la API de Meta directamente. Requiere ventana de 24h o plantilla aprobada.'}
            </p>
          </div>

          <Button
            type="button"
            onClick={enviar}
            disabled={enviando || !telefono.trim()}
            className="w-full bg-green-600 hover:bg-green-700 text-white gap-2"
          >
            {enviando
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
              : 'Enviar mensaje de prueba'}
          </Button>

          {resultado && (
            <div
              className={`flex items-start gap-2 text-xs p-2.5 rounded-md border ${
                resultado.tipo === 'ok' ? 'bg-green-50 border-green-200 text-green-800'
                  : resultado.tipo === 'aviso' ? 'bg-amber-50 border-amber-200 text-amber-800'
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
