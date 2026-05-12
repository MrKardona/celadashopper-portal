export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { Bike, MapPin, Phone, Package, FileText, ExternalLink, ArrowLeft, CheckCircle2, User } from 'lucide-react'
import Link from 'next/link'

const tw = 'rgba(255,255,255,'
const BODEGA_LABELS: Record<string, string> = {
  medellin: 'Medellín', bogota: 'Bogotá', barranquilla: 'Barranquilla',
}

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

interface Props { params: Promise<{ id: string }> }

export default async function AdminDomiciliarioDetallePage({ params }: Props) {
  const { id } = await params
  const admin = getAdmin()

  const [perfilRes, paquetesRes, manualesRes] = await Promise.all([
    admin.from('perfiles')
      .select('id, nombre_completo, whatsapp, telefono, email')
      .eq('id', id)
      .eq('rol', 'domiciliario')
      .single(),
    admin.from('paquetes')
      .select('id, tracking_casilla, tracking_origen, descripcion, bodega_destino, cliente_id, direccion_entrega, barrio_entrega, estado, fecha_asignacion_domiciliario')
      .eq('domiciliario_id', id)
      .in('estado', ['en_camino_cliente', 'en_bodega_local'])
      .is('paquete_origen_id', null)
      .order('fecha_asignacion_domiciliario', { ascending: true }),
    admin.from('domicilios_manuales')
      .select('id, nombre, direccion, telefono, notas, orden, estado, created_at')
      .eq('domiciliario_id', id)
      .eq('estado', 'pendiente')
      .order('orden')
      .order('created_at'),
  ])

  if (!perfilRes.data) notFound()

  const perfil   = perfilRes.data
  const paquetes = paquetesRes.data ?? []
  const manuales = manualesRes.data ?? []
  const tel      = perfil.whatsapp ?? perfil.telefono

  // Cargar perfiles de clientes
  const clienteIds = [...new Set(paquetes.map(p => p.cliente_id).filter(Boolean))] as string[]
  const perfilesMap: Record<string, { nombre_completo: string; whatsapp: string | null; telefono: string | null; direccion: string | null; barrio: string | null }> = {}
  if (clienteIds.length > 0) {
    const { data: pfs } = await admin.from('perfiles')
      .select('id, nombre_completo, whatsapp, telefono, direccion, barrio')
      .in('id', clienteIds)
    for (const p of pfs ?? []) perfilesMap[p.id] = p
  }

  const total = paquetes.length + manuales.length

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start gap-3 flex-wrap">
        <Link href="/admin/domiciliarios"
          className="flex items-center gap-1.5 text-xs mt-1 transition-opacity hover:opacity-70 flex-shrink-0"
          style={{ color: `${tw}0.4)` }}>
          <ArrowLeft className="h-3.5 w-3.5" /> Domiciliarios
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm"
              style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
              {perfil.nombre_completo.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white truncate flex items-center gap-2">
                <Bike className="h-5 w-5 flex-shrink-0" style={{ color: '#818cf8' }} />
                {perfil.nombre_completo}
              </h1>
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                {tel && (
                  <a href={`https://wa.me/${tel.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs hover:underline" style={{ color: '#25D366' }}>
                    <Phone className="h-3 w-3" />{tel}
                  </a>
                )}
                <span className="text-xs" style={{ color: `${tw}0.35)` }}>
                  {total === 0 ? 'Sin entregas pendientes' : `${total} entrega${total !== 1 ? 's' : ''} pendiente${total !== 1 ? 's' : ''}`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {total === 0 ? (
        <div className="glass-card p-12 text-center">
          <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-15 text-white" />
          <p style={{ color: `${tw}0.4)` }}>Sin entregas pendientes</p>
          <p className="text-xs mt-1" style={{ color: `${tw}0.25)` }}>Este domiciliario no tiene paquetes ni domicilios manuales asignados</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">

          {/* ── Domicilios manuales ── */}
          {manuales.map((m, idx) => (
            <div key={m.id} className="glass-card p-4 space-y-3"
              style={{ borderColor: 'rgba(129,140,248,0.2)' }}>

              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(129,140,248,0.12)' }}>
                    <FileText className="h-3.5 w-3.5" style={{ color: '#818cf8' }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{m.nombre}</p>
                    <p className="text-[11px]" style={{ color: '#818cf8' }}>Domicilio manual</p>
                  </div>
                </div>
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: 'rgba(129,140,248,0.12)', color: '#818cf8', border: '1px solid rgba(129,140,248,0.25)' }}>
                  #{paquetes.length + idx + 1}
                </span>
              </div>

              <a href={`https://maps.google.com/?q=${encodeURIComponent(m.direccion)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-start gap-2 text-xs hover:opacity-80 transition-opacity"
                style={{ color: `${tw}0.7)` }}>
                <MapPin className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: '#818cf8' }} />
                <div>
                  <p>{m.direccion}</p>
                  <p className="mt-0.5 flex items-center gap-1" style={{ color: '#818cf8' }}>
                    <ExternalLink className="h-2.5 w-2.5" /> Abrir en Maps
                  </p>
                </div>
              </a>

              {m.telefono && (
                <a href={`https://wa.me/${m.telefono.replace(/\D/g, '')}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs hover:underline"
                  style={{ color: '#34d399' }}>
                  <Phone className="h-3 w-3" />{m.telefono}
                </a>
              )}

              {m.notas && (
                <p className="text-xs px-3 py-2 rounded-xl"
                  style={{ background: `${tw}0.04)`, color: `${tw}0.55)`, border: `1px solid ${tw}0.07)` }}>
                  {m.notas}
                </p>
              )}
            </div>
          ))}

          {/* ── Paquetes del sistema ── */}
          {paquetes.map((p, idx) => {
            const cli      = p.cliente_id ? perfilesMap[p.cliente_id] : null
            const direccion = p.direccion_entrega ?? cli?.direccion ?? null
            const barrio    = p.barrio_entrega    ?? cli?.barrio    ?? null

            return (
              <div key={p.id} className="glass-card p-4 space-y-3">

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
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
                      style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}>
                      {BODEGA_LABELS[p.bodega_destino ?? ''] ?? p.bodega_destino}
                    </span>
                    <Link href={`/admin/paquetes/${p.id}`}
                      className="text-[10px] flex items-center gap-0.5 hover:underline"
                      style={{ color: `${tw}0.35)` }}>
                      Ver detalle <ExternalLink className="h-2.5 w-2.5" />
                    </Link>
                  </div>
                </div>

                {/* Cliente */}
                <div className="rounded-xl p-3 space-y-2" style={{ background: `${tw}0.05)`, border: `1px solid ${tw}0.08)` }}>
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-3.5 w-3.5 flex-shrink-0" style={{ color: `${tw}0.4)` }} />
                    <span className="font-semibold text-white truncate">
                      {cli?.nombre_completo ?? '⏳ Sin asignar'}
                    </span>
                  </div>
                  {(cli?.whatsapp ?? cli?.telefono) && (
                    <a href={`https://wa.me/${(cli.whatsapp ?? cli.telefono)!.replace(/\D/g, '')}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs hover:underline"
                      style={{ color: '#34d399' }}>
                      <Phone className="h-3 w-3" />
                      {cli?.whatsapp ?? cli?.telefono}
                    </a>
                  )}
                </div>

                {/* Dirección */}
                {direccion ? (
                  <a href={`https://maps.google.com/?q=${encodeURIComponent([direccion, barrio, BODEGA_LABELS[p.bodega_destino ?? ''] ?? p.bodega_destino].filter(Boolean).join(', '))}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-start gap-2 text-xs hover:opacity-80 transition-opacity"
                    style={{ color: `${tw}0.7)` }}>
                    <MapPin className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: '#F5B800' }} />
                    <div>
                      <p>{direccion}</p>
                      {barrio && <p className="mt-0.5" style={{ color: `${tw}0.4)` }}>{barrio}</p>}
                      <p className="mt-0.5 flex items-center gap-1" style={{ color: '#F5B800' }}>
                        <ExternalLink className="h-2.5 w-2.5" /> Abrir en Maps
                      </p>
                    </div>
                  </a>
                ) : (
                  <p className="text-xs px-2 py-2 rounded-xl flex items-center gap-1.5"
                    style={{ background: 'rgba(245,184,0,0.08)', color: '#F5B800', border: '1px solid rgba(245,184,0,0.2)' }}>
                    <MapPin className="h-3 w-3" />
                    Sin dirección de entrega
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
        <Link href="/admin/domiciliarios"
          className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-70"
          style={{ color: `${tw}0.35)` }}>
          <ArrowLeft className="h-3.5 w-3.5" /> Volver a domiciliarios
        </Link>
        <Link href={`/admin/listos-entrega?domiciliario=${id}`}
          className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-70"
          style={{ color: `${tw}0.35)` }}>
          <Package className="h-3.5 w-3.5" /> Ver en listos para entrega
        </Link>
      </div>
    </div>
  )
}
