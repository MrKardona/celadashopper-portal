// src/lib/email/plantillas.ts
// Plantillas HTML de emails transaccionales para CeladaShopper.

interface TarifaCalculada {
  subtotal_envio: number
  seguro: number
  total: number
  metodo: string
  detalle: string
  requiere_peso?: boolean
}

interface VariablesPlantilla {
  nombre: string
  descripcion: string
  tracking: string
  tracking_origen?: string | null
  tracking_usaco?: string | null
  peso?: string
  costo?: string
  bodega?: string
  link: string
  fotoUrl?: string | null
  fotoUrlContenido?: string | null
  fotoUrlEmpaque?: string | null
  tienda?: string
  categoria?: string
  valor?: string
  fecha_compra?: string
  fecha_estimada_llegada?: string
  notas_cliente?: string
  estadoActual?: string
  tarifaCalculada?: TarifaCalculada
}

const SITE_URL = 'https://portal.celadashopper.com'
const COLOR_NARANJA = '#ea580c'
const COLOR_FONDO = '#fff7ed'

// ─── Layout base con header y footer ────────────────────────────────────────
function layout(titulo: string, contenido: string, vars: { nombre: string; link?: string }): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${titulo}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f3f4f6;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color:${COLOR_NARANJA};padding:24px 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <span style="color:#ffffff;font-size:22px;font-weight:bold;">📦 CeladaShopper</span>
                    <p style="color:#fed7aa;font-size:13px;margin:4px 0 0 0;">Portal de clientes</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;background-color:${COLOR_FONDO};">
              ${contenido}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#1c1917;padding:24px 32px;text-align:center;">
              <p style="color:#fed7aa;font-size:13px;margin:0 0 8px 0;font-weight:bold;">CeladaShopper</p>
              <p style="color:#a8a29e;font-size:11px;margin:0;line-height:1.5;">
                Tu casillero en USA · Compra en Estados Unidos, recíbelo en Colombia.<br>
                <a href="${SITE_URL}" style="color:#fed7aa;text-decoration:none;">portal.celadashopper.com</a>
              </p>
              <p style="color:#57534e;font-size:10px;margin:12px 0 0 0;">
                Recibiste este correo porque tienes una cuenta activa en CeladaShopper.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function botonVerSeguimiento(link: string): string {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px auto;">
      <tr>
        <td style="border-radius:8px;background-color:${COLOR_NARANJA};">
          <a href="${link}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;">
            Ver mi paquete →
          </a>
        </td>
      </tr>
    </table>
  `
}

function bloqueDatos(label: string, valor: string): string {
  return `
    <tr>
      <td style="padding:6px 0;color:#78716c;font-size:13px;">${label}:</td>
      <td style="padding:6px 0;color:#1c1917;font-size:14px;font-weight:bold;text-align:right;">${valor}</td>
    </tr>
  `
}

// ─── Tracker visual de progreso del paquete ─────────────────────────────────
// Mapea cada estado del paquete a uno de los 5 hitos visibles del tracker.
// Compatible con Gmail, Outlook, Apple Mail (sin animaciones CSS, solo HTML/inline).
const HITOS = [
  { key: 'reportado', icono: '📝', label: 'Reportado' },
  { key: 'recibido_usa', icono: '🇺🇸', label: 'En Miami' },
  { key: 'en_transito', icono: '✈️', label: 'En camino' },
  { key: 'en_bodega_local', icono: '📍', label: 'Listo' },
  { key: 'entregado', icono: '✅', label: 'Entregado' },
] as const

// Cuál hito visible corresponde al estado interno
const ESTADO_A_HITO: Record<string, number> = {
  reportado: 0,
  recibido_usa: 1,
  en_consolidacion: 1,
  listo_envio: 1,
  en_transito: 2,
  en_colombia: 2,
  en_bodega_local: 3,
  en_camino_cliente: 3,
  entregado: 4,
  retenido: 1, // mostrar como "en USA" pero con badge de retenido
  devuelto: 4, // mostrar como entregado (devuelto al remitente)
}

function trackerProgreso(estadoActual?: string): string {
  if (!estadoActual) return ''
  const hitoActivo = ESTADO_A_HITO[estadoActual] ?? 0

  // Cada celda del tracker
  const celdas = HITOS.map((h, i) => {
    const completado = i < hitoActivo
    const actual = i === hitoActivo
    const bg = actual ? COLOR_NARANJA : completado ? '#fb923c' : '#e7e5e4'
    const colorTexto = actual || completado ? '#ffffff' : '#a8a29e'
    const labelColor = actual ? COLOR_NARANJA : completado ? '#9a3412' : '#a8a29e'
    const peso = actual ? 'bold' : 'normal'
    const ring = actual
      ? `box-shadow:0 0 0 4px #fed7aa;`
      : ''

    return `
      <td align="center" style="vertical-align:top;padding:0 2px;width:20%;">
        <div style="background:${bg};color:${colorTexto};width:44px;height:44px;border-radius:50%;line-height:44px;font-size:20px;margin:0 auto;${ring}">
          ${h.icono}
        </div>
        <p style="margin:8px 0 0 0;font-size:11px;font-weight:${peso};color:${labelColor};font-family:Arial,sans-serif;">
          ${h.label}
        </p>
      </td>
    `
  }).join('')

  // Línea de progreso entre los hitos
  const porcentaje = Math.round((hitoActivo / (HITOS.length - 1)) * 100)

  return `
    <div style="margin:24px 0 28px 0;padding:20px 12px 16px 12px;background:#ffffff;border:1px solid #fed7aa;border-radius:10px;">
      <p style="margin:0 0 14px 0;text-align:center;font-size:12px;color:#78716c;font-family:Arial,sans-serif;letter-spacing:0.5px;text-transform:uppercase;">
        Estado del envío
      </p>
      <!-- Barra de fondo y progreso -->
      <div style="position:relative;height:4px;background:#e7e5e4;border-radius:2px;margin:0 22px 12px 22px;">
        <div style="height:4px;background:${COLOR_NARANJA};border-radius:2px;width:${porcentaje}%;"></div>
      </div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>${celdas}</tr>
      </table>
    </div>
  `
}

