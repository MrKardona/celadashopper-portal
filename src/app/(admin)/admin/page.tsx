import { createClient } from '@supabase/supabase-js'
import { Package, MapPin, Plane, AlertTriangle, Users, CheckCircle2, ClipboardList } from 'lucide-react'
import Link from 'next/link'
import { ESTADO_LABELS } from '@/types'

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
import DashboardCharts from '@/components/admin/DashboardCharts'

const GRUPO_USA = ['reportado', 'recibido_usa', 'en_consolidacion', 'listo_envio'] as const
const GRUPO_TRANSITO = ['en_transito', 'en_colombia'] as const
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
    entregadosTotalRes, entregadosMesRes, recepcionesUsaRes,
  ] = await Promise.all([
    supabase.from('paquetes').select('estado').not('estado', 'in', '("entregado","devuelto")'),
    supabase.from('paquetes').select('id, tracking_casilla, descripcion, estado, cliente_id, created_at').order('created_at', { ascending: false }).limit(10),
    supabase.from('paquetes').select('id, tracking_casilla, descripcion, estado, cliente_id, updated_at').not('estado', 'in', '("entregado","devuelto")').lt('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()).order('updated_at', { ascending: true }).limit(5),
    supabase.from('perfiles').select('id', { count: 'exact', head: true }).eq('rol', 'cliente').eq('activo', true),
    supabase.from('paquetes').select('id', { count: 'exact', head: true }).eq('estado', 'entregado'),
    supabase.from('paquetes').select('id', { count: 'exact', head: true }).eq('estado', 'entregado').gte('updated_at', hace30Dias),
    supabase.from('paquetes').select('fecha_recepcion_usa').gte('fecha_recepcion_usa', hace14Dias).not('fecha_recepcion_usa', 'is', null),
  ])

  const paquetes = conteoRes.data ?? []
  const recientes = recientesRes.data ?? []
  const alertas = alertasRes.data ?? []
  const totalClientes = clientesRes.count ?? 0
  const totalEntregados = entregadosTotalRes.count ?? 0
  const entregadosMes = entregadosMesRes.count ?? 0
  const recepcionesUsa = recepcionesUsaRes.data ?? []

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
  const enUsa = sumaGrupo(GRUPO_USA)
  const enTransito = sumaGrupo(GRUPO_TRANSITO)
  const enBodegaLocal = sumaGrupo(GRUPO_BODEGA_LOCAL)

  const stats = [
    { label: 'Total activos', value: paquetes.length, icon: Package, iconBg: 'rgba(99,130,255,0.15)', iconColor: '#8899ff' },
    { label: 'Recibidos en USA', value: enUsa, icon: ClipboardList, iconBg: 'rgba(245,184,0,0.15)', iconColor: '#F5B800', sub: 'Reportados + recibidos + consolidación', href: '/admin/paquetes?grupo=usa' },
    { label: 'En tránsito', value: enTransito, icon: Plane, iconBg: 'rgba(168,85,247,0.15)', iconColor: '#c084fc', sub: 'En camino USA → Colombia', href: '/admin/paquetes?grupo=transito' },
    { label: 'En bodega Colombia', value: enBodegaLocal, icon: MapPin, iconBg: 'rgba(245,184,0,0.15)', iconColor: '#fbbf24', sub: 'Listos para entrega', href: '/admin/listos-entrega' },
    { label: 'Entregados', value: totalEntregados, icon: CheckCircle2, iconBg: 'rgba(52,211,153,0.15)', iconColor: '#34d399', sub: entregadosMes > 0 ? `${entregadosMes} en últimos 30 días` : undefined },
    { label: 'Clientes activos', value: totalClientes, icon: Users, iconBg: 'rgba(52,211,153,0.12)', iconColor: '#6ee7b7' },
  ]

  const datosDonut = [
    { nombre: 'En USA', valor: enUsa, color: '#eab308' },
    { nombre: 'En tránsito', valor: enTransito, color: '#a855f7' },
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
        <p className="text-sm mt-1" style={{ color: `${tw}0.45)` }}>Vista general de la operación</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map(({ label, value, icon: Icon, iconBg, iconColor, sub, href }) => {
          const inner = (
            <div className="glass-card h-full p-4 hover:border-white/[0.14] transition-all">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs" style={{ color: `${tw}0.45)` }}>{label}</p>
                  <p className="text-3xl font-bold text-white mt-1">{value}</p>
                  {sub && <p className="text-[11px] mt-0.5 truncate" style={{ color: `${tw}0.3)` }}>{sub}</p>}
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

      {/* Charts */}
      <DashboardCharts datosDonut={datosDonut} datosBarras={datosBarras} />

      {/* Estado breakdown */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-white mb-3">Detalle por estado individual</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(conteo).map(([estado, n]) => (
            <Link
              key={estado}
              href={`/admin/paquetes?estado=${estado}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-opacity hover:opacity-80"
              style={(() => { const s = ESTADO_DARK[estado] ?? { bg: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)', border: 'rgba(255,255,255,0.12)' }; return { background: s.bg, color: s.color, border: `1px solid ${s.border}` } })()}
            >
              {ESTADO_LABELS[estado as keyof typeof ESTADO_LABELS] ?? estado}
              <span className="font-bold">{n}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {alertas.length > 0 && (
          <div className="glass-card overflow-hidden" style={{ borderColor: 'rgba(245,184,0,0.2)' }}>
            <div className="px-5 py-4" style={{ borderBottom: `1px solid ${tw}0.06)` }}>
              <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#F5B800' }}>
                <AlertTriangle className="h-4 w-4" />
                Sin movimiento +7 días ({alertas.length})
              </h3>
            </div>
            <div className="divide-y" style={{ borderColor: `${tw}0.05)` }}>
              {alertas.map(p => {
                const dias = Math.floor((Date.now() - new Date(p.updated_at).getTime()) / (1000 * 60 * 60 * 24))
                return (
                  <Link key={p.id} href={`/admin/paquetes/${p.id}`}
                    className="flex items-center justify-between px-5 py-3 transition-colors"
                    style={{ borderColor: `${tw}0.05)` }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{p.descripcion}</p>
                      <p className="text-xs mt-0.5" style={{ color: `${tw}0.4)` }}>
                        {p.cliente_id ? nombresMap[p.cliente_id] : 'Sin asignar'} · {p.tracking_casilla}
                      </p>
                    </div>
                    <span className="text-xs font-semibold ml-2 flex-shrink-0" style={{ color: '#F5B800' }}>{dias}d</span>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        <div className="glass-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${tw}0.06)` }}>
            <h3 className="text-sm font-semibold text-white">Últimos registros</h3>
            <Link href="/admin/paquetes" className="text-xs font-semibold" style={{ color: '#F5B800' }}>Ver todos →</Link>
          </div>
          <div className="divide-y" style={{ borderColor: `${tw}0.05)` }}>
            {recientes.map(p => (
              <Link key={p.id} href={`/admin/paquetes/${p.id}`}
                className="flex items-center justify-between px-5 py-3 transition-colors"
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{p.descripcion}</p>
                  <p className="text-xs mt-0.5" style={{ color: `${tw}0.4)` }}>
                    {p.cliente_id ? nombresMap[p.cliente_id] : 'Sin asignar'} · {p.tracking_casilla}
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
    </div>
  )
}
