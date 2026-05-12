export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { Bike, Phone, Package, ArrowLeft, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import OrdenarRutaPanel, { type ParadaRuta } from '@/components/admin/OrdenarRutaPanel'

const tw = 'rgba(255,255,255,'

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
      .select('id, nombre_completo, whatsapp, telefono')
      .eq('id', id)
      .eq('rol', 'domiciliario')
      .single(),
    admin.from('paquetes')
      .select('id, tracking_casilla, tracking_origen, descripcion, bodega_destino, cliente_id, direccion_entrega, barrio_entrega, orden_ruta')
      .eq('domiciliario_id', id)
      .in('estado', ['en_camino_cliente', 'en_bodega_local'])
      .is('paquete_origen_id', null)
      .order('orden_ruta', { ascending: true, nullsFirst: false }),
    admin.from('domicilios_manuales')
      .select('id, nombre, direccion, telefono, notas, orden')
      .eq('domiciliario_id', id)
      .eq('estado', 'pendiente')
      .order('orden'),
  ])

  if (!perfilRes.data) notFound()

  const perfil   = perfilRes.data
  const paquetes = paquetesRes.data ?? []
  const manuales = manualesRes.data ?? []
  const tel      = perfil.whatsapp ?? perfil.telefono

  // Direcciones de clientes para paquetes que no tienen la propia
  const sinDir = paquetes.filter(p => !p.direccion_entrega && p.cliente_id).map(p => p.cliente_id as string)
  const clienteDir: Record<string, { nombre: string; direccion: string | null; barrio: string | null }> = {}
  if (sinDir.length > 0) {
    const { data: pfs } = await admin.from('perfiles')
      .select('id, nombre_completo, direccion, barrio')
      .in('id', [...new Set(sinDir)])
    for (const p of pfs ?? []) clienteDir[p.id] = { nombre: p.nombre_completo, direccion: p.direccion, barrio: p.barrio }
  }
  // También para paquetes con dirección propia necesitamos el nombre del cliente
  const todosClienteIds = [...new Set(paquetes.map(p => p.cliente_id).filter(Boolean))] as string[]
  const clienteNombres: Record<string, string> = {}
  if (todosClienteIds.length > 0) {
    const idsNuevos = todosClienteIds.filter(cid => !clienteDir[cid])
    if (idsNuevos.length > 0) {
      const { data: pfs } = await admin.from('perfiles').select('id, nombre_completo').in('id', idsNuevos)
      for (const p of pfs ?? []) clienteNombres[p.id] = p.nombre_completo
    }
  }

  // ── Construir lista unificada ─────────────────────────────────────
  const paradasPaquetes: ParadaRuta[] = paquetes.map(p => {
    const cli = p.cliente_id ? (clienteDir[p.cliente_id] ?? null) : null
    const nombreCliente = p.cliente_id
      ? (clienteDir[p.cliente_id]?.nombre ?? clienteNombres[p.cliente_id] ?? null)
      : null
    const dir = p.direccion_entrega ?? (cli ? [cli.direccion, cli.barrio].filter(Boolean).join(', ') || null : null)
    return {
      tipo: 'paquete',
      id: p.id,
      label: p.tracking_origen ?? p.tracking_casilla ?? 'Sin tracking',
      descripcion: [p.descripcion, nombreCliente].filter(Boolean).join(' · ') || '',
      direccion: dir,
      telefono: null,
      notas: null,
      ordenActual: p.orden_ruta ?? 9999,
    }
  })

  const paradasManuales: ParadaRuta[] = manuales.map(m => ({
    tipo: 'manual',
    id: m.id,
    label: m.nombre,
    descripcion: m.notas ?? '',
    direccion: m.direccion,
    telefono: m.telefono ?? null,
    notas: m.notas ?? null,
    ordenActual: m.orden ?? 9999,
  }))

  // Merge y ordenar: los que tienen orden_ruta/orden definido van primero
  const todasParadas = [...paradasPaquetes, ...paradasManuales]
    .sort((a, b) => a.ordenActual - b.ordenActual)

  const total = todasParadas.length

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
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <Bike className="h-5 w-5 flex-shrink-0" style={{ color: '#818cf8' }} />
                <span className="truncate">{perfil.nombre_completo}</span>
              </h1>
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                {tel && (
                  <a href={`https://wa.me/${tel.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs hover:underline" style={{ color: '#25D366' }}>
                    <Phone className="h-3 w-3" />{tel}
                  </a>
                )}
                <span className="text-xs" style={{ color: `${tw}0.35)` }}>
                  {total === 0
                    ? 'Sin entregas pendientes'
                    : `${total} entrega${total !== 1 ? 's' : ''} pendiente${total !== 1 ? 's' : ''}`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido */}
      {total === 0 ? (
        <div className="glass-card p-12 text-center">
          <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-15 text-white" />
          <p style={{ color: `${tw}0.4)` }}>Sin entregas pendientes</p>
          <p className="text-xs mt-1" style={{ color: `${tw}0.25)` }}>
            No hay paquetes ni domicilios manuales asignados a este domiciliario
          </p>
        </div>
      ) : (
        <div className="glass-card p-5" style={{ borderColor: 'rgba(129,140,248,0.15)' }}>
          <OrdenarRutaPanel domiciliarioId={id} paradas={todasParadas} />
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
        <Link href="/admin/domiciliarios"
          className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-70"
          style={{ color: `${tw}0.35)` }}>
          <ArrowLeft className="h-3.5 w-3.5" /> Volver
        </Link>
        <Link href={`/admin/listos-entrega?domiciliario=${id}`}
          className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-70"
          style={{ color: `${tw}0.35)` }}>
          <Package className="h-3.5 w-3.5" /> Listos para entrega
        </Link>
      </div>
    </div>
  )
}
