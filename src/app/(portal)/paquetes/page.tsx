import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Package, PlusCircle, ChevronRight } from 'lucide-react'
import { ESTADO_LABELS, ESTADO_COLORES, CATEGORIA_LABELS, type EstadoPaquete, type CategoriaProducto } from '@/types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default async function PaquetesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: paquetes } = await supabase
    .from('paquetes')
    .select('*, fotos_paquetes(id)')
    .eq('cliente_id', user!.id)
    .order('created_at', { ascending: false })

  const activos = paquetes?.filter(p => !['entregado', 'devuelto'].includes(p.estado)) ?? []
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
              <div className="space-y-2">
                {activos.map(paquete => (
                  <PaqueteCard key={paquete.id} paquete={paquete} />
                ))}
              </div>
            </section>
          )}

          {completados.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Historial ({completados.length})
              </h2>
              <div className="space-y-2">
                {completados.map(paquete => (
                  <PaqueteCard key={paquete.id} paquete={paquete} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function PaqueteCard({ paquete }: { paquete: any }) {
  const tienesFotos = paquete.fotos_paquetes?.length > 0

  return (
    <Link href={`/paquetes/${paquete.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-gray-900 truncate">{paquete.descripcion}</p>
                {tienesFotos && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">📷 Fotos</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-sm text-gray-500">{paquete.tienda}</span>
                <span className="text-gray-300">•</span>
                <span className="text-xs text-gray-400">{CATEGORIA_LABELS[paquete.categoria as CategoriaProducto]}</span>
                <span className="text-gray-300">•</span>
                <span className="text-xs font-mono text-gray-400">{paquete.tracking_casilla}</span>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <Badge className={`text-xs ${ESTADO_COLORES[paquete.estado as EstadoPaquete]}`}>
                  {ESTADO_LABELS[paquete.estado as EstadoPaquete]}
                </Badge>
                {paquete.peso_libras && (
                  <span className="text-xs text-gray-500">{paquete.peso_libras} lbs</span>
                )}
                {paquete.costo_servicio && (
                  <span className="text-xs font-medium text-gray-700">
                    ${paquete.costo_servicio.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0 mt-1" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
