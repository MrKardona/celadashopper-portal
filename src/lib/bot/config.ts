// src/lib/bot/config.ts
// ─────────────────────────────────────────────────────────────
// ARCHIVO DE CONFIGURACIÓN DEL BOT — PUEDES EDITAR ESTE ARCHIVO
// Cambia mensajes, keywords, y comportamiento del bot aquí.
// Después de editar: guarda → git push → se despliega en ~30 segundos
// ─────────────────────────────────────────────────────────────

export const BOT_CONFIG = {

  // ── MENSAJES QUE EL BOT ENVÍA ─────────────────────────────
  // Usa {nombre}, {casilla}, {tracking}, {tienda}, {descripcion},
  // {estado}, {costo} como variables dinámicas
  mensajes: {

    bienvenida: `¡Hola {nombre}! 👋 Soy el asistente de *CeladaShopper*.

Puedo ayudarte con:
📦 Ver el estado de tus paquetes
🔔 Registrar un nuevo pedido (pre-alerta)
📍 Consultar tu número de casilla

¿En qué te ayudo hoy?`,

    pedirNombre: `¡Hola! 👋 Soy el asistente de *CeladaShopper*.
Para ayudarte mejor, ¿cuál es tu nombre o correo registrado?`,

    confirmacionTracking: `¿Confirmas este pedido?

📦 *Tienda:* {tienda}
🔢 *Tracking:* {tracking}
📝 *Descripción:* {descripcion}

Responde *sí* para guardar o *no* para cancelar.`,

    confirmacionTrackingSolo: `Encontré este número de tracking:
🔢 *{tracking}*

¿Es de alguna de estas tiendas? Escríbela o dime el nombre del producto para registrarlo.`,

    trackingGuardado: `✅ ¡Pre-alerta registrada con éxito!

🔢 *Tracking:* {tracking}
📦 *Tienda:* {tienda}

Te avisamos por aquí en cuanto llegue a nuestra bodega en Miami. 🏭`,

    trackingCancelado: `Entendido, no se guardó ningún pedido.
Si necesitas registrarlo después, solo mándame el tracking. 👍`,

    paquetesActivos: `📦 *Tus paquetes activos:*

{lista_paquetes}

Si tienes alguna duda de algún paquete, escríbeme su tracking.`,

    unPaquete: `📦 *{tracking}* — {tienda}
📍 Estado: *{estado}*
💰 Costo: {costo}
🕐 Actualizado: {fecha}`,

    sinPaquetes: `No encontré paquetes activos en tu cuenta. 😊

Si ya hiciste un pedido, puedes registrar el tracking aquí mismo. Solo cópialo y pégalo.`,

    clienteNoEncontrado: `No encontré tu cuenta en nuestro sistema. 🤔

¿Estás registrado en CeladaShopper? Si no tienes cuenta, puedes crearla en:
🌐 portal.celadashopper.com`,

    escalarHumano: `Entendido, te conecto con uno de nuestros asesores ahora mismo. 🙋

Un momento por favor...`,

    noEntendi: `No entendí bien tu mensaje 😅

Puedes decirme:
• Tu número de *tracking* para registrar un pedido
• *"mis paquetes"* para ver el estado de tus envíos
• *"asesor"* para hablar con una persona
• *"casilla"* para ver tu número de casilla`,

    casilla: `Tu número de casilla es: *{casilla}* 📫

Úsalo como dirección de entrega en tus compras en EE.UU.:
📍 {direccion_bodega}
Suite/Apt: {casilla}`,
  },

  // ── PALABRAS QUE ESCALAN A UN AGENTE HUMANO ───────────────
  // Si el cliente escribe alguna de estas, el bot transfiere a un asesor
  escalarSiDice: [
    'asesor', 'agente', 'humano', 'persona', 'ayuda urgente',
    'problema', 'reclamo', 'queja', 'perdido', 'perdio', 'perdió',
    'daño', 'dañado', 'roto', 'error', 'devolucion', 'devolución',
    'reembolso', 'fraude', 'robo', 'urgente',
  ],

  // ── PALABRAS QUE MUESTRAN ESTADO DE PAQUETES ──────────────
  verPaquetesSiDice: [
    'mis paquetes', 'mis pedidos', 'estado', 'donde esta', 'dónde está',
    'cuando llega', 'cuándo llega', 'rastreo', 'seguimiento',
    'mis envios', 'mis envíos', 'ver paquetes', 'que tengo',
    'qué tengo', 'mis compras',
  ],

  // ── PALABRAS QUE MUESTRAN LA CASILLA ──────────────────────
  casillaSiDice: [
    'casilla', 'casillero', 'mi casilla', 'mi numero', 'mi número',
    'direccion', 'dirección', 'direccion bodega', 'address',
  ],

  // ── CONFIGURACIÓN GENERAL ─────────────────────────────────
  config: {
    // ID del usuario de Kommo que aparece como remitente del bot
    // (se obtiene del token JWT: sub = 12515183)
    kommoUserId: 12515183,

    // Máxima similitud para fuzzy matching de trackings (0-1)
    // 0.8 = acepta hasta 20% de diferencia en caracteres
    fuzzyThreshold: 0.8,

    // Si el bot no reconoce el mensaje después de estos intentos,
    // escala automáticamente a un asesor
    maxIntentosSinEntender: 2,

    // ── ESCALACIÓN A ASESOR HUMANO ───────────────────────────
    // ID del pipeline principal "Embudo de ventas"
    kommoPipelineId: 10274719,
    // ID de la etapa "Nueva consulta" → donde cae cuando pide asesor
    kommoStatusEscalacion: 78801083,
    // ID del asesor humano (Stiven Cardona) que recibe los leads escalados
    kommoAsesorId: 12607411,
  },

  // ── PROMPT DE CLAUDE (el cerebro del análisis) ────────────
  // Puedes ajustar las instrucciones aquí para afinar el comportamiento
  promptSistema: `Eres el asistente de análisis de mensajes para CeladaShopper,
un servicio de casillero USA→Colombia. Tu ÚNICA función es analizar
el mensaje de un cliente y retornar un JSON estructurado.

TIPOS DE TRACKING VÁLIDOS (ejemplos de formato):
- UPS: 1Z999AA10123456784
- FedEx: 774899172137 o 9261290100130736401
- USPS: 9400111899223397808498 o 9261290100130736401
- DHL: 1234567890
- Amazon: TBA123456789000
- Shopify/tiendas: cualquier alfanumérico de 8+ caracteres

REGLAS:
1. Si el mensaje contiene un número que parece tracking → intención "tracking"
2. Si el cliente pregunta por sus paquetes/envíos/estado → intención "ver_paquetes"
3. Si el cliente pide hablar con una persona o tiene una queja → intención "escalar"
4. Si el mensaje es una confirmación (sí/no/si/ok) → intención "confirmacion"
5. Si pregunta por su casilla o dirección → intención "casilla"
6. Cualquier otro caso → intención "otro"

EXTRACCIÓN DE DATOS:
- tracking: extrae el número de tracking del texto (sin espacios, solo el código)
- tienda: detecta la tienda si el cliente la menciona o si hay contexto (Amazon, Shein, Nike, etc.)
- descripcion: extrae qué producto es si está mencionado
- confirmacion_positiva: true si dice sí/si/yes/ok/listo/confirmo/correcto

RESPONDE ÚNICAMENTE con este JSON, sin texto adicional:
{
  "intencion": "tracking" | "ver_paquetes" | "escalar" | "confirmacion" | "casilla" | "otro",
  "tracking": "CÓDIGO" | null,
  "tienda": "Nombre tienda" | null,
  "descripcion": "descripción producto" | null,
  "confirmacion_positiva": true | false | null,
  "confianza": 0.0
}`,
}

