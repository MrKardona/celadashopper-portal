import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Package, PlusCircle, Truck, CheckCircle, Clock, AlertTriangle,
} from 'lucide-react'
import { ESTADO_LABELS, ESTADO_COLORES, CATEGORIA_LABELS, type EstadoPaquete } from '@/types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('*')
    .eq('id', user!.id)
    .single()

  const { data: paquetes } = await supabase
    .from('paquetes')
    .select('*')
    .eq('cliente_id', user!.id)
    .order('created_at', { ascending: false })
    .limit(5)

  const { data: todos } = await supabase
    .from('paquetes')
    .select('estado')
    .eq('cliente_id', user!.id)

  const stats = {
    total: todos?.length ?? 0,
    activos: todos?.filter(p => !['entregado', 'devuelto'].includes(p.estado)).length ?? 0,
    en_transito: todos?.filter(p => ['en_transito', 'en_colombia', 'en_bodega_local', 'en_camino_cliente'].includes(p.estado)).length ?? 0,
    entregados: todos?.filter(p => p.estado === 'entregado').length ?? 0,
  }

  return (
    <div className="space-y-6">
      {/* Bienvenida */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Hola, {perfil?.nombre_completo?.split(' ')[0]} <span aria-hidden="true">👋</span>
          </h1>
          <p className="text-gray-500">
            Tu casilla: <span className="font-semibold text-orange-600">{perfil?.numero_casilla}</span>
          </p>
        </div>
        <Link
          href="/reportar"
          className={buttonVariants({ variant: 'default' }) + ' bg-orange-600 hover:bg-orange-700 gap-2'}
        >
          <PlusCircle className="h-4 w-4" />
          Reportar pedido
        </Link>
      </div>

      {/* Estadisticas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Package className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold" aria-label={`${stats.total} paquetes en total`}>{stats.total}</p>
                <p className="text-xs text-gray-500">Total paquetes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold" aria-label={`${stats.activos} paquetes en proceso`}>{stats.activos}</p>
                <p className="text-xs text-gray-500">En proceso</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Truck className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold" aria-label={`${stats.en_transito} paquetes en tránsito`}>{stats.en_transito}</p>
                <p className="text-xs text-gray-500">En tránsito</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold" aria-label={`${stats.entregados} paquetes entregados`}>{stats.entregados}</p>
                <p className="text-xs text-gray-500">Entregados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Paquetes recientes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Paquetes recientes</CardTitle>
          <Link href="/paquetes" className="text-sm text-orange-600 hover:underline">
            Ver todos
          </Link>
        </CardHeader>
        <CardContent>
          {!paquetes || paquetes.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No tienes paquetes reportados aún</p>
              <Link
                href="/reportar"
                className={buttonVariants({ variant: 'outline' }) + ' mt-3 gap-2'}
              >
                <PlusCircle className="h-4 w-4" />
                Reportar tu primer pedido
              </Link>
            </div>
          ) : (
            <div className="divide-y">
              {paquetes.map(paquete => (
                <Link
                  key={paquete.id}
                  href={`/paquetes/${paquete.id}`}
                  className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-2 px-2 rounded-md transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{paquete.descripcion}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500">{paquete.tienda}</span>
                      <span className="text-gray-300">•</span>
                      <span className="text-xs text-gray-400 font-mono">{paquete.tracking_casilla}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Badge className={`text-xs ${ESTADO_COLORES[paquete.estado as EstadoPaquete]}`}>
                      {ESTADO_LABELS[paquete.estado as EstadoPaquete]}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Direccion bodega USA */}
      <Card className="bg-orange-50 border-orange-200">
        <CardHeader>
          <CardTitle className="text-base text-orange-800"><span aria-hidden="true">📦</span> Tu dirección de envío en USA</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="font-mono text-sm text-orange-900 space-y-1">
            <p className="font-semibold">{perfil?.nombre_completo}</p>
            <p>Casilla: {perfil?.numero_casilla}</p>
            <p className="text-orange-600 text-xs mt-2">
              Usa esta dirección al comprar en tiendas de USA. El número de casilla es tu identificador.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
