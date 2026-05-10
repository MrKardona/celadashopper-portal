import { createClient } from '@supabase/supabase-js'
import { CheckCircle2, Package, MapPin, User, Phone, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import EntregarPaqueteButton from '@/components/admin/EntregarPaqueteButton'
import FacturaBadge from '@/components/admin/FacturaBadge'

const BODEGA_LABELS: Record<string, string> = {
  medellin: 'Medellín', bogota: 'Bogotá', barranquilla: 'Barranquilla',
}

const tw = 'rgba(255,255,255,'

interface Props { searchParams: Promise<{ ciudad?: string }> }

export default async function ListosEntregaPage({ searchParams }: Props) {
  const { ciudad } = await searchParams

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: 'public' }, auth: { persistSession: false } }
  )

  let q = supabase
    .from('paquetes')
    .select('id, tracking_casilla, tracking_origen, descripcion, peso_libras, costo_servicio, factura_id, factura_pagada, bodega_destino, fecha_llegada_colombia, cliente_id, direccion_entrega, barrio_entrega, referencia_entrega')
    .eq('estado', 'en_bodega_local')
    .order('fecha_llegada_colombia', { ascending: true })

  if (ciudad) q = q.eq('bodega_destino', ciudad)
  const { data: paquetes } = await q
  const lista = paquetes ?? []

  const clienteIds = [...new Set(lista.map(p => p.cliente_id).filter(Boolean))] as string[]
  const perfilesMap: Record<string, {
    nombre_completo: string; email: string | null; whatsapp: string | null
    telefono: string | null; direccion: string | null; barrio: string | null
    referencia: string | null; numero_casilla: string | null
  }> = {}
  if (clienteIds.length > 0) {
    const { data: perfiles } = await supabase
      .from('perfiles').select('id, nombre_completo, email, whatsapp, telefono, direccion, barrio, referencia, numero_casilla').in('id', clienteIds)
    for (const p of perfiles ?? []) perfilesMap[p.id] = p
  }

  const ciudades = [...new Set(lista.map(p => p.bodega_destino).filter(Boolean))]

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6" style={{ color: '#34d399' }} />
            Listos para entrega
          </h1>
          <p className="text-sm mt-1" style={{ color: `${tw}0.45)` }}>
            {lista.length} paquete{lista.length !== 1 ? 's' : ''} en bodega Colombia esperando entrega al cliente
          </p>
        </div>
      </div>

      {ciudades.length > 1 && (
        <div className="flex flex-wrap gap-2 text-sm">
          <a href="/admin/listos-entrega" className="px-3 py-1.5 rounded-full text-sm font-medium transition-all"
            style={!ciudad
              ? { background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }
              : { color: `${tw}0.5)`, border: `1px solid ${tw}0.1)` }}>
            Todas
          </a>
          {ciudades.map(c => (
            <a key={c} href={`/admin/listos-entrega?ciudad=${c}`} className="px-3 py-1.5 rounded-full text-sm font-medium transition-all"
              style={ciudad === c
                ? { background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }
                : { color: `${tw}0.5)`, border: `1px solid ${tw}0.1)` }}>
              {BODEGA_LABELS[c!] ?? c}
            </a>
          ))}
        </div>
      )}

      {lista.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Package className="h-10 w-10 mx-auto mb-2 opacity-20 text-white" />
          <p style={{ color: `${tw}0.4)` }}>No hay paquetes pendientes de entrega</p>
          <p className="text-xs mt-1" style={{ color: `${tw}0.25)` }}>Cuando recibas cajas en Colombia, los paquetes aparecerán aquí</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {lista.map(p => {
            const cli = p.cliente_id ? perfilesMap[p.cliente_id] : null
            const direccion = p.direccion_entrega ?? cli?.direccion ?? null
            const barrio = p.barrio_entrega ?? cli?.barrio ?? null
            const referencia = p.referencia_entrega ?? cli?.referencia ?? null
            const tel = cli?.whatsapp ?? cli?.telefono ?? null

            return (
              <div key={p.id} className="glass-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-sm font-bold" style={{ color: '#F5B800' }}>{p.tracking_origen ?? p.tracking_casilla}</p>
                      <Link href={`/admin/paquetes/${p.id}`}
                        className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium transition-all hover:opacity-80"
                        style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <ExternalLink className="h-2.5 w-2.5" />
                        Ver / Editar
                      </Link>
                    </div>
                    <p className="text-sm mt-0.5 truncate text-white">{p.descripcion}</p>
                    <div className="mt-1.5">
                      <FacturaBadge
                        facturaId={p.factura_id ?? null}
                        facturaPagada={p.factura_pagada ?? null}
                        costoServicio={p.costo_servicio ?? null}
                        size="xs"
                      />
                    </div>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
                    style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}>
                    {BODEGA_LABELS[p.bodega_destino] ?? p.bodega_destino}
                  </span>
                </div>

                {/* Cliente */}
                <div className="rounded-xl p-3 space-y-1" style={{ background: `${tw}0.05)`, border: `1px solid ${tw}0.08)` }}>
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-3.5 w-3.5 flex-shrink-0" style={{ color: `${tw}0.4)` }} />
                    <span className="font-semibold text-white truncate">
                      {cli?.nombre_completo ?? '⏳ Sin asignar'}
                    </span>
                    {cli?.numero_casilla && (
                      <span className="text-[11px] font-mono" style={{ color: '#F5B800' }}>{cli.numero_casilla}</span>
                    )}
                  </div>
                  {tel && (
                    <a href={`https://wa.me/${tel.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs hover:underline" style={{ color: '#34d399' }}>
                      <Phone className="h-3 w-3" />
                      {tel}
                    </a>
                  )}
                </div>

                {/* Dirección */}
                {direccion ? (
                  <div className="text-xs space-y-0.5">
                    <p className="flex items-start gap-1.5" style={{ color: `${tw}0.7)` }}>
                      <MapPin className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: '#F5B800' }} />
                      <span>{direccion}</span>
                    </p>
                    {(barrio || referencia) && (
                      <p className="text-[11px] ml-5" style={{ color: `${tw}0.4)` }}>
                        {barrio && <span>{barrio}</span>}
                        {barrio && referencia && <span> · </span>}
                        {referencia && <span>{referencia}</span>}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs px-2 py-1 rounded flex items-center gap-1"
                    style={{ background: 'rgba(245,184,0,0.08)', color: '#F5B800', border: '1px solid rgba(245,184,0,0.2)' }}>
                    <MapPin className="h-3 w-3" />
                    Sin dirección de entrega registrada
                  </p>
                )}

                {/* Datos */}
                <div className="flex flex-wrap gap-3 text-xs pt-2" style={{ borderTop: `1px solid ${tw}0.06)`, color: `${tw}0.4)` }}>
                  {p.peso_libras && <span>{Number(p.peso_libras).toFixed(1)} lb</span>}
                  {p.costo_servicio && <span>${Number(p.costo_servicio).toFixed(2)} USD</span>}
                  {p.fecha_llegada_colombia && (
                    <span className="ml-auto" style={{ color: `${tw}0.3)` }}>
                      Llegó hace {Math.floor((Date.now() - new Date(p.fecha_llegada_colombia).getTime()) / (1000 * 60 * 60 * 24))} días
                    </span>
                  )}
                </div>

                <EntregarPaqueteButton
                  paqueteId={p.id}
                  tracking={p.tracking_casilla ?? ''}
                  descripcion={p.descripcion}
                  clienteEmail={cli?.email ?? null}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
