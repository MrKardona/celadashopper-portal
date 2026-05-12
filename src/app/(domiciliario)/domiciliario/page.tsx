export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { CheckCircle2, MapPin, Phone, Package, User, ExternalLink } from 'lucide-react'
import EntregarDomiciliarioButton from '@/components/domiciliario/EntregarDomiciliarioButton'

const BODEGA_LABELS: Record<string, string> = {
  medellin: 'Medellín', bogota: 'Bogotá', barranquilla: 'Barranquilla',
}
const tw = 'rgba(255,255,255,'

function getAdmin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export default async function DomiciliarioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = getAdmin()
  const { data: perfil } = await admin.from('perfiles').select('rol').eq('id', user.id).single()
  if (perfil?.rol !== 'domiciliario') redirect('/dashboard')

  const { data: paquetes } = await admin
    .from('paquetes')
    .select('id, tracking_casilla, tracking_origen, descripcion, peso_libras, costo_servicio, bodega_destino, cliente_id, direccion_entrega, barrio_entrega, referencia_entrega, estado, fecha_asignacion_domiciliario')
    .eq('domiciliario_id', user.id)
    .in('estado', ['en_camino_cliente', 'en_bodega_local'])
    .order('fecha_asignacion_domiciliario', { ascending: true })

  const lista = paquetes ?? []

  const clienteIds = [...new Set(lista.map(p => p.cliente_id).filter(Boolean))] as string[]
  const perfilesMap: Record<string, {
    nombre_completo: string
    whatsapp: string | null
    telefono: string | null
    direccion: string | null
    barrio: string | null
    referencia: string | null
  }> = {}

  if (clienteIds.length > 0) {
    const { data: pfs } = await admin
      .from('perfiles')
      .select('id, nombre_completo, whatsapp, telefono, direccion, barrio, referencia')
      .in('id', clienteIds)
    for (const p of pfs ?? []) perfilesMap[p.id] = p
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6" style={{ color: '#34d399' }} />
            Mis entregas
          </h1>
          <p className="text-sm mt-1" style={{ color: `${tw}0.45)` }}>
            {lista.length === 0
              ? 'No tienes paquetes asignados por ahora'
              : `${lista.length} paquete${lista.length !== 1 ? 's' : ''} pendiente${lista.length !== 1 ? 's' : ''} de entrega`}
          </p>
        </div>
      </div>

      {lista.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Package className="h-10 w-10 mx-auto mb-2 opacity-20 text-white" />
          <p style={{ color: `${tw}0.4)` }}>Sin paquetes asignados</p>
          <p className="text-xs mt-1" style={{ color: `${tw}0.25)` }}>El administrador te asignará paquetes cuando estén listos para entregar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {lista.map((p, idx) => {
            const cli = p.cliente_id ? perfilesMap[p.cliente_id] : null
            const direccion = p.direccion_entrega ?? cli?.direccion ?? null
            const barrio    = p.barrio_entrega    ?? cli?.barrio    ?? null
            const referencia = p.referencia_entrega ?? cli?.referencia ?? null
            const tel = cli?.whatsapp ?? cli?.telefono ?? null

            return (
              <div key={p.id} className="glass-card p-4 space-y-3">

                {/* Tracking + nombre */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-sm font-bold" style={{ color: '#F5B800' }}>
                        {p.tracking_origen ?? p.tracking_casilla}
                      </p>
                      <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}>
                        #{idx + 1}
                      </span>
                    </div>
                    <p className="text-sm mt-0.5 text-white font-medium">{p.descripcion}</p>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap flex-shrink-0"
                    style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}>
                    {BODEGA_LABELS[p.bodega_destino ?? ''] ?? p.bodega_destino}
                  </span>
                </div>

                {/* Cliente */}
                <div className="rounded-xl p-3 space-y-2" style={{ background: `${tw}0.05)`, border: `1px solid ${tw}0.08)` }}>
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-3.5 w-3.5 flex-shrink-0" style={{ color: `${tw}0.4)` }} />
                    <span className="font-semibold text-white truncate">
                      {cli?.nombre_completo ?? '⏳ Sin asignar'}
                    </span>
                  </div>
                  {tel && (
                    <a href={`https://wa.me/${tel.replace(/\D/g, '')}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs hover:underline"
                      style={{ color: '#34d399' }}>
                      <Phone className="h-3 w-3" />
                      {tel}
                    </a>
                  )}
                </div>

                {/* Dirección */}
                {direccion ? (
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent([direccion, barrio, BODEGA_LABELS[p.bodega_destino ?? ''] ?? p.bodega_destino].filter(Boolean).join(', '))}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-start gap-2 text-xs hover:opacity-80 transition-opacity"
                    style={{ color: `${tw}0.7)` }}>
                    <MapPin className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: '#F5B800' }} />
                    <div>
                      <p>{direccion}</p>
                      {(barrio || referencia) && (
                        <p className="mt-0.5" style={{ color: `${tw}0.4)` }}>
                          {[barrio, referencia].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      <p className="mt-0.5 flex items-center gap-1" style={{ color: '#F5B800' }}>
                        <ExternalLink className="h-2.5 w-2.5" /> Abrir en Maps
                      </p>
                    </div>
                  </a>
                ) : (
                  <p className="text-xs px-2 py-2 rounded-xl flex items-center gap-1.5"
                    style={{ background: 'rgba(245,184,0,0.08)', color: '#F5B800', border: '1px solid rgba(245,184,0,0.2)' }}>
                    <MapPin className="h-3 w-3" />
                    Sin dirección de entrega — contacta al administrador
                  </p>
                )}

                {/* Datos peso/costo */}
                {(p.peso_libras || p.costo_servicio) && (
                  <div className="flex gap-3 text-xs pt-1" style={{ borderTop: `1px solid ${tw}0.06)`, color: `${tw}0.4)` }}>
                    {p.peso_libras && <span>{Number(p.peso_libras).toFixed(1)} lb</span>}
                    {p.costo_servicio && <span>${Number(p.costo_servicio).toFixed(2)} USD</span>}
                  </div>
                )}

                {/* Botón de entrega */}
                <EntregarDomiciliarioButton paqueteId={p.id} descripcion={p.descripcion ?? ''} />
              </div>
            )
          })}
        </div>
      )}

      <p className="text-center text-xs" style={{ color: `${tw}0.18)` }}>
        Los paquetes entregados desaparecen automáticamente de esta lista
      </p>
    </div>
  )
}
