export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { Trash2, ArrowLeft, Package } from 'lucide-react'
import { CATEGORIA_LABELS, ESTADO_LABELS, type CategoriaProducto, type EstadoPaquete } from '@/types'
import { fechaCorta } from '@/lib/fecha'

const tw = 'rgba(255,255,255,'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: 'public' }, auth: { persistSession: false } }
  )
}

export default async function EliminadosPage() {
  const admin = getAdmin()

  const { data: registros } = await admin
    .from('paquetes_eliminados')
    .select('*')
    .order('eliminado_at', { ascending: false })
    .limit(200)

  const total = registros?.length ?? 0

  return (
    <div className="space-y-5" style={{ fontFamily: "'Outfit', sans-serif" }}>

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/paquetes"
          className="p-2 rounded-xl transition-colors hover:bg-white/[0.07]"
          style={{ color: `${tw}0.4)` }}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Trash2 className="h-5 w-5" style={{ color: `${tw}0.25)` }} />
            Log de paquetes eliminados
          </h1>
          <p className="text-xs mt-0.5" style={{ color: `${tw}0.35)` }}>
            Registro automático de cada eliminación — los últimos 200
          </p>
        </div>
        {total > 0 && (
          <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
            style={{ background: 'rgba(255,255,255,0.06)', color: `${tw}0.4)`, border: `1px solid ${tw}0.1)` }}>
            {total} registro{total !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Tabla */}
      {!registros || registros.length === 0 ? (
        <div className="glass-card text-center py-16">
          <Package className="h-10 w-10 mx-auto mb-3" style={{ color: `${tw}0.12)` }} />
          <p className="text-sm" style={{ color: `${tw}0.3)` }}>Ningún paquete eliminado aún</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: `1px solid ${tw}0.07)`, background: `${tw}0.025)` }}>
                  {['Descripción', 'Cliente', 'Estado', 'Categoría', 'Tracking', 'Eliminado por', 'Fecha'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                      style={{ color: `${tw}0.3)` }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {registros.map((r, i) => (
                  <tr key={r.id}
                    className="transition-colors hover:bg-white/[0.03]"
                    style={{ borderBottom: i < registros.length - 1 ? `1px solid ${tw}0.04)` : 'none' }}>

                    {/* Descripción */}
                    <td className="px-4 py-3 max-w-[220px]">
                      <p className="font-medium truncate" style={{ color: `${tw}0.7)` }}>
                        {r.descripcion ?? '—'}
                      </p>
                      {r.tienda && (
                        <p className="text-xs mt-0.5 truncate" style={{ color: `${tw}0.3)` }}>{r.tienda}</p>
                      )}
                      {r.cantidad_divisiones > 0 && (
                        <p className="text-[10px] mt-0.5" style={{ color: `${tw}0.25)` }}>
                          +{r.cantidad_divisiones} división{r.cantidad_divisiones !== 1 ? 'es' : ''}
                        </p>
                      )}
                    </td>

                    {/* Cliente */}
                    <td className="px-4 py-3 max-w-[160px]">
                      <p className="truncate text-xs" style={{ color: r.cliente_nombre ? `${tw}0.55)` : `${tw}0.2)` }}>
                        {r.cliente_nombre ?? 'Sin asignar'}
                      </p>
                    </td>

                    {/* Estado */}
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full whitespace-nowrap"
                        style={{ background: `${tw}0.06)`, color: `${tw}0.4)`, border: `1px solid ${tw}0.09)` }}>
                        {ESTADO_LABELS[r.estado as EstadoPaquete] ?? r.estado ?? '—'}
                      </span>
                    </td>

                    {/* Categoría */}
                    <td className="px-4 py-3 text-xs" style={{ color: `${tw}0.38)` }}>
                      {CATEGORIA_LABELS[r.categoria as CategoriaProducto] ?? r.categoria ?? '—'}
                    </td>

                    {/* Tracking */}
                    <td className="px-4 py-3 max-w-[160px]">
                      {r.tracking_casilla && (
                        <p className="text-xs font-mono truncate" style={{ color: `${tw}0.45)` }}>
                          {r.tracking_casilla}
                        </p>
                      )}
                      {r.tracking_origen && (
                        <p className="text-[11px] font-mono truncate mt-0.5" style={{ color: `${tw}0.25)` }}>
                          {r.tracking_origen}
                        </p>
                      )}
                      {!r.tracking_casilla && !r.tracking_origen && (
                        <span style={{ color: `${tw}0.2)` }}>—</span>
                      )}
                    </td>

                    {/* Eliminado por */}
                    <td className="px-4 py-3 text-xs" style={{ color: `${tw}0.3)` }}>
                      {r.eliminado_por_nombre ?? '—'}
                    </td>

                    {/* Fecha */}
                    <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: `${tw}0.28)` }}>
                      {fechaCorta(r.eliminado_at)}
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