// ═══════════════════════════════════════════════════════════════════════════
// PLANTILLAS POR TIPO DE EVENTO
// ═══════════════════════════════════════════════════════════════════════════

// Mapa de categorías a labels legibles
const CATEGORIA_LABELS_EMAIL: Record<string, string> = {
  celular: 'Celular',
  computador: 'Computador',
  ipad_tablet: 'iPad / Tablet',
  ropa_accesorios: 'Ropa y accesorios',
  electrodomestico: 'Electrodoméstico',
  juguetes: 'Juguetes',
  cosmeticos: 'Cosméticos',
  perfumeria: 'Perfumería',
  suplementos: 'Suplementos',
  libros: 'Libros',
  otro: 'Otro',
}

function formatearFecha(fechaIso?: string): string | undefined {
  if (!fechaIso) return undefined
  try {
    const d = new Date(fechaIso)
    if (isNaN(d.getTime())) return undefined
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return undefined
  }
}

export function plantillaPaqueteReportado(vars: VariablesPlantilla): { subject: string; html: string; text: string } {
  const subject = `📦 Pedido reportado: ${vars.descripcion}`
  const categoriaLabel = vars.categoria ? (CATEGORIA_LABELS_EMAIL[vars.categoria] ?? vars.categoria) : undefined
  const fechaCompra = formatearFecha(vars.fecha_compra)
  const fechaLlegada = formatearFecha(vars.fecha_estimada_llegada)

  const contenido = `
    <h2 style="color:#1c1917;font-size:24px;margin:0 0 12px 0;">¡Hola ${vars.nombre}! 👋</h2>
    <p style="color:#44403c;font-size:15px;line-height:1.6;margin:0 0 8px 0;">
      Recibimos tu pedido en <strong>CeladaShopper</strong>. Te confirmaremos cada paso por correo.
    </p>

    ${trackerProgreso('reportado')}

    <h3 style="color:#1c1917;font-size:16px;margin:24px 0 12px 0;">Detalles de tu pedido</h3>
    <div style="background:#ffffff;border:1px solid #fed7aa;border-radius:8px;padding:20px;margin:0 0 16px 0;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        ${bloqueDatos('📦 Producto', vars.descripcion)}
        ${categoriaLabel ? bloqueDatos('🏷️ Categoría', categoriaLabel) : ''}
        ${vars.tienda ? bloqueDatos('🏬 Tienda', vars.tienda) : ''}
        ${vars.valor ? bloqueDatos('💵 Valor declarado', vars.valor) : ''}
        ${fechaCompra ? bloqueDatos('🛒 Fecha de compra', fechaCompra) : ''}
        ${fechaLlegada ? bloqueDatos('📅 Llegada estimada a Miami', fechaLlegada) : ''}
        ${vars.tracking_origen ? bloqueDatos('🚚 Tracking del courier', vars.tracking_origen) : ''}
        ${vars.bodega ? bloqueDatos('📍 Ciudad destino', vars.bodega) : ''}
        ${bloqueDatos('🔖 Tu número CeladaShopper', vars.tracking)}
      </table>
    </div>

    ${vars.notas_cliente ? `
      <div style="background:#fef3c7;border-left:4px solid #f59e0b;border-radius:4px;padding:12px 16px;margin:0 0 20px 0;">
        <p style="color:#78716c;font-size:11px;margin:0 0 4px 0;text-transform:uppercase;letter-spacing:0.5px;font-weight:bold;">Tus notas</p>
        <p style="color:#44403c;font-size:14px;margin:0;line-height:1.5;">${vars.notas_cliente}</p>
      </div>
    ` : ''}

    <p style="color:#44403c;font-size:14px;line-height:1.6;margin:0 0 8px 0;">Te avisaremos cuando:</p>
    <ul style="color:#44403c;font-size:14px;line-height:1.8;margin:0 0 24px 24px;padding:0;">
      <li>Llegue a nuestra bodega de Miami 🇺🇸</li>
      <li>Esté en camino a Colombia ✈️</li>
      <li>Esté listo para recoger en ${vars.bodega ?? 'tu ciudad'} 🎉</li>
    </ul>
    ${botonVerSeguimiento(vars.link)}
  `
  return {
    subject,
    html: layout(subject, contenido, vars),
    text: `Hola ${vars.nombre}, recibimos tu pedido "${vars.descripcion}" de ${vars.tienda ?? 'tu tienda'}. Tu número CeladaShopper: ${vars.tracking}. Sigue tu paquete en ${vars.link}`,
  }
}

