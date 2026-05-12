export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { ClipboardList, MapPin, User, Package, CheckCircle2 } from 'lucide-react'
import LimitSelector from '@/components/ui/LimitSelector'

const BODEGA_LABELS: Record<string, string> = {
  medellin: 'Medellín', bogota: 'Bogotá', barranquilla: 'Barranquilla',
}
const tw = 'rgba(255,255,255,'

function getAdmin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function agruparPorFecha(paquetes: EntregaRow[]): { label: string; items: EntregaRow[] }[] {
  const hoy   = new Date(); hoy.setHours(0,0,0,0)
  const ayer  = new Date(hoy); ayer.setDate(ayer.getDate() - 1)
  const semana = new Date(hoy); semana.setDate(semana.getDate() - 7)

  const grupos: Record<string, EntregaRow[]> = {}

  for (const p of paquetes) {
    const ts = new Date(p.updated_at ?? p.fecha_asignacion_domiciliario ?? '')
    ts.setHours(0,0,0,0)
    let label: string
    if (ts.getTime() === hoy.getTime()) label = 'Hoy'
    else if (ts.getTime() === ayer.getTime()) label = 'Ayer'
    else if (ts >= semana) label = 'Esta semana'
    else {
      label = ts.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
      label = label.charAt(0).toUpperCase() + label.slice(1)
    }
    if (!grupos[label]) grupos[label] = []
    grupos[label].push(p)
  }

  const orden = ['Hoy', 'Ayer', 'Esta semana']
  return Object.entries(grupos).sort(([a], [b]) => {
    const ia = orden.indexOf(a); const ib = orden.indexOf(b)
    if (ia !== -1 && ib !== -1) return ia - ib
    if (ia !== -1) return -1
    if (ib !== -1) return 1
    return 0
  }).map(([label, items]) => ({ label, items }))
}

interface Props { searchParams: Promise<{ limite?: string }> }

interface EntregaRow {
  id: string
  tracking_casilla: string | null
  tracking_origen: string | null
  descripcion: string | null
  bodega_destino: string | null
  cliente_id: string | null
  direccion_entrega: string | null
  barrio_entrega: string | null
  updated_at: string | null
  fecha_asignacion_domiciliario: string | null
}

