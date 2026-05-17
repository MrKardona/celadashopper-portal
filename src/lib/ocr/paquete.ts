// src/lib/ocr/paquete.ts
// Wrapper sobre Claude Vision para extraer datos de etiqueta y contenido
// de un paquete recibido en bodega USA. Devuelve JSON estructurado y validado.
//
// Modelo: Haiku 4.5 — barato (~$0.005 por par de fotos), rápido (~2-4 s),
// suficiente para etiquetas de envío y descripción visual.

import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

// ─── Esquemas de salida ──────────────────────────────────────────────────────
const EtiquetaSchema = z.object({
  tracking_origen: z.string().nullable(),
  numero_casilla: z.string().nullable(),
  nombre_destinatario: z.string().nullable(),
  tienda: z.string().nullable(),
  cantidad: z.number().int().min(1).nullable(),
  confianza: z.enum(['alta', 'media', 'baja']),
  notas: z.string().nullable(),
})

const ContenidoSchema = z.object({
  descripcion: z.string(),
  categoria: z.enum([
    'celular', 'computador', 'ipad_tablet', 'calzado',
    'ropa_accesorios', 'electrodomestico', 'juguetes',
    'cosmeticos', 'perfumeria', 'suplementos', 'libros', 'tarifa_especial', 'otro',
  ]),
  condicion: z.enum(['nuevo', 'usado']).nullable(),
  cantidad: z.number().int().min(1).max(50),
  confianza: z.enum(['alta', 'media', 'baja']),
})

export type EtiquetaOCR = z.infer<typeof EtiquetaSchema>
export type ContenidoOCR = z.infer<typeof ContenidoSchema>

// ─── Prompts ─────────────────────────────────────────────────────────────────
const PROMPT_ETIQUETA = `Eres un asistente de bodega de CeladaShopper (servicio de casillero USA → Colombia).
Te paso la foto de la etiqueta de un paquete recibido en USA. Extrae los datos clave.

CAMPOS A IDENTIFICAR:
- tracking_origen: número de tracking del courier (Amazon, USPS, UPS, FedEx, DHL). Suele tener prefijos como TBA..., 1Z..., 9XXXX..., o ser un código de barras grande. NO confundir con direcciones o teléfonos. **DEVUELVE EL TRACKING SIEMPRE CONCATENADO, SIN ESPACIOS** — si en la etiqueta aparece como "9400 1118 9942 0334" debes devolver "9400111899420334".
- numero_casilla: identificador del cliente CeladaShopper. Formato: "CS-NNNN" o "CS NNNN" o solo "NNNN" precedido por "Casillero" o "Suite" o "Apt". Está en la línea de dirección.
- nombre_destinatario: nombre completo de la persona en la etiqueta (línea "TO:" o "Ship To:" o similar).
- tienda: si la etiqueta menciona la tienda de origen (Amazon, Nike, Walmart, etc.). Si no aparece claro, devuelve null.
- cantidad: si la etiqueta o la caja muestran claramente la cantidad de unidades del producto (ej: "Pack of 6", "Qty: 3", "x4", "Count: 12", o un número impreso junto al nombre del producto), extrae ese número entero. Si no aparece cantidad visible, devuelve null.

REGLAS:
- Si NO ves un dato con seguridad, devuelve null. NUNCA inventes valores.
- "confianza" reflejará qué tan claro fue lo que viste:
  - "alta": la etiqueta es legible y los campos están claros
  - "media": algunos campos son legibles, otros dudosos
  - "baja": la etiqueta es difícil de leer, hay reflejos, está borrosa o cortada
- En "notas" pon cualquier observación útil (ej: "etiqueta parcialmente cubierta", "casilla podría ser 0042 u 0048").

DEVUELVE ÚNICAMENTE JSON VÁLIDO, sin markdown, con esta forma exacta:
{
  "tracking_origen": string | null,
  "numero_casilla": string | null,
  "nombre_destinatario": string | null,
  "tienda": string | null,
  "cantidad": number | null,
  "confianza": "alta" | "media" | "baja",
  "notas": string | null
}`

