// src/app/api/admin/foto/route.ts
// POST /api/admin/foto   → sube una foto a Supabase Storage y devuelve la URL pública
// Acepta multipart/form-data con campo "file"

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { verificarAdmin } from '@/lib/auth/admin'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null

  if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })

  // Validar tipo y tamaño
  const tiposPermitidos = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']
  if (!tiposPermitidos.includes(file.type)) {
    return NextResponse.json({ error: 'Tipo de archivo no permitido' }, { status: 400 })
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Archivo demasiado grande (máx 10 MB)' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `bodega/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const admin = getSupabaseAdmin()
  const { error: uploadError } = await admin.storage
    .from('fotos-paquetes')
    .upload(path, buffer, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = admin.storage
    .from('fotos-paquetes')
    .getPublicUrl(path)

  return NextResponse.json({ ok: true, url: publicUrl, path })
}
