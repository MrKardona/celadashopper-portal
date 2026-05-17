// POST /api/domiciliario/foto — sube una foto de entrega a Supabase Storage
// Accesible para domiciliarios (y admins)

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

function getAdmin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdmin()
  const { data: perfil } = await admin.from('perfiles').select('rol').eq('id', user.id).single()
  const rolesPermitidos = ['admin', 'domiciliario']
  if (!perfil || !rolesPermitidos.includes(perfil.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })

  const tiposPermitidos = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']
  if (!tiposPermitidos.includes(file.type)) {
    return NextResponse.json({ error: 'Tipo de archivo no permitido' }, { status: 400 })
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Archivo demasiado grande (máx 10 MB)' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `entregas/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { error: uploadError } = await admin.storage
    .from('fotos-paquetes')
    .upload(path, buffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = admin.storage.from('fotos-paquetes').getPublicUrl(path)

  return NextResponse.json({ ok: true, url: publicUrl, path })
}
