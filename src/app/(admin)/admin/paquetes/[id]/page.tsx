import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import Link from 'next/link'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
import { ArrowLeft, Package, MapPin, Scale, DollarSign, Calendar, Camera, FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import PaqueteEditForm from '@/components/admin/PaqueteEditForm'
import EliminarPaqueteButton from '@/components/admin/EliminarPaqueteButton'
import PruebaWhatsappButton from '@/components/admin/PruebaWhatsappButton'
import PruebaEmailButton from '@/components/admin/PruebaEmailButton'
import AsignarClienteButton from '@/components/admin/AsignarClienteButton'
import CrearFacturaZohoButton from '@/components/admin/CrearFacturaZohoButton'
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
  let perfil: {
    nombre_completo: string
    numero_casilla: string
    email: string
    whatsapp: string | null
    telefono: string | null
    ciudad: string | null
    direccion: string | null
    barrio: string | null
    referencia: string | null
  } | null = null
  if (p.cliente_id) {
    const { data: perfilData } = await supabase
      .from('perfiles')
      .select('nombre_completo, numero_casilla, email, whatsapp, telefono, ciudad, direccion, barrio, referencia')
      .eq('id', p.cliente_id)
      .single()
    perfil = perfilData
  }

  // Cargar tarifa legacy (solo para mostrar info de referencia)
  const { data: tarifa } = await supabase
    .from('categorias_tarifas')
    .select('tarifa_por_libra, precio_fijo, tarifa_tipo, descripcion, seguro_porcentaje')
    .eq('categoria', p.categoria)
    .maybeSingle()

  // Cargar primera regla de tarifas_rangos para la categoría (solo para mostrar referencia)
  const { data: tarifaRango } = await supabase
    .from('tarifas_rangos')
    .select('tarifa_por_libra, precio_por_unidad, cargo_fijo, seguro_porcentaje, notas')
    .eq('categoria', p.categoria)
    .eq('activo', true)
    .order('prioridad', { ascending: true })
    .limit(1)
    .maybeSingle()

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
                  <p className="text-gray-400 text-xs">Condición</p>
                  <p className="font-medium capitalize">{p.condicion ?? '—'}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Cantidad</p>
                  <p className="font-medium">{p.cantidad ?? 1} ud{(p.cantidad ?? 1) !== 1 ? 's' : ''}</p>
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
                  <p className="text-gray-400 text-xs">Pago</p>
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
          <Card className={!perfil ? 'border-amber-300 bg-amber-50/40' : ''}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <MapPin className="h-4 w-4 text-orange-600" />
                Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {!perfil ? (
                <>
                  <div className="bg-amber-100 border border-amber-300 rounded-lg p-3 text-center">
                    <p className="text-amber-800 font-semibold text-sm">⏳ Paquete sin asignar</p>
                    <p className="text-xs text-amber-700 mt-1">
                      Este paquete aún no tiene cliente. Asígnalo manualmente para que pueda hacer seguimiento.
                    </p>
                  </div>
                  <AsignarClienteButton
                    paqueteId={id}
                    trackingCasilla={p.tracking_casilla ?? '—'}
                    descripcion={p.descripcion ?? '—'}
                    clienteActual={null}
                    variante="primary"
                  />
                </>
              ) : (
                <>
                  <div>
                    <p className="font-semibold text-gray-900">{perfil.nombre_completo}</p>
                    <p className="text-orange-600 font-mono text-xs">{perfil.numero_casilla}</p>
                  </div>
                  {perfil.email && (
                    <a href={`mailto:${perfil.email}`} className="text-blue-600 text-xs hover:underline block truncate">
                      {perfil.email}
                    </a>
                  )}
                  {(perfil.whatsapp ?? perfil.telefono) && (
                    <a
                      href={`https://wa.me/${(perfil.whatsapp ?? perfil.telefono)?.replace(/\D/g, '')}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-green-600 text-xs hover:underline block"
                    >
                      WhatsApp: {perfil.whatsapp ?? perfil.telefono}
                    </a>
                  )}

                  {/* Dirección de entrega del cliente */}
                  {(perfil.direccion || perfil.barrio || perfil.referencia || perfil.ciudad) && (
                    <div className="pt-2 mt-2 border-t border-gray-100">
                      <p className="text-[11px] text-gray-400 uppercase tracking-wide font-medium mb-1">
                        Dirección de entrega
                      </p>
                      {perfil.direccion && (
                        <p className="text-gray-700 text-xs leading-relaxed">{perfil.direccion}</p>
                      )}
                      {perfil.barrio && (
                        <p className="text-gray-500 text-xs">Barrio: {perfil.barrio}</p>
                      )}
                      {perfil.ciudad && (
                        <p className="text-gray-500 text-xs">{perfil.ciudad}</p>
                      )}
                      {perfil.referencia && (
                        <p className="text-gray-500 text-[11px] italic mt-0.5">
                          Ref: {perfil.referencia}
                        </p>
                      )}
                      {!perfil.direccion && !perfil.barrio && !perfil.referencia && perfil.ciudad && (
                        <p className="text-amber-600 text-[11px] italic">
                          ⚠️ Solo tiene ciudad, sin dirección detallada
                        </p>
                      )}
                    </div>
                  )}
                  {!perfil.direccion && !perfil.ciudad && (
                    <div className="pt-2 mt-2 border-t border-gray-100">
                      <p className="text-amber-700 text-xs bg-amber-50 border border-amber-200 px-2 py-1 rounded">
                        ⚠️ Cliente sin dirección registrada
                      </p>
                    </div>
                  )}

                  <Link
                    href={`/admin/paquetes?q=${encodeURIComponent(perfil.nombre_completo ?? '')}`}
                    className="text-xs text-orange-600 hover:underline block pt-2"
                  >
                    Ver todos los paquetes de este cliente →
                  </Link>

                  <div className="pt-3 border-t border-gray-100 space-y-2">
                    {/* Prueba de Email al cliente */}
                    <PruebaEmailButton emailSugerido={perfil.email} nombreSugerido={perfil.nombre_completo} />
                    {/* Prueba de WhatsApp al cliente */}
                    <PruebaWhatsappButton telefonoSugerido={perfil.whatsapp ?? perfil.telefono ?? null} />
                    {/* Reasignar a otro cliente */}
                    <AsignarClienteButton
                      paqueteId={id}
                      trackingCasilla={p.tracking_casilla ?? '—'}
                      descripcion={p.descripcion ?? '—'}
                      clienteActual={{ nombre: perfil.nombre_completo, casilla: perfil.numero_casilla }}
                      variante="subtle"
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Tarifa info */}
          {(tarifaRango || tarifa) && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm">
              <p className="font-semibold text-blue-800 mb-1 flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5" /> Tarifa: {CATEGORIA_LABELS[p.categoria as keyof typeof CATEGORIA_LABELS]}
              </p>
              {tarifaRango ? (
                <>
                  <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide">Escalonada</span>
                  <p className="text-blue-700 mt-1 text-xs">
                    {Number(tarifaRango.cargo_fijo) > 0 && `$${tarifaRango.cargo_fijo} fijo + `}
                    {Number(tarifaRango.precio_por_unidad) > 0 && `$${tarifaRango.precio_por_unidad}/ud + `}
                    {Number(tarifaRango.tarifa_por_libra) > 0 && `$${tarifaRango.tarifa_por_libra}/lb`}
                  </p>
                  {Number(tarifaRango.seguro_porcentaje) > 0 && (
                    <p className="text-blue-600 text-xs mt-0.5">+ {tarifaRango.seguro_porcentaje}% seguro</p>
                  )}
                  {tarifaRango.notas && (
                    <p className="text-blue-500 text-xs mt-1 italic">{tarifaRango.notas}</p>
                  )}
                </>
              ) : tarifa ? (
                <>
                  <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide">Legacy</span>
                  <p className="text-blue-700 mt-1">
                    {tarifa.tarifa_tipo === 'fijo_por_unidad'
                      ? `$${tarifa.precio_fijo} fijo por unidad`
                      : `$${tarifa.tarifa_por_libra} USD/lb`}
                  </p>
                  {tarifa.seguro_porcentaje > 0 && (
                    <p className="text-blue-600 text-xs mt-1 font-medium">+ {tarifa.seguro_porcentaje}% seguro</p>
                  )}
                </>
              ) : null}
            </div>
          )}

          {/* Factura Zoho */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-orange-600" />
                Factura Zoho Inventory
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CrearFacturaZohoButton
                paqueteId={id}
                facturaId={p.factura_id ?? null}
                costoServicio={p.costo_servicio ?? null}
              />
            </CardContent>
          </Card>

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
                categoria={p.categoria}
                pesoLibras={p.peso_libras}
                pesoFacturable={p.peso_facturable}
                costoServicio={p.costo_servicio}
                tarifaAplicada={p.tarifa_aplicada}
                trackingUsaco={p.tracking_usaco}
                notasCliente={p.notas_cliente}
                valorDeclarado={p.valor_declarado}
                condicion={p.condicion ?? null}
                cantidad={p.cantidad ?? 1}
              />
            </CardContent>
          </Card>

          {/* Zona peligrosa: eliminar paquete */}
          <Card className="border-red-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-red-700">Zona peligrosa</CardTitle>
            </CardHeader>
            <CardContent>
              <EliminarPaqueteButton
                paqueteId={id}
                trackingCasilla={p.tracking_casilla ?? '—'}
                descripcion={p.descripcion ?? '—'}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