export function plantillaPaqueteRecibidoUSA(vars: VariablesPlantilla): { subject: string; html: string; text: string } {
  const subject = `📍 Tu paquete llegó a Miami: ${vars.descripcion}`
  const contenido = `
    <h2 style="color:#1c1917;font-size:24px;margin:0 0 12px 0;">¡Tu paquete llegó! 🎉</h2>
    <p style="color:#44403c;font-size:15px;line-height:1.6;margin:0 0 8px 0;">
      ¡Hola ${vars.nombre}! Tu paquete <strong>${vars.descripcion}</strong> ya está en nuestra bodega de Miami.
    </p>
    ${trackerProgreso('recibido_usa')}
    ${(vars.fotoUrlEmpaque || vars.fotoUrlContenido) ? `
      <div style="margin:20px 0;">
        <p style="color:#78716c;font-size:11px;margin:0 0 10px 0;text-transform:uppercase;letter-spacing:0.5px;font-weight:bold;text-align:center;">
          Fotos de tu paquete
        </p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>
            ${vars.fotoUrlEmpaque ? `
              <td style="width:50%;padding-right:6px;vertical-align:top;text-align:center;">
                <img src="${vars.fotoUrlEmpaque}" alt="Foto del empaque" style="width:100%;max-width:280px;border-radius:8px;border:1px solid #fed7aa;display:block;margin:0 auto;" />
                <p style="color:#78716c;font-size:11px;margin:6px 0 0 0;">📦 Empaque (con guía)</p>
              </td>
            ` : ''}
            ${vars.fotoUrlContenido ? `
              <td style="width:50%;padding-left:6px;vertical-align:top;text-align:center;">
                <img src="${vars.fotoUrlContenido}" alt="Foto del contenido" style="width:100%;max-width:280px;border-radius:8px;border:1px solid #fed7aa;display:block;margin:0 auto;" />
                <p style="color:#78716c;font-size:11px;margin:6px 0 0 0;">🔍 Contenido revisado</p>
              </td>
            ` : ''}
          </tr>
        </table>
      </div>
    ` : ''}
    <div style="background:#ffffff;border:1px solid #fed7aa;border-radius:8px;padding:20px;margin:20px 0;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        ${bloqueDatos('📦 Producto', vars.descripcion)}
        ${vars.tracking_origen ? bloqueDatos('🚚 Guía con que llegó', vars.tracking_origen) : ''}
        ${vars.peso ? bloqueDatos('⚖️ Peso', vars.peso) : ''}
        ${bloqueDatos('🔖 Número CeladaShopper', vars.tracking)}
      </table>
    </div>

    ${vars.tarifaCalculada && vars.tarifaCalculada.metodo !== 'sin_tarifa' && vars.tarifaCalculada.total > 0 ? `
      <!-- Tarifa estimada -->
      <div style="background:#fff7ed;border:2px solid ${COLOR_NARANJA};border-radius:10px;padding:20px;margin:20px 0;">
        <p style="color:${COLOR_NARANJA};font-size:11px;margin:0 0 6px 0;font-weight:bold;letter-spacing:0.5px;text-transform:uppercase;">
          ${vars.tarifaCalculada.requiere_peso ? 'Costo aproximado mínimo' : 'Costo aproximado del envío'}
        </p>
        <p style="color:${COLOR_NARANJA};font-size:32px;margin:0;font-weight:bold;font-family:Arial,sans-serif;">
          ${vars.tarifaCalculada.requiere_peso ? 'desde ' : ''}$${vars.tarifaCalculada.total.toFixed(2)}
          <span style="font-size:14px;font-weight:normal;color:#78716c;">USD</span>
        </p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:12px;border-top:1px solid #fed7aa;padding-top:8px;">
          <tr>
            <td style="color:#78716c;font-size:12px;padding:2px 0;">Envío:</td>
            <td style="color:#1c1917;font-size:13px;text-align:right;font-weight:bold;padding:2px 0;">$${vars.tarifaCalculada.subtotal_envio.toFixed(2)} USD</td>
          </tr>
          ${vars.tarifaCalculada.seguro > 0 ? `
          <tr>
            <td style="color:#78716c;font-size:12px;padding:2px 0;">Seguro:</td>
            <td style="color:#1c1917;font-size:13px;text-align:right;font-weight:bold;padding:2px 0;">$${vars.tarifaCalculada.seguro.toFixed(2)} USD</td>
          </tr>
          ` : ''}
        </table>
        <p style="color:#78716c;font-size:11px;margin:10px 0 0 0;line-height:1.5;">
          ${vars.tarifaCalculada.detalle}
        </p>
        <p style="color:#9a3412;font-size:11px;margin:6px 0 0 0;line-height:1.5;font-style:italic;">
          ⚠️ Costo aproximado. Lo confirmaremos definitivamente al despachar.
        </p>
      </div>
    ` : vars.tarifaCalculada && vars.tarifaCalculada.metodo === 'sin_tarifa' ? `
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px;margin:20px 0;">
        <p style="color:#1e40af;font-size:13px;margin:0;line-height:1.5;">
          📋 <strong>Tarifa especial</strong> — el costo de este envío se calcula al hacer la consolidación completa del paquete. Te confirmaremos el costo final próximamente.
        </p>
      </div>
    ` : ''}

    <p style="color:#44403c;font-size:14px;line-height:1.6;margin:0 0 24px 0;">
      Pronto lo despacharemos a Colombia ✈️. Te avisaremos cuando esté en tránsito y cuando llegue a la bodega local.
    </p>
    ${botonVerSeguimiento(vars.link)}
  `
  const textoCosto = vars.tarifaCalculada && vars.tarifaCalculada.total > 0
    ? ` Costo aproximado: $${vars.tarifaCalculada.total.toFixed(2)} USD.`
    : ''
  return {
    subject,
    html: layout(subject, contenido, vars),
    text: `Hola ${vars.nombre}, tu paquete "${vars.descripcion}" llegó a la bodega de Miami. Peso: ${vars.peso}.${textoCosto} Sigue su tracking en ${vars.link}`,
  }
}

