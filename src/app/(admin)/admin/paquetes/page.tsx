import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { Package, Search, Camera } from 'lucide-react'
import { ESTADO_LABELS, CATEGORIA_LABELS } from '@/types'

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

const ESTADOS = [
  'reportado', 'recibido_usa', 'en_consolidacion', 'listo_envio',
  'en_transito', 'en_colombia', 'en_bodega_local', 'en_camino_cliente',
  'entregado', 'retenido', 'devuelto',
]

const BODEGAS = ['medellin', 'bogota', 'barranquilla']
const BODEGA_LABELS: Record<string, string> = {
  medellin: 'Medellín', bogota: 'Bogotá', barranquilla: 'Barranquilla',
}

const tw = 'rgba(255,255,255,'

interface Props {
  searchParams: Promise<{ estado?: string; bodega?: string; q?: string; asignacion?: string; consolidacion?: string }>
}

export default async function AdminPaquetesPage({ searchParams }: Props) {
  const params = await searchParams
  const { estado, bodega, q, asignacion, consolidacion } = params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: 'public' }, auth: { persistSession: false } }
  )

  let q1 = supabase
    .from('paquetes')
    .select('id, tracking_casilla, cliente_id, descripcion, tienda, categoria, estado, bodega_destino, peso_facturable, peso_libras, costo_servicio, valor_declarado, factura_pagada, requiere_consolidacion, notas_consolidacion, nombre_etiqueta, fecha_recepcion_usa, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(200)

  if (estado) q1 = q1.eq('estado', estado)
  if (bodega) q1 = q1.eq('bodega_destino', bodega)
  if (asignacion === 'sin_asignar') q1 = q1.is('cliente_id', null)
  else if (asignacion === 'asignados') q1 = q1.not('cliente_id', 'is', null)
  if (consolidacion === 'requiere') q1 = q1.eq('requiere_consolidacion', true)
  else if (consolidacion === 'despachable') q1 = q1.eq('requiere_consolidacion', false)

  const { data: paquetes, error: errPaq } = await q1
  const lista = paquetes ?? []

  const paqueteIds = lista.map(p => p.id)
  const clienteIds = [...new Set(lista.map(p => p.cliente_id).filter(Boolean))]

  const [perfilesRes, fotosRes] = await Promise.all([
    clienteIds.length > 0
      ? supabase.from('perfiles').select('id, nombre_completo, numero_casilla').in('id', clienteIds)
      : Promise.resolve({ data: [] }),
    paqueteIds.length > 0
      ? supabase.from('fotos_paquetes').select('paquete_id, url').in('paquete_id', paqueteIds).order('created_at')
      : Promise.resolve({ data: [] }),
  ])

  const perfilesMap: Record<string, { nombre_completo: string; numero_casilla: string }> =
    Object.fromEntries((perfilesRes.data ?? []).map((p: { id: string; nombre_completo: string; numero_casilla: string }) => [p.id, p]))

  const fotosMap: Record<string, string> = {}
  for (const f of (fotosRes.data ?? []) as { paquete_id: string; url: string }[]) {
    if (!fotosMap[f.paquete_id]) fotosMap[f.paquete_id] = f.url
  }

  const filtrados = q
    ? lista.filter(p => {
        const perfil = p.cliente_id ? perfilesMap[p.cliente_id] : null
        const txt = `${p.tracking_casilla} ${p.descripcion} ${p.tienda} ${p.nombre_etiqueta ?? ''} ${perfil?.nombre_completo ?? ''} ${perfil?.numero_casilla ?? ''}`.toLowerCase()
        return txt.includes(q.toLowerCase())
      })
    : lista

  const selectClass = "glass-input text-sm px-3 py-2 rounded-xl"

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Paquetes</h1>
          <p className="text-sm mt-1" style={{ color: `${tw}0.45)` }}>{filtrados.length} resultado{filtrados.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Filtros */}
      <form method="get" className="flex flex-wrap gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: `${tw}0.35)` }} />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar tracking, cliente, producto..."
            className="glass-input pl-9 pr-4 py-2 text-sm rounded-xl w-72"
          />
        </div>
        <select name="estado" defaultValue={estado ?? ''} className={selectClass}>
          <option value="">Todos los estados</option>
          {ESTADOS.map(e => <option key={e} value={e}>{ESTADO_LABELS[e as keyof typeof ESTADO_LABELS] ?? e}</option>)}
        </select>
        <select name="bodega" defaultValue={bodega ?? ''} className={selectClass}>
          <option value="">Todas las bodegas</option>
          {BODEGAS.map(b => <option key={b} value={b}>{BODEGA_LABELS[b]}</option>)}
        </select>
        <select name="asignacion" defaultValue={asignacion ?? ''} className={selectClass}>
          <option value="">Asignados y sin asignar</option>
          <option value="sin_asignar">⏳ Solo sin asignar</option>
          <option value="asignados">✓ Solo asignados</option>
        </select>
        <select name="consolidacion" defaultValue={consolidacion ?? ''} className={selectClass}>
          <option value="">Consolidación: cualquiera</option>
          <option value="requiere">📦 Requiere consolidar</option>
          <option value="despachable">🚀 Listo para despachar</option>
        </select>
        <button type="submit" className="btn-gold px-4 py-2 rounded-xl text-sm font-semibold">Filtrar</button>
        {(estado || bodega || q || asignacion || consolidacion) && (
          <Link href="/admin/paquetes" className="px-4 py-2 text-sm rounded-xl font-medium transition-all" style={{ color: `${tw}0.55)`, border: `1px solid ${tw}0.12)` }}>Limpiar</Link>
        )}
      </form>

      {/* Tabla */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${tw}0.07)`, background: `${tw}0.03)` }}>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: `${tw}0.35)` }}>Tiempo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: `${tw}0.35)` }}>Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide hidden md:table-cell" style={{ color: `${tw}0.35)` }}>Producto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide hidden lg:table-cell" style={{ color: `${tw}0.35)` }}>Categoría</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: `${tw}0.35)` }}>Estado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide hidden lg:table-cell" style={{ color: `${tw}0.35)` }}>Bodega</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide hidden md:table-cell" style={{ color: `${tw}0.35)` }}>Peso / Valor / Costo</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12" style={{ color: `${tw}0.3)` }}>
                    <Package className="h-10 w-10 mx-auto mb-2 opacity-20" />
                    {errPaq ? `Error: ${errPaq.message}` : 'No hay paquetes con esos filtros'}
                  </td>
                </tr>
              ) : (
                filtrados.map(p => {
                  const perfil = p.cliente_id ? perfilesMap[p.cliente_id] : null
                  const peso = p.peso_facturable ?? p.peso_libras
                  const fotoUrl = fotosMap[p.id]
                  const diasEnBodega = p.fecha_recepcion_usa
                    ? Math.floor((Date.now() - new Date(p.fecha_recepcion_usa).getTime()) / 86_400_000)
                    : null
                  return (
                    <tr
                      key={p.id}
                      className="transition-colors cursor-pointer"
                      style={{ borderBottom: `1px solid ${tw}0.05)` }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = !perfil ? 'rgba(245,184,0,0.03)' : ''}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {fotoUrl ? (
                            <a href={fotoUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 group relative">
                              <img src={fotoUrl} alt="" className="h-9 w-9 rounded-md object-cover border border-white/10 group-hover:opacity-80 transition-opacity" />
                              <div className="absolute inset-0 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/30 transition-opacity">
                                <Camera className="h-3.5 w-3.5 text-white" />
                              </div>
                            </a>
                          ) : (
                            <div className="h-9 w-9 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: `${tw}0.05)`, border: `1px solid ${tw}0.08)` }}>
                              <Camera className="h-4 w-4" style={{ color: `${tw}0.2)` }} />
                            </div>
                          )}
                          <Link href={`/admin/paquetes/${p.id}`} className="min-w-0 block">
                            {diasEnBodega !== null ? (
                              <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg border ${
                                diasEnBodega > 14
                                  ? 'bg-red-500/15 text-red-400 border-red-500/25'
                                  : diasEnBodega > 7
                                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/25'
                                    : 'bg-white/[0.06] border-white/10'
                              }`}
                              style={diasEnBodega <= 7 ? { color: `${tw}0.55)` } : {}}
                              >
                                {diasEnBodega === 0 ? '🕐 Hoy' : `⏱ ${diasEnBodega}d`}
                              </span>
                            ) : (
                              <span className="text-xs italic" style={{ color: `${tw}0.25)` }}>Sin fecha</span>
                            )}
                            {p.requiere_consolidacion && (
                              <span className="block text-[10px] px-1.5 py-0.5 rounded mt-1 w-fit"
                                style={{ background: 'rgba(99,130,255,0.15)', color: '#8899ff', border: '1px solid rgba(99,130,255,0.25)' }}
                                title={p.notas_consolidacion ?? 'Cliente solicitó consolidar con otros paquetes'}
                              >
                                📦 Consolidar
                              </span>
                            )}
                          </Link>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/paquetes/${p.id}`} className="block">
                          {perfil ? (
                            <>
                              <p className="font-medium text-white truncate max-w-[140px]">{perfil.nombre_completo}</p>
                              <p className="text-xs mt-0.5" style={{ color: `${tw}0.35)` }}>{perfil.numero_casilla}</p>
                            </>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(245,184,0,0.12)', color: '#F5B800', border: '1px solid rgba(245,184,0,0.2)' }}>
                              ⏳ Sin asignar
                            </span>
                          )}
                        </Link>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <Link href={`/admin/paquetes/${p.id}`} className="block">
                          <p className="truncate max-w-[180px]" style={{ color: `${tw}0.8)` }}>{p.descripcion}</p>
                          <p className="text-xs mt-0.5" style={{ color: `${tw}0.35)` }}>{p.tienda}</p>
                        </Link>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell" style={{ color: `${tw}0.45)` }}>
                        {CATEGORIA_LABELS[p.categoria as keyof typeof CATEGORIA_LABELS] ?? p.categoria}
                      </td>
                      <td className="px-4 py-3">
                        {(() => { const s = ESTADO_DARK[p.estado] ?? { bg: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)', border: 'rgba(255,255,255,0.12)' }; return (
                          <span className="inline-flex px-2 py-1 rounded-full text-xs font-semibold" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                            {ESTADO_LABELS[p.estado as keyof typeof ESTADO_LABELS] ?? p.estado}
                          </span>
                        )})()}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell capitalize" style={{ color: `${tw}0.45)` }}>
                        {BODEGA_LABELS[p.bodega_destino] ?? p.bodega_destino}
                      </td>
                      <td className="px-4 py-3 text-right hidden md:table-cell">
                        <div className="space-y-0.5">
                          {peso
                            ? <p className="font-medium" style={{ color: `${tw}0.8)` }}>{peso} lb</p>
                            : <p className="text-xs italic" style={{ color: `${tw}0.2)` }}>Sin pesar</p>
                          }
                          {p.valor_declarado && (
                            <p className="text-xs font-semibold" style={{ color: '#34d399' }}>${Number(p.valor_declarado).toFixed(2)} USD</p>
                          )}
                          {p.costo_servicio && (
                            <p className={`text-xs font-semibold ${p.factura_pagada ? 'text-green-400' : 'text-red-400'}`}>
                              ${p.costo_servicio} {p.factura_pagada ? '✓' : 'pendiente'}
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