const PROMPT_CONTENIDO = `Eres un asistente de bodega de CeladaShopper. Te paso la foto del contenido de un paquete recibido en bodega USA. Tu trabajo es describir con precisión lo que realmente ves — sin adivinar ni inventar.

REGLA PRINCIPAL: describe SOLO lo que puedes ver con certeza. Si los artículos están envueltos en plástico burbuja, bolsa, papel u otro embalaje y no puedes identificar el producto, descríbelos tal como se ven: forma, color visible, cantidad. Nunca inventes el tipo de producto si no lo puedes ver claramente.

CAMPOS:
- descripcion: descripción en español de máx 120 caracteres. Sé honesto con lo que ves:
  • Si el producto es visible e identificable: nombra marca/tipo + cantidad. Ej: "Tenis Nike Air Max blancos talla 42" / "Vitamina D3 5000 IU, 4 frascos" / "Perfume Acqua di Gio, 2 unidades"
  • Si está parcialmente visible: describe lo que sí ves. Ej: "Frascos con etiqueta oscura envueltos en burbuja, 8 unidades" / "Rollos cilíndricos en plástico burbuja, 10 unidades"
  • Si no se puede identificar: "Artículos envueltos en plástico burbuja, X unidades" / "Objetos en bolsa sin identificar"
  NUNCA escribas nombres de productos que no puedas ver con seguridad (ej: no escribas "barras de plata" si solo ves algo cilíndrico envuelto).

- categoria: elige la más probable según lo visible. Si no puedes determinarla, usa "otro":
  - "celular" → smartphones
  - "computador" → laptops, PCs
  - "ipad_tablet" → tablets, iPads
  - "calzado" → zapatos, tenis, sandalias, botas
  - "ropa_accesorios" → camisas, pantalones, gorras, bolsos, relojes, gafas
  - "electrodomestico" → licuadoras, planchas, freidoras, etc.
  - "juguetes" → juguetes, peluches, juegos
  - "cosmeticos" → maquillaje, cremas, productos de belleza
  - "perfumeria" → perfumes, colonias, fragancias
  - "suplementos" → vitaminas, proteínas, productos GNC
  - "libros" → libros físicos
  - "tarifa_especial" → SOLO si claramente es algo de alto valor o muy inusual
  - "otro" → cuando no puedes identificar o no encaja en ninguna anterior

- condicion: "nuevo" si está en caja original sellada o sin uso evidente; "usado" si se ve usado o sin empaque original; null si no puedes determinarlo (artículos envueltos → null).

- cantidad: cuenta las unidades visibles en la foto. Si están en grupo, cuenta los bultos/objetos individuales. Si no puedes contar con precisión, estima conservadoramente. Si hay un solo ítem, devuelve 1.

- confianza:
  - "alta": producto claramente visible e identificable
  - "media": visible pero parcialmente cubierto o con dudas
  - "baja": envuelto, borroso, mal iluminado o no identificable

DEVUELVE ÚNICAMENTE JSON VÁLIDO, sin markdown, con esta forma exacta:
{
  "descripcion": string,
  "categoria": "celular" | "computador" | "ipad_tablet" | "calzado" | "ropa_accesorios" | "electrodomestico" | "juguetes" | "cosmeticos" | "perfumeria" | "suplementos" | "libros" | "tarifa_especial" | "otro",
  "condicion": "nuevo" | "usado" | null,
  "cantidad": number,
  "confianza": "alta" | "media" | "baja"
}`

// ─── Cliente Anthropic compartido ────────────────────────────────────────────
function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY no configurada')
  return new Anthropic({ apiKey })
}

// ─── Helper: descarga imagen y la convierte a base64 ─────────────────────────
async function imagenABase64(url: string): Promise<{ data: string; mediaType: string }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`No se pudo descargar la imagen (${res.status})`)
  const arrayBuffer = await res.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')
  const mediaType = res.headers.get('content-type') ?? 'image/jpeg'
  return { data: base64, mediaType }
}

// ─── Parser de respuesta JSON con limpieza de markdown ───────────────────────
function parsearJSON(raw: string): unknown {
  const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim()
  const parsed = JSON.parse(cleaned)
  // Claude a veces envuelve el objeto en un array — desempacar el primero
  return Array.isArray(parsed) ? parsed[0] : parsed
}

// ─── Análisis de etiqueta ────────────────────────────────────────────────────
export async function analizarEtiqueta(fotoUrl: string): Promise<EtiquetaOCR> {
  const client = getClient()
  const { data, mediaType } = await imagenABase64(fotoUrl)

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
            data,
          },
        },
        { type: 'text', text: PROMPT_ETIQUETA },
      ],
    }],
  })

  if (message.stop_reason === 'max_tokens') {
    throw new Error('La respuesta de la IA fue cortada (max_tokens). Intenta de nuevo.')
  }
  const texto = message.content[0].type === 'text' ? message.content[0].text : ''
  const parsed = parsearJSON(texto)
  return EtiquetaSchema.parse(parsed)
}

// ─── Análisis de contenido ───────────────────────────────────────────────────
export async function analizarContenido(fotoUrl: string): Promise<ContenidoOCR> {
  const client = getClient()
  const { data, mediaType } = await imagenABase64(fotoUrl)

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
            data,
          },
        },
        { type: 'text', text: PROMPT_CONTENIDO },
      ],
    }],
  })

  if (message.stop_reason === 'max_tokens') {
    throw new Error('La respuesta de la IA fue cortada (max_tokens). Intenta de nuevo.')
  }
  const texto = message.content[0].type === 'text' ? message.content[0].text : ''
  const parsed = parsearJSON(texto)
  return ContenidoSchema.parse(parsed)
}

// ─── Análisis combinado en paralelo ──────────────────────────────────────────
export async function analizarPaquete(
  fotoEmpaqueUrl: string,
  fotoContenidoUrl: string,
): Promise<{ etiqueta: EtiquetaOCR; contenido: ContenidoOCR }> {
  const [etiqueta, contenido] = await Promise.all([
    analizarEtiqueta(fotoEmpaqueUrl),
    analizarContenido(fotoContenidoUrl),
  ])
  return { etiqueta, contenido }
}
