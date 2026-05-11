export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { Package, MapPin, Plane, AlertTriangle, Users, CheckCircle2, ClipboardList, ScanBarcode, Box, ArrowRight, Layers } from 'lucide-react'
import Link from 'next/link'
import { ESTADO_LABELS } from '@/types'
import DashboardCharts from '@/components/admin/DashboardCharts'

const ESTADO_DARK: Record<string, { bg: string; color: string; border: string }> = {
  reportado:          { bg: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)', border: 'rgba(255,255,255,0.12)' },
  recibido_usa:       { bg: 'rgba(99,130,255,0.12)',  color: '#8899ff',               border: 'rgba(99,130,255,0.3)'  },
  en_consolidacion:   { bg: 'rgba(245,184,0,0.10)',   color: '#F5B800',               border: 'rgba(245,184,0,0.25)'  },
  listo_envio:        { bg: 'rgba(168,85,247,0.12)',  color: '#c084fc',               border: 'rgba(168,85,247,0.3)'  },
  en_transito:        { bg: 'rgba(251,146,60,0.12)',  color: '#fb923c',               border: 'rgba(251,146,60,0.3)'  },
  en_colombia:        { bg: 'rgba(34,211,238,0.10)',  color: '#22d3ee',               border: 'rgba(34,211,238,0.25)' },
  en_bodega_local:    { bg: 'rgba(99,130,255,0.10)',  color: '#818cf8',               border: 'rgba(99,130,255,0.25)' },
  en_camino_cliente:  { bg: 'rgba(132,204,22,0.10)',  color: '#a3e635',               border: 'rgba(132,204,22,0.25)' },
  entregado:          { bg: 'rgba(52,211,153,0.12)',  color: '#34d399',               border: 'rgba(52,211,153,0.3)'  },
  retenido:           { bg: 'rgba(239,68,68,0.12)',   color: '#f87171',               border: 'rgba(239,68,68,0.3)'   },
  devuelto:           { bg: 'rgba(244,63,94,0.12)',   color: '#fb7185',               border: 'rgba(244,63,94,0.3)'   },
}

const GRUPO_USA         = ['reportado', 'recibido_usa', 'en_consolidacion', 'listo_envio'] as const
const GRUPO_TRANSITO    = ['en_transito', 'en_colombia'] as const
const GRUPO_BODEGA_LOCAL = ['en_bodega_local', 'en_camino_cliente'] as const

const tw = 'rgba(255,255,255,'

