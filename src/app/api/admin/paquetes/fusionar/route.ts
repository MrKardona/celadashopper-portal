// POST /api/admin/paquetes/fusionar
// Fusiona 2+ paquetes del mismo cliente en uno solo.
// El primer paquete de la lista sobrevive; los demás se eliminan.

import { NextRequest, NextResponse } from 'next/server'
import { verificarAdmin } from '@/lib/auth/admin'

const ESTADO_ORDEN = [
  'reportado', 'recibido_usa', 'en_consolidacion', 'listo_envio',
  'en_transito', 'en_colombia', 'en_bodega_local', 'en_camino_cliente',
]

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json() as { ids: string[]; descripcion: string }

  if (!body.ids || body.ids.length < 2) {
    return NextResponse.json({ error: 'Se necesitan al menos 2 paquetes para fusionar' }, { status: 400 })
  }

  const admin = getAdmin()

  // Obtener todos los paquetes
  const { data: paquetes, error: errFetch } = await admin
    .from('paquetes')
    .select('id, cliente_id, descripcion, tienda, categoria, estado, bodega_destino, peso_libras, peso_facturable, cantidad, valor_declarado, notas_internas, paquete_origen_id')
    .in('id', body.ids)

  if (errFetch || !paquetes || paquetes.length !== body.ids.length) {
    return NextResponse.json({ error: 'No se encontraron todos los paquetes' }, { status: 400 })
  }

  // Validar mismo cliente
  const clienteIds = [...new Set(paquetes.map(p => p.cliente_id))]
  if (clienteIds.length > 1 || !clienteIds[0]) {
    return NextResponse.json({ error: 'Solo se pueden fusionar paquetes del mismo cliente' }, { status: 400 })
  }

  // Validar estados permitidos
  const noPermitidos = paquetes.filter(p => ['entregado', 'devuelto', 'retenido'].includes(p.estado))
  if (noPermitidos.length > 0) {
    return NextResponse.json({ error: 'No se pueden fusionar paquetes entregados, devueltos o retenidos' }, { status: 400 })
  }

  // El paquete que "sobrevive" es el primero en la lista
  const [survivor, ...toDelete] = paquetes
  const deleteIds = toDelete.map(p => p.id)

  // Peso, cantidad y valor declarado totales
  const pesoTotal = paquetes.reduce((acc, p) => acc + (p.peso_libras ?? 0), 0)
  const cantidadTotal = paquetes.reduce((acc, p) => acc + (p.cantidad ?? 1), 0)
  const valorTotal = paquetes.reduce((acc, p) => acc + (p.valor_declarado ?? 0), 0)

  // Estado más avanzado entre los fusionados
  const estadoFinal = paquetes.reduce((best, p) => {
    const bestIdx = ESTADO_ORDEN.indexOf(best)
    const pIdx = ESTADO_ORDEN.indexOf(p.estado)
    return pIdx > bestIdx ? p.estado : best
  }, paquetes[0].estado)

  const ahora = new Date().toISOString()
  const notaFusion = `[Fusionado con ${deleteIds.length} paquete${deleteIds.length !== 1 ? 's' : ''} el ${ahora.split('T')[0]}]`

  // Reasignar fotos y notificaciones al sobreviviente antes de borrar
  if (deleteIds.length > 0) {
    await Promise.all([
      admin
        .from('fotos_paquetes')
        .update({ paquete_id: survivor.id })
        .in('paquete_id', deleteIds),
      admin
        .from('notificaciones')
        .update({ paquete_id: survivor.id })
        .in('paquete_id', deleteIds),
    ])
  }

  // Actualizar el paquete sobreviviente
  const { error: errUpdate } = await admin
    .from('paquetes')
    .update({
      descripcion: body.descripcion.trim() || survivor.descripcion,
      peso_libras: pesoTotal > 0 ? pesoTotal : null,
      peso_facturable: pesoTotal > 0 ? pesoTotal : null,
      cantidad: cantidadTotal,
      valor_declarado: valorTotal > 0 ? valorTotal : null,
      estado: estadoFinal,
      notas_internas: [survivor.notas_internas, notaFusion].filter(Boolean).join(' · '),
      updated_at: ahora,
    })
    .eq('id', survivor.id)

  if (errUpdate) {
    return NextResponse.json({ error: errUpdate.message }, { status: 500 })
  }

  // Eliminar los paquetes absorbidos (sus fotos ya apuntan al sobreviviente)
  const { error: errDelete } = await admin
    .from('paquetes')
    .delete()
    .in('id', deleteIds)

  if (errDelete) {
    return NextResponse.json({ error: errDelete.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: survivor.id })
}
