import { createClient } from '@supabase/supabase-js'
import { CheckCircle2, Package, MapPin, User, Phone } from 'lucide-react'
import EntregarPaqueteButton from '@/components/admin/EntregarPaqueteButton'

const BODEGA_LABELS: Record<string, string> = {
  medellin: 'Medellín',
  bogota: 'Bogotá',
  barranquilla: 'Barranquilla',
}

interface Props {
  searchParams: Promise<{ ciudad?: string }>
}

export default async function ListosEntregaPage({ searchParams }: Props) {
  const { ciudad } = await searchParams

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: 'public' }, auth: { persistSession: false } }
  )

  let q = supabase
    .from('paquetes')
    .select(`
      id, tracking_casilla, descripcion, peso_libras, costo_servicio,
      bodega_destino, fecha_llegada_colombia, cliente_id,
      direccion_entrega, barrio_entrega, referencia_entrega
    `)
    .eq('estado', 'en_bodega_local')
    .order('fecha_llegada_colombia', { ascending: true })

  if (ciudad) q = q.eq('bodega_destino', ciudad)

  const { data: paquetes } = await q
  const lista = paquetes ?? []

  // Cargar perfiles de los clientes
  const clienteIds = [...new Set(lista.map(p => p.cliente_id).filter(Boolean))] as string[]
  const perfilesMap: Record<string, {
    nombre_completo: string
    email: string | null
    whatsapp: string | null
    telefono: string | null
    direccion: string | null
    barrio: string | null
    referencia: string | null
    numero_casilla: string | null
  }> = {}
  if (clienteIds.length > 0) {
    const { data: perfiles } = await supabase
      .from('perfiles')
      .select('id, nombre_completo, email, whatsapp, telefono, direccion, barrio, referencia, numero_casilla')
      .in('id', clienteIds)
    for (const p of perfiles ?? []) {
      perfilesMap[p.id] = {
        nombre_completo: p.nombre_completo,
        email: p.email,
        whatsapp: p.whatsapp,
        telefono: p.telefono,
        direccion: p.direccion,
        barrio: p.barrio,
        referencia: p.referencia,
        numero_casilla: p.numero_casilla,
      }
    }
  }

  const ciudades = [...new Set(lista.map(p => p.bodega_destino).filter(Boolean))]

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
            Listos para entrega
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {lista.length} paquete{lista.length !== 1 ? 's' : ''} en bodega Colombia esperando entrega al cliente
          </p>
        </div>
      </div>

      {/* Filtro por ciudad */}
      {ciudades.length > 1 && (
        <div className="flex flex-wrap gap-2 text-sm">
          <a
            href="/admin/listos-entrega"
            className={`px-3 py-1.5 rounded-full border ${!ciudad ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
          >
            Todas
          </a>
          {ciudades.map(c => (
            <a
              key={c}
              href={`/admin/listos-entrega?ciudad=${c}`}
              className={`px-3 py-1.5 rounded-full border ${ciudad === c ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
            >
              {BODEGA_LABELS[c!] ?? c}
            </a>
          ))}
        </div>
      )}

      {/* Lista de paquetes */}
      {lista.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>No hay paquetes pendientes de entrega</p>
          <p className="text-xs mt-1">Cuando recibas cajas en Colombia, los paquetes aparecerán aquí</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {lista.map(p => {
            const cli = p.cliente_id ? perfilesMap[p.cliente_id] : null
            // Dirección final: la del paquete tiene prioridad sobre la del perfil
            const direccion = p.direccion_entrega ?? cli?.direccion ?? null
            const barrio = p.barrio_entrega ?? cli?.barrio ?? null
            const referencia = p.referencia_entrega ?? cli?.referencia ?? null
            const tel = cli?.whatsapp ?? cli?.telefono ?? null

            return (
              <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm font-bold text-orange-700">{p.tracking_casilla}</p>
                    <p className="text-sm text-gray-900 mt-0.5 truncate">{p.descripcion}</p>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full border font-medium whitespace-nowrap bg-green-100 text-green-700 border-green-200">
                    {BODEGA_LABELS[p.bodega_destino] ?? p.bodega_destino}
                  </span>
                </div>

                {/* Cliente */}
                <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                    <span className="font-semibold text-gray-900 truncate">
                      {cli?.nombre_completo ?? '⏳ Sin asignar'}
                    </span>
                    {cli?.numero_casilla && (
                      <span className="text-[11px] font-mono text-orange-600">{cli.numero_casilla}</span>
                    )}
                  </div>
                  {tel && (
                    <a
                      href={`https://wa.me/${tel.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs text-green-700 hover:underline"
                    >
                      <Phone className="h-3 w-3" />
                      {tel}
                    </a>
                  )}
                </div>

                {/* Dirección */}
                {direccion ? (
                  <div className="text-xs space-y-0.5">
                    <p className="flex items-start gap-1.5 text-gray-700">
                      <MapPin className="h-3.5 w-3.5 text-orange-600 flex-shrink-0 mt-0.5" />
                      <span>{direccion}</span>
                    </p>
                    {(barrio || referencia) && (
                      <p className="text-[11px] text-gray-500 ml-5">
                        {barrio && <span>{barrio}</span>}
                        {barrio && referencia && <span> · </span>}
                        {referencia && <span>{referencia}</span>}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Sin dirección de entrega registrada
                  </p>
                )}

                {/* Datos del paquete */}
                <div className="flex flex-wrap gap-3 text-xs text-gray-500 pt-2 border-t border-gray-100">
                  {p.peso_libras && <span>{Number(p.peso_libras).toFixed(1)} lb</span>}
                  {p.costo_servicio && <span>${Number(p.costo_servicio).toFixed(2)} USD</span>}
                  {p.fecha_llegada_colombia && (
                    <span className="ml-auto text-gray-400">
                      Llegó hace{' '}
                      {Math.floor(
                        (Date.now() - new Date(p.fecha_llegada_colombia).getTime()) /
                          (1000 * 60 * 60 * 24),
                      )}{' '}
                      días
                    </span>
                  )}
                </div>

                {/* Botón entregar */}
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
