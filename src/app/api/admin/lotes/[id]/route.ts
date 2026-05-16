// DELETE /api/admin/lotes/[id]
// Disuelve un lote: desvincula sus paquetes y elimina el registro.

import { NextRequest, NextResponse } from 'next/server'
import { verificarAdmin } from '@/lib/auth/admin'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

interface Props { params: Promise<{ id: string }> }

export async function DELETE(_req: NextRequest, { params }: Props) {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id: loteId } = await params
  const admin = getSupabaseAdmin()

  // Desvincular todos los paquetes del lote
  const { error: errUpdate } = await admin
    .from('paquetes')
    .update({ lote_entrega_id: null })
    .eq('lote_entrega_id', loteId)

  if (errUpdate) return NextResponse.json({ error: errUpdate.message }, { status: 500 })

  // Eliminar el registro de lote
  const { error: errDelete } = await admin
    .from('lotes_entrega')
    .delete()
    .eq('id', loteId)

  if (errDelete) return NextResponse.json({ error: errDelete.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
