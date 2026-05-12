export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Package, PlusCircle, ChevronRight } from 'lucide-react'
import { CATEGORIA_LABELS, type CategoriaProducto } from '@/types'
import { FadeUp, FadeUpScroll, StaggerGridScroll, StaggerItem } from '@/components/portal/AnimateIn'
import { fechaCorta } from '@/lib/fecha'
import FotoThumb from '@/components/ui/FotoThumb'

const PASO_ESTADOS: Record<string, number> = {
  reportado: 0,
  recibido_usa: 1, en_consolidacion: 1, listo_envio: 1, retenido: 1,
  en_transito: 2, en_colombia: 2,
  en_bodega_local: 3, en_camino_cliente: 3,
  entregado: 4, devuelto: 4,
}

const PASOS_TRACKER = [
  { label: 'Reportado', icon: '📝' },
  { label: 'Miami',     icon: '🇺🇸' },
  { label: 'En camino', icon: '✈️'  },
  { label: 'Bodega',    icon: '📍'  },
  { label: 'Entregado', icon: '✅'  },
]

const DOT_ACTIVO = [
  'bg-slate-500 text-white ring-2 ring-offset-1 ring-offset-transparent ring-slate-400 animate-pulse',
  'bg-blue-500  text-white ring-2 ring-offset-1 ring-offset-transparent ring-blue-400  animate-pulse',
  'bg-amber-500 text-white ring-2 ring-offset-1 ring-offset-transparent ring-amber-400 animate-pulse',
  'bg-violet-500 text-white ring-2 ring-offset-1 ring-offset-transparent ring-violet-400 animate-pulse',
  'bg-green-500  text-white ring-2 ring-offset-1 ring-offset-transparent ring-green-400',
]
const DOT_HECHO = [
  'bg-slate-400  text-white',
  'bg-blue-400   text-white',
  'bg-amber-400  text-white',
  'bg-violet-400 text-white',
  'bg-green-500  text-white',
]
const BARRA_COLOR = [
  'bg-slate-400',
  'bg-blue-500',
  'bg-amber-500',
  'bg-violet-500',
  'bg-green-500',
]
const STRIP_COLOR = [
  'from-slate-400  to-slate-400',
  'from-slate-300  to-blue-500',
  'from-blue-500   to-amber-500',
  'from-amber-500  to-violet-500',
  'from-violet-400 to-green-500',
]

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
  const fotos = [...(paquete.fotos_paquetes ?? [])] as { url: string; descripcion?: string | null; created_at: string }[]
  const thumbUrl = fotoProducto(fotos)

  const paso = PASO_ESTADOS[paquete.estado as string] ?? 0
  const esDevuelto  = paquete.estado === 'devuelto'
  const esRetenido  = paquete.estado === 'retenido'

  const barColor       = esDevuelto ? 'bg-red-500'   : esRetenido ? 'bg-amber-400' : BARRA_COLOR[paso]
  const stripGradient  = esDevuelto ? 'from-red-600 to-red-500' : esRetenido ? 'from-amber-400 to-amber-500' : STRIP_COLOR[paso]
  const activeDotClass = esDevuelto
    ? 'bg-red-500 text-white ring-2 ring-offset-1 ring-offset-transparent ring-red-400'
    : esRetenido
      ? 'bg-amber-500 text-white ring-2 ring-offset-1 ring-offset-transparent ring-amber-400 animate-pulse'
      : DOT_ACTIVO[paso]

  function iconoPaso(i: number) {
    if (i === 4 && esDevuelto) return '↩️'
    if (i === 1 && esRetenido) return '⚠️'
    return PASOS_TRACKER[i].icon
  }

  return (
    <Link href={`/paquetes/${paquete.id}`}>
      <div className="glass-card cursor-pointer overflow-hidden group transition-all hover:border-white/[0.14]">

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
                    style={{ background: 'rgba(245,184,0,0.15)', color: '#F5B800', border: '1px solid rgba(245,184,0,0.3)' }}>
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

              {/* Aguja (guía de transporte) */}
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                {paquete.tracking_origen && (
                  <span className="text-[11px] font-mono" style={{ color: `${tw}0.3)` }}>
                    📦 {paquete.tracking_origen}
                  </span>
                )}
                {paquete.tracking_usaco && (
                  <span className="text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(245,184,0,0.1)', color: '#F5B800', border: '1px solid rgba(245,184,0,0.2)' }}>
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

          {/* Tracker */}
          <div className="relative pb-1">
            <div className="absolute top-4 left-[10%] w-[80%] h-1.5 rounded-full" style={{ background: `${tw}0.08)` }} />
            <div
              className={`absolute top-4 left-[10%] h-1.5 rounded-full ${barColor} transition-all duration-700`}
              style={{ width: `${paso * 20}%` }}
            />
            <div className="relative grid grid-cols-5 z-10">
              {PASOS_TRACKER.map((s, i) => {
                const hecho  = i < paso
                const actual = i === paso
                return (
                  <div key={i} className="flex flex-col items-center gap-1.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-base transition-all ${
                      actual
                        ? `${activeDotClass} shadow-lg`
                        : hecho
                          ? `${DOT_HECHO[i]} shadow-sm`
                          : ''
                    }`}
                      style={!actual && !hecho ? { background: `${tw}0.07)` } : {}}
                    >
                      {(actual || hecho)
                        ? <span>{iconoPaso(i)}</span>
                        : <span className="w-1.5 h-1.5 rounded-full block" style={{ background: `${tw}0.2)` }} />
                      }
                    </div>
                    <span className="text-[10px] text-center leading-tight font-medium"
                      style={{ color: actual ? '#fff' : hecho ? `${tw}0.45)` : `${tw}0.18)` }}>
                      {s.label}
                    </span>
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