// ── MAPEO DE ESTADOS USACO/SUPABASE A TEXTO LEGIBLE ──────────
export const ESTADO_TEXTO: Record<string, string> = {
  // Estados internos Supabase
  esperando_en_usa:  '⏳ Esperando en USA',
  recibido_usa:      '📦 Recibido en Miami',
  en_transito:       '✈️ En tránsito a Colombia',
  en_aduana:         '🛃 En proceso de aduana',
  listo_entrega:     '🎉 Listo para entregar',
  listo_envio:       '📤 Listo para envío',
  entregado:         '✅ Entregado',
  devuelto:          '↩️ Devuelto',
  // Estados USACO
  'Pre-Alertado':          '⏳ Pre-alertado',
  'RecibidoOrigen':        '📦 Recibido en Miami',
  'IncluidoEnGuia':        '📋 Incluido en guía',
  'TransitoInternacional': '✈️ En tránsito a Colombia',
  'ProcesoDeAduana':       '🛃 En aduana',
  'BodegaDestino':         '🏭 En bodega Colombia',
  'EnRuta':                '🚚 En ruta',
  'En ruta transito':      '🚚 En ruta tránsito',
  'EnTransportadora':      '📬 En transportadora',
  'EntregaFallida':        '⚠️ Entrega fallida',
  'Entregado':             '✅ Entregado',
}
