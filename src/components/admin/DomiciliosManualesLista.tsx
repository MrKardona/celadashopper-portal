'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2, X, Check } from 'lucide-react'

const tw = 'rgba(255,255,255,'

interface DomicilioManual {
  id: string
  nombre: string
  direccion: string
  notas: string | null
}

interface Props {
  manuales: DomicilioManual[]
}

export default function DomiciliosManualesLista({ manuales: inicial }: Props) {
  const router = useRouter()
  const [lista, setLista] = useState(inicial)
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [borrando, setBorrando] = useState(false)

  async function eliminar(id: string) {
    setBorrando(true)
    try {
      const res = await fetch(`/api/admin/domicilios-manuales/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setLista(prev => prev.filter(m => m.id !== id))
        setConfirmando(null)
        router.refresh()
      }
    } finally {
      setBorrando(false)
    }
  }

  if (lista.length === 0) return null

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: `${tw}0.3)` }}>
        Domicilios manuales · {lista.length}
      </p>
      {lista.map((m, idx) => {
        const esteConfirmando = confirmando === m.id
        return (
          <div
            key={m.id}
            className="flex items-start gap-2 rounded-xl px-3 py-2 transition-all"
            style={{
              background: esteConfirmando ? 'rgba(239,68,68,0.07)' : 'rgba(129,140,248,0.06)',
              border: esteConfirmando ? '1px solid rgba(239,68,68,0.25)' : '1px solid rgba(129,140,248,0.12)',
            }}
          >
            <span className="text-[10px] font-bold mt-0.5 flex-shrink-0" style={{ color: '#818cf8' }}>
              {idx + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{m.nombre}</p>
              <p className="text-[11px] truncate" style={{ color: `${tw}0.4)` }}>{m.direccion}</p>
              {m.notas && (
                <p className="text-[10px] mt-0.5 truncate" style={{ color: `${tw}0.28)` }}>{m.notas}</p>
              )}

              {/* Confirmación inline */}
              {esteConfirmando && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="text-[11px]" style={{ color: '#f87171' }}>¿Eliminar?</span>
                  <button
                    onClick={() => eliminar(m.id)}
                    disabled={borrando}
                    className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg disabled:opacity-50"
                    style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}
                  >
                    {borrando
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <><Check className="h-3 w-3" />Sí</>}
                  </button>
                  <button
                    onClick={() => setConfirmando(null)}
                    className="text-[11px] px-2 py-0.5 rounded-lg"
                    style={{ color: `${tw}0.4)`, border: `1px solid ${tw}0.1)` }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Botón eliminar */}
            {!esteConfirmando && (
              <button
                onClick={() => setConfirmando(m.id)}
                className="p-1 rounded-lg flex-shrink-0 transition-colors mt-0.5"
                title="Eliminar domicilio"
                style={{ color: `${tw}0.2)` }}
                onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                onMouseLeave={e => (e.currentTarget.style.color = `${tw}0.2)`)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
