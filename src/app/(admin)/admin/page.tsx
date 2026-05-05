import { createClient } from '@supabase/supabase-js'
import { Package, MapPin, Plane, AlertTriangle, Users, CheckCircle2, ClipboardList } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { ESTADO_LABELS, ESTADO_COLORES } from '@/types'
import DashboardCharts from '@/components/admin/DashboardCharts'

// Agrupación lógica de estados:
// - Reportados/En USA: paquetes que ya están físicamente en USA o fueron reportados
// - En tránsito: en movimiento entre USA y bodega Colombia
// - En bodega Colombia: listos para entrega o saliendo al cliente
// - Entregados: finalizados
const GRUPO_USA = ['reportado', 'recibido_usa', 'en_consolidacion', 'listo_envio'] as const
const GRUPO_TRANSITO = ['en_transito', 'en_colombia'] as const
const GRUPO_BODEGA_LOCAL = ['en_bodega_local', 'en_camino_cliente'] as const

export default async function AdminDashboard() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: 'public' }, auth: { persistSession: false } }
  )

  const hace30Dias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const hace14Dias = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const [
    conteoRes,
    recientesRes,
    alertasRes,
    clientesRes,
    entregadosTotalRes,
    entregadosMesRes,
    recepcionesUsaRes,
  ] = await Promise.all([
    supabase
      .from('paquetes')
      .select('estado')
      .not('estado', 'in', '("entregado","devuelto")'),

    supabase
      .from('paquetes')
      .select('id, tracking_casilla, descripcion, estado, cliente_id, created_at')
      .order('created_at', { ascending: false })
      .limit(10),

    supabase
      .from('paquetes')
      .select('id, tracking_casilla, descripcion, estado, cliente_id, updated_at')
      .not('estado', 'in', '("entregado","devuelto")')
      .lt('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('updated_at', { ascending: true })
      .limit(5),

    supabase
      .from('perfiles')
      .select('id', { count: 'exact', head: true })
      .eq('rol', 'cliente')
      .eq('activo', true),

    supabase
      .from('paquetes')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'entregado'),

    supabase
      .from('paquetes')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'entregado')
      .gte('updated_at', hace30Dias),

    // Recepciones USA por día (últimos 14 días) — para la gráfica de barras
    supabase
      .from('paquetes')
      .select('fecha_recepcion_usa')
      .gte('fecha_recepcion_usa', hace14Dias)
      .not('fecha_recepcion_usa', 'is', null),
  ])

  const paquetes = conteoRes.data ?? []
  const recientes = recientesRes.data ?? []
  const alertas = alertasRes.data ?? []
  const totalClientes = clientesRes.count ?? 0
  const totalEntregados = entregadosTotalRes.count ?? 0
  const entregadosMes = entregadosMesRes.count ?? 0
  const recepcionesUsa = recepcionesUsaRes.data ?? []

  // Cargar nombres de clientes para recientes + alertas
  const clienteIds = [...new Set([
    ...recientes.map(p => p.cliente_id),
    ...alertas.map(p => p.cliente_id),
  ].filter(Boolean))]

  let nombresMap: Record<string, string> = {}
  if (clienteIds.length > 0) {
    const { data: perfiles } = await supabase
      .from('perfiles')
      .select('id, nombre_completo')
      .in('id', clienteIds)
    if (perfiles) {
      nombresMap = Object.fromEntries(perfiles.map(p => [p.id, p.nombre_completo]))
    }
  }

  // Conteo por estado individual
  const conteo = paquetes.reduce((acc, p) => {
    acc[p.estado] = (acc[p.estado] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Conteo por grupos lógicos
  const sumaGrupo = (estados: readonly string[]) =>
    estados.reduce((s, e) => s + (conteo[e] ?? 0), 0)

  const enUsa = sumaGrupo(GRUPO_USA)
  const enTransito = sumaGrupo(GRUPO_TRANSITO)
  const enBodegaLocal = sumaGrupo(GRUPO_BODEGA_LOCAL)

  const stats = [
    { label: 'Total activos', value: paquetes.length, icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
    {
      label: 'Recibidos en USA',
      value: enUsa,
      icon: ClipboardList,
      color: 'text-yellow-700',
      bg: 'bg-yellow-50',
      sub: 'Reportados + recibidos + consolidación',
      href: '/admin/paquetes?grupo=usa',
    },
    {
      label: 'En tránsito',
      value: enTransito,
      icon: Plane,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      sub: 'En camino USA → Colombia',
      href: '/admin/paquetes?grupo=transito',
    },
    {
      label: 'En bodega Colombia',
      value: enBodegaLocal,
      icon: MapPin,
      color: 'text-orange-700',
      bg: 'bg-orange-50',
      sub: 'Listos para entrega',
      href: '/admin/listos-entrega',
    },
    {
      label: 'Entregados',
      value: totalEntregados,
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      sub: entregadosMes > 0 ? `${entregadosMes} en últimos 30 días` : undefined,
    },
    { label: 'Clientes activos', value: totalClientes, icon: Users, color: 'text-green-600', bg: 'bg-green-50' },
  ]

  // ── Datos para gráficas ──────────────────────────────────────────────────
  // 1. Donut: distribución por GRUPO (visión ejecutiva, 4 segmentos)
  const datosDonut = [
    { nombre: 'En USA', valor: enUsa, color: '#eab308' },
    { nombre: 'En tránsito', valor: enTransito, color: '#a855f7' },
    { nombre: 'En bodega CO', valor: enBodegaLocal, color: '#ea580c' },
    { nombre: 'Entregados (30d)', valor: entregadosMes, color: '#10b981' },
  ].filter(d => d.valor > 0)

  // 2. Barras: recepciones USA por día (últimos 14 días)
  const recepcionesPorDia: Record<string, number> = {}
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    const key = d.toISOString().slice(0, 10)
    recepcionesPorDia[key] = 0
  }
  for (const r of recepcionesUsa) {
    if (!r.fecha_recepcion_usa) continue
    const key = r.fecha_recepcion_usa.slice(0, 10)
    if (key in recepcionesPorDia) recepcionesPorDia[key]++
  }
  const datosBarras = Object.entries(recepcionesPorDia).map(([fecha, count]) => ({
    fecha: fecha.slice(5), // "MM-DD"
    count,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Vista general de la operación</p>
      </div>

      {/* Stats con grupos lógicos */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg, sub, href }) => {
          const inner = (
            <Card className="h-full hover:shadow-md transition-shadow">
              <CardContent className="pt-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-500">{label}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
                    {sub && (
                      <p className="text-[11px] text-gray-400 mt-0.5 truncate">{sub}</p>
                    )}
                  </div>
                  <div className={`${bg} p-3 rounded-xl flex-shrink-0`}>
                    <Icon className={`h-5 w-5 ${color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
          return href
            ? <Link key={label} href={href} className="block">{inner}</Link>
            : <div key={label}>{inner}</div>
        })}
      </div>

      {/* Gráficas interactivas */}
      <DashboardCharts datosDonut={datosDonut} datosBarras={datosBarras} />

      {/* Estado breakdown (todos los estados individuales) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalle por estado individual</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(conteo).map(([estado, n]) => (
              <Link
                key={estado}
                href={`/admin/paquetes?estado=${estado}`}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-opacity hover:opacity-80 ${ESTADO_COLORES[estado as keyof typeof ESTADO_COLORES] ?? 'bg-gray-100 text-gray-700'}`}
              >
                {ESTADO_LABELS[estado as keyof typeof ESTADO_LABELS] ?? estado}
                <span className="font-bold">{n}</span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {alertas.length > 0 && (
          <Card className="border-amber-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-amber-700">
                <AlertTriangle className="h-4 w-4" />
                Sin movimiento +7 días ({alertas.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {alertas.map(p => {
                const dias = Math.floor((Date.now() - new Date(p.updated_at).getTime()) / (1000 * 60 * 60 * 24))
                return (
                  <Link key={p.id} href={`/admin/paquetes/${p.id}`}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-amber-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.descripcion}</p>
                      <p className="text-xs text-gray-500">
                        {p.cliente_id ? nombresMap[p.cliente_id] : 'Sin asignar'} · {p.tracking_casilla}
                      </p>
                    </div>
                    <span className="text-xs text-amber-600 font-medium ml-2 flex-shrink-0">{dias}d</span>
                  </Link>
                )
              })}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              Últimos registros
              <Link href="/admin/paquetes" className="text-sm text-orange-600 font-normal hover:underline">
                Ver todos
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recientes.map(p => (
              <Link key={p.id} href={`/admin/paquetes/${p.id}`}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{p.descripcion}</p>
                  <p className="text-xs text-gray-500">
                    {p.cliente_id ? nombresMap[p.cliente_id] : 'Sin asignar'} · {p.tracking_casilla}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ml-2 flex-shrink-0 ${ESTADO_COLORES[p.estado as keyof typeof ESTADO_COLORES] ?? 'bg-gray-100 text-gray-700'}`}>
                  {ESTADO_LABELS[p.estado as keyof typeof ESTADO_LABELS] ?? p.estado}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