export function plantillaPaqueteEnTransito(vars: VariablesPlantilla): { subject: string; html: string; text: string } {
  const subject = `✈️ Tu paquete está en camino a Colombia`
  const contenido = `
    <h2 style="color:#1c1917;font-size:24px;margin:0 0 12px 0;">¡En camino a Colombia! ✈️</h2>
    <p style="color:#44403c;font-size:15px;line-height:1.6;margin:0 0 8px 0;">
      ¡Hola ${vars.nombre}! Tu paquete <strong>${vars.descripcion}</strong> ya salió de Miami rumbo a Colombia.
    </p>
    ${trackerProgreso('en_transito')}
    <div style="background:#ffffff;border:1px solid #fed7aa;border-radius:8px;padding:20px;margin:20px 0;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        ${bloqueDatos('📦 Producto', vars.descripcion)}
        ${vars.tracking_origen ? bloqueDatos('🚚 Guía con que llegó', vars.tracking_origen) : ''}
        ${vars.bodega ? bloqueDatos('📍 Ciudad destino', vars.bodega) : ''}
        ${bloqueDatos('🔖 Número CeladaShopper', vars.tracking)}
      </table>
    </div>
    <p style="color:#44403c;font-size:14px;line-height:1.6;margin:0 0 24px 0;">
      Te avisaremos cuando llegue a nuestra bodega en ${vars.bodega ?? 'Colombia'} y esté listo para recoger.
    </p>
    ${botonVerSeguimiento(vars.link)}
  `
  return {
    subject,
    html: layout(subject, contenido, vars),
    text: `Hola ${vars.nombre}, tu paquete "${vars.descripcion}" va en camino a Colombia. Tracking: ${vars.tracking}. Detalle en ${vars.link}`,
  }
}

