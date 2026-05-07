export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Package, PlusCircle, ChevronRight } from 'lucide-react'
import { CATEGORIA_LABELS, type CategoriaProducto } from '@/types'

// ─── Tracker: mapeo estado → paso (0-4) ──────────────────────────────────────
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

// Clases completas para que Tailwind las incluya en el build
const DOT_ACTIVO = [
  'bg-slate-500 text-white ring-2 ring-offset-1 ring-slate-300 animate-pulse',
  'bg-blue-500  text-white ring-2 ring-offset-1 ring-blue-300  animate-pulse',
  'bg-orange-500 text-white ring-2 ring-offset-1 ring-orange-300 animate-pulse',
  'bg-violet-500 text-white ring-2 ring-offset-1 ring-violet-300 animate-pulse',
  'bg-green-500  text-white ring-2 ring-offset-1 ring-green-300',
]
const DOT_HECHO = [
  'bg-slate-400  text-white',
  'bg-blue-400   text-white',
  'bg-orange-400 text-white',
  'bg-violet-400 text-white',
  'bg-green-500  text-white',
]
const BARRA_COLOR = [
  'bg-slate-400',
  'bg-blue-500',
  'bg-orange-500',
  'bg-violet-500',
  'bg-green-500',
]
const STRIP_COLOR = [
  'from-slate-400  to-slate-400',
  'from-slate-300  to-blue-500',
  'from-blue-500   to-orange-500',
  'from-orange-500 to-violet-500',
  'from-violet-400 to-green-500',
]

// ─── Page ────────────────────────────────────────────────────────────────────
export default async function PaquetesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: paquetes } = await supabase
    .from('paquetes')
    .select('*, fotos_paquetes(id)')
    .eq('cliente_id', user!.id)
    .order('created_at', { ascending: false })

  const activos    = paquetes?.filter(p => !['entregado', 'devuelto'].includes(p.estado)) ?? []
  const completados = paquetes?.filter(p => ['entregado', 'devuelto'].includes(p.estado)) ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Mis paquetes</h1>
        <Link href="/reportar">
          <Button className="bg-orange-600 hover:bg-orange-700 gap-2" size="sm">
            <PlusCircle className="h-4 w-4" />
            Nuevo
          </Button>
        </Link>
      </div>

      {!paquetes || paquetes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">Aún no tienes paquetes registrados</p>
            <Link href="/reportar">
              <Button className="bg-orange-600 hover:bg-orange-700 gap-2">
                <PlusCircle className="h-4 w-4" />
                Reportar mi primer pedido
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {activos.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                En proceso ({activos.length})
              </h2>
              <div className="space-y-3">
                {activos.map(p => <PaqueteCard key={p.id} paquete={p} />)}
              </div>
            </section>
          )}

          {completados.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Historial ({completados.length})
              </h2>
              <div className="space-y-3">
                {completados.map(p => <PaqueteCard key={p.id} paquete={p} />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

// ─── Tarjeta individual ───────────────────────────────────────────────────────
function PaqueteCard({ paquete }: { paquete: any }) {
  const tienesFotos = paquete.fotos_paquetes?.length > 0
  const paso        = PASO_ESTADOS[paquete.estado as string] ?? 0
  const esDevuelto  = paquete.estado === 'devuelto'
  const esRetenido  = paquete.estado === 'retenido'

  // Overrides de color para estados especiales
  const barColor       = esDevuelto ? 'bg-red-400'   : esRetenido ? 'bg-amber-400' : BARRA_COLOR[paso]
  const stripGradient  = esDevuelto ? 'from-red-500 to-red-400'     : esRetenido ? 'from-amber-400 to-amber-500' : STRIP_COLOR[paso]
  const activeDotClass = esDevuelto
    ? 'bg-red-500 text-white ring-2 ring-offset-1 ring-red-300'
    : esRetenido
      ? 'bg-amber-500 text-white ring-2 ring-offset-1 ring-amber-300 animate-pulse'
      : DOT_ACTIVO[paso]

  function iconoPaso(i: number) {
    if (i === 4 && esDevuelto) return '↩️'
    if (i === 1 && esRetenido) return '⚠️'
    return PASOS_TRACKER[i].icon
  }

  return (
    <Link href={`/paquetes/${paquete.id}`}>
      <Card className="hover:shadow-lg transition-all cursor-pointer overflow-hidden border-gray-200 group">

        {/* Franja superior degradada según estado */}
        <div className={`h-1.5 bg-gradient-to-r ${stripGradient}`} />

        <CardContent className="px-4 pt-3 pb-4">

          {/* ── Cabecera ── */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-gray-900 leading-snug">{paquete.descripcion}</p>
                {tienesFotos && (
                  <span className="text-[11px] bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded-full shrink-0">
                    📷 Fotos
                  </span>
                )}
                {esRetenido && (
                  <span className="text-[11px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full font-semibold shrink-0">
                    ⚠️ Retenido
                  </span>
                )}
                {esDevuelto && (
                  <span className="text-[11px] bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded-full font-semibold shrink-0">
                    ↩️ Devuelto
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-400 flex-wrap">
                {paquete.tienda && <><span>{paquete.tienda}</span><span>·</span></>}
                <span>{CATEGORIA_LABELS[paquete.categoria as CategoriaProducto] ?? paquete.categoria}</span>
                <span>·</span>
                <span className="font-mono">{paquete.tracking_casilla}</span>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-orange-400 flex-shrink-0 mt-0.5 transition-colors" />
          </div>

          {/* ── Tracker de progreso ── */}
          <div className="relative pb-1">
            {/* Línea de fondo (gris) */}
            <div className="absolute top-4 left-[10%] w-[80%] h-1.5 bg-gray-100 rounded-full" />
            {/* Línea de progreso (color) */}
            <div
              className={`absolute top-4 left-[10%] h-1.5 rounded-full ${barColor} transition-all duration-700`}
              style={{ width: `${paso * 20}%` }}
            />
            {/* Puntos + etiquetas */}
            <div className="relative grid grid-cols-5 z-10">
              {PASOS_TRACKER.map((s, i) => {
                const hecho = i < paso
                const actual = i === paso
                return (
                  <div key={i} className="flex flex-col items-center gap-1.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-base transition-all ${
                      actual
                        ? `${activeDotClass} shadow-lg`
                        : hecho
                          ? `${DOT_HECHO[i]} shadow-sm`
                          : 'bg-gray-100'
                    }`}>
                      {(actual || hecho)
                        ? <span>{iconoPaso(i)}</span>
                        : <span className="w-1.5 h-1.5 rounded-full bg-gray-300 block" />
                      }
                    </div>
                    <span className={`text-[10px] text-center leading-tight font-medium ${
                      actual ? 'text-gray-800'
                        : hecho ? 'text-gray-400'
                          : 'text-gray-200'
                    }`}>
                      {s.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Info extra: peso y costo ── */}
          {(paquete.peso_libras || paquete.costo_servicio) && (
            <div className="flex items-center gap-4 mt-3 pt-2.5 border-t border-gray-100 text-xs">
              {paquete.peso_libras && (
                <span className="text-gray-500">⚖️ {paquete.peso_libras} lbs</span>
              )}
              {paquete.costo_servicio && (
                <span className="font-semibold text-gray-700">
                  💵 ${Number(paquete.costo_servicio).toFixed(2)} USD
                </span>
              )}
            </div>
          )}

        </CardContent>
      </Card>
    </Link>
  )
}
