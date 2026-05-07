import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { Box, Package, MapPin, Truck, CheckCircle2, ScanBarcode } from 'lucide-react'
import { format } from 'date-fns'
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

interface Props { searchParams: Promise<{ estado?: string }> }

export default async function CajasPage({ searchParams }: Props) {
  const { estado } = await searchParams

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: 'public' }, auth: { persistSession: false } }
  )

  let q = supabase
    .from('cajas_consolidacion')
    .select('id, codigo_interno, tracking_usaco, courier, bodega_destino, peso_estimado, peso_real, estado, created_at, fecha_despacho, fecha_recepcion_colombia')
    .order('created_at', { ascending: false })
    .limit(100)

  if (estado) q = q.eq('estado', estado)
  const { data: cajas } = await q
  const lista = cajas ?? []

  const cajaIds = lista.map(c => c.id)
  const conteoMap: Record<string, number> = {}
  if (cajaIds.length > 0) {
    const { data: paquetes } = await supabase.from('paquetes').select('caja_id').in('caja_id', cajaIds)
    for (const p of paquetes ?? []) {
      if (p.caja_id) conteoMap[p.caja_id] = (conteoMap[p.caja_id] ?? 0) + 1
    }
  }

  const pilClass = (active: boolean) => active
    ? 'px-3 py-1.5 rounded-full text-sm font-semibold transition-all'
    : 'px-3 py-1.5 rounded-full text-sm font-medium transition-all'

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Box className="h-6 w-6" style={{ color: '#F5B800' }} />
            Cajas para envío a Colombia
          </h1>
          <p className="text-sm mt-1" style={{ color: `${tw}0.45)` }}>
            Arma cajas en USA con varios paquetes y despáchalas con USACO. {lista.length} caja{lista.length !== 1 ? 's' : ''}.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <SugerirArmadoButton />
          <NuevaCajaButton />
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 text-sm">
        <Link href="/admin/cajas" className={pilClass(!estado)}
          style={!estado
            ? { background: 'rgba(245,184,0,0.15)', color: '#F5B800', border: '1px solid rgba(245,184,0,0.25)' }
            : { color: `${tw}0.5)`, border: `1px solid ${tw}0.1)` }}>
          Todas
        </Link>
        {(['abierta', 'cerrada', 'despachada', 'recibida_colombia'] as const).map(e => {
          const s = ESTADO_STYLE[e]
          return (
            <Link key={e} href={`/admin/cajas?estado=${e}`} className={pilClass(estado === e)}
              style={estado === e
                ? { background: s.bg, color: s.color, border: `1px solid ${s.border}` }
                : { color: `${tw}0.5)`, border: `1px solid ${tw}0.1)` }}>
              {ESTADO_LABELS[e]}
            </Link>
          )
        })}
      </div>

      {lista.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Box className="h-10 w-10 mx-auto mb-2 opacity-20 text-white" />
          <p style={{ color: `${tw}0.4)` }}>No hay cajas {estado ? `en estado "${ESTADO_LABELS[estado]}"` : 'creadas'}</p>
          <p className="text-xs mt-1" style={{ color: `${tw}0.25)` }}>Crea una nueva caja para empezar a consolidar paquetes</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {lista.map(caja => {
            const count = conteoMap[caja.id] ?? 0
            const puedeEliminar = caja.estado !== 'recibida_colombia'
            const s = ESTADO_STYLE[caja.estado] ?? { bg: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', border: 'rgba(255,255,255,0.12)' }
            return (
              <div key={caja.id} className="glass-card overflow-hidden relative group hover:border-white/[0.15] transition-all">
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
                    <span>Creada {format(new Date(caja.created_at), "d MMM, HH:mm", { locale: es })}</span>
                    {caja.estado === 'despachada' && caja.fecha_despacho && (
                      <span className="flex items-center gap-1" style={{ color: '#c084fc' }}>
                        <Truck className="h-3 w-3" />
                        {format(new Date(caja.fecha_despacho), "d MMM", { locale: es })}
                      </span>
                    )}
                    {caja.estado === 'recibida_colombia' && (
                      <span className="flex items-center gap-1" style={{ color: '#34d399' }}>
                        <CheckCircle2 className="h-3 w-3" />
                        En Colombia
                      </span>
                    )}
                  </div>
                </Link>
              </div>
            )
          })}
        </div>
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
    </div>
  )
}