export function plantillaPaqueteListoRecoger(vars: VariablesPlantilla): { subject: string; html: string; text: string } {
  const subject = `🎉 Tu paquete está listo en bodega ${vars.bodega ?? ''}`
  const contenido = `
    <h2 style="color:#1c1917;font-size:24px;margin:0 0 12px 0;">¡Listo para recoger! 🎉</h2>
    <p style="color:#44403c;font-size:15px;line-height:1.6;margin:0 0 8px 0;">
      ¡Hola ${vars.nombre}! Tu paquete <strong>${vars.descripcion}</strong> ya llegó a nuestra bodega ${vars.bodega ? `en ${vars.bodega}` : 'local'}.
    </p>
    ${trackerProgreso('en_bodega_local')}
    <div style="background:#ffffff;border:1px solid #fed7aa;border-radius:8px;padding:20px;margin:20px 0;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        ${bloqueDatos('📦 Producto', vars.descripcion)}
        ${vars.peso ? bloqueDatos('⚖️ Peso', vars.peso) : ''}
        ${vars.costo ? bloqueDatos('💰 Costo del servicio', vars.costo) : ''}
        ${vars.bodega ? bloqueDatos('📍 Bodega', vars.bodega) : ''}
        ${bloqueDatos('🔖 Tracking', vars.tracking)}
      </table>
    </div>
    <p style="color:#44403c;font-size:14px;line-height:1.6;margin:0 0 24px 0;">
      Coordina la entrega o pasa a recogerlo cuando puedas.
    </p>
    ${botonVerSeguimiento(vars.link)}
  `
  return {
    subject,
    html: layout(subject, contenido, vars),
    text: `Hola ${vars.nombre}, tu paquete "${vars.descripcion}" está listo en bodega ${vars.bodega ?? ''}. Costo: ${vars.costo}. Detalle en ${vars.link}`,
  }
}

