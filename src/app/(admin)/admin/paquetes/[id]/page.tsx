import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Package, MapPin, Scale, DollarSign, Camera, FileText } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import PaqueteEditForm from '@/components/admin/PaqueteEditForm'
import EliminarPaqueteButton from '@/components/admin/EliminarPaqueteButton'
import PruebaWhatsappButton from '@/components/admin/PruebaWhatsappButton'
import PruebaEmailButton from '@/components/admin/PruebaEmailButton'
import AsignarClienteButton from '@/components/admin/AsignarClienteButton'
import CrearFacturaZohoButton from '@/components/admin/CrearFacturaZohoButton'
import ClienteEditInline from '@/components/admin/ClienteEditInline'
import FacturaBadge from '@/components/admin/FacturaBadge'
import DividirPaqueteModal from '@/components/admin/DividirPaqueteModal'
import EliminarDivisionButton from '@/components/admin/EliminarDivisionButton'
import { ESTADO_LABELS, CATEGORIA_LABELS } from '@/types'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

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

const BODEGA_LABELS: Record<string, string> = {
  medellin: 'Medellín', bogota: 'Bogotá', barranquilla: 'Barranquilla',
}

const tw = 'rgba(255,255,255,'

interface Props { params: Promise<{ id: string }> }

function InfoRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide mb-0.5" style={{ color: `${tw}0.3)` }}>{label}</p>
      <p className={`font-medium text-sm text-white ${mono ? 'font-mono' : ''}`}>{value ?? '—'}</p>
    </div>
  )
}

function GlassSection({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: `1px solid ${tw}0.06)` }}>
        <Icon className="h-4 w-4" style={{ color: '#F5B800' }} />
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}

