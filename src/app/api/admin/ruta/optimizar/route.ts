// POST /api/admin/ruta/optimizar
// Body: { domiciliario_id: string }
// Claude analiza TODAS las paradas (paquetes + manuales) y devuelve orden óptimo

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

  // Cargar todas las paradas pendientes
  const [paquetesRes, manualesRes] = await Promise.all([
    admin.from('paquetes')
      .select('id, tracking_casilla, tracking_origen, descripcion, direccion_entrega, barrio_entrega, cliente_id')
      .eq('domiciliario_id', domiciliario_id)
      .in('estado', ['en_camino_cliente', 'en_bodega_local'])
      .is('paquete_origen_id', null),
    admin.from('domicilios_manuales')
      .select('id, nombre, direccion')
      .eq('domiciliario_id', domiciliario_id)
      .eq('estado', 'pendiente'),
  ])

  // Para paquetes sin dirección propia, buscar la del cliente
  const paquetes = paquetesRes.data ?? []
  const sinDir = paquetes.filter(p => !p.direccion_entrega && p.cliente_id).map(p => p.cliente_id as string)
  const clienteDir: Record<string, string> = {}
  if (sinDir.length > 0) {
    const { data: pfs } = await admin.from('perfiles').select('id, direccion, barrio').in('id', sinDir)
    for (const p of pfs ?? []) {
      if (p.direccion) clienteDir[p.id] = [p.direccion, p.barrio].filter(Boolean).join(', ')
    }
  }

  // Construir lista unificada con clave tipo:id
  type Parada = { clave: string; tipo: 'paquete' | 'manual'; id: string; label: string; direccion: string | null }
  const paradas: Parada[] = [
    ...paquetes.map(p => ({
      clave: `paquete:${p.id}`,
      tipo: 'paquete' as const,
      id: p.id,
      label: (p.tracking_origen ?? p.tracking_casilla ?? '') + (p.descripcion ? ` – ${p.descripcion}` : ''),
      direccion: p.direccion_entrega ?? (p.cliente_id ? clienteDir[p.cliente_id] ?? null : null),
    })),
    ...(manualesRes.data ?? []).map(m => ({
      clave: `manual:${m.id}`,
      tipo: 'manual' as const,
      id: m.id,
      label: m.nombre,
      direccion: m.direccion,
    })),
  ]

  if (paradas.length < 2) {
    return NextResponse.json({ ok: true, orden: paradas.map(p => p.clave), message: 'Menos de 2 paradas' })
  }

  const lista = paradas.map((p, i) =>
    `${i}: [${p.tipo.toUpperCase()}] ${p.label} — ${p.direccion ?? 'sin dirección'}`
  ).join('\n')

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const message = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `Eres un optimizador de rutas de domicilios en Colombia. Analiza estas paradas y devuelve el orden de visita más eficiente para minimizar desplazamientos, agrupando por zonas o barrios cercanos.

Paradas (índice: tipo — nombre/tracking — dirección):
${lista}

Las paradas "sin dirección" colócalas al final o donde mejor encajen.
Responde ÚNICAMENTE con un array JSON con los índices en el orden óptimo. Ejemplo: [2,0,1,3]
No incluyas explicación ni texto extra, solo el array JSON.`,
    }],
  })

  const texto = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  const match = texto.match(/\[[\d,\s]+\]/)
  if (!match) return NextResponse.json({ error: 'Respuesta IA inválida', raw: texto }, { status: 500 })

  const indices: number[] = JSON.parse(match[0])
  if (indices.length !== paradas.length || !indices.every(i => i >= 0 && i < paradas.length)) {
    return NextResponse.json({ error: 'Índices IA inválidos', raw: texto }, { status: 500 })
  }

  // Guardar el nuevo orden
  const ordenadas = indices.map(i => paradas[i])
  await Promise.all(
    ordenadas.map((parada, nuevoOrden) => {
      if (parada.tipo === 'paquete') {
        return admin.from('paquetes').update({ orden_ruta: nuevoOrden }).eq('id', parada.id)
      } else {
        return admin.from('domicilios_manuales').update({ orden: nuevoOrden }).eq('id', parada.id)
      }
    })
  )

  return NextResponse.json({ ok: true, orden: ordenadas.map(p => p.clave) })
}
