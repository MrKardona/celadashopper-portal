import { createClient } from '@supabase/supabase-js'
import { Package, Clock, Plane, AlertTriangle, Users, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { ESTADO_LABELS, ESTADO_COLORES } from '@/types'

export default async function AdminDashboard() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: 'public' }, auth: { persistSession: false } }
  )

  const hace30Dias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    conteoRes,
    recientesRes,
    alertasRes,
    clientesRes,
    entregadosTotalRes,
    entregadosMesRes,
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

    // Total de paquetes entregados (histórico)
    supabase
      .from('paquetes')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'entregado'),

    // Entregados en los últimos 30 días
    supabase
      .from('paquetes')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'entregado')
      .gte('updated_at', hace30Dias),
  ])

  const paquetes = conteoRes.data ?? []
  const recientes = recientesRes.data ?? []
  const alertas = alertasRes.data ?? []
  const totalClientes = clientesRes.count ?? 0
  const totalEntregados = entregadosTotalRes.count ?? 0
  const entregadosMes = entregadosMesRes.count ?? 0

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

  const conteo = paquetes.reduce((acc, p) => {
    acc[p.estado] = (acc[p.estado] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  const stats = [
    { label: 'Total activos', value: paquetes.length, icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Recibidos USA', value: conteo['recibido_usa'] ?? 0, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    {
      label: 'En tránsito',
      value: (conteo['en_transito'] ?? 0) + (conteo['en_consolidacion'] ?? 0) + (conteo['listo_envio'] ?? 0),
      icon: Plane, color: 'text-purple-600', bg: 'bg-purple-50',
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Vista general de la operación</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg, sub }) => (
          <Card key={label}>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm text-gray-500">{label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
                  {sub && (
                    <p className="text-[11px] text-gray-400 mt-0.5 truncate">{sub}</p>
                  )}
                </div>
                <div className={`${bg} p-3 rounded-xl flex-shrink-0`}>
                  <Icon className={`h-6 w-6 ${color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Estado breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Paquetes por estado</CardTitle>
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