export default async function AdminPaqueteDetalle({ params }: Props) {
  const { id } = await params
  const supabase = getSupabaseAdmin()

  const [paqueteRes, fotosRes, eventosRes, subPaquetesRes] = await Promise.all([
    supabase.from('paquetes').select('*').eq('id', id).single(),
    supabase.from('fotos_paquetes').select('*').eq('paquete_id', id).order('created_at'),
    supabase.from('eventos_paquete').select('*').eq('paquete_id', id).order('created_at', { ascending: false }),
    supabase.from('paquetes').select('id, descripcion, peso_libras, cantidad, estado, costo_servicio, notas_internas').eq('paquete_origen_id', id).order('created_at'),
  ])

  if (paqueteRes.error || !paqueteRes.data) notFound()

  const p = paqueteRes.data
  const fotos = fotosRes.data ?? []
  const eventos = eventosRes.data ?? []
  const subPaquetes = subPaquetesRes.data ?? []

  let perfil: {
    nombre_completo: string; numero_casilla: string; email: string
    whatsapp: string | null; telefono: string | null; ciudad: string | null
    direccion: string | null; barrio: string | null; referencia: string | null
  } | null = null
  if (p.cliente_id) {
    const { data } = await supabase.from('perfiles')
      .select('nombre_completo, numero_casilla, email, whatsapp, telefono, ciudad, direccion, barrio, referencia')
      .eq('id', p.cliente_id).single()
    perfil = data
  }

  const { data: tarifa } = await supabase.from('categorias_tarifas')
    .select('tarifa_por_libra, precio_fijo, tarifa_tipo, descripcion, seguro_porcentaje')
    .eq('categoria', p.categoria).maybeSingle()

  const { data: tarifaRango } = await supabase.from('tarifas_rangos')
    .select('tarifa_por_libra, precio_por_unidad, cargo_fijo, seguro_porcentaje, notas')
    .eq('categoria', p.categoria).eq('activo', true)
    .order('prioridad', { ascending: true }).limit(1).maybeSingle()

  const fechaFmt = (d: string | null) =>
    d ? format(new Date(d), "d MMM yyyy, HH:mm", { locale: es }) : '—'

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/admin/paquetes" className="mt-1 p-1.5 rounded-lg transition-all hover:text-white/80"
          style={{ color: `${tw}0.4)` }}
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-white font-mono">{p.tracking_casilla}</h1>
            {(() => { const s = ESTADO_DARK[p.estado] ?? { bg: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)', border: 'rgba(255,255,255,0.12)' }; return (
              <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                {ESTADO_LABELS[p.estado as keyof typeof ESTADO_LABELS] ?? p.estado}
              </span>
            )})()}
            {p.paquete_origen_id && (
              <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>
                ✂️ Sub-paquete
              </span>
            )}
            <FacturaBadge
              facturaId={p.factura_id ?? null}
              facturaPagada={p.factura_pagada ?? null}
              costoServicio={p.costo_servicio ?? null}
            />
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <p className="text-sm" style={{ color: `${tw}0.45)` }}>{p.descripcion} · {p.tienda}</p>
            {!p.paquete_origen_id && (
              <DividirPaqueteModal
                paqueteId={id}
                descripcionOrigen={p.descripcion ?? ''}
                pesoLibrasOrigen={p.peso_libras ?? null}
                cantidadOrigen={p.cantidad ?? null}
                valorDeclaradoOrigen={p.valor_declarado ?? null}
              />
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Columna izquierda */}
        <div className="lg:col-span-2 space-y-5">

          {/* Datos del paquete */}
          <GlassSection icon={Package} title="Datos del paquete">
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="Categoría" value={CATEGORIA_LABELS[p.categoria as keyof typeof CATEGORIA_LABELS] ?? p.categoria} />
              <InfoRow label="Bodega destino" value={BODEGA_LABELS[p.bodega_destino] ?? p.bodega_destino} />
              <InfoRow label="Tracking origen" value={p.tracking_origen} mono />
              <InfoRow label="Tracking USACO" value={p.tracking_usaco} mono />
              <InfoRow label="Condición" value={p.condicion ? <span className="capitalize">{p.condicion}</span> : null} />
              <InfoRow label="Cantidad" value={`${p.cantidad ?? 1} ud${(p.cantidad ?? 1) !== 1 ? 's' : ''}`} />
              <InfoRow label="Valor declarado" value={p.valor_declarado ? `$${p.valor_declarado} USD` : null} />
              <InfoRow label="Peso / Facturable" value={
                p.peso_libras
                  ? `${p.peso_libras} lb${p.peso_facturable && p.peso_facturable !== p.peso_libras ? ` (fact: ${p.peso_facturable} lb)` : ''}`
                  : null
              } />
              <InfoRow label="Costo servicio" value={
                p.costo_servicio
                  ? <span style={{ color: '#34d399' }}>${p.costo_servicio} USD</span>
                  : <span style={{ color: `${tw}0.3)` }}>Sin calcular</span>
              } />
              <InfoRow label="Pago" value={
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${p.factura_pagada ? 'bg-green-500/15 text-green-400 border border-green-500/25' : 'bg-white/[0.06] border border-white/10'}`}
                  style={!p.factura_pagada ? { color: `${tw}0.45)` } : {}}>
                  {p.factura_pagada ? 'Pagada' : 'Pendiente'}
                </span>
              } />
              <InfoRow label="Registrado" value={<span className="text-xs">{fechaFmt(p.created_at)}</span>} />
              <InfoRow label="Última actualización" value={<span className="text-xs">{fechaFmt(p.updated_at)}</span>} />
            </div>
            {p.notas_cliente && (
              <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${tw}0.06)` }}>
                <p className="text-xs uppercase tracking-wide mb-1" style={{ color: `${tw}0.3)` }}>Notas del cliente</p>
                <p className="text-sm" style={{ color: `${tw}0.7)` }}>{p.notas_cliente}</p>
              </div>
            )}
          </GlassSection>

          {/* Fotos */}
          {fotos.length > 0 && (
            <GlassSection icon={Camera} title={`Fotos (${fotos.length})`}>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {fotos.map(f => (
                  <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer"
                    className="aspect-square rounded-xl overflow-hidden hover:opacity-80 transition-opacity"
                    style={{ border: `1px solid ${tw}0.1)` }}>
                    <img src={f.url} alt={f.descripcion ?? 'Foto'} className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            </GlassSection>
          )}

          {/* Historial */}
          {eventos.length > 0 && (
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Historial de estados</h3>
              <div className="space-y-3">
                {eventos.map(ev => (
                  <div key={ev.id} className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: '#F5B800' }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {ev.estado_anterior && (
                          <>
                            <span className="text-xs" style={{ color: `${tw}0.35)` }}>
                              {ESTADO_LABELS[ev.estado_anterior as keyof typeof ESTADO_LABELS] ?? ev.estado_anterior}
                            </span>
                            <span className="text-xs" style={{ color: `${tw}0.2)` }}>→</span>
                          </>
                        )}
                        <span className="text-xs font-semibold text-white">
                          {ESTADO_LABELS[ev.estado_nuevo as keyof typeof ESTADO_LABELS] ?? ev.estado_nuevo}
                        </span>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: `${tw}0.35)` }}>{fechaFmt(ev.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Sub-paquetes */}
          {subPaquetes.length > 0 && (
            <div className="glass-card overflow-hidden" style={{ borderColor: 'rgba(251,191,36,0.2)' }}>
              <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: `1px solid rgba(251,191,36,0.1)` }}>
                <span className="text-sm">✂️</span>
                <h3 className="text-sm font-semibold text-white">Divisiones ({subPaquetes.length})</h3>
                <span className="text-xs ml-auto" style={{ color: 'rgba(255,255,255,0.3)' }}>Invisibles para el cliente</span>
              </div>
              <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                {subPaquetes.map((sp, i) => (
                  <div key={sp.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{sp.descripcion}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {sp.peso_libras ? `${sp.peso_libras} lb` : 'Sin peso'}
                        {sp.cantidad ? ` · ${sp.cantidad} ud` : ''}
                        {sp.costo_servicio ? ` · $${sp.costo_servicio}` : ''}
                        {sp.notas_internas ? ` · ${sp.notas_internas}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {(() => { const s = ESTADO_DARK[sp.estado] ?? { bg: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', border: 'rgba(255,255,255,0.1)' }; return (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                          {ESTADO_LABELS[sp.estado as keyof typeof ESTADO_LABELS] ?? sp.estado}
                        </span>
                      )})()}
                      <a href={`/admin/paquetes/${sp.id}`}
                        className="text-[10px] font-semibold px-2 py-1 rounded-lg"
                        style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
                        Ver →
                      </a>
                      <EliminarDivisionButton subPaqueteId={sp.id} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Vínculo al paquete origen si es sub-paquete */}
          {p.paquete_origen_id && (
            <div className="rounded-xl px-4 py-3 flex items-center justify-between gap-3"
              style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                ✂️ Este es un sub-paquete. Paquete origen:
              </p>
              <a href={`/admin/paquetes/${p.paquete_origen_id}`}
                className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }}>
                Ver origen →
              </a>
            </div>
          )}
        </div>

        {/* Columna derecha */}
        <div className="space-y-5">
          {/* Cliente */}
          <div className="glass-card overflow-hidden" style={!perfil ? { borderColor: 'rgba(245,184,0,0.2)' } : {}}>
            <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: `1px solid ${tw}0.06)` }}>
              <MapPin className="h-4 w-4" style={{ color: '#F5B800' }} />
              <h3 className="text-sm font-semibold text-white">Cliente</h3>
            </div>
            <div className="px-5 py-4 space-y-3 text-sm">
              {!perfil ? (
                <>
                  <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(245,184,0,0.08)', border: '1px solid rgba(245,184,0,0.2)' }}>
                    <p className="font-semibold text-sm" style={{ color: '#F5B800' }}>⏳ Paquete sin asignar</p>
                    <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      Este paquete aún no tiene cliente. Asígnalo manualmente.
                    </p>
                  </div>
                  <AsignarClienteButton paqueteId={id} trackingCasilla={p.tracking_casilla ?? '—'} descripcion={p.descripcion ?? '—'} clienteActual={null} variante="primary" />
                </>
              ) : (
                <>
                  <div>
                    <p className="font-semibold text-white">{perfil.nombre_completo}</p>
                    <p className="font-mono text-xs mt-0.5" style={{ color: '#F5B800' }}>{perfil.numero_casilla}</p>
                  </div>
                  {perfil.email && (
                    <a href={`mailto:${perfil.email}`} className="text-xs hover:underline block truncate" style={{ color: '#8899ff' }}>
                      {perfil.email}
                    </a>
                  )}
                  {(perfil.whatsapp ?? perfil.telefono) && (
                    <a href={`https://wa.me/${(perfil.whatsapp ?? perfil.telefono)?.replace(/\D/g, '')}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-xs hover:underline block" style={{ color: '#34d399' }}>
                      WhatsApp: {perfil.whatsapp ?? perfil.telefono}
                    </a>
                  )}

                  {(perfil.direccion || perfil.barrio || perfil.referencia || perfil.ciudad) && (
                    <div className="pt-3 mt-2" style={{ borderTop: `1px solid ${tw}0.06)` }}>
                      <p className="text-[11px] uppercase tracking-wide font-medium mb-1" style={{ color: `${tw}0.3)` }}>Dirección de entrega</p>
                      {perfil.direccion && <p className="text-xs leading-relaxed" style={{ color: `${tw}0.65)` }}>{perfil.direccion}</p>}
                      {perfil.barrio && <p className="text-xs mt-0.5" style={{ color: `${tw}0.4)` }}>Barrio: {perfil.barrio}</p>}
                      {perfil.ciudad && <p className="text-xs" style={{ color: `${tw}0.4)` }}>{perfil.ciudad}</p>}
                      {perfil.referencia && <p className="text-xs mt-0.5 italic" style={{ color: `${tw}0.35)` }}>Ref: {perfil.referencia}</p>}
                      {!perfil.direccion && !perfil.barrio && !perfil.referencia && perfil.ciudad && (
                        <p className="text-[11px] italic" style={{ color: '#F5B800' }}>⚠️ Solo tiene ciudad, sin dirección detallada</p>
                      )}
                    </div>
                  )}
                  {!perfil.direccion && !perfil.ciudad && (
                    <div className="pt-2 mt-2" style={{ borderTop: `1px solid ${tw}0.06)` }}>
                      <p className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(245,184,0,0.08)', color: '#F5B800', border: '1px solid rgba(245,184,0,0.2)' }}>
                        ⚠️ Cliente sin dirección registrada
                      </p>
                    </div>
                  )}

                  <Link href={`/admin/paquetes?q=${encodeURIComponent(perfil.nombre_completo ?? '')}`}
                    className="text-xs font-semibold block pt-2 hover:underline" style={{ color: '#F5B800' }}>
                    Ver todos los paquetes de este cliente →
                  </Link>

                  <div className="pt-3 space-y-2" style={{ borderTop: `1px solid ${tw}0.06)` }}>
                    <PruebaEmailButton emailSugerido={perfil.email} nombreSugerido={perfil.nombre_completo} />
                    <PruebaWhatsappButton telefonoSugerido={perfil.whatsapp ?? perfil.telefono ?? null} />
                    <AsignarClienteButton paqueteId={id} trackingCasilla={p.tracking_casilla ?? '—'} descripcion={p.descripcion ?? '—'}
                      clienteActual={{ nombre: perfil.nombre_completo, casilla: perfil.numero_casilla }} variante="subtle" />
                  </div>

                  <div className="pt-3" style={{ borderTop: `1px solid ${tw}0.06)` }}>
                    <ClienteEditInline perfil={{
                      id: p.cliente_id!,
                      nombre_completo: perfil.nombre_completo,
                      numero_casilla: perfil.numero_casilla,
                      email: perfil.email,
                      whatsapp: perfil.whatsapp,
                      telefono: perfil.telefono,
                      ciudad: perfil.ciudad,
                      direccion: perfil.direccion,
                      barrio: perfil.barrio,
                      referencia: perfil.referencia,
                    }} />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Tarifa */}
          {(tarifaRango || tarifa) && (
            <div className="glass-card p-4 text-sm" style={{ borderColor: 'rgba(99,130,255,0.2)' }}>
              <p className="font-semibold text-white mb-2 flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5" style={{ color: '#8899ff' }} />
                Tarifa: {CATEGORIA_LABELS[p.categoria as keyof typeof CATEGORIA_LABELS]}
              </p>
              {tarifaRango ? (
                <>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide"
                    style={{ background: 'rgba(245,184,0,0.12)', color: '#F5B800', border: '1px solid rgba(245,184,0,0.2)' }}>Escalonada</span>
                  <p className="mt-2 text-xs" style={{ color: `${tw}0.65)` }}>
                    {Number(tarifaRango.cargo_fijo) > 0 && `$${tarifaRango.cargo_fijo} fijo + `}
                    {Number(tarifaRango.precio_por_unidad) > 0 && `$${tarifaRango.precio_por_unidad}/ud + `}
                    {Number(tarifaRango.tarifa_por_libra) > 0 && `$${tarifaRango.tarifa_por_libra}/lb`}
                  </p>
                  {Number(tarifaRango.seguro_porcentaje) > 0 && <p className="text-xs mt-0.5" style={{ color: `${tw}0.45)` }}>+ {tarifaRango.seguro_porcentaje}% seguro</p>}
                  {tarifaRango.notas && <p className="text-xs mt-1 italic" style={{ color: `${tw}0.35)` }}>{tarifaRango.notas}</p>}
                </>
              ) : tarifa ? (
                <>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide"
                    style={{ background: `${tw}0.08)`, color: `${tw}0.5)`, border: `1px solid ${tw}0.12)` }}>Legacy</span>
                  <p className="mt-2 text-xs" style={{ color: `${tw}0.65)` }}>
                    {tarifa.tarifa_tipo === 'fijo_por_unidad' ? `$${tarifa.precio_fijo} fijo por unidad` : `$${tarifa.tarifa_por_libra} USD/lb`}
                  </p>
                  {tarifa.seguro_porcentaje > 0 && <p className="text-xs mt-1 font-medium" style={{ color: `${tw}0.45)` }}>+ {tarifa.seguro_porcentaje}% seguro</p>}
                </>
              ) : null}
            </div>
          )}

          {/* Factura Zoho */}
          <GlassSection icon={FileText} title="Factura Zoho Inventory">
            <CrearFacturaZohoButton paqueteId={id} facturaId={p.factura_id ?? null} costoServicio={p.costo_servicio ?? null} facturaPagada={p.factura_pagada ?? null} />
          </GlassSection>

          {/* Editar */}
          <GlassSection icon={Scale} title="Actualizar paquete">
            <PaqueteEditForm
              paqueteId={id} estado={p.estado} bodega={p.bodega_destino} categoria={p.categoria}
              pesoLibras={p.peso_libras} pesoFacturable={p.peso_facturable} costoServicio={p.costo_servicio}
              tarifaAplicada={p.tarifa_aplicada} trackingUsaco={p.tracking_usaco} notasCliente={p.notas_cliente}
              valorDeclarado={p.valor_declarado} condicion={p.condicion ?? null} cantidad={p.cantidad ?? 1}
            />
          </GlassSection>

          {/* Zona peligrosa */}
          <div className="glass-card overflow-hidden" style={{ borderColor: 'rgba(239,68,68,0.2)' }}>
            <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(239,68,68,0.12)' }}>
              <h3 className="text-sm font-semibold" style={{ color: '#f87171' }}>Zona peligrosa</h3>
            </div>
            <div className="px-5 py-4">
              <EliminarPaqueteButton paqueteId={id} trackingCasilla={p.tracking_casilla ?? '—'} descripcion={p.descripcion ?? '—'} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
