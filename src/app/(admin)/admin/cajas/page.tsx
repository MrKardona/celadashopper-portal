import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { Box, Package, MapPin, Truck, CheckCircle2, ScanBarcode, Clock, Archive } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import NuevaCajaButton from '@/components/admin/NuevaCajaButton'
import EliminarCajaIconButton from '@/components/admin/EliminarCajaIconButton'
import SugerirArmadoButton from '@/components/admin/SugerirArmadoButton'

const ESTADO_LABELS: Record<string, string> = {
  abierta: 'Abierta', cerrada: 'Cerrada', despachada: 'Despachada', recibida_colombia: 'Recibida en Colombia',
}

const ESTADO_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  abierta:           { bg: 'rgba(245,184,0,0.12)',  color: '#F5B800',  border: 'rgba(245,184,0,0.25)' },
  cerrada:           { bg: 'rgba(99,130,255,0.12)', color: '#8899ff',  border: 'rgba(99,130,255,0.25)' },
  despachada:        { bg: 'rgba(168,85,247,0.12)', color: '#c084fc',  border: 'rgba(168,85,247,0.25)' },
  recibida_colombia: { bg: 'rgba(52,211,153,0.12)', color: '#34d399',  border: 'rgba(52,211,153,0.25)' },
}

const BODEGA_LABELS: Record<string, string> = {
  medellin: 'Medellín', bogota: 'Bogotá', barranquilla: 'Barranquilla',
}

const tw = 'rgba(255,255,255,'

