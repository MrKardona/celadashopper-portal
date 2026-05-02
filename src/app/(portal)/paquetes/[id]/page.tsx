import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Package, MapPin, Calendar, DollarSign, Scale } from 'lucide-react'
import {
  ESTADO_LABELS, ESTADO_COLORES, CATEGORIA_LABELS,
  type EstadoPaquete, type CategoriaProducto
} from '@/types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const ESTADOS_ORDEN: EstadoPaquete[] = [
  'reportado', 'recibido_usa', 'en_consolidacion', 'listo_envio',
  'en_transito', 'en_colombia', 'en_bodega_local', 'en_camino_cliente', 'entregado'
]

export default async function DetallePaquetePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Queries separadas para evitar problemas de RLS al hacer joins
  const [paqueteRes, fotosRes, eventosRes] = await Promise.all([
    supabase
      .from('paquetes')
      .select('*')
      .eq('id', id)
      .eq('cliente_id', user!.id)
      .maybeSingle(),
    supabase
      .from('fotos_paquetes')
      .select('*')
      .eq('paquete_id', id)
      .order('created_at'),
    supabase
      .from('eventos_paquete')
      .select('*')
      .eq('paquete_id', id)
      .order('created_at', { ascending: false }),
  ])

  const paquete = paqueteRes.data
  if (!paquete) notFound()

  // Adjuntar relacionados al objeto paquete (compatibilidad con resto del código)
  paquete.fotos_paquetes = fotosRes.data ?? []
  paquete.eventos_paquete = eventosRes.data ?? []

  const estadoActualIdx = ESTADOS_ORDEN.indexOf(paquete.estado as EstadoPaquete)
  const esProblema = ['retenido', 'devuelto'].includes(paquete.estado)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/paquetes">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900 truncate">{paquete.descripcion}</h1>
          <p className="text-sm text-gray-500">{paquete.tienda}</p>
        </div>
      </div>

      {/* Estado actual */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-4">
            <Badge className={`text-sm px-3 py-1 ${ESTADO_COLORES[paquete.estado as EstadoPaquete]}`}>
              {ESTADO_LABELS[paquete.estado as EstadoPaquete]}
            </Badge>
            <span className="text-xs text-gray-400 font-mono">{paquete.tracking_casilla}</span>
          </div>

          {/* Barra de progreso */}
          {!esProblema && (
            <div className="space-y-3">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Reportado</span>
                <span>En tránsito</span>
                <span>Entregado</span>
              </div>
              <div className="flex gap-1">
                {ESTADOS_ORDEN.map((estado, idx) => (
                  <div
                    key={estado}
                    className={`h-2 flex-1 rounded-full transition-colors ${
                      idx <= estadoActualIdx ? 'bg-orange-500' : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
              <div className="text-xs text-gray-500 text-center">
                Paso {estadoActualIdx + 1} de {ESTADOS_ORDEN.length}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fotos */}
      {paquete.fotos_paquetes && paquete.fotos_paquetes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">📷 Fotos del paquete</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {paquete.fotos_paquetes.map((foto: any) => (
                <a key={foto.id} href={foto.url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={foto.url}
                    alt={foto.descripcion ?? 'Foto del paquete'}
                    className="w-full aspect-square object-cover rounded-lg hover:opacity-90 transition-opacity"
                  />
                  {foto.descripcion && (
                    <p className="text-xs text-gray-500 mt-1 text-center capitalize">{foto.descripcion}</p>
                  )}
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Datos del paquete */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Información del pedido</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3">
            <div className="flex items-start gap-3">
              <Package className="h-4 w-4 text-gray-400 mt-0.5" />
              <div>
                <dt className="text-xs text-gray-500">Categoría</dt>
                <dd className="text-sm font-medium">{CATEGORIA_LABELS[paquete.categoria as CategoriaProducto]}</dd>
              </div>
            </div>
            {paquete.tracking_origen && (
              <div className="flex items-start gap-3">
                <Package className="h-4 w-4 text-gray-400 mt-0.5" />
                <div>
                  <dt className="text-xs text-gray-500">Tracking original</dt>
                  <dd className="text-sm font-mono">{paquete.tracking_origen}</dd>
                </div>
              </div>
            )}
            {paquete.tracking_usaco && (
              <div className="flex items-start gap-3">
                <Package className="h-4 w-4 text-gray-400 mt-0.5" />
                <div>
                  <dt className="text-xs text-gray-500">Tracking USACO</dt>
                  <dd className="text-sm font-mono">{paquete.tracking_usaco}</dd>
                </div>
              </div>
            )}
            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
              <div>
                <dt className="text-xs text-gray-500">Ciudad destino</dt>
                <dd className="text-sm font-medium capitalize">{paquete.bodega_destino}</dd>
              </div>
            </div>
            {paquete.peso_libras && (
              <div className="flex items-start gap-3">
                <Scale className="h-4 w-4 text-gray-400 mt-0.5" />
                <div>
                  <dt className="text-xs text-gray-500">Peso</dt>
                  <dd className="text-sm font-medium">{paquete.peso_libras} lbs</dd>
                </div>
              </div>
            )}
            {paquete.valor_declarado && (
              <div className="flex items-start gap-3">
                <DollarSign className="h-4 w-4 text-gray-400 mt-0.5" />
                <div>
                  <dt className="text-xs text-gray-500">Valor declarado</dt>
                  <dd className="text-sm font-medium">${paquete.valor_declarado} USD</dd>
                </div>
              </div>
            )}
            {paquete.costo_servicio && (
              <div className="flex items-start gap-3 bg-orange-50 -mx-4 px-4 py-3 rounded-lg">
                <DollarSign className="h-4 w-4 text-orange-600 mt-0.5" />
                <div>
                  <dt className="text-xs text-orange-600">Costo del servicio</dt>
                  <dd className="text-lg font-bold text-orange-700">${paquete.costo_servicio.toFixed(2)} USD</dd>
                  {!paquete.factura_pagada && (
                    <dd className="text-xs text-red-600 mt-0.5">Pendiente de pago</dd>
                  )}
                </div>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Historial de eventos */}
      {paquete.eventos_paquete && paquete.eventos_paquete.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historial de movimientos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[...paquete.eventos_paquete].reverse().map((evento: any) => (
                <div key={evento.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-orange-400 mt-1.5" />
                    <div className="w-px flex-1 bg-gray-200 mt-1" />
                  </div>
                  <div className="pb-3">
                    <p className="text-sm font-medium">
                      {ESTADO_LABELS[evento.estado_nuevo as EstadoPaquete]}
                    </p>
                    {evento.descripcion && (
                      <p className="text-xs text-gray-500">{evento.descripcion}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {format(new Date(evento.created_at), "d 'de' MMMM, h:mm a", { locale: es })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
