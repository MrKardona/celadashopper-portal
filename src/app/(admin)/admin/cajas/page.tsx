import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { Box, PlusCircle, Package, MapPin, Truck, CheckCircle2, ScanBarcode } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import NuevaCajaButton from '@/components/admin/NuevaCajaButton'

const ESTADO_LABELS: Record<string, string> = {
  abierta: 'Abierta',
  cerrada: 'Cerrada',
  despachada: 'Despachada',
  recibida_colombia: 'Recibida en Colombia',
}

const ESTADO_BADGE: Record<string, string> = {
  abierta: 'bg-amber-100 text-amber-700 border-amber-200',
  cerrada: 'bg-blue-100 text-blue-700 border-blue-200',
  despachada: 'bg-orange-100 text-orange-700 border-orange-200',
  recibida_colombia: 'bg-green-100 text-green-700 border-green-200',
}

const BODEGA_LABELS: Record<string, string> = {
  medellin: 'Medellín', bogota: 'Bogotá', barranquilla: 'Barranquilla',
}

interface Props {
  searchParams: Promise<{ estado?: string }>
}

export default async function CajasPage({ searchParams }: Props) {
  const { estado } = await searchParams

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: 'public' }, auth: { persistSession: false } }
  )

  let q = supabase
    .from('cajas_consolidacion')
    .select('id, codigo_interno, tracking_usaco, courier, bodega_destino, peso_estimado, peso_real, estado, created_at, fecha_despacho, fecha_recepcion_colombia')
    .order('created_at', { ascending: false })
    .limit(100)

  if (estado) q = q.eq('estado', estado)

  const { data: cajas } = await q
  const lista = cajas ?? []

  // Conteo de paquetes por caja
  const cajaIds = lista.map(c => c.id)
  const conteoMap: Record<string, number> = {}
  if (cajaIds.length > 0) {
    const { data: paquetes } = await supabase
      .from('paquetes')
      .select('caja_id')
      .in('caja_id', cajaIds)
    for (const p of paquetes ?? []) {
      if (p.caja_id) conteoMap[p.caja_id] = (conteoMap[p.caja_id] ?? 0) + 1
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Box className="h-6 w-6 text-orange-600" />
            Cajas para envío a Colombia
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Arma cajas en USA con varios paquetes y despáchalas con USACO. {lista.length} caja{lista.length !== 1 ? 's' : ''}.
          </p>
        </div>
        <NuevaCajaButton />
      </div>

      {/* Filtros por estado */}
      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          href="/admin/cajas"
          className={`px-3 py-1.5 rounded-full border ${!estado ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
        >
          Todas
        </Link>
        {(['abierta', 'cerrada', 'despachada', 'recibida_colombia'] as const).map(e => (
          <Link
            key={e}
            href={`/admin/cajas?estado=${e}`}
            className={`px-3 py-1.5 rounded-full border ${estado === e ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
          >
            {ESTADO_LABELS[e]}
          </Link>
        ))}
      </div>

      {/* Lista de cajas */}
      {lista.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <Box className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>No hay cajas {estado ? `en estado "${ESTADO_LABELS[estado]}"` : 'creadas'}</p>
          <p className="text-xs mt-1">Crea una nueva caja para empezar a consolidar paquetes</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {lista.map(caja => {
            const count = conteoMap[caja.id] ?? 0
            return (
              <Link
                key={caja.id}
                href={`/admin/cajas/${caja.id}`}
                className="bg-white rounded-xl border border-gray-200 hover:border-orange-300 hover:shadow-sm transition-all p-4 space-y-3 group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-sm font-bold text-gray-900">{caja.codigo_interno}</p>
                    {caja.tracking_usaco && (
                      <p className="text-xs text-orange-600 font-mono mt-0.5">USACO: {caja.tracking_usaco}</p>
                    )}
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium whitespace-nowrap ${ESTADO_BADGE[caja.estado]}`}>
                    {ESTADO_LABELS[caja.estado]}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                  <span className="flex items-center gap-1">
                    <Package className="h-3 w-3" />
                    <strong className="text-gray-900">{count}</strong> paquete{count !== 1 ? 's' : ''}
                  </span>
                  <span className="text-gray-300">·</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {BODEGA_LABELS[caja.bodega_destino] ?? caja.bodega_destino}
                  </span>
                  {caja.peso_estimado && (
                    <>
                      <span className="text-gray-300">·</span>
                      <span>{Number(caja.peso_estimado).toFixed(1)} lb</span>
                    </>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-gray-400 pt-2 border-t border-gray-100">
                  <span>Creada {format(new Date(caja.created_at), "d MMM, HH:mm", { locale: es })}</span>
                  {caja.estado === 'despachada' && caja.fecha_despacho && (
                    <span className="flex items-center gap-1 text-orange-600">
                      <Truck className="h-3 w-3" />
                      {format(new Date(caja.fecha_despacho), "d MMM", { locale: es })}
                    </span>
                  )}
                  {caja.estado === 'recibida_colombia' && (
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle2 className="h-3 w-3" />
                      En Colombia
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Atajo a recibir Colombia */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm">
        <div className="flex items-start gap-3">
          <ScanBarcode className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-blue-900">¿Llegó una caja a Colombia?</p>
            <p className="text-blue-700 text-xs mt-1">
              Usa el módulo de recepción Colombia para escanear el tracking USACO y procesar todos los paquetes en bloque.
            </p>
            <Link
              href="/admin/recibir-colombia"
              className="inline-block text-xs font-semibold text-blue-700 hover:text-blue-900 mt-2"
            >
              Ir a Recibir Colombia →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
