'use client'

import { useEffect, useState } from 'react'
import { TRACKING_LABELS, PASOS_PRINCIPALES_MEDELLIN, PASOS_PRINCIPALES_BOGOTA } from '@/lib/usaco/tracking'
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
  bodegaKey?: string
  estadoUsaco?: string | null
  pasoMinimo?: number   // piso calculado desde paquete.estado + estado_usaco
}

// Estado USACO raw → índice de paso (mismo mapa que paquetes/page.tsx)
const USACO_A_PASO: Record<string, number> = {
  GuiaCreadaColaborador: 3,
  TransitoInternacional: 4,
  ProcesoDeAduana:       5,
  BodegaDestino:         6,
  EnRuta:                7,
  'En ruta transito':    7,
  EnTransportadora:      7,
  EntregaFallida:        7,
  Entregado:             8,
}

// 9 hitos — coincide exactamente con el tracker del correo
const HITOS_MEDELLIN = [
  { emoji: '📝', label: 'Reportado'  },
  { emoji: '🇺🇸', label: 'Miami'     },
  { emoji: '📦', label: 'Procesado'  },
  { emoji: '📄', label: 'Guía'       },
  { emoji: '✈️',  label: 'Tránsito'  },
  { emoji: '🛃',  label: 'Aduana'    },
  { emoji: '🇨🇴', label: 'Colombia'  },
  { emoji: '📍', label: 'En bodega'  },
  { emoji: '✓',  label: 'Entregado'  },
]
const HITOS_BOGOTA = [
  { emoji: '📝', label: 'Reportado'  },
  { emoji: '🇺🇸', label: 'Miami'     },
  { emoji: '📦', label: 'Procesado'  },
  { emoji: '📄', label: 'Guía'       },
  { emoji: '✈️',  label: 'Tránsito'  },
  { emoji: '🛃',  label: 'Aduana'    },
  { emoji: '🇨🇴', label: 'Colombia'  },
  { emoji: '🚚', label: 'En ruta'    },
  { emoji: '✓',  label: 'Entregado'  },
]

// Evento de tracking → índice de paso (mismo mapa que el email)
const EVENTO_A_PASO: Record<string, number> = {
  reportado:              0,
  recibido_usa:           1,
  recibido_miami:         1,
  retenido:               1,
  en_consolidacion:       2,
  listo_envio:            2,
  procesado:              2,
  guia_creada:            3,
  incluido_guia:          3,
  en_transito:            4,
  transito_internacional: 4,
  proceso_aduana:         5,
  en_colombia:            6,
  llego_colombia:         6,
  en_bodega_local:        7,
  listo_entrega:          7,
  en_camino_cliente:      7,
  en_ruta:                7,
  en_ruta_transito:       7,
  en_transportadora:      7,
  entrega_fallida:        7,
  entregado:              8,
  entregado_transporte:   8,
  devuelto:               8,
}

// Paleta idéntica al email
const GOLD     = '#F5B800'
const GOLD_DIM = '#7a5c00'
const PURPLE   = '#a5b4fc'
const BG_INNER = '#19193a'
const BORDER   = '#3a3a68'
const MUTED    = '#6868a0'

