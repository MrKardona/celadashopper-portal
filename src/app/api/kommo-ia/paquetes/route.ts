// src/app/api/kommo-ia/paquetes/route.ts
// Endpoint público para Kommo IA — genera un resumen de todos los paquetes activos
// Kommo IA lo usa como fuente URL de conocimiento en tiempo real

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest) {
  const supabase = getSupabase()
  // Token mínimo de seguridad — agrega ?token=celadashopper2026 en Kommo IA
  const token = req.nextUrl.searchParams.get('token')
  if (token !== 'celadashopper2026') {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  // Cargar todos los perfiles activos con sus paquetes activos
  const { data: perfiles, error } = await supabase
    .from('perfiles')
    .select(`
      nombre_completo,
      numero_casilla,
      whatsapp,
      telefono,
      ciudad,
      paquetes (
        tracking_casilla,
        tracking_usa,
        descripcion,
        tienda,
        estado,
        peso_facturable,
        costo_servicio,
        factura_pagada,
        updated_at
      )
    `)
    .eq('activo', true)
    .eq('rol', 'cliente')

  if (error) {
    console.error('[kommo-ia/paquetes] Error Supabase:', error)
    return new NextResponse('Error interno', { status: 500 })
  }

  // Cargar tarifas
  const { data: tarifas } = await supabase
    .from('categorias_tarifas')
    .select('nombre_display, tarifa_por_libra, precio_fijo, tarifa_tipo')
    .eq('activo', true)

  const ahora = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })

  // Construir documento de texto para Kommo IA
  let doc = `# BASE DE DATOS CLIENTES CELADASHOPPER
Actualizado: ${ahora} (hora Colombia)

## QUÉ ES CELADASHOPPER
Servicio de casillero USA→Colombia. Los clientes compran en tiendas de EE.UU., el paquete llega a nuestra bodega en Miami, y nosotros lo enviamos a Colombia. Cada cliente tiene un número de casillero único (ej: CS-1234).

## TARIFAS POR LIBRA
`

  ;(tarifas || []).forEach(t => {
    if (t.tarifa_tipo === 'fijo_por_unidad') {
      doc += `- ${t.nombre_display}: $${t.precio_fijo} USD fijo por unidad\n`
    } else {
      doc += `- ${t.nombre_display}: $${t.tarifa_por_libra} USD/lb\n`
    }
  })

  doc += `\n## ESTADOS DE PAQUETES
- esperando_en_usa: El cliente compró pero el paquete aún no llega a Miami
- recibido_usa: Llegó a nuestra bodega en Miami, siendo procesado
- en_transito: Ya salió de Miami hacia Colombia
- en_aduana: En proceso de aduana colombiana
- listo_entrega: Llegó a Colombia, listo para recoger o despachar
- entregado: El cliente ya lo recibió
- devuelto: Fue devuelto al remitente

## CLIENTES Y PAQUETES ACTIVOS\n`

  let clientesConPaquetes = 0
  ;(perfiles || []).forEach(perfil => {
    const paquetesActivos = (perfil.paquetes || []).filter(
      (p: { estado: string }) => !['entregado', 'devuelto'].includes(p.estado)
    )

    if (paquetesActivos.length === 0) return
    clientesConPaquetes++

    const tel = perfil.whatsapp || perfil.telefono || 'Sin teléfono'
    doc += `\n### ${perfil.nombre_completo} | Casillero: ${perfil.numero_casilla} | Tel: ${tel} | Ciudad: ${perfil.ciudad}\n`

    paquetesActivos.forEach((p: {
      tracking_casilla: string
      tracking_usa: string
      descripcion: string
      tienda: string
      estado: string
      peso_facturable: number
      costo_servicio: number
      factura_pagada: boolean
      updated_at: string
    }) => {
      const estadoTexto: Record<string, string> = {
        esperando_en_usa: 'Esperando en USA',
        recibido_usa: 'Recibido en Miami',
        en_transito: 'En tránsito a Colombia',
        en_aduana: 'En aduana',
        listo_entrega: 'Listo para entregar',
        listo_envio: 'Listo para envío'
      }
      const estadoLegible = estadoTexto[p.estado] || p.estado
      const pagoStr = p.factura_pagada ? 'PAGADO' : `PENDIENTE PAGO $${p.costo_servicio} USD`
      const ultimaActualizacion = p.updated_at
        ? new Date(p.updated_at).toLocaleDateString('es-CO')
        : 'N/A'

      doc += `- **${p.tracking_casilla}**: ${p.descripcion} (${p.tienda})\n`
      doc += `  Estado: ${estadoLegible} | Peso: ${p.peso_facturable}lb | Costo: ${pagoStr}\n`
      if (p.tracking_usa) doc += `  Tracking USA: ${p.tracking_usa}\n`
      doc += `  Última actualización: ${ultimaActualizacion}\n`
    })
  })

  doc += `\n---\nTotal clientes con paquetes activos: ${clientesConPaquetes}\n`
  doc += `\n## INSTRUCCIONES PARA EL AGENTE
Cuando un cliente pregunte por su paquete:
1. Identifica al cliente por su nombre o número de teléfono
2. Busca su casillero en esta lista
3. Informa el estado de cada paquete activo
4. Si el pago está pendiente, mencionarlo
5. Si el paquete está en "Listo para entregar" o "En tránsito", dar esa buena noticia
6. Para problemas complejos (paquete dañado, disputa, negociación), transferir al equipo humano
`

  return new NextResponse(doc, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}
