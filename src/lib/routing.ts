/**
 * Lógica de ruteo interno de paquetes.
 * El cliente NUNCA ve esto — es puramente operacional.
 *
 * Reglas:
 *  1. Categoría celular → siempre Barranquilla (zona franca, trámite especial)
 *  2. Ciudad en área metro Medellín (Valle de Aburrá + municipios cercanos) → Medellín
 *  3. Cualquier otra ciudad → Bogotá (despacha con guía nacional al destino final)
 */

import type { BodegaDestino } from '@/types'

// Valle de Aburrá + municipios del oriente antioqueño que manejamos desde Medellín
const METRO_MEDELLIN = [
  'medellin', 'bello', 'itagui', 'envigado', 'sabaneta',
  'la estrella', 'caldas', 'copacabana', 'girardota', 'barbosa',
  'rionegro', 'la ceja', 'el retiro', 'guarne', 'marinilla',
  'carmen de viboral', 'el carmen de viboral', 'san antonio de pereira',
  'la union', 'san vicente', 'san carlos',
]

// Ciudades que van directamente a la bodega Barranquilla
const METRO_BARRANQUILLA = [
  'barranquilla', 'soledad', 'malambo', 'galapa', 'puerto colombia',
]

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

/**
 * Devuelve la bodega interna a la que debe ir el paquete.
 * @param ciudadCliente  Campo `ciudad` del perfil del cliente (texto libre)
 * @param categoria      Categoría del paquete (p. ej. 'celular')
 */
export function getBodegaParaCiudad(
  ciudadCliente: string | null | undefined,
  categoria?: string | null,
): BodegaDestino {
  // Celulares SIEMPRE van a Barranquilla — zona franca, sin importar la ciudad del cliente
  if (categoria === 'celular') return 'barranquilla'

  if (!ciudadCliente) return 'bogota'

  const c = normalizar(ciudadCliente)

  if (METRO_MEDELLIN.some(m => c.includes(m))) return 'medellin'
  if (METRO_BARRANQUILLA.some(b => c.includes(b))) return 'barranquilla'

  // Todo lo demás sale desde Bogotá con guía directa al cliente
  return 'bogota'
}

export const BODEGA_LABELS: Record<BodegaDestino, string> = {
  medellin: 'Medellín',
  bogota: 'Bogotá',
  barranquilla: 'Barranquilla',
}
