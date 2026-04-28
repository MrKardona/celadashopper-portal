import { createClient } from '@supabase/supabase-js'
import { Package, Clock, Plane, AlertTriangle, Users } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { ESTADO_LABELS, ESTADO_COLORES } from '@/types'

export default async function AdminDashboard() {
  const [conteoRes, recientesRes, alertasRes, clientesRes] = await Promise.all([
    // Conteo por estado (solo activos)
    supabase
      .from('paquetes')
      .select('estado')
      .not('estado', 'in', '("entregado","devuelto")'),

    // Últimos 10 registrados
    supabase
      .from('paquetes')
      .select('id, tracking_casilla, descripcion, estado, created_at, perfiles(nombre_completo)')
      .order('created_at', { ascending: false })
      .limit(10),

    // Paquetes sin movimiento +7 días (activos)
    supabase
      .from('paquetes')
      .select('id, tracking_casilla, descripcion, estado, updated_at, perfiles(nombre_completo)')
      .not('estado', 'in', '("entregado","devuelto")')
      .lt('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('updated_at', { ascending: true })
      .limit(5),

    // Total clientes activos
    supabase
      .from('perfiles')
      .select('id', { count: 'exact', head: true })
      .eq('rol', 'cliente')
      .eq('activo', true),
  ])

  const paquetes = conteoRes.data ?? []
  const recientes = recientesRes.data ?? []
  const alertas = alertasRes.data ?? []
  const totalClientes = clientesRes.count ?? 0

  // Calcular métricas
  const conteo = paquetes.reduce((acc, p) => {
    acc[p.estado] = (acc[p.estado] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  const stats = [
    {
      label: 'Total activos',
      value: paquetes.length,
      icon: Package,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Recibidos USA',
      value: conteo['recibido_usa'] ?? 0,
      icon: Clock,
      color: 'text-yellow-600',
      bg: 'bg-yellow-50',
    },
    {
      label: 'En tránsito',
      value: (conteo['en_transito'] ?? 0) + (conteo['en_consolidacion'] ?? 0) + (conteo['listo_envio'] ?? 0),
      icon: Plane,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      label: 'Clientes activos',
      value: totalClientes,
      icon: Users,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Vista general de la operación</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
                </div>
                <div className={`${bg} p-3 rounded-xl`}>
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
        {/* Alertas */}
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
                const perfil = p.perfiles as unknown as { nombre_completo: string } | null
                const dias = Math.floor(
                  (Date.now() - new Date(p.updated_at).getTime()) / (1000 * 60 * 60 * 24)
                )
                return (
                  <Link
                    key={p.id}
                    href={`/admin/paquetes/${p.id}`}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-amber-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.descripcion}</p>
                      <p className="text-xs text-gray-500">{perfil?.nombre_completo} · {p.tracking_casilla}</p>
                    </div>
                    <span className="text-xs text-amber-600 font-medium ml-2 flex-shrink-0">{dias}d</span>
                  </Link>
                )
              })}
            </CardContent>
          </Card>
        )}

        {/* Recientes */}
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
            {recientes.map(p => {
              const perfil = p.perfiles as unknown as { nombre_completo: string } | null
              return (
                <Link
                  key={p.id}
                  href={`/admin/paquetes/${p.id}`}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.descripcion}</p>
                    <p className="text-xs text-gray-500">{perfil?.nombre_completo} · {p.tracking_casilla}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ml-2 flex-shrink-0 ${ESTADO_COLORES[p.estado as keyof typeof ESTADO_COLORES] ?? 'bg-gray-100 text-gray-700'}`}>
                    {ESTADO_LABELS[p.estado as keyof typeof ESTADO_LABELS] ?? p.estado}
                  </span>
                </Link>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