export function TrackingTimeline({ eventos, bodegaKey, estadoUsaco, pasoMinimo = 0 }: Props) {
  const esMedellin = !bodegaKey || bodegaKey === 'medellin'
  const hitos      = esMedellin ? HITOS_MEDELLIN : HITOS_BOGOTA
  const PASOS      = esMedellin ? PASOS_PRINCIPALES_MEDELLIN : PASOS_PRINCIPALES_BOGOTA

  // Ordenar cronológicamente, deduplicar por tipo de evento
  const sorted = [...eventos].sort(
    (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
  )
  const seen = new Set<string>()
  const ordenados = sorted.filter(e => {
    if (seen.has(e.evento)) return false
    seen.add(e.evento)
    return true
  })

  // Paso activo = máximo entre: eventos de tracking, estado_usaco, y estado interno del paquete
  let pasoActivo = pasoMinimo  // piso: lo que ya sabe la página desde paquete.estado + estado_usaco
  for (const e of ordenados) {
    const p = EVENTO_A_PASO[e.evento] ?? -1
    if (p > pasoActivo) pasoActivo = p
  }
  if (estadoUsaco) {
    const pasoUsaco = USACO_A_PASO[estadoUsaco] ?? 0
    if (pasoUsaco > pasoActivo) pasoActivo = pasoUsaco
  }

  const porcentaje = Math.round((pasoActivo / (hitos.length - 1)) * 100)

  // Animación de la barra: arranca en 0, llega al valor real 100 ms después del mount
  const [barWidth, setBarWidth] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setBarWidth(porcentaje), 100)
    return () => clearTimeout(t)
  }, [porcentaje])

  // Pasos pendientes (para la lista de detalle)
  const completados = new Set(ordenados.map(e => e.evento))
  let lastMainIdx = -1
  for (let i = PASOS.length - 1; i >= 0; i--) {
    if (completados.has(PASOS[i])) { lastMainIdx = i; break }
  }
  const pendientes = PASOS.filter((p, i) => !completados.has(p) && i > lastMainIdx)

  if (ordenados.length === 0 && pendientes.length === 0) return null

  return (
    <div className="space-y-5">
      {/* ── Barra de 9 pasos (igual al email) ────────────────────────── */}
      <div style={{
        background: BG_INNER,
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        padding: '18px 8px 16px',
      }}>
        <p style={{
          textAlign: 'center',
          fontSize: 10,
          color: MUTED,
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
          fontWeight: 'bold',
          margin: '0 0 12px 0',
        }}>
          Estado del envío
        </p>

        {/* Barra de progreso animada */}
        <div style={{
          height: 3,
          background: BORDER,
          borderRadius: 2,
          margin: '0 14px 14px 14px',
        }}>
          <div style={{
            height: 3,
            background: GOLD,
            borderRadius: 2,
            width: `${barWidth}%`,
            transition: 'width 1.4s cubic-bezier(0.22, 1, 0.36, 1)',
          }} />
        </div>

        {/* Círculos de pasos */}
        <div style={{ display: 'flex' }}>
          {hitos.map((h, i) => {
            const completado = i < pasoActivo
            const actual     = i === pasoActivo
            const circleBg   = actual ? GOLD   : completado ? PURPLE  : BORDER
            const circleClr  = actual || completado ? '#000' : MUTED
            const labelClr   = actual ? GOLD   : completado ? PURPLE  : MUTED
            const labelW     = actual ? '700' : '400'

            return (
              <div key={i} style={{ flex: 1, textAlign: 'center', padding: '0 1px' }}>
                <div style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: circleBg,
                  color: circleClr,
                  margin: '0 auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  outline: actual ? `2px solid ${GOLD_DIM}` : 'none',
                  outlineOffset: actual ? 2 : 0,
                  animation: actual ? 'csTrackPulse 2.2s ease-in-out infinite' : 'none',
                }}>
                  {h.emoji}
                </div>
                <p style={{
                  margin: '4px 0 0',
                  fontSize: 7.5,
                  fontWeight: labelW,
                  color: labelClr,
                  lineHeight: 1.2,
                  fontFamily: 'inherit',
                }}>
                  {h.label}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Log de eventos completados ────────────────────────────────── */}
      <div>
        {ordenados.map((evento, i) => {
          const def        = TRACKING_LABELS[evento.evento]
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
                  <div className="w-px flex-1 mt-1 mb-1 min-h-[12px]"
                    style={{ background: 'rgba(255,255,255,0.1)' }} />
                )}
              </div>
              <div className="pb-4 min-w-0">
                <p className="text-sm font-medium text-white">{def?.label ?? evento.evento}</p>
                {evento.descripcion && (
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    {evento.descripcion}
                  </p>
                )}
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {fechaHoraLarga(evento.fecha)}
                </p>
              </div>
            </div>
          )
        })}

        {/* Pasos pendientes (opacos) */}
        {pendientes.map((paso, i) => {
          const def    = TRACKING_LABELS[paso]
          const isLast = i === pendientes.length - 1
          return (
            <div key={paso} className="flex gap-3 opacity-40">
              <div className="flex flex-col items-center shrink-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <span className="w-2 h-2 rounded-full block" style={{ background: 'rgba(255,255,255,0.2)' }} />
                </div>
                {!isLast && (
                  <div className="w-px flex-1 mt-1 mb-1 min-h-[12px]"
                    style={{ background: 'rgba(255,255,255,0.05)' }} />
                )}
              </div>
              <div className="pb-4">
                <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {def?.label ?? paso}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Keyframe para el pulso del círculo activo */}
      <style>{`
        @keyframes csTrackPulse {
          0%, 100% { opacity: 1; transform: scale(1);    }
          50%       { opacity: .82; transform: scale(1.1); }
        }
      `}</style>
    </div>
  )
}
