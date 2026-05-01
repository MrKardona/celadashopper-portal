import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import Link from 'next/link'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
import { ArrowLeft, Package, MapPin, Scale, DollarSign, Calendar, Camera } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import PaqueteEditForm from '@/components/admin/PaqueteEditForm'
import { ESTADO_LABELS, ESTADO_COLORES, CATEGORIA_LABELS } from '@/types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const BODEGA_LABELS: Record<string, string> = {
  medellin: 'Medellín', bogota: 'Bogotá', barranquilla: 'Barranquilla',
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function AdminPaqueteDetalle({ params }: Props) {
  const { id } = await params
  const supabase = getSupabaseAdmin()

  // Queries separadas para evitar problemas con PostgREST joins + RLS
  const [paqueteRes, fotosRes, eventosRes] = await Promise.all([
    supabase.from('paquetes').select('*').eq('id', id).single(),
    supabase.from('fotos_paquetes').select('*').eq('paquete_id', id).order('created_at'),
    supabase.from('eventos_paquete').select('*').eq('paquete_id', id).order('created_at', { ascending: false }),
  ])

  if (paqueteRes.error || !paqueteRes.data) notFound()

  const p = paqueteRes.data
  const fotos = fotosRes.data ?? []
  const eventos = eventosRes.data ?? []

  // Cargar perfil del cliente por separado si existe
  let perfil: { nombre_completo: string; numero_casilla: string; email: string; whatsapp: string | null; telefono: string | null; ciudad: string | null } | null = null
  if (p.cliente_id) {
    const { data: perfilData } = await supabase
      .from('perfiles')
      .select('nombre_completo, numero_casilla, email, whatsapp, telefono, ciudad')
      .eq('id', p.cliente_id)
      .single()
    perfil = perfilData
  }

  // Cargar tarifa de la categoría
  const { data: tarifa } = await supabase
    .from('categorias_tarifas')
    .select('tarifa_por_libra, precio_fijo, tarifa_tipo, descripcion, seguro_porcentaje')
    .eq('categoria', p.categoria)
    .single()

  const fechaFmt = (d: string | null) =>
    d ? format(new Date(d), "d MMM yyyy, HH:mm", { locale: es }) : '—'

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/admin/paquetes" className="text-gray-400 hover:text-gray-700 mt-1">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900 font-mono">{p.tracking_casilla}</h1>
            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${ESTADO_COLORES[p.estado as keyof typeof ESTADO_COLORES] ?? 'bg-gray-100 text-gray-700'}`}>
              {ESTADO_LABELS[p.estado as keyof typeof ESTADO_LABELS] ?? p.estado}
            </span>
          </div>
          <p className="text-gray-500 text-sm mt-1">{p.descripcion} · {p.tienda}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna izquierda: info + fotos + historial */}
        <div className="lg:col-span-2 space-y-5">

          {/* Info del paquete */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Package className="h-4 w-4 text-orange-600" />
                Datos del paquete
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-400 text-xs">Categoría</p>
                  <p className="font-medium">{CATEGORIA_LABELS[p.categoria as keyof typeof CATEGORIA_LABELS] ?? p.categoria}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Bodega destino</p>
                  <p className="font-medium">{BODEGA_LABELS[p.bodega_destino] ?? p.bodega_destino}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Tracking origen</p>
                  <p className="font-medium font-mono text-xs">{p.tracking_origen ?? '—'}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Tracking USACO</p>
                  <p className="font-medium font-mono text-xs">{p.tracking_usaco ?? '—'}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Valor declarado</p>
                  <p className="font-medium">{p.valor_declarado ? `$${p.valor_declarado} USD` : '—'}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Peso / Facturable</p>
                  <p className="font-medium">
                    {p.peso_libras ? `${p.peso_libras} lb` : '—'}
                    {p.peso_facturable && p.peso_facturable !== p.peso_libras
                      ? ` (fact: ${p.peso_facturable} lb)`
                      : ''}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Costo servicio</p>
                  <p className={`font-semibold ${p.costo_servicio ? 'text-green-700' : 'text-gray-400'}`}>
                    {p.costo_servicio ? `$${p.costo_servicio} USD` : 'Sin calcular'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Factura</p>
                  <Badge variant={p.factura_pagada ? 'default' : 'outline'} className={p.factura_pagada ? 'bg-green-100 text-green-700 border-green-200' : ''}>
                    {p.factura_pagada ? 'Pagada' : 'Pendiente'}
                  </Badge>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Registrado</p>
                  <p className="font-medium text-xs">{fechaFmt(p.created_at)}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Última actualización</p>
                  <p className="font-medium text-xs">{fechaFmt(p.updated_at)}</p>
                </div>
              </div>
              {p.notas_cliente && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-400">Notas del cliente</p>
                  <p className="text-sm text-gray-700 mt-1">{p.notas_cliente}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Fotos */}
          {fotos.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Camera className="h-4 w-4 text-orange-600" />
                  Fotos ({fotos.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {fotos.map(f => (
                    <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer"
                      className="aspect-square rounded-lg overflow-hidden border border-gray-200 hover:opacity-80 transition-opacity"
                    >
                      <img src={f.url} alt={f.descripcion ?? 'Foto'} className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Historial de eventos */}
          {eventos.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Historial de estados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {eventos.map(ev => (
                    <div key={ev.id} className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-orange-400 mt-1.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {ev.estado_anterior && (
                            <>
                              <span className="text-xs text-gray-400">
                                {ESTADO_LABELS[ev.estado_anterior as keyof typeof ESTADO_LABELS] ?? ev.estado_anterior}
                              </span>
                              <span className="text-gray-300 text-xs">→</span>
                            </>
                          )}
                          <span className="text-xs font-semibold text-gray-700">
                            {ESTADO_LABELS[ev.estado_nuevo as keyof typeof ESTADO_LABELS] ?? ev.estado_nuevo}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{fechaFmt(ev.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Columna derecha: cliente + edición */}
        <div className="space-y-5">
          {/* Info del cliente */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <MapPin className="h-4 w-4 text-orange-600" />
                Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <p className="font-semibold text-gray-900">{perfil?.nombre_completo}</p>
                <p className="text-orange-600 font-mono text-xs">{perfil?.numero_casilla}</p>
              </div>
              {perfil?.ciudad && <p className="text-gray-500">{perfil.ciudad}</p>}
              {perfil?.email && (
                <a href={`mailto:${perfil.email}`} className="text-blue-600 text-xs hover:underline block truncate">
                  {perfil.email}
                </a>
              )}
              {(perfil?.whatsapp ?? perfil?.telefono) && (
                <a
                  href={`https://wa.me/${(perfil.whatsapp ?? perfil.telefono)?.replace(/\D/g, '')}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-green-600 text-xs hover:underline block"
                >
                  WhatsApp: {perfil.whatsapp ?? perfil.telefono}
                </a>
              )}
              <Link href={`/admin/clientes?q=${perfil?.nombre_completo ?? ''}`} className="text-xs text-orange-600 hover:underline">
                Ver todos sus paquetes →
              </Link>
            </CardContent>
          </Card>

          {/* Tarifa info */}
          {tarifa && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm">
              <p className="font-semibold text-blue-800 mb-1 flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5" /> Tarifa: {CATEGORIA_LABELS[p.categoria as keyof typeof CATEGORIA_LABELS]}
              </p>
              <p className="text-blue-700">
                {tarifa.tarifa_tipo === 'fijo_por_unidad'
                  ? `$${tarifa.precio_fijo} fijo por unidad`
                  : `$${tarifa.tarifa_por_libra} USD/lb`}
              </p>
              {tarifa.seguro_porcentaje > 0 && (
                <p className="text-blue-600 text-xs mt-1 font-medium">
                  + {tarifa.seguro_porcentaje}% seguro incluido
                </p>
              )}
              {tarifa.descripcion && (
                <p className="text-blue-600 text-xs mt-1">{tarifa.descripcion}</p>
              )}
            </div>
          )}

          {/* Formulario de edición */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Scale className="h-4 w-4 text-orange-600" />
                Actualizar paquete
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PaqueteEditForm
                paqueteId={id}
                estado={p.estado}
                bodega={p.bodega_destino}
                pesoLibras={p.peso_libras}
                costoServicio={p.costo_servicio}
                tarifaAplicada={p.tarifa_aplicada}
                trackingUsaco={p.tracking_usaco}
                notasCliente={p.notas_cliente}
                tarifaPorLibra={tarifa?.tarifa_por_libra ?? 0}
                precioFijo={tarifa?.precio_fijo ?? null}
                tarifaTipo={tarifa?.tarifa_tipo ?? 'por_libra'}
                seguroPorcentaje={tarifa?.seguro_porcentaje ?? 0}
                valorDeclarado={p.valor_declarado}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
