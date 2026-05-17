// POST /api/admin/domicilios-manuales/optimizar-ruta
// Body: { domiciliario_id: string }
// Usa Claude para ordenar las direcciones en ruta óptima y guarda el orden

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdmin()
  const { data: perfil } = await admin.from('perfiles').select('rol').eq('id', user.id).single()
  if (perfil?.rol !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { domiciliario_id } = await req.json() as { domiciliario_id?: string }
  if (!domiciliario_id) return NextResponse.json({ error: 'domiciliario_id requerido' }, { status: 400 })

  const { data: manuales, error } = await admin
    .from('domicilios_manuales')
    .select('id, nombre, direccion, notas')
    .eq('domiciliario_id', domiciliario_id)
    .eq('estado', 'pendiente')
    .order('orden')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!manuales || manuales.length < 2) {
    return NextResponse.json({ ok: true, orden: manuales?.map(m => m.id) ?? [], message: 'Menos de 2 paradas, no hay qué optimizar' })
  }

  const lista = manuales.map((m, i) => `${i}: "${m.nombre}" — ${m.direccion}${m.notas ? ` (${m.notas})` : ''}`).join('\n')

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 256,
    messages: [{
      role: 'user',
      content: `Eres un optimizador de rutas de domicilios en Colombia. Analiza estas direcciones y devuelve el orden de visita más eficiente para minimizar desplazamientos, agrupando las que estén cerca geográficamente.

Paradas (índice: destinatario — dirección):
${lista}

Responde ÚNICAMENTE con un array JSON con los índices en el orden óptimo. Ejemplo: [2,0,1,3]
No incluyas explicación, solo el array.`,
    }],
  })

  const texto = message.content[0].type === 'text' ? message.content[0].text.trim() : ''

  // Extraer el array JSON de la respuesta
  const match = texto.match(/\[[\d,\s]+\]/)
  if (!match) return NextResponse.json({ error: 'No se pudo parsear la respuesta de IA', raw: texto }, { status: 500 })

  const indices: number[] = JSON.parse(match[0])

  // Validar que los índices sean correctos
  if (indices.length !== manuales.length || !indices.every(i => i >= 0 && i < manuales.length)) {
    return NextResponse.json({ error: 'Respuesta de IA inválida', raw: texto }, { status: 500 })
  }

  // Guardar el nuevo orden en la BD
  await Promise.all(
    indices.map((idx, nuevoOrden) =>
      admin.from('domicilios_manuales').update({ orden: nuevoOrden }).eq('id', manuales[idx].id)
    )
  )

  return NextResponse.json({
    ok: true,
    orden: indices.map(i => manuales[i].id),
  })
}
