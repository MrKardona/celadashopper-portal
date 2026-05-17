// src/lib/whatsapp/context-builder.ts
// Construye el contexto que recibe Claude para generar una respuesta

import type { ClienteConPaquetes, ConversacionWhatsapp } from '@/types'

/**
 * Construye un string de contexto estructurado para el system prompt de Claude.
 * Incluye: datos del cliente, paquetes activos con fotos, historial de conversación y tarifas.
 */
export function buildContext(
  cliente: ClienteConPaquetes | null,
  historial: ConversacionWhatsapp[]
): string {
  const ahora = new Date().toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'full',
    timeStyle: 'short',
  })

  if (!cliente) {
    return `FECHA Y HORA COLOMBIA: ${ahora}
TIPO DE CLIENTE: CLIENTE NUEVO (no registrado en el sistema)
INSTRUCCIÓN: Saluda, explica el servicio, da tarifas si pregunta, y si está interesado recopila: nombre completo, ciudad (medellin/bogota/barranquilla), y email opcional.`
  }

  const { perfil, paquetes, tarifas } = cliente

  const paquetesTexto = paquetes.length === 0
    ? 'Sin paquetes activos.'
    : paquetes.map((p) => {
        const fotos = p.fotos_paquetes?.map((f: { url: string }) => f.url).join(', ') || 'Sin fotos'
        return `  - ID: ${p.id}
    Tracking: ${p.tracking_casilla || 'Sin asignar'}
    Descripción: ${p.descripcion} (${p.tienda})
    Estado: ${p.estado}
    Peso: ${p.peso_facturable ?? '?'} lbs
    Costo: $${p.costo_servicio?.toLocaleString('es-CO') ?? 'Por calcular'}
    Pagado: ${p.factura_pagada ? 'Sí' : 'No'}
    Destino: ${p.bodega_destino}
    Fotos: ${fotos}`
      }).join('\n')

  const tarifasTexto = tarifas.length === 0
    ? 'Tarifas no disponibles.'
    : tarifas.map((t: { nombre_display: string; tarifa_por_libra: number }) =>
        `  ${t.nombre_display}: $${t.tarifa_por_libra.toLocaleString('es-CO')}/lb`
      ).join('\n')

  const historialTexto = historial.length === 0
    ? 'Primera interacción.'
    : historial
        .slice(-10)
        .map((m) => `  [${m.rol.toUpperCase()}]: ${m.mensaje}`)
        .join('\n')

  return `FECHA Y HORA COLOMBIA: ${ahora}

CLIENTE:
  Nombre: ${perfil.nombre_completo}
  Casilla: ${perfil.numero_casilla || 'Sin asignar'}
  Ciudad: ${perfil.ciudad || 'No especificada'}
  WhatsApp: ${perfil.whatsapp || (perfil as any).telefono}

PAQUETES ACTIVOS (${paquetes.length}):
${paquetesTexto}

TARIFAS VIGENTES (por libra):
${tarifasTexto}

HISTORIAL RECIENTE:
${historialTexto}`
}
