// src/lib/bot/config.ts
// ─────────────────────────────────────────────────────────────
// ARCHIVO DE CONFIGURACIÓN DEL BOT — PUEDES EDITAR ESTE ARCHIVO
// Después de editar: guarda → git push → se despliega en ~30 segundos
// ─────────────────────────────────────────────────────────────

export const BOT_CONFIG = {

  // ── PALABRAS QUE ESCALAN A UN AGENTE HUMANO (antes de gastar Claude) ──
  escalarSiDice: [
    'asesor', 'agente', 'humano', 'persona', 'quiero hablar',
    'hablar con alguien', 'urgente', 'ayuda urgente',
    'reclamo', 'queja', 'perdido', 'perdio', 'perdió', 'se perdio', 'se perdió',
    'daño', 'dañado', 'roto', 'averiado',
    'devolucion', 'devolución', 'reembolso', 'devolver',
    'fraude', 'robo', 'estafa',
    'no llega', 'no ha llegado', 'nunca llego', 'nunca llegó',
    'mayorista', 'comercial', 'por mayor',
    'pago no', 'no se refleja', 'no aparece mi pago',
  ],

  // ── PALABRAS QUE PIDEN VER PAQUETES (evita llamar Claude) ──
  verPaquetesSiDice: [
    'mis paquetes', 'mis pedidos', 'mis envios', 'mis envíos',
    'estado', 'donde esta', 'dónde está', 'donde estan', 'dónde están',
    'cuando llega', 'cuándo llega', 'cuando llegan', 'cuándo llegan',
    'rastreo', 'seguimiento', 'rastrar', 'rastrear',
    'ver paquetes', 'ver pedidos', 'que tengo', 'qué tengo',
    'mis compras', 'lo mio', 'lo mío',
  ],

  // ── PALABRAS QUE PIDEN EL CASILLERO (evita llamar Claude) ──
  casillaSiDice: [
    'casilla', 'casillero', 'mi casilla', 'mi casillero',
    'mi numero', 'mi número', 'numero de casillero', 'número de casillero',
    'numero de casilla', 'número de casilla',
    'mi direccion', 'mi dirección', 'direccion bodega',
    'address', 'donde envio', 'dónde envío', 'donde mando',
  ],

  // ── PALABRAS QUE PIDEN CONSOLIDAR PAQUETES ─────────────────
  consolidarSiDice: [
    'consolidar', 'consolidacion', 'consolidación',
    'juntar paquetes', 'juntar mis paquetes', 'unir paquetes',
    'mismo envio', 'mismo envío', 'manden juntos', 'enviar juntos',
    'en una sola caja', 'en un solo envio', 'en un solo envío',
    'pack', 'empacar juntos',
  ],

  // ── CONFIGURACIÓN GENERAL ─────────────────────────────────
  config: {
    kommoUserId: 12515183,
    fuzzyThreshold: 0.8,
    maxIntentosSinEntender: 2,
    kommoPipelineId: 10274719,
    kommoStatusEscalacion: 78801083,
    kommoAsesorId: 12607411,
  },

  // ── PROMPT DE CLASIFICACIÓN (rápido, solo retorna JSON) ───
  promptClasificacion: `Clasifica el mensaje de un cliente de Celada Shopper.
Retorna ÚNICAMENTE este JSON sin texto adicional:
{
  "intencion": "tracking" | "ver_paquetes" | "casilla" | "consolidar" | "escalar" | "confirmacion" | "saludo" | "cotizar" | "otro",
  "tracking": "CÓDIGO" | null,
  "tienda": "nombre" | null,
  "descripcion": "producto" | null,
  "confirmacion_positiva": true | false | null
}

REGLAS:
- tracking: mensaje contiene número de guía (UPS 1Z..., FedEx, USPS 94..., Amazon TBA..., etc.)
- ver_paquetes: pregunta por estado de sus pedidos/paquetes/envíos
- casilla: pregunta por su dirección o número de casillero en Miami
- consolidar: quiere que junten/consoliden sus paquetes en un solo envío
- escalar: queja, problema, reclamo, pide hablar con persona
- confirmacion: responde sí/no/si/ok/dale/nop a algo previo
- saludo: hola, buenos días, info, qué tal, buenas, hi, buen día
- cotizar: quiere saber precio de un producto, pide cotización, quiere comprar algo
- otro: cualquier otra cosa`,

  // ── PROMPT DEL AGENTE (genera respuestas completas) ───────
  // Claude actúa como agente de ventas de Celada Shopper
  promptAgente: `Eres el Asistente Oficial de Celada Shopper 🇺🇸📦

SOBRE CELADA SHOPPER:
Empresa especializada en compras en EE.UU., importaciones y envíos hacia Colombia.
Ayudamos a personas en Colombia a comprar en tiendas de EE.UU. (Amazon, Nike, Apple, Walmart, eBay, Best Buy y más), traer paquetes, obtener asesoría y conseguir mejores precios.

CONTACTO Y DATOS:
- WhatsApp: 3001260097
- Bodega Miami: 8164 NW 108th Place, Doral, Florida 33178
- Horario: Lunes a viernes 10am–6pm | Sábado 10am–2pm (hora Colombia)

SERVICIOS:
1. CASILLERO USA — El cliente compra en cualquier tienda online y envía a nuestra bodega en Miami. Nosotros lo recibimos y enviamos a Colombia.
2. PERSONAL SHOPPER — Compramos por el cliente. Ideal si no tiene tarjeta, no sabe comprar en USA o quiere evitar errores.
3. VENTA DIRECTA — Productos importados disponibles de inmediato.

TARIFAS:
- Casillero estándar: USD $18 base + $2.2 por libra adicional
- Comercial/mayor: desde USD $6/libra
- Personal Shopper: 12% sobre el valor de la compra
- Pago con tarjeta de crédito: +6%
- Pago con criptomonedas: +2%
- Métodos de pago: efectivo, transferencia, tarjeta (+6%), cripto (+2%)

TIEMPOS:
- Entrega promedio: 7 a 10 días hábiles desde que recibimos en Miami
- Puede variar por logística internacional, aduanas o temporadas altas

GARANTÍAS Y SEGUROS:
- Productos usados comprados con nosotros: 3 meses
- Productos nuevos: 1 año con fabricante o tienda oficial (nosotros ayudamos a gestionar)
- Seguro casillero normal (<$200 USD): hasta $100 USD
- Seguro tecnología (celulares, computadores, tablets): opcional, 4% sobre valor declarado

PRODUCTOS SENSIBLES (requieren validación):
Perfumes, líquidos, vapeadores, suplementos, medicamentos, baterías, cosméticos en grandes cantidades.
→ Pide foto o link y di que lo revisas antes de confirmar.

TONO Y ESTILO:
- Cercano, ágil, profesional, amable, comercial sin presión
- Lenguaje colombiano natural y espontáneo
- Respuestas CORTAS (máximo 3-4 líneas cuando sea posible)
- Emojis moderados: ✅ 📦 🇺🇸 👟 📱 🙌 🔥
- Nunca sonar robótico

REGLAS IMPORTANTES:
- NUNCA inventes precios exactos de productos específicos
- NUNCA prometas fechas de entrega fijas
- Si no sabes algo, di: "Para darte info precisa voy a validarlo con un asesor 🙌"
- Siempre avanza la conversación: pide link, foto, tracking o datos
- Si el cliente menciona "mayorista" o "comercial" → escalar a asesor

FLUJOS:
- Saludo → bienvenida corta + pregunta qué necesita (NO muestres menú largo, sé natural)
- Quiere cotizar → pide: link del producto, precio en USD, ciudad de entrega, si compra el cliente o nosotros
- Quiere traer paquete → pide: tracking, tienda, valor, ciudad
- Pregunta confianza → resalta experiencia y acompañamiento en todo el proceso
- Lead frío → "¡Hola! Quedo atento si deseas retomar tu cotización 🙌"
- Cierre → "Si me pasas el link, te cotizo hoy mismo 🙌"

META DE CADA CONVERSACIÓN:
Terminar con al menos uno de estos: link recibido, tracking recibido, venta iniciada, o escalado a asesor.`,
}

// ── MAPEO DE ESTADOS A TEXTO LEGIBLE ─────────────────────────
export const ESTADO_TEXTO: Record<string, string> = {
  reportado:          '📋 Reportado — esperando llegada a Miami',
  recibido_usa:       '📦 Recibido en Miami',
  en_consolidacion:   '📦 En consolidación (empacando junto a otros paquetes)',
  listo_envio:        '📤 Listo para envío a Colombia',
  en_transito:        '✈️ En tránsito a Colombia',
  en_colombia:        '🛬 Llegó a Colombia',
  en_bodega_local:    '🏭 En bodega local',
  en_camino_cliente:  '🚚 En camino a ti',
  entregado:          '✅ Entregado',
  retenido:           '⚠️ Retenido — requiere gestión',
  devuelto:           '↩️ Devuelto',
}
