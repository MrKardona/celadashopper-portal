// POST /api/admin/lotes/[id]/entregar
// Marca todos los paquetes del lote como entregados con una sola foto.
// Envía UNA sola notificación WhatsApp al cliente mencionando todos los paquetes.

import { NextRequest, NextResponse } from 'next/server'
import { verificarAdmin } from '@/lib/auth/admin'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { notificarCambioEstado } from '@/lib/notificaciones/por-estado'

interface Props { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Props) {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id: loteId } = await params
  const body = await req.json() as {
    foto_url?: string | null
    notas?: string | null
    notificar?: boolean
  }

  const admin = getSupabaseAdmin()

  // Cargar todos los paquetes del lote
  const { data: paquetes, error: errFetch } = await admin
    .from('paquetes')
    .select('id, estado, cliente_id, descripcion, tracking_casilla, visible_cliente')
    .eq('lote_entrega_id', loteId)

  if (errFetch) return NextResponse.json({ error: errFetch.message }, { status: 500 })
  if (!paquetes || paquetes.length === 0) {
    return NextResponse.json({ error: 'Lote no encontrado o vacío' }, { status: 404 })
  }

  // Solo los que aún no están entregados
  const aProcesar = paquetes.filter(p => !['entregado', 'devuelto'].includes(p.estado))
  if (aProcesar.length === 0) {
    return NextResponse.json({ ok: true, ya_entregados: true, mensaje: 'Todos ya estaban entregados' })
  }

  const ahora = new Date().toISOString()

  // Marcar todos como entregados
  const { error: errUpdate } = await admin
    .from('paquetes')
    .update({ estado: 'entregado', updated_at: ahora })
    .in('id', aProcesar.map(p => p.id))

  if (errUpdate) return NextResponse.json({ error: errUpdate.message }, { status: 500 })

  // Registrar eventos internos
  const eventos = aProcesar.map(p => ({
    paquete_id: p.id,
    estado_anterior: p.estado,
    estado_nuevo: 'entregado',
    descripcion: body.notas
      ? `Entregado como parte del lote. ${body.notas}`
      : `Entregado como parte del lote (${loteId.slice(0, 8)})`,
    ubicacion: 'Colombia',
  }))
  await admin.from('eventos_paquete').insert(eventos)
    .then(() => {}, e => console.error('[lote/entregar] eventos:', e))

  // Guardar foto en todos los paquetes si se proporcionó
  if (body.foto_url) {
    const fotosInsert = aProcesar.map(p => ({
      paquete_id: p.id,
      url: body.foto_url!,
      storage_path: body.foto_url!,
      descripcion: 'Foto de entrega al cliente',
      subida_por: user.id,
    }))
    await admin.from('fotos_paquetes').insert(fotosInsert)
      .then(() => {}, e => console.error('[lote/entregar] fotos:', e))
  }

  // Enviar UNA sola notificación WhatsApp (primer paquete visible al cliente)
  let notificado = false
  if (body.notificar !== false) {
    const primerPaq = aProcesar.find(p => p.visible_cliente !== false)
    if (primerPaq) {
      try {
        await notificarCambioEstado(primerPaq.id, 'entregado', {
          fotoEntregaUrl: body.foto_url ?? null,
          notasEntrega: body.notas ?? null,
        })
        notificado = true
      } catch (e) {
        console.error('[lote/entregar] notif:', e)
      }
    }
  }

  // Disolver el lote (ya no es necesario una vez entregado)
  await admin.from('paquetes').update({ lote_entrega_id: null }).eq('lote_entrega_id', loteId)
  await admin.from('lotes_entrega').delete().eq('id', loteId)

  return NextResponse.json({
    ok: true,
    entregados: aProcesar.length,
    notificado,
  })
}
