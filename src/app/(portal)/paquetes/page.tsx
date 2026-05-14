export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Package, PlusCircle, ChevronRight } from 'lucide-react'
import { CATEGORIA_LABELS, type CategoriaProducto } from '@/types'
import { FadeUp, FadeUpScroll, StaggerGridScroll, StaggerItem } from '@/components/portal/AnimateIn'
import { fechaCorta } from '@/lib/fecha'
import FotoThumb from '@/components/ui/FotoThumb'

// ── 9 pasos — mismo mapa que email y TrackingTimeline ──────────────────────
// Estado interno → índice de paso
const PASO_ESTADOS: Record<string, number> = {
  reportado:          0,
  recibido_usa:       1,
  retenido:           1,
  en_consolidacion:   2,
  listo_envio:        2,
  en_transito:        4,   // guia_creada (3) puede venir de estado_usaco
  en_colombia:        6,
  llego_colombia:     6,
  en_bodega_local:    7,
  listo_entrega:      7,
  en_camino_cliente:  7,
  entregado:          8,
  devuelto:           8,
}

// Estado USACO → índice de paso (refina el paso cuando el estado interno es más bajo)
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

// Hitos ciudad Medellín y Bogotá
const HITOS_MEDELLIN = [
  { label: 'Reportado', icon: '📝' },
  { label: 'Miami',     icon: '🇺🇸' },
  { label: 'Procesado', icon: '📦' },
  { label: 'Guía',      icon: '📄' },
  { label: 'Tránsito',  icon: '✈️'  },
  { label: 'Aduana',    icon: '🛃'  },
  { label: 'Colombia',  icon: '🇨🇴' },
  { label: 'En bodega', icon: '📍'  },
  { label: 'Entregado', icon: '✓'   },
]
const HITOS_BOGOTA = [
  { label: 'Reportado', icon: '📝' },
  { label: 'Miami',     icon: '🇺🇸' },
  { label: 'Procesado', icon: '📦' },
  { label: 'Guía',      icon: '📄' },
  { label: 'Tránsito',  icon: '✈️'  },
  { label: 'Aduana',    icon: '🛃'  },
  { label: 'Colombia',  icon: '🇨🇴' },
  { label: 'En ruta',   icon: '🚚'  },
  { label: 'Entregado', icon: '✓'   },
]

// Paleta idéntica al email y TrackingTimeline
const GOLD    = '#F5B800'
const GOLD_D  = '#7a5c00'
const PURPLE  = '#a5b4fc'
const BG_STEP = '#19193a'
const BORDER  = '#3a3a68'
const MUTED   = '#6868a0'

const tw = 'rgba(255,255,255,'

