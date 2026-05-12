export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { MapPin, Phone, Package, CheckCircle2 } from 'lucide-react'
import EntregarDomiciliarioButton from '@/components/domiciliario/EntregarDomiciliarioButton'
import Link from 'next/link'

const BODEGA_LABELS: Record<string, string> = {
  medellin: 'Medellín', bogota: 'Bogotá', barranquilla: 'Barranquilla',
}

const tw = 'rgba(255,255,255,'

function getSupabaseAdmin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function DomiciliarioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = getSupabaseAdmin()

  const { data: perfil } = await admin
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (perfil?.rol !== 'domiciliario') redirect('/dashboard')

  const { data: paquetes } = await admin
    .from('paquetes')
    .select('id, tracking_casilla, tracking_origen, descripcion, peso_libras, bodega_destino, cliente_id, direccion_entrega, barrio_entrega, referencia_entrega, estado, fecha_asignacion_domiciliario')
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
    const { data: perfilesClientes } = await admin
      .from('perfiles')
      .select('id, nombre_completo, whatsapp, telefono, direccion, barrio, referencia')
      .in('id', clienteIds)
    for (const p of perfilesClientes ?? []) perfilesMap[p.id] = p
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">
          {lista.length === 0 ? 'Sin entregas asignadas' : `${lista.length} entrega${lista.length !== 1 ? 's' : ''} pendiente${lista.length !== 1 ? 's' : ''}`}
        </h1>
        <p className="text-sm mt-0.5" style={{ color: `${tw}0.4)` }}>
          {lista.length > 0 ? 'Pulsa "Confirmar entrega" al dejar cada paquete.' : 'El administrador te asignará paquetes próximamente.'}
        </p>
      </div>

      {lista.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: `${tw}0.03)`, border: `1px solid ${tw}0.07)` }}>
          <Package className="h-10 w-10 mx-auto mb-3 opacity-15 text-white" />
          <p style={{ color: `${tw}0.3)` }}>No tienes paquetes asignados por ahora</p>
        </div>
      ) : (
        lista.map((p, i) => {
          const cli = p.cliente_id ? perfilesMap[p.cliente_id] : null
          const direccion = p.direccion_entrega ?? cli?.direccion ?? null
          const barrio = p.barrio_entrega ?? cli?.barrio ?? null
          const referencia = p.referencia_entrega ?? cli?.referencia ?? null
          const tel = cli?.whatsapp ?? cli?.telefono ?? null

          return (
            <div key={p.id} className="rounded-2xl overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>

              {/* Número + descripción */}
              <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                <div className="h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                  style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm leading-snug truncate">{p.descripcion}</p>
                  <p className="text-xs font-mono mt-0.5" style={{ color: `${tw}0.35)` }}>
                    {p.tracking_origen ?? p.tracking_casilla}
                  </p>
                </div>
                {p.peso_libras && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: `${tw}0.06)`, color: `${tw}0.45)` }}>
                    {Number(p.peso_libras).toFixed(1)} lb
                  </span>
                )}
              </div>

              {/* Separador */}
              <div style={{ height: 1, background: `${tw}0.06)` }} />

              {/* Datos del destinatario */}
              <div className="px-4 py-3 space-y-2.5">
                {/* Cliente */}
                <div className="flex items-center gap-2.5">
                  <Package className="h-3.5 w-3.5 flex-shrink-0" style={{ color: `${tw}0.3)` }} />
                  <p className="text-sm font-semibold text-white">
                    {cli?.nombre_completo ?? 'Cliente sin asignar'}
                  </p>
                </div>

                {/* Teléfono */}
                {tel && (
                  <a href={`https://wa.me/${tel.replace(/\D/g, '')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
                    <Phone className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#25D366' }} />
                    <span className="text-sm font-medium" style={{ color: '#25D366' }}>{tel}</span>
                  </a>
                )}

                {/* Dirección */}
                {direccion ? (
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent([direccion, barrio, BODEGA_LABELS[p.bodega_destino ?? ''] ?? p.bodega_destino].filter(Boolean).join(', '))}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-start gap-2.5 hover:opacity-80 transition-opacity">
                    <MapPin className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: '#F5B800' }} />
                    <div>
                      <p className="text-sm text-white">{direccion}</p>
                      {(barrio || referencia) && (
                        <p className="text-xs mt-0.5" style={{ color: `${tw}0.4)` }}>
                          {[barrio, referencia].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                  </a>
                ) : (
                  <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
                    style={{ background: 'rgba(245,184,0,0.07)', border: '1px solid rgba(245,184,0,0.18)' }}>
                    <MapPin className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#F5B800' }} />
                    <p className="text-xs" style={{ color: '#F5B800' }}>Sin dirección registrada — contacta al admin</p>
                  </div>
                )}
              </div>

              {/* Botón entregar */}
              <div className="px-4 pb-4">
                <EntregarDomiciliarioButton paqueteId={p.id} descripcion={p.descripcion ?? ''} />
              </div>
            </div>
          )
        })
      )}

      {/* Historial — link rápido */}
      {lista.length > 0 && (
        <p className="text-center text-xs pt-2" style={{ color: `${tw}0.2)` }}>
          Los paquetes entregados desaparecen de esta lista automáticamente.
        </p>
      )}
    </div>
  )
}
