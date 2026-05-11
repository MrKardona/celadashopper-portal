import { TRACKING_LABELS, PASOS_PRINCIPALES } from '@/lib/usaco/tracking'
import { fechaHoraLarga } from '@/lib/fecha'

interface TrackingEvento {
  id: string
  evento: string
  descripcion?: string | null
  fecha: string
  fuente: string
}

interface Props {
  eventos: TrackingEvento[]
}

const tw = 'rgba(255,255,255,'

export function TrackingTimeline({ eventos }: Props) {
  const ordenados = [...eventos].sort(
    (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
  )

  const completados = new Set(ordenados.map(e => e.evento))

  // Find last completed main step index so we only show future pending ones
  let lastMainIdx = -1
  for (let i = PASOS_PRINCIPALES.length - 1; i >= 0; i--) {
    if (completados.has(PASOS_PRINCIPALES[i])) { lastMainIdx = i; break }
  }

  const pendientes = PASOS_PRINCIPALES.filter(
    (p, i) => !completados.has(p) && i > lastMainIdx
  )

  const total = ordenados.length + pendientes.length
  if (total === 0) return null

  return (
    <div>
      {ordenados.map((evento, i) => {
        const def = TRACKING_LABELS[evento.evento]
        const isLastItem = i === ordenados.length - 1 && pendientes.length === 0
        return (
          <div key={evento.id} className="flex gap-3">
            <div className="flex flex-col items-center shrink-0">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                style={{ background: 'rgba(245,184,0,0.15)', border: '1px solid rgba(245,184,0,0.3)' }}
              >
                {def?.emoji ?? '📍'}
              </div>
              {!isLastItem && (
                <div className="w-px flex-1 mt-1 mb-1 min-h-[12px]" style={{ background: `${tw}0.1)` }} />
              )}
            </div>
            <div className="pb-4 min-w-0">
              <p className="text-sm font-medium text-white">{def?.label ?? evento.evento}</p>
              {evento.descripcion && (
                <p className="text-xs mt-0.5" style={{ color: `${tw}0.5)` }}>{evento.descripcion}</p>
              )}
              <p className="text-xs mt-0.5" style={{ color: `${tw}0.3)` }}>
                {fechaHoraLarga(evento.fecha)}
              </p>
            </div>
          </div>
        )
      })}

      {pendientes.map((paso, i) => {
        const def = TRACKING_LABELS[paso]
        const isLast = i === pendientes.length - 1
        return (
          <div key={paso} className="flex gap-3 opacity-40">
            <div className="flex flex-col items-center shrink-0">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: `${tw}0.04)`, border: `1px solid ${tw}0.08)` }}
              >
                <span className="w-2 h-2 rounded-full block" style={{ background: `${tw}0.2)` }} />
              </div>
              {!isLast && (
                <div className="w-px flex-1 mt-1 mb-1 min-h-[12px]" style={{ background: `${tw}0.05)` }} />
              )}
            </div>
            <div className="pb-4">
              <p className="text-sm font-medium" style={{ color: `${tw}0.4)` }}>
                {def?.label ?? paso}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