export default async function AdminDashboard() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: 'public' }, auth: { persistSession: false } }
  )

  const hace30Dias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const hace14Dias = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const [
    conteoRes, recientesRes, alertasRes, clientesRes,
    entregadosTotalRes, entregadosMesRes, recepcionesUsaRes, devueltosTotalRes,
    cajasActivasRes, consolidacionRes,
  ] = await Promise.all([
    supabase.from('paquetes').select('estado').not('estado', 'in', '("entregado","devuelto")'),
    supabase.from('paquetes').select('id, tracking_casilla, tracking_origen, descripcion, estado, cliente_id, created_at').order('created_at', { ascending: false }).limit(8),
    supabase.from('paquetes').select('id, tracking_casilla, tracking_origen, descripcion, estado, cliente_id, updated_at').not('estado', 'in', '("entregado","devuelto")').lt('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()).order('updated_at', { ascending: true }).limit(5),
    supabase.from('perfiles').select('id', { count: 'exact', head: true }).eq('rol', 'cliente').eq('activo', true),
    supabase.from('paquetes').select('id', { count: 'exact', head: true }).eq('estado', 'entregado'),
    supabase.from('paquetes').select('id', { count: 'exact', head: true }).eq('estado', 'entregado').gte('updated_at', hace30Dias),
    supabase.from('paquetes').select('fecha_recepcion_usa').gte('fecha_recepcion_usa', hace14Dias).not('fecha_recepcion_usa', 'is', null),
    supabase.from('paquetes').select('id', { count: 'exact', head: true }).eq('estado', 'devuelto'),
    supabase.from('cajas_consolidacion').select('id', { count: 'exact', head: true }).in('estado', ['abierta', 'cerrada', 'despachada']),
    supabase
      .from('paquetes')
      .select('cliente_id')
      .in('estado', ['recibido_usa', 'en_consolidacion', 'listo_envio'])
      .not('cliente_id', 'is', null),
  ])

  const paquetes        = conteoRes.data ?? []
  const recientes       = recientesRes.data ?? []
  const alertas         = alertasRes.data ?? []
  const totalClientes   = clientesRes.count ?? 0
  const totalEntregados = entregadosTotalRes.count ?? 0
  const entregadosMes   = entregadosMesRes.count ?? 0
  const recepcionesUsa  = recepcionesUsaRes.data ?? []
  const totalDevueltos  = devueltosTotalRes.count ?? 0
  const cajasActivas    = cajasActivasRes.count ?? 0

  // Count clients with 2+ packages in US states
  const consolidacionRows = consolidacionRes.data ?? []
  const consolidacionCounts: Record<string, number> = {}
  for (const row of consolidacionRows) {
    if (!row.cliente_id) continue
    consolidacionCounts[row.cliente_id] = (consolidacionCounts[row.cliente_id] ?? 0) + 1
  }
  const consolidacionClientes = Object.values(consolidacionCounts).filter(n => n >= 2).length

  const clienteIds = [...new Set([
    ...recientes.map(p => p.cliente_id),
    ...alertas.map(p => p.cliente_id),
  ].filter(Boolean))]

  let nombresMap: Record<string, string> = {}
  if (clienteIds.length > 0) {
    const { data: perfiles } = await supabase.from('perfiles').select('id, nombre_completo').in('id', clienteIds)
    if (perfiles) nombresMap = Object.fromEntries(perfiles.map(p => [p.id, p.nombre_completo]))
  }

  const conteo = paquetes.reduce((acc, p) => {
    acc[p.estado] = (acc[p.estado] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  const sumaGrupo = (estados: readonly string[]) => estados.reduce((s, e) => s + (conteo[e] ?? 0), 0)
  const enUsa         = sumaGrupo(GRUPO_USA)
  const enTransito    = sumaGrupo(GRUPO_TRANSITO)
  const enBodegaLocal = sumaGrupo(GRUPO_BODEGA_LOCAL)

  const stats = [
    { label: 'Total activos',      value: paquetes.length,   icon: Package,      iconBg: 'rgba(99,130,255,0.15)',  iconColor: '#8899ff' },
    { label: 'En USA',             value: enUsa,             icon: ClipboardList, iconBg: 'rgba(245,184,0,0.15)',  iconColor: '#F5B800',  href: '/admin/paquetes?grupo=usa' },
    { label: 'En trÃ¡nsito',        value: enTransito,        icon: Plane,        iconBg: 'rgba(168,85,247,0.15)', iconColor: '#c084fc',  href: '/admin/paquetes?grupo=transito' },
    { label: 'En bodega Colombia', value: enBodegaLocal,     icon: MapPin,       iconBg: 'rgba(245,184,0,0.15)',  iconColor: '#fbbf24',  href: '/admin/listos-entrega' },
    { label: 'Entregados (30d)',   value: entregadosMes,     icon: CheckCircle2, iconBg: 'rgba(52,211,153,0.15)', iconColor: '#34d399' },
    { label: 'Clientes activos',   value: totalClientes,     icon: Users,        iconBg: 'rgba(52,211,153,0.12)', iconColor: '#6ee7b7' },
  ]

  const datosDonut = [
    { nombre: 'En USA',       valor: enUsa,         color: '#eab308' },
    { nombre: 'En trÃ¡nsito',  valor: enTransito,    color: '#a855f7' },
    { nombre: 'En bodega CO', valor: enBodegaLocal, color: '#F5B800' },
    { nombre: 'Entregados (30d)', valor: entregadosMes, color: '#10b981' },
  ].filter(d => d.valor > 0)

  const recepcionesPorDia: Record<string, number> = {}
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    recepcionesPorDia[d.toISOString().slice(0, 10)] = 0
  }
  for (const r of recepcionesUsa) {
    if (!r.fecha_recepcion_usa) continue
    const key = r.fecha_recepcion_usa.slice(0, 10)
    if (key in recepcionesPorDia) recepcionesPorDia[key]++
  }
  const datosBarras = Object.entries(recepcionesPorDia).map(([fecha, count]) => ({ fecha: fecha.slice(5), count }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-sm mt-1" style={{ color: `${tw}0.45)` }}>Vista general de la operaciÃ³n</p>
      </div>

      {/* â”€â”€ Alertas (arriba porque son urgentes) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {alertas.length > 0 && (
        <div className="glass-card overflow-hidden" style={{ borderColor: 'rgba(245,184,0,0.22)' }}>
          <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom: `1px solid ${tw}0.06)`, background: 'rgba(245,184,0,0.04)' }}>
            <AlertTriangle className="h-4 w-4 flex-shrink-0" style={{ color: '#F5B800' }} />
            <h3 className="text-sm font-semibold flex-1" style={{ color: '#F5B800' }}>
              Sin movimiento +7 dÃ­as â€” {alertas.length} paquete{alertas.length !== 1 ? 's' : ''}
            </h3>
            <Link href="/admin/paquetes" className="text-xs font-semibold" style={{ color: `${tw}0.35)` }}>Ver todos â†’</Link>
          </div>
          <div className="divide-y" style={{ borderColor: `${tw}0.05)` }}>
            {alertas.map(p => {
              const dias = Math.floor((Date.now() - new Date(p.updated_at).getTime()) / (1000 * 60 * 60 * 24))
              const s = ESTADO_DARK[p.estado] ?? { bg: '', color: `${tw}0.5)`, border: '' }
              return (
                <Link key={p.id} href={`/admin/paquetes/${p.id}`}
                  className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-white/[0.04]">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">{p.descripcion}</p>
                    <p className="text-xs mt-0.5" style={{ color: `${tw}0.4)` }}>
                      {p.cliente_id ? nombresMap[p.cliente_id] : 'Sin asignar'}{(p.tracking_origen ?? p.tracking_casilla) ? ` Â· ${p.tracking_origen ?? p.tracking_casilla}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                      {ESTADO_LABELS[p.estado as keyof typeof ESTADO_LABELS] ?? p.estado}
                    </span>
                    <span className="text-xs font-bold tabular-nums" style={{ color: '#F5B800' }}>{dias}d</span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* â”€â”€ ConsolidaciÃ³n alert â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {consolidacionClientes > 0 && (
        <Link href="/admin/consolidacion"
          className="glass-card p-4 flex items-center gap-4 group hover:border-purple-500/30 transition-all"
          style={{ borderColor: 'rgba(168,85,247,0.22)', background: 'rgba(168,85,247,0.04)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(168,85,247,0.15)' }}>
            <Layers className="h-5 w-5" style={{ color: '#c084fc' }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-white text-sm">
              {consolidacionClientes === 1
                ? '1 cliente con varios paquetes en Miami'
                : `${consolidacionClientes} clientes con varios paquetes en Miami`}
            </p>
            <p className="text-xs mt-0.5" style={{ color: `${tw}0.38)` }}>
              PodrÃ­an enviarse juntos en la misma caja
            </p>
          </div>
          <ArrowRight className="h-4 w-4 flex-shrink-0 opacity-0 group-hover:opacity-40 transition-opacity" style={{ color: '#c084fc' }} />
        </Link>
      )}

      {/* â”€â”€ Acciones del dÃ­a â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link href="/admin/recibir"
          className="glass-card p-4 flex items-center gap-4 group hover:border-white/[0.18] transition-all">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(99,130,255,0.15)' }}>
            <ScanBarcode className="h-5 w-5" style={{ color: '#8899ff' }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-white text-sm">Recibir en USA</p>
            <p className="text-xs mt-0.5" style={{ color: `${tw}0.38)` }}>Escanear paquetes nuevos</p>
          </div>
          <ArrowRight className="h-4 w-4 flex-shrink-0 opacity-0 group-hover:opacity-40 transition-opacity" style={{ color: 'white' }} />
        </Link>

        <Link href="/admin/cajas"
          className="glass-card p-4 flex items-center gap-4 group hover:border-white/[0.18] transition-all">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(168,85,247,0.15)' }}>
            <Box className="h-5 w-5" style={{ color: '#c084fc' }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-white text-sm">Cajas USA</p>
            <p className="text-xs mt-0.5" style={{ color: `${tw}0.38)` }}>
              {cajasActivas > 0 ? `${cajasActivas} caja${cajasActivas !== 1 ? 's' : ''} activa${cajasActivas !== 1 ? 's' : ''}` : 'Sin cajas activas'}
            </p>
          </div>
          <ArrowRight className="h-4 w-4 flex-shrink-0 opacity-0 group-hover:opacity-40 transition-opacity" style={{ color: 'white' }} />
        </Link>

        <Link href="/admin/listos-entrega"
          className="glass-card p-4 flex items-center gap-4 group transition-all"
          style={enBodegaLocal > 0
            ? { borderColor: 'rgba(52,211,153,0.25)', background: 'rgba(52,211,153,0.04)' }
            : {}
          }>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(52,211,153,0.15)' }}>
            <CheckCircle2 className="h-5 w-5" style={{ color: '#34d399' }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-white text-sm">Listos para entrega</p>
            <p className="text-xs mt-0.5 font-semibold" style={{ color: enBodegaLocal > 0 ? '#34d399' : `${tw}0.38)` }}>
              {enBodegaLocal > 0 ? `${enBodegaLocal} paquete${enBodegaLocal !== 1 ? 's' : ''} esperando` : 'Todo entregado'}
            </p>
          </div>
          <ArrowRight className="h-4 w-4 flex-shrink-0 opacity-0 group-hover:opacity-40 transition-opacity" style={{ color: 'white' }} />
        </Link>
      </div>

      {/* â”€â”€ Stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map(({ label, value, icon: Icon, iconBg, iconColor, href }) => {
          const inner = (
            <div className="glass-card h-full p-4 hover:border-white/[0.14] transition-all">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs" style={{ color: `${tw}0.45)` }}>{label}</p>
                  <p className="text-3xl font-bold text-white mt-1 tabular-nums">{value}</p>
                </div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: iconBg }}>
                  <Icon className="h-5 w-5" style={{ color: iconColor }} />
                </div>
              </div>
            </div>
          )
          return href
            ? <Link key={label} href={href} className="block">{inner}</Link>
            : <div key={label}>{inner}</div>
        })}
      </div>

      {/* â”€â”€ Charts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <DashboardCharts datosDonut={datosDonut} datosBarras={datosBarras} />

      {/* â”€â”€ DistribuciÃ³n por estado â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-white mb-4">DistribuciÃ³n por estado</h3>
        {[
          { label: 'ðŸ‡ºðŸ‡¸ En USA',      estados: ['reportado', 'recibido_usa', 'en_consolidacion', 'listo_envio'] },
          { label: 'âœˆï¸ En trÃ¡nsito',  estados: ['en_transito', 'en_colombia'] },
          { label: 'ðŸ‡¨ðŸ‡´ En Colombia', estados: ['en_bodega_local', 'en_camino_cliente', 'retenido'] },
        ].map(grupo => (
          <div key={grupo.label} className="mb-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: `${tw}0.3)` }}>{grupo.label}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {grupo.estados.map(estado => {
                const n = conteo[estado] ?? 0
                const s = ESTADO_DARK[estado] ?? { bg: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.55)', border: 'rgba(255,255,255,0.12)' }
                return (
                  <Link key={estado} href={`/admin/paquetes?estado=${estado}`}
                    className="flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-xl text-center transition-all hover:scale-[1.03] hover:opacity-90"
                    style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                    <span className="text-2xl font-extrabold leading-none tabular-nums" style={{ color: s.color }}>{n}</span>
                    <span className="text-[11px] font-medium leading-tight" style={{ color: s.color, opacity: 0.8 }}>
                      {ESTADO_LABELS[estado as keyof typeof ESTADO_LABELS] ?? estado}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}

        <div className="mt-2 pt-4" style={{ borderTop: `1px solid ${tw}0.07)` }}>
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: `${tw}0.25)` }}>ðŸ“‹ Historial</p>
          <div className="grid grid-cols-2 gap-2 max-w-xs">
            {[
              { estado: 'entregado', count: totalEntregados, sub: `${entregadosMes} este mes` },
              { estado: 'devuelto',  count: totalDevueltos,  sub: 'total devueltos' },
            ].map(({ estado, count, sub }) => {
              const s = ESTADO_DARK[estado]!
              return (
                <Link key={estado} href={`/admin/paquetes?estado=${estado}`}
                  className="flex flex-col items-center justify-center gap-0.5 py-3 px-2 rounded-xl text-center transition-all hover:scale-[1.03] hover:opacity-90"
                  style={{ background: s.bg, border: `1px solid ${s.border}`, opacity: 0.75 }}>
                  <span className="text-2xl font-extrabold leading-none tabular-nums" style={{ color: s.color }}>{count}</span>
                  <span className="text-[11px] font-medium leading-tight" style={{ color: s.color, opacity: 0.85 }}>
                    {ESTADO_LABELS[estado as keyof typeof ESTADO_LABELS] ?? estado}
                  </span>
                  <span className="text-[10px]" style={{ color: s.color, opacity: 0.5 }}>{sub}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      {/* â”€â”€ Ãšltimos registros â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${tw}0.06)` }}>
          <h3 className="text-sm font-semibold text-white">Ãšltimos registros</h3>
          <Link href="/admin/paquetes" className="text-xs font-semibold" style={{ color: '#F5B800' }}>Ver todos â†’</Link>
        </div>
        <div className="divide-y" style={{ borderColor: `${tw}0.05)` }}>
          {recientes.map(p => (
            <Link key={p.id} href={`/admin/paquetes/${p.id}`}
              className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-white/[0.04]">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{p.descripcion}</p>
                <p className="text-xs mt-0.5" style={{ color: `${tw}0.4)` }}>
                  {p.cliente_id ? nombresMap[p.cliente_id] : 'Sin asignar'}{(p.tracking_origen ?? p.tracking_casilla) ? ` Â· ${p.tracking_origen ?? p.tracking_casilla}` : ''}
                </p>
              </div>
              <span
                className="text-xs px-2 py-0.5 rounded-full ml-2 flex-shrink-0 font-semibold"
                style={(() => { const s = ESTADO_DARK[p.estado] ?? { bg: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)', border: 'rgba(255,255,255,0.12)' }; return { background: s.bg, color: s.color, border: `1px solid ${s.border}` } })()}
              >
                {ESTADO_LABELS[p.estado as keyof typeof ESTADO_LABELS] ?? p.estado}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
