// POST /api/admin/paquetes/[id]/dividir
// Divide un paquete en sub-paquetes internos.
// Los sub-paquetes tienen visible_cliente=false → no aparecen en el portal del cliente
// ni disparan notificaciones.

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function verificarAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = getSupabaseAdmin()
  const { data: perfil } = await admin
    .from('perfiles').select('rol').eq('id', user.id).single()
  if (!['admin', 'agente_usa'].includes(perfil?.rol ?? '')) return null
  return user
}

interface SubPaqueteInput {
  descripcion: string
  peso_libras: number | null
  cantidad: number | null
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

  const ahora = new Date().toISOString()

  // Crear sub-paquetes heredando los campos del origen
  const inserts = body.sub_paquetes.map((sp, i) => ({
    cliente_id:          origen.cliente_id,
    descripcion:         sp.descripcion || `${origen.descripcion} — División ${i + 1}`,
    tienda:              origen.tienda ?? 'Sin especificar',
    categoria:           origen.categoria,
    estado:              origen.estado,
    bodega_destino:      origen.bodega_destino,
    tracking_casilla:    origen.tracking_casilla,
    condicion:           origen.condicion,
    fecha_recepcion_usa: origen.fecha_recepcion_usa,
    peso_libras:         sp.peso_libras ?? null,
    peso_facturable:     sp.peso_libras ?? null,
    cantidad:            sp.cantidad ?? null,
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

  // Marcar el paquete origen como dividido en notas internas
  await admin
    .from('paquetes')
    .update({
      notas_internas: [
        origen.notas_internas,
        `[Dividido en ${body.sub_paquetes.length} sub-paquetes el ${ahora.split('T')[0]}]`,
      ].filter(Boolean).join(' · '),
      updated_at: ahora,
    })
    .eq('id', id)

  return NextResponse.json({ ok: true, sub_paquetes: creados })
}