export default async function PaquetesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: paquetes } = await supabase
    .from('paquetes')
    .select('*, fotos_paquetes(url, created_at, descripcion)')
    .eq('cliente_id', user!.id)
    .eq('visible_cliente', true)
    .is('paquete_origen_id', null)   // excluir divisiones
    .order('created_at', { ascending: false })

  const activos     = paquetes?.filter(p => !['entregado', 'devuelto'].includes(p.estado)) ?? []
  const completados = paquetes?.filter(p => ['entregado', 'devuelto'].includes(p.estado)) ?? []

  return (
    <div className="space-y-6" style={{ fontFamily: "'Outfit', sans-serif" }}>

      <FadeUp>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Mis paquetes</h1>
          <Link
            href="/reportar"
            className="btn-gold inline-flex items-center gap-2 px-4 py-2.5 text-sm rounded-xl font-bold"
          >
            <PlusCircle className="h-4 w-4" />
            Nuevo
          </Link>
        </div>
      </FadeUp>

      {!paquetes || paquetes.length === 0 ? (
        <FadeUp delay={0.1}>
          <div className="glass-card text-center py-12">
            <Package className="h-12 w-12 mx-auto mb-4" style={{ color: `${tw}0.18)` }} />
            <p className="mb-4 text-sm" style={{ color: `${tw}0.45)` }}>Aún no tienes paquetes registrados</p>
            <Link href="/reportar" className="btn-gold inline-flex items-center gap-2 px-4 py-2.5 text-sm rounded-xl font-bold">
              <PlusCircle className="h-4 w-4" />
              Reportar mi primer pedido
            </Link>
          </div>
        </FadeUp>
      ) : (
        <>
          {activos.length > 0 && (
            <section>
              <FadeUp>
                <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: `${tw}0.35)` }}>
                  En proceso ({activos.length})
                </h2>
              </FadeUp>
              <div className="space-y-3">
                {activos.map((p, i) => (
                  <StaggerItem key={p.id} index={i}>
                    <PaqueteCard paquete={p} />
                  </StaggerItem>
                ))}
              </div>
            </section>
          )}

          {completados.length > 0 && (
            <section>
              <FadeUpScroll>
                <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: `${tw}0.35)` }}>
                  Historial ({completados.length})
                </h2>
              </FadeUpScroll>
              <div className="space-y-3">
                {completados.map((p, i) => (
                  <StaggerItem key={p.id} index={i}>
                    <PaqueteCard paquete={p} />
                  </StaggerItem>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function fotoProducto(fotos: { url: string; descripcion?: string | null; created_at: string }[]): string | null {
  if (!fotos || fotos.length === 0) return null
  const sorted = [...fotos].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  // 1. Photo tagged as "contenido"
  const contenido = sorted.find(f => (f.descripcion ?? '').toLowerCase().includes('contenido'))
  if (contenido) return contenido.url
  // 2. Second photo (typically content)
  if (sorted.length > 1) return sorted[1].url
  // 3. Only photo available
  return sorted[0]?.url ?? null
}

function PaqueteCard({ paquete }: { paquete: any }) {
  const fotos    = [...(paquete.fotos_paquetes ?? [])] as { url: string; descripcion?: string | null; created_at: string }[]
  const thumbUrl = fotoProducto(fotos)

  const esDevuelto  = paquete.estado === 'devuelto'
  const esRetenido  = paquete.estado === 'retenido'
  const esMedellin  = !paquete.bodega_destino || paquete.bodega_destino === 'medellin'
  const hitos       = esMedellin ? HITOS_MEDELLIN : HITOS_BOGOTA

  // Paso activo = máximo entre el estado interno y el estado USACO
  const pasoEstado = PASO_ESTADOS[paquete.estado as string] ?? 0
  const pasoUsaco  = paquete.estado_usaco ? (USACO_A_PASO[paquete.estado_usaco as string] ?? 0) : 0
  const paso       = Math.max(pasoEstado, pasoUsaco)

  // Porcentaje de la barra (8 segmentos entre 9 pasos)
  const pct = Math.round((paso / 8) * 100)

  // Color de la franja superior y la barra según estado especial
  const stripGradient = esDevuelto
    ? 'from-red-600 to-red-500'
    : esRetenido
      ? 'from-amber-400 to-amber-500'
      : 'from-yellow-600 to-yellow-400'
  const barFill = esDevuelto ? '#ef4444' : esRetenido ? '#F5B800' : GOLD

  return (
    <Link href={`/paquetes/${paquete.id}`}>
      <div className="glass-card cursor-pointer overflow-hidden group transition-all hover:border-white/[0.14]">

        {/* Franja de color superior */}
        <div className={`h-1.5 bg-gradient-to-r ${stripGradient}`} />

        <div className="px-4 pt-3 pb-4">

          {/* Cabecera */}
          <div className="flex items-start gap-3 mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-white leading-snug group-hover:text-yellow-300 transition-colors">
                  {paquete.descripcion}
                </p>
                {esRetenido && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded-full font-semibold shrink-0"
                    style={{ background: 'rgba(245,184,0,0.15)', color: GOLD, border: '1px solid rgba(245,184,0,0.3)' }}>
                    ⚠️ Retenido
                  </span>
                )}
                {esDevuelto && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded-full font-semibold shrink-0"
                    style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
                    ↩️ Devuelto
                  </span>
                )}
              </div>

              {/* Tienda · categoría · fecha */}
              <div className="flex items-center gap-1.5 mt-0.5 text-xs flex-wrap" style={{ color: `${tw}0.38)` }}>
                {paquete.tienda && <><span>{paquete.tienda}</span><span>·</span></>}
                <span>{CATEGORIA_LABELS[paquete.categoria as CategoriaProducto] ?? paquete.categoria}</span>
                {paquete.fecha_recepcion_usa && (
                  <><span>·</span><span>{fechaCorta(paquete.fecha_recepcion_usa)}</span></>
                )}
              </div>

              {/* Tracking */}
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                {paquete.tracking_origen && (
                  <span className="text-[11px] font-mono" style={{ color: `${tw}0.3)` }}>
                    📦 {paquete.tracking_origen}
                  </span>
                )}
                {paquete.tracking_usaco && (
                  <span className="text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(245,184,0,0.1)', color: GOLD, border: '1px solid rgba(245,184,0,0.2)' }}>
                    ✈️ {paquete.tracking_usaco}
                  </span>
                )}
              </div>
            </div>

            {/* Thumbnail + chevron */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <FotoThumb url={thumbUrl} alt={paquete.descripcion} width={52} height={52} radius="0.75rem" />
              <ChevronRight className="h-5 w-5 transition-colors group-hover:text-yellow-300"
                style={{ color: `${tw}0.2)` }} />
            </div>
          </div>

          {/* ── Tracker 9 pasos (igual al email y TrackingTimeline) ─────── */}
          <div style={{
            background: BG_STEP,
            border: `1px solid ${BORDER}`,
            borderRadius: 10,
            padding: '12px 6px 10px',
          }}>
            {/* Barra de progreso */}
            <div style={{ height: 2, background: BORDER, borderRadius: 2, margin: '0 10px 10px' }}>
              <div style={{
                height: 2,
                background: barFill,
                borderRadius: 2,
                width: `${pct}%`,
                transition: 'width 0.8s ease-out',
              }} />
            </div>

            {/* Círculos */}
            <div style={{ display: 'flex' }}>
              {hitos.map((h, i) => {
                const completado = i < paso
                const actual     = i === paso
                const circleBg   = esDevuelto && i === 8
                  ? '#ef4444'
                  : actual   ? GOLD
                  : completado ? PURPLE
                  : BORDER
                const clr = actual || completado ? '#000' : MUTED
                const lClr = actual ? GOLD : completado ? PURPLE : MUTED
                const lW   = actual ? '700' : '400'
                const icon = esDevuelto && i === 8 ? '↩️'
                  : esRetenido && i === 1 ? '⚠️'
                  : h.icon

                return (
                  <div key={i} style={{ flex: 1, textAlign: 'center', padding: '0 1px' }}>
                    <div style={{
                      width: 26, height: 26,
                      borderRadius: '50%',
                      background: circleBg,
                      color: clr,
                      margin: '0 auto',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      outline: actual ? `2px solid ${GOLD_D}` : 'none',
                      outlineOffset: actual ? 2 : 0,
                      animation: actual && !esDevuelto ? 'csCardPulse 2.2s ease-in-out infinite' : 'none',
                    }}>
                      {(actual || completado)
                        ? <span style={{ lineHeight: 1 }}>{icon}</span>
                        : <span style={{ width: 5, height: 5, borderRadius: '50%', background: MUTED, display: 'block' }} />
                      }
                    </div>
                    <p style={{
                      margin: '3px 0 0',
                      fontSize: 7,
                      fontWeight: lW,
                      color: lClr,
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

          {/* Peso y costo */}
          {(paquete.peso_libras || paquete.costo_servicio) && (
            <div className="flex items-center gap-4 mt-3 pt-2.5 text-xs" style={{ borderTop: `1px solid ${tw}0.06)` }}>
              {paquete.peso_libras && (
                <span style={{ color: `${tw}0.45)` }}>⚖️ {paquete.peso_libras} lbs</span>
              )}
              {paquete.costo_servicio && (
                <span className="font-semibold" style={{ color: `${tw}0.75)` }}>
                  💵 ${Number(paquete.costo_servicio).toFixed(2)} USD
                </span>
              )}
            </div>
          )}

        </div>
      </div>
    </Link>
  )
}