export function plantillaPaqueteEntregado(vars: VariablesPlantilla): { subject: string; html: string; text: string } {
  const subject = `✅ Paquete entregado: ${vars.descripcion}`
  const contenido = `
    <h2 style="color:#1c1917;font-size:24px;margin:0 0 12px 0;">¡Entregado! ✅</h2>
    <p style="color:#44403c;font-size:15px;line-height:1.6;margin:0 0 8px 0;">
      ¡Hola ${vars.nombre}! Confirmamos que tu paquete <strong>${vars.descripcion}</strong> fue entregado.
    </p>
    ${trackerProgreso('entregado')}
    ${vars.fotoUrlContenido ? `
      <div style="margin:20px 0;text-align:center;">
        <p style="color:#78716c;font-size:11px;margin:0 0 8px 0;text-transform:uppercase;letter-spacing:0.5px;font-weight:bold;">Foto de la entrega</p>
        <img src="${vars.fotoUrlContenido}" alt="Comprobante de entrega" style="max-width:100%;border-radius:8px;border:1px solid #fed7aa;" />
      </div>
    ` : ''}
    <div style="background:#ffffff;border:1px solid #fed7aa;border-radius:8px;padding:20px;margin:20px 0;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        ${bloqueDatos('📦 Producto', vars.descripcion)}
        ${vars.bodega ? bloqueDatos('📍 Bodega', vars.bodega) : ''}
        ${bloqueDatos('🔖 Tracking', vars.tracking)}
      </table>
    </div>
    <p style="color:#44403c;font-size:14px;line-height:1.6;margin:0 0 24px 0;">
      Gracias por confiar en CeladaShopper 🙏. Si tienes algún comentario o problema, contáctanos.
    </p>
    ${botonVerSeguimiento(vars.link)}
  `
  return {
    subject,
    html: layout(subject, contenido, vars),
    text: `Hola ${vars.nombre}, tu paquete "${vars.descripcion}" fue entregado. Gracias por confiar en CeladaShopper.`,
  }
}

export function plantillaCostoCalculado(vars: VariablesPlantilla): { subject: string; html: string; text: string } {
  const subject = `💰 Costo calculado para tu paquete: ${vars.costo}`
  const contenido = `
    <h2 style="color:#1c1917;font-size:24px;margin:0 0 12px 0;">Tu costo de envío</h2>
    <p style="color:#44403c;font-size:15px;line-height:1.6;margin:0 0 20px 0;">
      ¡Hola ${vars.nombre}! Ya pesamos tu paquete <strong>${vars.descripcion}</strong> y este es el costo:
    </p>
    <div style="background:#ffffff;border:2px solid ${COLOR_NARANJA};border-radius:8px;padding:24px;margin:20px 0;text-align:center;">
      <p style="color:#78716c;font-size:13px;margin:0 0 6px 0;">Costo del servicio</p>
      <p style="color:${COLOR_NARANJA};font-size:36px;font-weight:bold;margin:0;font-family:Arial,sans-serif;">${vars.costo}</p>
      ${vars.peso ? `<p style="color:#78716c;font-size:12px;margin:8px 0 0 0;">Peso: ${vars.peso}</p>` : ''}
    </div>
    <p style="color:#44403c;font-size:14px;line-height:1.6;margin:0 0 24px 0;">
      Pronto te enviamos los datos de pago.
    </p>
    ${botonVerSeguimiento(vars.link)}
  `
  return {
    subject,
    html: layout(subject, contenido, vars),
    text: `Hola ${vars.nombre}, ya pesamos tu paquete "${vars.descripcion}". Costo del servicio: ${vars.costo}. Peso: ${vars.peso}. Detalle en ${vars.link}`,
  }
}

// Mapa de estados internos a etiquetas legibles en español.
const ESTADO_LABELS_EMAIL: Record<string, string> = {
  reportado: 'Pedido reportado',
  recibido_usa: 'Recibido en bodega Miami',
  en_consolidacion: 'En consolidación',
  listo_envio: 'Listo para envío',
  en_transito: 'En tránsito a Colombia',
  en_colombia: 'Llegó a Colombia',
  en_bodega_local: 'Listo para recoger',
  en_camino_cliente: 'En camino al cliente',
  entregado: 'Entregado',
  retenido: 'Retenido en aduana',
  devuelto: 'Devuelto',
}

