// src/lib/notificaciones/por-estado.ts
// Envía WhatsApp automático cuando un paquete cambia de estado

import { createClient } from '@supabase/supabase-js'
import { sendProactiveWhatsApp } from '@/lib/kommo/proactive'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ESTADO_A_EVENTO: Record<string, string> = {
  recibido_usa: 'paquete_recibido_usa',
  en_transito: 'paquete_en_transito',
  en_bodega_local: 'paquete_listo_recoger',
}

const BODEGA_LABELS: Record<string, string> = {
  medellin: 'Medellín',
  bogota: 'Bogotá',
  barranquilla: 'Barranquilla',
}

function rellenarPlantilla(plantilla: string, vars: Record<string, string>): string {
  return plantilla.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
}

export async function notificarCambioEstado(paqueteId: string, estadoNuevo: string): Promise<void> {
  const evento = ESTADO_A_EVENTO[estadoNuevo]
  if (!evento) return

  try {
    // Cargar paquete + perfil del cliente + plantilla en paralelo
    const [paqueteRes, plantillaRes] = await Promise.all([
      supabase
        .from('paquetes')
        .select('*, perfiles(nombre_completo, whatsapp, telefono, email)')
        .eq('id', paqueteId)
        .single(),
      supabase
        .from('plantillas_notificacion')
        .select('texto_plantilla')
        .eq('evento', evento)
        .eq('activa', true)
        .single(),
    ])

    if (paqueteRes.error || !paqueteRes.data) return
    if (plantillaRes.error || !plantillaRes.data) return

    const paquete = paqueteRes.data
    const perfil = paquete.perfiles as {
      nombre_completo: string
      whatsapp: string | null
      telefono: string | null
      email: string | null
    } | null

    if (!perfil) return

    const phone = perfil.whatsapp ?? perfil.telefono ?? ''
    if (!phone) return

    const nombre = perfil.nombre_completo?.split(' ')[0] ?? 'Cliente'
    const peso = paquete.peso_facturable
      ? `${paquete.peso_facturable} lbs`
      : paquete.peso_libras
        ? `${paquete.peso_libras} lbs`
        : 'Por determinar'
    const costo = paquete.costo_servicio
      ? `$${paquete.costo_servicio} USD`
      : 'Por determinar'
    const bodega = BODEGA_LABELS[paquete.bodega_destino] ?? paquete.bodega_destino

    const mensaje = rellenarPlantilla(plantillaRes.data.texto_plantilla, {
      nombre,
      descripcion: paquete.descripcion,
      peso,
      costo,
      bodega,
      tracking: paquete.tracking_casilla ?? '',
    })

    await sendProactiveWhatsApp(phone, mensaje)

    // Registrar en notificaciones
    await supabase.from('notificaciones').insert({
      cliente_id: paquete.cliente_id,
      paquete_id: paqueteId,
      tipo: evento,
      titulo: `Estado actualizado: ${estadoNuevo}`,
      mensaje,
      enviada_whatsapp: true,
    })
  } catch (err) {
    console.error('[notificarCambioEstado] Error:', err)
  }
}
