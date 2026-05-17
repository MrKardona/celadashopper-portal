// src/lib/whatsapp/client-resolver.ts
// Busca un cliente en Supabase por su número de WhatsApp

import { createClient } from '../supabase/server'
import type { ClienteConPaquetes } from '@/types'

/**
 * Normaliza un número de teléfono al formato internacional colombiano +57XXXXXXXXXX
 * Acepta: 3001234567 | 573001234567 | +573001234567
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('57') && digits.length === 12) return `+${digits}`
  if (digits.length === 10) return `+57${digits}`
  return `+${digits}`
}

/**
 * Busca un cliente por número de WhatsApp o teléfono.
 * Retorna el perfil con sus paquetes activos y las tarifas vigentes.
 * Retorna null si el cliente no está registrado.
 */
export async function resolveClient(
  rawPhone: string
): Promise<ClienteConPaquetes | null> {
  const supabase = await createClient()
  const phone = normalizePhone(rawPhone)

  const { data: perfiles, error } = await supabase
    .from('perfiles')
    .select(`
      *,
      paquetes (
        id, descripcion, categoria, estado, peso_libras, peso_facturable,
        costo_servicio, factura_pagada, bodega_destino, tracking_casilla,
        tienda, created_at, updated_at,
        fotos_paquetes ( id, url, descripcion )
      )
    `)
    .eq('activo', true)
    .or(`whatsapp.eq.${phone},telefono.eq.${phone}`)
    .limit(1)

  if (error || !perfiles || perfiles.length === 0) return null

  const perfil = perfiles[0]

  const paquetesActivos = (perfil.paquetes || []).filter(
    (p: { estado: string }) =>
      !['entregado', 'devuelto'].includes(p.estado)
  )

  const { data: tarifas } = await supabase
    .from('categorias_tarifas')
    .select('*')
    .eq('activo', true)

  return {
    perfil,
    paquetes: paquetesActivos,
    tarifas: tarifas || [],
  }
}
