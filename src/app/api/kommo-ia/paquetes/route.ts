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

// Comparación segura contra timing attacks (string corto, OK con length+xor).
function safeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

export async function GET(req: NextRequest) {
  const supabase = getSupabase()

  // Auth: requiere KOMMO_IA_TOKEN como query param o Bearer header.
  // Acepta también el header X-Kommo-Token. Sin token configurado, deniega siempre.
  const tokenEsperado = process.env.KOMMO_IA_TOKEN
  if (!tokenEsperado) {
    console.error('[kommo-ia/paquetes] KOMMO_IA_TOKEN no configurado en env')
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const tokenQuery = req.nextUrl.searchParams.get('token') ?? ''
  const authHeader = req.headers.get('authorization') ?? ''
  const tokenBearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  const tokenHeader = req.headers.get('x-kommo-token') ?? ''
  const recibido = tokenQuery || tokenBearer || tokenHeader

  if (!recibido || !safeEq(recibido, tokenEsperado)) {
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
      paquetes!paquetes_cliente_id_fkey (
        tracking_casilla,
        tracking_origen,
        descripcion,
        tienda,
        estado,
        peso_facturable,
        costo_servicio,
        factura_pagada,
        requiere_consolidacion,
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
Dirección bodega Miami: 8164 NW 108th Place, Doral, Florida 33178

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
- reportado: El cliente lo registró pero aún no llega a Miami
- recibido_usa: Llegó a nuestra bodega en Miami, siendo procesado
- en_consolidacion: Se está empacando junto con otros paquetes del cliente
- listo_envio: Listo para salir de Miami a Colombia
- en_transito: Ya salió de Miami hacia Colombia
- en_colombia: Llegó a Colombia, en proceso de distribución
- en_bodega_local: En bodega local, pendiente de entrega
- en_camino_cliente: En camino al cliente
- entregado: El cliente ya lo recibió
- retenido: Retenido (requiere gestión del equipo)
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
      tracking_origen: string | null
      descripcion: string
      tienda: string
      estado: string
      peso_facturable: number | null
      costo_servicio: number | null
      factura_pagada: boolean | null
      requiere_consolidacion: boolean | null
      updated_at: string
    }) => {
      const estadoTexto: Record<string, string> = {
        reportado:         'Reportado — esperando en USA',
        recibido_usa:      'Recibido en Miami',
        en_consolidacion:  'En consolidación',
        listo_envio:       'Listo para envío',
        en_transito:       'En tránsito a Colombia',
        en_colombia:       'Llegó a Colombia',
        en_bodega_local:   'En bodega local',
        en_camino_cliente: 'En camino al cliente',
        entregado:         'Entregado',
        retenido:          'Retenido',
        devuelto:          'Devuelto',
      }
      const estadoLegible = estadoTexto[p.estado] || p.estado
      const pagoStr = p.factura_pagada ? 'PAGADO' : p.costo_servicio ? `PENDIENTE PAGO $${p.costo_servicio} USD` : 'Costo por asignar'
      const ultimaActualizacion = p.updated_at
        ? new Date(p.updated_at).toLocaleDateString('es-CO')
        : 'N/A'
      const consolidacion = p.requiere_consolidacion ? ' | ⚠️ CONSOLIDAR CON OTROS PAQUETES' : ''

      doc += `- **${p.tracking_casilla}**: ${p.descripcion} (${p.tienda})\n`
      doc += `  Estado: ${estadoLegible} | Peso: ${p.peso_facturable ?? 'sin pesar'}lb | Costo: ${pagoStr}${consolidacion}\n`
      if (p.tracking_origen) doc += `  Tracking courier: ${p.tracking_origen}\n`
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
