// POST /api/admin/notificar-manual
// Dispara manualmente una notificación (WA + email) para un paquete.
// Autenticación: Bearer ${CRON_SECRET} — solo para uso interno/admin.

import { NextRequest, NextResponse } from 'next/server'
import { notificarCambioEstado } from '@/lib/notificaciones/por-estado'

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await req.json() as { paquete_id?: string; estado?: string }
  const { paquete_id, estado } = body

  if (!paquete_id || !estado) {
    return NextResponse.json({ error: 'paquete_id y estado son requeridos' }, { status: 400 })
  }

  try {
    await notificarCambioEstado(paquete_id, estado)
    return NextResponse.json({ ok: true, paquete_id, estado })
  } catch (err) {
    console.error('[notificar-manual]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
