// src/lib/whatsapp/action-executor.ts
// Ejecuta las acciones decididas por el agente Claude

import { createClient } from '../supabase/server'
import { escalateToHuman } from '../kommo/client'
import type {
  AgentResponse,
  RegistrarClienteData,
  ConfirmarEnvioData,
  EscalarData,
} from '@/types'

/**
 * Ejecuta la acción retornada por Claude.
 * Las acciones modifican Supabase y/o Kommo según corresponda.
 */
export async function executeAction(
  response: AgentResponse,
  telefono: string,
  chatId: string,
  kommoContactId: number
): Promise<void> {
  const { accion, datos_accion } = response

  switch (accion) {
    case 'ninguna':
      return

    case 'registrar_cliente': {
      const datos = datos_accion as RegistrarClienteData
      const supabase = await createClient()
      const numero_casilla = `CS-${Date.now().toString().slice(-4)}`
      await supabase.from('perfiles').insert({
        nombre_completo: datos.nombre,
        email: datos.email || `wa_${telefono.replace('+', '')}@celadashopper.com`,
        telefono,
        whatsapp: telefono,
        ciudad: datos.ciudad,
        numero_casilla,
        rol: 'cliente',
        activo: true,
      })
      break
    }

    case 'confirmar_envio': {
      const datos = datos_accion as ConfirmarEnvioData
      const supabase = await createClient()
      await supabase
        .from('paquetes')
        .update({ estado: 'listo_envio', updated_at: new Date().toISOString() })
        .eq('id', datos.paquete_id)
      break
    }

    case 'escalar': {
      const datos = datos_accion as EscalarData
      await escalateToHuman(
        datos.kommo_contact_id || kommoContactId,
        chatId,
        datos.motivo
      )
      break
    }
  }
}