// Plantilla genérica para estados no específicos
export function plantillaEstadoGenerico(estado: string, vars: VariablesPlantilla): { subject: string; html: string; text: string } {
  const label = ESTADO_LABELS_EMAIL[estado] ?? estado
  const subject = `📦 ${label}: ${vars.descripcion}`
  const contenido = `
    <h2 style="color:#1c1917;font-size:24px;margin:0 0 12px 0;">${label}</h2>
    <p style="color:#44403c;font-size:15px;line-height:1.6;margin:0 0 8px 0;">
      ¡Hola ${vars.nombre}! Tu paquete <strong>${vars.descripcion}</strong> tiene una nueva actualización: <strong>${label}</strong>.
    </p>
    ${trackerProgreso(estado)}
    <div style="background:#ffffff;border:1px solid #fed7aa;border-radius:8px;padding:20px;margin:20px 0;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        ${bloqueDatos('📦 Producto', vars.descripcion)}
        ${vars.tracking_origen ? bloqueDatos('🚚 Guía con que llegó', vars.tracking_origen) : ''}
        ${bloqueDatos('🔖 Número CeladaShopper', vars.tracking)}
        ${vars.bodega ? bloqueDatos('📍 Bodega', vars.bodega) : ''}
      </table>
    </div>
    ${botonVerSeguimiento(vars.link)}
  `
  return {
    subject,
    html: layout(subject, contenido, vars),
    text: `Hola ${vars.nombre}, tu paquete "${vars.descripcion}" tiene actualización: ${estado}. Detalle en ${vars.link}`,
  }
}

export function plantillaTrackingActualizado(vars: VariablesPlantilla): { subject: string; html: string; text: string } {
  const subject = `🔖 Actualización de seguimiento: ${vars.descripcion}`
  const contenido = `
    <h2 style="color:#1c1917;font-size:24px;margin:0 0 12px 0;">Seguimiento asignado</h2>
    <p style="color:#44403c;font-size:15px;line-height:1.6;margin:0 0 20px 0;">
      ¡Hola ${vars.nombre}! Tu paquete <strong>${vars.descripcion}</strong> ya tiene número de seguimiento asignado.
    </p>
    <div style="background:#ffffff;border:1px solid #fed7aa;border-radius:8px;padding:20px;margin:20px 0;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        ${bloqueDatos('📦 Producto', vars.descripcion)}
        ${vars.tracking_origen ? bloqueDatos('🚚 Guía con que llegó', vars.tracking_origen) : ''}
        ${bloqueDatos('🔖 Número CeladaShopper', vars.tracking)}
      </table>
    </div>
    <p style="color:#44403c;font-size:14px;line-height:1.6;margin:0 0 24px 0;">
      Puedes consultar el estado completo de tu paquete en cualquier momento desde el portal.
    </p>
    ${botonVerSeguimiento(vars.link)}
  `
  return {
    subject,
    html: layout(subject, contenido, vars),
    text: `Hola ${vars.nombre}, asignamos tracking interno a tu paquete "${vars.descripcion}". Tracking: ${vars.tracking}. Detalle en ${vars.link}`,
  }
}

// Plantilla de prueba
export function plantillaPrueba(nombre: string): { subject: string; html: string; text: string } {
  const subject = '🧪 Prueba de email - CeladaShopper'
  const contenido = `
    <h2 style="color:#1c1917;font-size:24px;margin:0 0 12px 0;">¡Hola ${nombre}!</h2>
    <p style="color:#44403c;font-size:15px;line-height:1.6;margin:0 0 20px 0;">
      Este es un correo de prueba para verificar que las notificaciones por email están funcionando correctamente.
    </p>
    <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:20px 0;">
      <p style="color:#92400e;font-size:14px;margin:0;line-height:1.5;">
        ✅ Si recibiste este mensaje, las notificaciones automáticas de tus paquetes te llegarán correctamente.
      </p>
    </div>
    <p style="color:#44403c;font-size:13px;line-height:1.5;margin:0;">
      — Equipo CeladaShopper
    </p>
  `
  return {
    subject,
    html: layout(subject, contenido, { nombre }),
    text: `Hola ${nombre}, este es un correo de prueba para verificar que las notificaciones por email funcionan.`,
  }
}
