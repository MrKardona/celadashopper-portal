// src/lib/kommo/proactive.ts
// Envío proactivo de mensajes WhatsApp via Kommo CRM

const KOMMO_DOMAIN = process.env.KOMMO_DOMAIN!
const KOMMO_API_TOKEN = process.env.KOMMO_API_TOKEN!
const BASE_URL = `https://${KOMMO_DOMAIN}.kommo.com/api/v4`

async function kommoFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${KOMMO_API_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Kommo ${res.status}: ${body}`)
  }
  // 204 No Content no tiene body
  if (res.status === 204) return null
  return res.json()
}

/**
 * Busca un contacto en Kommo por número de teléfono.
 * Intenta con y sin prefijo internacional.
 */
async function findContactByPhone(phone: string): Promise<{ id: number; chat_id?: string } | null> {
  const cleaned = phone.replace(/\D/g, '')
  const queries = [cleaned, `+${cleaned}`, phone]

  for (const q of queries) {
    try {
      const data = await kommoFetch(`/contacts?query=${encodeURIComponent(q)}&limit=5`)
      const contacts = data?._embedded?.contacts ?? []
      if (contacts.length > 0) {
        return { id: contacts[0].id }
      }
    } catch {
      // Continuar con siguiente formato
    }
  }
  return null
}

/**
 * Obtiene el chat_id más reciente de un contacto en Kommo.
 */
async function findChatByContactId(contactId: number): Promise<string | null> {
  try {
    const data = await kommoFetch(`/chats?contact_id=${contactId}&limit=5`)
    const chats = data?._embedded?.chats ?? []
    if (chats.length > 0) {
      // Ordenar por created_at descendente y tomar el más reciente
      const sorted = chats.sort(
        (a: { created_at: number }, b: { created_at: number }) => b.created_at - a.created_at
      )
      return sorted[0].id as string
    }
  } catch {
    // Sin chats
  }
  return null
}

/**
 * Crea una tarea en Kommo como fallback cuando no hay chat activo.
 * Esto alerta al equipo para que haga el seguimiento manual.
 */
async function createKommoTask(contactId: number, texto: string): Promise<void> {
  const vencimiento = Math.floor(Date.now() / 1000) + 3600 // 1 hora desde ahora
  await kommoFetch('/tasks', {
    method: 'POST',
    body: JSON.stringify([
      {
        task_type_id: 1,
        text: `📱 Enviar confirmación de registro por WhatsApp:\n\n${texto}`,
        complete_till: vencimiento,
        entity_id: contactId,
        entity_type: 'contacts',
      },
    ]),
  })
}

/**
 * Envía un mensaje WhatsApp proactivo al cliente via Kommo.
 * Flujo:
 *  1. Busca contacto por teléfono en Kommo
 *  2. Si tiene chat activo → envía el mensaje
 *  3. Si no → crea una tarea para el equipo
 * Retorna el estado del intento.
 */
export async function sendProactiveWhatsApp(
  phone: string,
  mensaje: string
): Promise<{ enviado: boolean; metodo: 'chat' | 'tarea' | 'sin_contacto' }> {
  if (!phone) return { enviado: false, metodo: 'sin_contacto' }

  const contact = await findContactByPhone(phone)
  if (!contact) {
    console.warn(`[Kommo] Contacto no encontrado para teléfono: ${phone}`)
    return { enviado: false, metodo: 'sin_contacto' }
  }

  const chatId = await findChatByContactId(contact.id)

  if (chatId) {
    await kommoFetch(`/chats/${chatId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ type: 'text', text: mensaje }),
    })
    return { enviado: true, metodo: 'chat' }
  }

  // Fallback: crear tarea para el equipo
  await createKommoTask(contact.id, mensaje)
  return { enviado: true, metodo: 'tarea' }
}
