// POST /api/admin/paquetes/[id]/dividir
// Divide un paquete en sub-paquetes internos.
// Los sub-paquetes tienen visible_cliente=false → no aparecen en el portal del cliente
// ni disparan notificaciones.

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { verificarAdmin } from '@/lib/auth/admin'

interface SubPaqueteInput {
  descripcion: string
  peso_libras: number | null
  cantidad: number | null
  valor_declarado?: number | null
  notas_internas?: string | null
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const body = await req.json() as { sub_paquetes: SubPaqueteInput[] }

  if (!body.sub_paquetes?.length || body.sub_paquetes.length < 2) {
    return NextResponse.json({ error: 'Se necesitan al menos 2 sub-paquetes para dividir' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  const { data: origen, error: errOrigen } = await admin
    .from('paquetes')
    .select('*')
    .eq('id', id)
    .single()

  if (errOrigen || !origen) {
    return NextResponse.json({ error: 'Paquete no encontrado' }, { status: 404 })
  }

  if (origen.paquete_origen_id) {
    return NextResponse.json({ error: 'Este paquete ya es un sub-paquete, no se puede dividir de nuevo' }, { status: 400 })
  }

  // Verificar si el paquete ya tiene sub-paquetes (fue dividido antes)
  const { data: subsExistentes } = await admin
    .from('paquetes')
    .select('id')
    .eq('paquete_origen_id', id)
    .limit(1)

  if (subsExistentes && subsExistentes.length > 0) {
    return NextResponse.json({
      error: 'Este paquete ya fue dividido anteriormente. Elimina los sub-paquetes existentes antes de volver a dividir.',
    }, { status: 409 })
  }

  const ahora = new Date().toISOString()
  // Sufijo único basado en timestamp para evitar colisiones en tracking_casilla
  const splitSuffix = Date.now().toString(36).slice(-4).toUpperCase()

  // Crear sub-paquetes heredando los campos del origen
  const inserts = body.sub_paquetes.map((sp, i) => ({
    cliente_id:          origen.cliente_id,
    descripcion:         sp.descripcion || `${origen.descripcion} — División ${i + 1}`,
    tienda:              origen.tienda ?? 'Sin especificar',
    categoria:           origen.categoria,
    estado:              origen.estado,
    bodega_destino:      origen.bodega_destino,
    tracking_casilla:    origen.tracking_casilla ? `${origen.tracking_casilla}-D${i + 1}-${splitSuffix}` : null,
    condicion:           origen.condicion,
    fecha_recepcion_usa: origen.fecha_recepcion_usa,
    peso_libras:         sp.peso_libras ?? null,
    peso_facturable:     sp.peso_libras ?? null,
    cantidad:            sp.cantidad ?? null,
    valor_declarado:     sp.valor_declarado ?? null,
    notas_internas:      sp.notas_internas ?? null,
    paquete_origen_id:   id,
    visible_cliente:     false,
    created_at:          ahora,
    updated_at:          ahora,
  }))

  const { data: creados, error: errInsert } = await admin
    .from('paquetes')
    .insert(inserts)
    .select('id, descripcion, peso_libras, cantidad')

  if (errInsert) {
    return NextResponse.json({ error: errInsert.message }, { status: 500 })
  }

  // Copiar fotos del padre a cada sub-paquete para que hereden la miniatura
  const { data: fotosOrigen } = await admin
    .from('fotos_paquetes')
    .select('url, storage_path, descripcion')
    .eq('paquete_id', id)
    .order('created_at', { ascending: true })

  if (fotosOrigen && fotosOrigen.length > 0 && creados && creados.length > 0) {
    const insertsfotos = creados.flatMap(sub =>
      fotosOrigen.map(f => ({
        paquete_id: sub.id,
        url: f.url,
        storage_path: f.storage_path,
        descripcion: f.descripcion ?? null,
        created_at: ahora,
      }))
    )
    await admin.from('fotos_paquetes').insert(insertsfotos)
  }

  // Marcar el paquete origen como dividido:
  // - estado → en_consolidacion para que no aparezca en sugerir armado ni listas de recepción
  // - notas_internas con el registro de la división
  // Cuando todos los sub-paquetes lleguen a Colombia se reactivará el padre y se notificará al cliente
  await admin
    .from('paquetes')
    .update({
      estado: 'en_consolidacion',
      notas_internas: [
        origen.notas_internas,
        `[Dividido en ${body.sub_paquetes.length} sub-paquetes el ${ahora.split('T')[0]}]`,
      ].filter(Boolean).join(' · '),
      updated_at: ahora,
    })
    .eq('id', id)

  // La notificación al cliente se envía cuando el ÚLTIMO sub-paquete
  // sea ingresado a una caja (POST /api/admin/cajas/[id]/paquetes).
  // No notificamos aquí para evitar enviar antes de que el paquete esté
  // consolidado y listo para despacho.

  return NextResponse.json({ ok: true, sub_paquetes: creados })
}