export default async function CajasPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: 'public' }, auth: { persistSession: false } }
  )

  const { data: cajas } = await supabase
    .from('cajas_consolidacion')
    .select('id, codigo_interno, tracking_usaco, courier, bodega_destino, peso_estimado, peso_real, estado, created_at, fecha_despacho, fecha_recepcion_colombia')
    .order('created_at', { ascending: false })
    .limit(300)

  const lista = cajas ?? []

  const cajaIds = lista.map(c => c.id)
  const conteoMap: Record<string, number> = {}
  if (cajaIds.length > 0) {
    const { data: paquetes } = await supabase.from('paquetes').select('caja_id').in('caja_id', cajaIds)
    for (const p of paquetes ?? []) {
      if (p.caja_id) conteoMap[p.caja_id] = (conteoMap[p.caja_id] ?? 0) + 1
    }
  }

  const activas    = lista.filter(c => ['abierta', 'cerrada', 'despachada'].includes(c.estado))
  const historial  = lista.filter(c => c.estado === 'recibida_colombia')

  const CajaCard = ({ caja }: { caja: typeof lista[0] }) => {
    const count = conteoMap[caja.id] ?? 0
    const puedeEliminar = caja.estado !== 'recibida_colombia'
    const s = ESTADO_STYLE[caja.estado] ?? { bg: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', border: 'rgba(255,255,255,0.12)' }
    return (
      <div className="glass-card overflow-hidden relative group hover:border-white/[0.15] transition-all">
        {puedeEliminar && (
          <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <EliminarCajaIconButton cajaId={caja.id} codigo={caja.codigo_interno} paquetesCount={count} />
          </div>
        )}
        <Link href={`/admin/cajas/${caja.id}`} className="block p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-mono text-sm font-bold text-white">{caja.codigo_interno}</p>
              {caja.tracking_usaco && (
                <p className="text-xs font-mono mt-0.5" style={{ color: '#F5B800' }}>USACO: {caja.tracking_usaco}</p>
              )}
            </div>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${puedeEliminar ? 'mr-8' : ''}`}
              style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
              {ESTADO_LABELS[caja.estado]}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 text-xs" style={{ color: `${tw}0.5)` }}>
            <span className="flex items-center gap-1">
              <Package className="h-3 w-3" />
              <strong className="text-white">{count}</strong> paquete{count !== 1 ? 's' : ''}
            </span>
            <span style={{ color: `${tw}0.2)` }}>·</span>
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {BODEGA_LABELS[caja.bodega_destino] ?? caja.bodega_destino}
            </span>
            {caja.peso_estimado && (
              <>
                <span style={{ color: `${tw}0.2)` }}>·</span>
                <span>{Number(caja.peso_estimado).toFixed(1)} lb</span>
              </>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] pt-2" style={{ borderTop: `1px solid ${tw}0.06)`, color: `${tw}0.35)` }}>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(caja.created_at), { locale: es, addSuffix: true })}
            </span>
            {caja.estado === 'despachada' && caja.fecha_despacho && (
              <span className="flex items-center gap-1" style={{ color: '#c084fc' }}>
                <Truck className="h-3 w-3" />
                Despachada {format(new Date(caja.fecha_despacho), "d MMM", { locale: es })}
              </span>
            )}
          </div>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Box className="h-6 w-6" style={{ color: '#F5B800' }} />
            Cajas para envío a Colombia
          </h1>
          <p className="text-sm mt-1" style={{ color: `${tw}0.45)` }}>
            {activas.length} activa{activas.length !== 1 ? 's' : ''} · {historial.length} recibida{historial.length !== 1 ? 's' : ''} en Colombia
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <SugerirArmadoButton />
          <NuevaCajaButton />
        </div>
      </div>

      {/* ── CAJAS ACTIVAS ──────────────────────────────────────── */}
      {activas.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <Box className="h-10 w-10 mx-auto mb-2 opacity-20 text-white" />
          <p style={{ color: `${tw}0.4)` }}>No hay cajas activas</p>
          <p className="text-xs mt-1" style={{ color: `${tw}0.25)` }}>Crea una nueva caja para consolidar paquetes</p>
        </div>
      ) : (
        <>
          {/* Agrupar por estado dentro de activas */}
          {[
            { key: 'abierta',    label: '📦 Armando',     sub: 'Cajas aún en preparación' },
            { key: 'cerrada',    label: '🔒 Listas',       sub: 'Cerradas y listas para despachar' },
            { key: 'despachada', label: '✈️ En tránsito',  sub: 'En camino a Colombia' },
          ].map(grupo => {
            const cajaGrupo = activas.filter(c => c.estado === grupo.key)
            if (cajaGrupo.length === 0) return null
            return (
              <div key={grupo.key}>
                <div className="flex items-baseline gap-2 mb-3">
                  <h2 className="text-sm font-bold text-white">{grupo.label}</h2>
                  <span className="text-xs" style={{ color: `${tw}0.35)` }}>{grupo.sub}</span>
                  <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ ...ESTADO_STYLE[grupo.key], background: ESTADO_STYLE[grupo.key].bg, border: `1px solid ${ESTADO_STYLE[grupo.key].border}` }}>
                    {cajaGrupo.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {cajaGrupo.map(caja => <CajaCard key={caja.id} caja={caja} />)}
                </div>
              </div>
            )
          })}
        </>
      )}

      {/* Atajo recibir Colombia */}
      <div className="glass-card p-4" style={{ borderColor: 'rgba(99,130,255,0.2)', background: 'rgba(99,130,255,0.05)' }}>
        <div className="flex items-start gap-3">
          <ScanBarcode className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: '#8899ff' }} />
          <div className="flex-1">
            <p className="font-semibold text-white text-sm">¿Llegó una caja a Colombia?</p>
            <p className="text-xs mt-1 leading-relaxed" style={{ color: `${tw}0.55)` }}>
              Usa el módulo de recepción Colombia para escanear el tracking USACO y procesar todos los paquetes en bloque.
            </p>
            <Link href="/admin/recibir-colombia" className="inline-block text-xs font-semibold mt-2" style={{ color: '#8899ff' }}>
              Ir a Recibir Colombia →
            </Link>
          </div>
        </div>
      </div>

      {/* ── HISTORIAL ─────────────────────────────────────────── */}
      {historial.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Archive className="h-4 w-4" style={{ color: `${tw}0.3)` }} />
              <h2 className="text-sm font-semibold" style={{ color: `${tw}0.4)` }}>Historial — Recibidas en Colombia</h2>
            </div>
            <div className="flex-1 h-px" style={{ background: `${tw}0.07)` }} />
            <span className="text-xs" style={{ color: `${tw}0.3)` }}>{historial.length} cajas</span>
          </div>

          {/* Lista compacta en vez de grid de tarjetas */}
          <div className="glass-card overflow-hidden" style={{ opacity: 0.75 }}>
            <div className="divide-y" style={{ borderColor: `${tw}0.06)` }}>
              {historial.map(caja => {
                const count = conteoMap[caja.id] ?? 0
                return (
                  <Link key={caja.id} href={`/admin/cajas/${caja.id}`}
                    className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-white/[0.03]">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-sm font-semibold text-white">{caja.codigo_interno}</p>
                        {caja.tracking_usaco && (
                          <p className="text-xs font-mono" style={{ color: `${tw}0.35)` }}>· {caja.tracking_usaco}</p>
                        )}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: `${tw}0.35)` }}>
                        {BODEGA_LABELS[caja.bodega_destino] ?? caja.bodega_destino}
                        {caja.fecha_recepcion_colombia && ` · Llegó ${format(new Date(caja.fecha_recepcion_colombia), "d MMM yyyy", { locale: es })}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs flex-shrink-0" style={{ color: `${tw}0.35)` }}>
                      <span>{count} paq.</span>
                      {caja.peso_real && <span>{Number(caja.peso_real).toFixed(1)} lb</span>}
                      <CheckCircle2 className="h-4 w-4" style={{ color: '#34d399', opacity: 0.6 }} />
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