export default async function HistorialPage({ searchParams }: Props) {
  const { limite: limiteParam } = await searchParams
  const limite = [10, 50, 100].includes(Number(limiteParam)) ? Number(limiteParam) : 10

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = getAdmin()
  const { data: perfil } = await admin.from('perfiles').select('rol').eq('id', user.id).single()
  if (perfil?.rol !== 'domiciliario') redirect('/dashboard')

  const { data: paquetes } = await admin
    .from('paquetes')
    .select('id, tracking_casilla, tracking_origen, descripcion, bodega_destino, cliente_id, direccion_entrega, barrio_entrega, updated_at, fecha_asignacion_domiciliario')
    .eq('domiciliario_id', user.id)
    .eq('estado', 'entregado')
    .is('paquete_origen_id', null)
    .order('updated_at', { ascending: false })
    .limit(limite)

  const lista: EntregaRow[] = paquetes ?? []

  // Nombres de clientes
  const clienteIds = [...new Set(lista.map(p => p.cliente_id).filter(Boolean))] as string[]
  const perfilesMap: Record<string, string> = {}
  if (clienteIds.length > 0) {
    const { data: pfs } = await admin
      .from('perfiles')
      .select('id, nombre_completo')
      .in('id', clienteIds)
    for (const p of pfs ?? []) perfilesMap[p.id] = p.nombre_completo
  }

  // Foto de entrega por paquete (descripcion contiene 'entrega')
  const paqueteIds = lista.map(p => p.id)
  const fotosEntregaMap: Record<string, string> = {}
  if (paqueteIds.length > 0) {
    const { data: fotos } = await admin
      .from('fotos_paquetes')
      .select('paquete_id, url, descripcion')
      .in('paquete_id', paqueteIds)
      .ilike('descripcion', '%entrega%')
    for (const f of fotos ?? []) {
      if (f.paquete_id && !fotosEntregaMap[f.paquete_id]) {
        fotosEntregaMap[f.paquete_id] = f.url
      }
    }
  }

  // Stats rápidas
  const hoy = new Date(); hoy.setHours(0,0,0,0)
  const entregadosHoy = lista.filter(p => {
    const ts = new Date(p.updated_at ?? '')
    ts.setHours(0,0,0,0)
    return ts.getTime() === hoy.getTime()
  }).length

  const grupos = agruparPorFecha(lista)

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ClipboardList className="h-6 w-6" style={{ color: '#818cf8' }} />
            Historial
          </h1>
          <p className="text-sm mt-1" style={{ color: `${tw}0.45)` }}>
            {lista.length === 0
              ? 'Aún no tienes entregas registradas'
              : `Mostrando ${lista.length} entrega${lista.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <LimitSelector actual={limite} />
      </div>

      {/* Stats */}
      {lista.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-card p-4 text-center">
            <p className="text-3xl font-bold" style={{ color: '#818cf8' }}>{entregadosHoy}</p>
            <p className="text-xs mt-1" style={{ color: `${tw}0.4)` }}>Entregados hoy</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-3xl font-bold text-white">{lista.length}</p>
            <p className="text-xs mt-1" style={{ color: `${tw}0.4)` }}>Total entregados</p>
          </div>
        </div>
      )}

      {lista.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Package className="h-10 w-10 mx-auto mb-2 opacity-20 text-white" />
          <p style={{ color: `${tw}0.4)` }}>Sin entregas aún</p>
          <p className="text-xs mt-1" style={{ color: `${tw}0.25)` }}>
            Aquí aparecerán los paquetes que entregues
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grupos.map(({ label, items }) => (
            <div key={label}>
              <p className="text-xs font-bold uppercase tracking-widest mb-2 px-1"
                style={{ color: `${tw}0.3)` }}>
                {label} · {items.length}
              </p>
              <div className="space-y-2">
                {items.map(p => {
                  const nombre = p.cliente_id ? (perfilesMap[p.cliente_id] ?? null) : null
                  const direccion = p.direccion_entrega ?? null
                  const barrio   = p.barrio_entrega ?? null
                  const fechaHora = p.updated_at
                    ? new Date(p.updated_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })
                    : null

                  return (
                    <div key={p.id} className="glass-card overflow-hidden">
                      {/* Foto de entrega — thumbnail arriba si existe */}
                      {fotosEntregaMap[p.id] && (
                        <div className="relative w-full" style={{ aspectRatio: '16/7', background: 'rgba(0,0,0,0.3)' }}>
                          <img
                            src={fotosEntregaMap[p.id]}
                            alt="Comprobante de entrega"
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute bottom-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(52,211,153,0.85)', color: 'white' }}>
                            📸 Comprobante
                          </span>
                        </div>
                      )}

                      <div className="p-4 space-y-2.5">
                      {/* Tracking + hora */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-xs font-bold" style={{ color: '#F5B800' }}>
                            {p.tracking_origen ?? p.tracking_casilla ?? '—'}
                          </p>
                          <p className="text-sm text-white font-medium mt-0.5 truncate">
                            {p.descripcion ?? 'Sin descripción'}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}>
                            <CheckCircle2 className="h-3 w-3" />
                            Entregado
                          </span>
                          {fechaHora && (
                            <span className="text-[10px]" style={{ color: `${tw}0.3)` }}>{fechaHora}</span>
                          )}
                        </div>
                      </div>

                      {/* Cliente + dirección */}
                      <div className="space-y-1">
                        {nombre && (
                          <div className="flex items-center gap-1.5 text-xs" style={{ color: `${tw}0.6)` }}>
                            <User className="h-3 w-3 flex-shrink-0" style={{ color: `${tw}0.35)` }} />
                            <span className="font-medium text-white">{nombre}</span>
                          </div>
                        )}
                        {(direccion || barrio) && (
                          <div className="flex items-start gap-1.5 text-xs" style={{ color: `${tw}0.45)` }}>
                            <MapPin className="h-3 w-3 flex-shrink-0 mt-0.5" style={{ color: `${tw}0.25)` }} />
                            <span>{[direccion, barrio].filter(Boolean).join(' · ')}</span>
                          </div>
                        )}
                      </div>

                      {/* Ciudad */}
                      {p.bodega_destino && (
                        <p className="text-[10px]" style={{ color: `${tw}0.25)` }}>
                          {BODEGA_LABELS[p.bodega_destino] ?? p.bodega_destino}
                        </p>
                      )}
                      </div>{/* cierre p-4 */}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
