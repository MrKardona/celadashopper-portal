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

    // Primer contacto: saludo sin pedir datos
    bienvenida: `¡Hola! 👋 Bienvenido a *CeladaShopper*.

Soy tu asistente virtual y estoy aquí para ayudarte con tus envíos desde EE.UU. 🇺🇸📦

¿En qué te puedo ayudar hoy?`,

    // Saludo cuando ya conocemos al cliente
    bienvenidaConNombre: `¡Hola, {nombre}! 👋 Qué gusto saludarte.

¿En qué te puedo ayudar hoy?`,

    // Se pide identificación SOLO cuando el cliente ya expresó qué quiere
    // pero no está registrado o no lo encontramos
    pedirIdentificacion: `Para consultar esa información necesito encontrar tu cuenta 🔍

¿Me puedes dar el correo o número de teléfono con el que te registraste en CeladaShopper?`,

    clienteNoEncontrado: `No encontré ninguna cuenta con esos datos 🤔

Verifica que el correo o teléfono sea el mismo con el que te registraste. Si aún no tienes cuenta puedes crearla en:
🌐 *portal.celadashopper.com*

¿Quieres que te conecte con un asesor para ayudarte?`,

    // Confirmación de tracking
    confirmacionTracking: `Encontré este pedido, ¿lo confirmo? 📋

📦 *Tienda:* {tienda}
🔢 *Tracking:* {tracking}
📝 *Descripción:* {descripcion}

Responde *sí* para registrarlo o *no* para cancelar.`,

    confirmacionTrackingSolo: `Encontré este número de tracking:
🔢 *{tracking}*

¿De qué tienda es y qué compraste? Así lo registro correctamente en tu cuenta.`,

    trackingGuardado: `✅ ¡Listo! Tu pre-alerta quedó registrada.

🔢 *Tracking:* {tracking}
📦 *Tienda:* {tienda}

En cuanto tu paquete llegue a nuestra bodega en Miami te aviso por aquí. ¡Cualquier cosa me escribes! 😊`,

    trackingCancelado: `Listo, no se guardó nada. Cuando quieras registrarlo solo mándame el tracking y listo 👍`,

    // Lista de paquetes
    paquetesActivos: `Aquí están tus paquetes activos 📦

{lista_paquetes}

Si tienes dudas sobre alguno escríbeme el número de tracking.`,

    unPaquete: `▫️ *{tracking}* — {tienda}
   📍 {estado}
   💰 {costo}
   🕐 {fecha}`,

    sinPaquetes: `No tienes paquetes activos por el momento 😊

Si ya hiciste una compra en EE.UU. puedes registrar el tracking aquí mismo y nosotros hacemos el resto.`,

    // Casilla
    casilla: `Tu número de casilla es: *{casilla}* 📫

Úsala como dirección de entrega cuando compres en EE.UU.:

📍 *8164 NW 108TH PL*
*Doral, FL 33178*
*Suite {casilla}*

Cópiala tal como está en el formulario de la tienda. Si la tienda pide nombre de empresa puedes poner *CeladaShopper*. ¿Necesitas ayuda con algo más?`,

    // Escalación
    escalarHumano: `Claro, te conecto con uno de nuestros asesores ahora mismo 🙋‍♂️

Un momento por favor, enseguida te atienden...`,

    // No entendió
    noEntendi: `Mmm, no entendí bien ese mensaje 😅

Te cuento lo que puedo hacer:
📦 *Ver tus paquetes* — solo escríbeme "mis paquetes"
🔔 *Registrar un envío* — mándame el número de tracking
📍 *Tu casilla* — escríbeme "mi casilla"
🙋 *Hablar con un asesor* — escríbeme "asesor"

¿En qué te puedo ayudar?`,

    // Preguntas frecuentes
    costoEnvio: `El costo del servicio depende del peso y dimensiones del paquete 📏

Nuestra tarifa base es por libra. Para cotizaciones exactas escríbenos o consulta en:
🌐 *portal.celadashopper.com*

¿Quieres que te conecte con un asesor para una cotización?`,

    tiempoEntrega: `El tiempo estimado de entrega desde que recibimos tu paquete en Miami es:

✈️ *5 a 10 días hábiles* aproximadamente, dependiendo de aduana y transportadora.

¿Tienes algún paquete específico del que quieras saber el estado?`,

    comoFunciona: `¡Te explico cómo funciona CeladaShopper! 🛍️

1️⃣ *Compras* en cualquier tienda de EE.UU. online
2️⃣ *Usas tu casilla* como dirección de envío en Miami
3️⃣ *Nosotros recibimos* tu paquete en nuestra bodega
4️⃣ *Te avisamos* cuando llega y lo enviamos a Colombia
5️⃣ *Recibes* tu paquete en casa 🏠

¿Tienes cuenta con nosotros? Si no, créala gratis en *portal.celadashopper.com*`,
  },

  // ── PALABRAS QUE ESCALAN A UN AGENTE HUMANO ───────────────
  escalarSiDice: [
    'asesor', 'agente', 'humano', 'persona', 'quiero hablar',
    'hablar con alguien', 'ayuda urgente', 'urgente',
    'reclamo', 'queja', 'perdido', 'perdio', 'perdió', 'se perdio', 'se perdió',
    'daño', 'dañado', 'roto', 'averiado',
    'devolucion', 'devolución', 'reembolso', 'devolver',
    'fraude', 'robo', 'estafa',
    'no llega', 'no ha llegado', 'nunca llego', 'nunca llegó',
  ],

  // ── PALABRAS QUE MUESTRAN ESTADO DE PAQUETES ──────────────
  verPaquetesSiDice: [
    'mis paquetes', 'mis pedidos', 'mis envios', 'mis envíos',
    'estado', 'estados', 'donde esta', 'dónde está', 'donde estan', 'dónde están',
    'cuando llega', 'cuándo llega', 'cuando llegan', 'cuándo llegan',
    'rastreo', 'seguimiento', 'tracking', 'rastrar', 'rastrear',
    'ver paquetes', 'ver pedidos', 'que tengo', 'qué tengo',
    'mis compras', 'lo mio', 'lo mío', 'mis cosas',
  ],

  // ── PALABRAS QUE MUESTRAN LA CASILLA ──────────────────────
  casillaSiDice: [
    'casilla', 'casillero', 'mi casilla', 'mi casillero',
    'mi numero', 'mi número', 'numero de casilla', 'número de casilla',
    'direccion', 'dirección', 'mi direccion', 'mi dirección',
    'bodega', 'direccion bodega', 'address', 'donde envio', 'dónde envío',
    'donde mando', 'dónde mando', 'a donde envio', 'adonde mando',
  ],

  // ── PALABRAS SOBRE CÓMO FUNCIONA EL SERVICIO ──────────────
  comoFuncionaSiDice: [
    'como funciona', 'cómo funciona', 'como es', 'cómo es',
    'que es celadashopper', 'qué es celadashopper',
    'como puedo', 'cómo puedo', 'que hacen', 'qué hacen',
    'me explicas', 'explicame', 'explícame',
    'que es esto', 'qué es esto',
  ],

  // ── PALABRAS SOBRE TIEMPOS / COSTOS ───────────────────────
  tiempoSiDice: [
    'cuanto demora', 'cuánto demora', 'cuanto tarda', 'cuánto tarda',
    'dias', 'días', 'semanas', 'tiempo de entrega', 'tiempo envio',
    'cuando me llega', 'cuándo me llega',
  ],

  costoSiDice: [
    'cuanto cuesta', 'cuánto cuesta', 'cuanto vale', 'cuánto vale',
    'precio', 'tarifa', 'tarifas', 'costo', 'costos', 'cobran',
    'cuanto cobran', 'cuánto cobran', 'valor del envio', 'valor envío',
  ],

  // ── CONFIGURACIÓN GENERAL ─────────────────────────────────
  config: {
    // ID del usuario de Kommo que aparece como remitente del bot
    kommoUserId: 12515183,

    // Máxima similitud para fuzzy matching de trackings (0-1)
    fuzzyThreshold: 0.8,

    // Si el bot no reconoce el mensaje después de estos intentos,
    // escala automáticamente a un asesor
    maxIntentosSinEntender: 2,

    // ── ESCALACIÓN A ASESOR HUMANO ───────────────────────────
    kommoPipelineId: 10274719,
    // Etapa "Nueva consulta" → donde cae cuando pide asesor
    kommoStatusEscalacion: 78801083,
    // Asesor humano (Stiven Cardona)
    kommoAsesorId: 12607411,
  },

  // ── PROMPT DE CLAUDE ──────────────────────────────────────
  // Claude solo clasifica la intención, NO genera respuestas.
  // Las respuestas están arriba en "mensajes".
  promptSistema: `Eres el asistente de análisis de mensajes de CeladaShopper.

SOBRE CELADASHOPPER:
CeladaShopper es un servicio de casillero (mailbox forwarding) de EE.UU. a Colombia.
Los clientes compran productos en tiendas online de EE.UU., usan su número de casilla
como dirección de envío en Miami (8164 NW 108TH PL, Doral FL 33178, Suite [número]),
y CeladaShopper recibe, consolida y envía los paquetes a Colombia.
Los clientes pueden registrar "pre-alertas" (avisar que viene un paquete) con el tracking number.

TU ÚNICA FUNCIÓN es analizar el mensaje del cliente y retornar un JSON estructurado.
Hablan principalmente en español colombiano, a veces informal.

INTENCIONES POSIBLES:
- "tracking": el mensaje contiene un número de tracking para registrar un paquete
- "ver_paquetes": quiere saber el estado de sus envíos/paquetes
- "casilla": pregunta por su número de casilla o dirección de envío en USA
- "escalar": quiere hablar con una persona o tiene un problema/queja
- "confirmacion": está respondiendo sí o no a algo previo
- "saludo": saludo genérico, primer mensaje, "hola", "buenos días", sin intención clara
- "como_funciona": pregunta cómo funciona el servicio o qué es CeladaShopper
- "costo": pregunta por precios, tarifas o costos
- "tiempo": pregunta cuánto demora el envío
- "otro": cualquier otro mensaje que no encaja arriba

FORMATOS DE TRACKING RECONOCIDOS:
- UPS: 1Z999AA10123456784 (empieza con 1Z)
- FedEx: 774899172137, 9261290100130736401
- USPS: 9400111899223397808498 (largo, 20-22 dígitos)
- DHL: 1234567890 (10 dígitos)
- Amazon: TBA123456789000 (empieza con TBA)
- Otros: cualquier alfanumérico de 8+ caracteres que parezca código de paquete

REGLAS:
1. Si hay un número que parece tracking → "tracking" (alta prioridad)
2. Saludos como "hola", "buenos días", "qué tal", "hi", emojis solos → "saludo"
3. Confirmaciones: sí/si/yes/ok/listo/confirmo/claro/dale/va → confirmacion_positiva: true
4. Negaciones: no/nop/nope/cancela/cancel → confirmacion_positiva: false
5. Preguntas sobre estado de paquetes → "ver_paquetes"
6. Cualquier queja, problema, pérdida, daño → "escalar"

RESPONDE ÚNICAMENTE con este JSON (sin texto adicional, sin markdown):
{
  "intencion": "tracking" | "ver_paquetes" | "casilla" | "escalar" | "confirmacion" | "saludo" | "como_funciona" | "costo" | "tiempo" | "otro",
  "tracking": "CÓDIGO" | null,
  "tienda": "Nombre tienda" | null,
  "descripcion": "descripción producto" | null,
  "confirmacion_positiva": true | false | null,
  "confianza": 0.0
}`,
}

// ── MAPEO DE ESTADOS A TEXTO LEGIBLE ─────────────────────────
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
