// src/lib/email/plantillas.ts
// Plantillas HTML de emails transaccionales para CeladaShopper.
// Tema: dark navy + gold — consistente con el portal web.
import { fechaLarga } from '@/lib/fecha'

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

// ─── Paleta dark portal ───────────────────────────────────────────────────────
const BG_OUTER   = '#090915'
const BG_CARD    = '#11112a'
const BG_INNER   = '#19193a'
const BORDER_SUB = '#2c2c52'
const BORDER_VIS = '#3a3a68'
const GOLD       = '#F5B800'
const GOLD_DIM   = '#7a5c00'
const PURPLE     = '#a5b4fc'
const TEXT_PRIM  = '#ffffff'
const TEXT_BODY  = '#b2b2d8'
const TEXT_MUTE  = '#6868a0'
const GREEN      = '#34d399'

// ─── Layout base ─────────────────────────────────────────────────────────────
function layout(titulo: string, contenido: string, vars: { nombre: string; link?: string }): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${titulo}</title>
</head>
<body style="margin:0;padding:0;background-color:${BG_OUTER};font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
    bgcolor="${BG_OUTER}" style="background-color:${BG_OUTER};padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0"
          style="max-width:600px;width:100%;background-color:${BG_CARD};border-radius:14px;overflow:hidden;border:1px solid ${BORDER_VIS};">

          <!-- Header -->
          <tr>
            <td bgcolor="${BG_CARD}" style="background-color:${BG_CARD};padding:28px 32px 22px 32px;border-bottom:1px solid ${BORDER_VIS};">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <p style="margin:0 0 2px 0;color:${GOLD};font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">
                      CeladaShopper
                    </p>
                    <p style="margin:0;color:${TEXT_MUTE};font-size:12px;">
                      Tu casillero en USA &rarr; Colombia
                    </p>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="display:inline-block;background-color:${GOLD};color:#000000;font-size:18px;padding:6px 10px;border-radius:8px;line-height:1;">
                      &#128230;
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td bgcolor="${BG_CARD}" style="background-color:${BG_CARD};padding:32px;">
              ${contenido}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td bgcolor="${BG_OUTER}" style="background-color:${BG_OUTER};padding:22px 32px;border-top:1px solid ${BORDER_SUB};text-align:center;">
              <p style="color:${GOLD};font-size:12px;font-weight:bold;margin:0 0 6px 0;letter-spacing:1px;">
                CELADASHOPPER
              </p>
              <p style="color:${TEXT_MUTE};font-size:11px;margin:0 0 8px 0;line-height:1.6;">
                Tu casillero en USA &middot; Compra en Estados Unidos, recíbelo en Colombia.<br>
                <a href="${SITE_URL}" style="color:${PURPLE};text-decoration:none;">${SITE_URL.replace('https://', '')}</a>
              </p>
              <p style="color:#3a3a60;font-size:10px;margin:0;line-height:1.5;">
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

// ─── Botón CTA ────────────────────────────────────────────────────────────────
function botonVerSeguimiento(link: string): string {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px auto 0 auto;">
      <tr>
        <td align="center" bgcolor="${GOLD}" style="background-color:${GOLD};border-radius:10px;">
          <a href="${link}"
            style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:bold;color:#000000;text-decoration:none;border-radius:10px;letter-spacing:0.3px;">
            Ver mi paquete &rarr;
          </a>
        </td>
      </tr>
    </table>
  `
}

// ─── Fila de dato (tabla de detalles) ─────────────────────────────────────────
function bloqueDatos(label: string, valor: string): string {
  return `
    <tr>
      <td style="padding:7px 0;color:${TEXT_MUTE};font-size:13px;border-bottom:1px solid ${BORDER_SUB};">${label}</td>
      <td style="padding:7px 0;color:${TEXT_PRIM};font-size:13px;font-weight:bold;text-align:right;border-bottom:1px solid ${BORDER_SUB};">${valor}</td>
    </tr>
  `
}

// ─── Tracker de progreso ─────────────────────────────────────────────────────
const HITOS = [
  { key: 'reportado',      icono: '&#128221;', label: 'Reportado' },
  { key: 'recibido_usa',   icono: '&#127482;&#127480;',  label: 'En Miami'   },
  { key: 'en_transito',    icono: '&#9992;&#65039;',  label: 'En camino'  },
  { key: 'en_bodega_local',icono: '&#128205;', label: 'Listo'      },
  { key: 'entregado',      icono: '&#10003;',  label: 'Entregado'  },
] as const

const ESTADO_A_HITO: Record<string, number> = {
  reportado:         0,
  recibido_usa:      1,
  en_consolidacion:  1,
  listo_envio:       1,
  en_transito:       2,
  en_colombia:       2,
  en_bodega_local:   3,
  en_camino_cliente: 3,
  entregado:         4,
  retenido:          1,
  devuelto:          4,
}

function trackerProgreso(estadoActual?: string): string {
  if (!estadoActual) return ''
  const hitoActivo = ESTADO_A_HITO[estadoActual] ?? 0
  const porcentaje = Math.round((hitoActivo / (HITOS.length - 1)) * 100)

  const celdas = HITOS.map((h, i) => {
    const completado = i < hitoActivo
    const actual     = i === hitoActivo

    const circleBg    = actual ? GOLD : completado ? PURPLE : BORDER_VIS
    const circleColor = actual ? '#000000' : completado ? '#000000' : TEXT_MUTE
    const labelColor  = actual ? GOLD : completado ? PURPLE : TEXT_MUTE
    const labelWeight = actual ? 'bold' : 'normal'
    const ringStyle   = actual ? `outline:3px solid ${GOLD_DIM};outline-offset:2px;` : ''

    return `
      <td align="center" style="vertical-align:top;padding:0 3px;width:20%;">
        <div style="background-color:${circleBg};color:${circleColor};width:42px;height:42px;border-radius:50%;line-height:42px;font-size:16px;margin:0 auto;text-align:center;${ringStyle}">
          ${h.icono}
        </div>
        <p style="margin:7px 0 0 0;font-size:10px;font-weight:${labelWeight};color:${labelColor};font-family:Arial,sans-serif;text-align:center;">
          ${h.label}
        </p>
      </td>
    `
  }).join('')

  return `
    <div style="margin:24px 0 28px 0;padding:20px 12px 18px 12px;background-color:${BG_INNER};border:1px solid ${BORDER_VIS};border-radius:12px;">
      <p style="margin:0 0 16px 0;text-align:center;font-size:11px;color:${TEXT_MUTE};font-family:Arial,sans-serif;letter-spacing:1.5px;text-transform:uppercase;font-weight:bold;">
        Estado del envío
      </p>
      <!-- Barra de progreso -->
      <div style="height:3px;background-color:${BORDER_VIS};border-radius:2px;margin:0 24px 14px 24px;">
        <div style="height:3px;background-color:${GOLD};border-radius:2px;width:${porcentaje}%;"></div>
      </div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>${celdas}</tr>
      </table>
    </div>
  `
}

// ─── Card de datos del paquete ────────────────────────────────────────────────
function cardDatos(filas: string): string {
  return `
    <div style="background-color:${BG_INNER};border:1px solid ${BORDER_VIS};border-radius:10px;padding:18px 20px;margin:20px 0;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        ${filas}
      </table>
    </div>
  `
}

// ─── Badge de tracking ────────────────────────────────────────────────────────
function badgeTracking(label: string, valor: string): string {
  return `
    <div style="background-color:${BG_INNER};border:1px solid ${GOLD_DIM};border-radius:10px;padding:16px 20px;margin:20px 0;">
      <p style="margin:0 0 4px 0;color:${GOLD};font-size:10px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;">
        ${label}
      </p>
      <p style="margin:0;color:${GOLD};font-size:26px;font-weight:bold;font-family:'Courier New',monospace;letter-spacing:2px;">
        ${valor}
      </p>
    </div>
  `
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const CATEGORIA_LABELS_EMAIL: Record<string, string> = {
  celular:          'Celular',
  computador:       'Computador',
  ipad_tablet:      'iPad / Tablet',
  ropa_accesorios:  'Ropa y accesorios',
  electrodomestico: 'Electrodoméstico',
  juguetes:         'Juguetes',
  cosmeticos:       'Cosméticos',
  perfumeria:       'Perfumería',
  suplementos:      'Suplementos',
  libros:           'Libros',
  otro:             'Otro',
}

function formatearFecha(fechaIso?: string): string | undefined {
  if (!fechaIso) return undefined
  try {
    const r = fechaLarga(fechaIso)
    return r === '—' ? undefined : r
  } catch {
    return undefined
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PLANTILLAS POR TIPO DE EVENTO
// ═══════════════════════════════════════════════════════════════════════════════

export function plantillaPaqueteReportado(vars: VariablesPlantilla): { subject: string; html: string; text: string } {
  const subject = `Pedido reportado: ${vars.descripcion}`
  const categoriaLabel = vars.categoria ? (CATEGORIA_LABELS_EMAIL[vars.categoria] ?? vars.categoria) : undefined
  const fechaCompra  = formatearFecha(vars.fecha_compra)
  const fechaLlegada = formatearFecha(vars.fecha_estimada_llegada)

  const contenido = `
    <h2 style="color:${TEXT_PRIM};font-size:22px;margin:0 0 8px 0;">
      &#128075; ¡Hola ${vars.nombre}!
    </h2>
    <p style="color:${TEXT_BODY};font-size:15px;line-height:1.65;margin:0 0 4px 0;">
      Recibimos tu pedido en <strong style="color:${TEXT_PRIM};">CeladaShopper</strong>.
      Te confirmaremos cada paso por correo.
    </p>

    ${trackerProgreso('reportado')}

    <p style="color:${GOLD};font-size:11px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 4px 0;">
      Detalles del pedido
    </p>
    ${cardDatos(`
      ${bloqueDatos('&#128230; Producto', vars.descripcion)}
      ${categoriaLabel ? bloqueDatos('&#127991;&#65039; Categoría', categoriaLabel) : ''}
      ${vars.tienda ? bloqueDatos('&#127978; Tienda', vars.tienda) : ''}
      ${vars.valor ? bloqueDatos('&#128181; Valor declarado', vars.valor) : ''}
      ${fechaCompra ? bloqueDatos('&#128722; Fecha de compra', fechaCompra) : ''}
      ${fechaLlegada ? bloqueDatos('&#128197; Llegada estimada a Miami', fechaLlegada) : ''}
      ${vars.tracking_origen ? bloqueDatos('&#128666; Tracking del courier', vars.tracking_origen) : ''}
      ${vars.bodega ? bloqueDatos('&#128205; Ciudad destino', vars.bodega) : ''}
      ${bloqueDatos('&#128278; Tu número CeladaShopper', vars.tracking)}
    `)}

    ${vars.notas_cliente ? `
      <div style="background-color:${BG_INNER};border:1px solid ${BORDER_VIS};border-radius:8px;padding:12px 16px;margin:16px 0;">
        <p style="color:${TEXT_MUTE};font-size:10px;margin:0 0 4px 0;text-transform:uppercase;letter-spacing:1px;font-weight:bold;">Tus notas</p>
        <p style="color:${TEXT_BODY};font-size:14px;margin:0;line-height:1.5;">${vars.notas_cliente}</p>
      </div>
    ` : ''}

    <p style="color:${TEXT_BODY};font-size:14px;line-height:1.6;margin:20px 0 6px 0;">Te avisaremos cuando:</p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 8px 16px;">
      <tr><td style="color:${PURPLE};font-size:14px;padding:3px 0;">&#10003;&nbsp;</td><td style="color:${TEXT_BODY};font-size:14px;padding:3px 0;">Llegue a nuestra bodega de Miami</td></tr>
      <tr><td style="color:${PURPLE};font-size:14px;padding:3px 0;">&#10003;&nbsp;</td><td style="color:${TEXT_BODY};font-size:14px;padding:3px 0;">Esté en camino a Colombia</td></tr>
      <tr><td style="color:${PURPLE};font-size:14px;padding:3px 0;">&#10003;&nbsp;</td><td style="color:${TEXT_BODY};font-size:14px;padding:3px 0;">Esté listo para recoger en ${vars.bodega ?? 'tu ciudad'}</td></tr>
    </table>

    ${botonVerSeguimiento(vars.link)}
  `
  return {
    subject,
    html: layout(subject, contenido, vars),
    text: `Hola ${vars.nombre}, recibimos tu pedido "${vars.descripcion}" de ${vars.tienda ?? 'tu tienda'}. Tu número CeladaShopper: ${vars.tracking}. Sigue tu paquete en ${vars.link}`,
  }
}

export function plantillaPaqueteRecibidoUSA(vars: VariablesPlantilla): { subject: string; html: string; text: string } {
  const subject = `Tu paquete llegó a Miami: ${vars.descripcion}`
  const contenido = `
    <h2 style="color:${TEXT_PRIM};font-size:22px;margin:0 0 8px 0;">
      &#127881; ¡Tu paquete llegó a Miami!
    </h2>
    <p style="color:${TEXT_BODY};font-size:15px;line-height:1.65;margin:0 0 4px 0;">
      ¡Hola <strong style="color:${TEXT_PRIM};">${vars.nombre}</strong>!
      Tu paquete <strong style="color:${TEXT_PRIM};">${vars.descripcion}</strong> ya está en nuestra bodega de Miami.
    </p>

    ${trackerProgreso('recibido_usa')}

    ${(vars.fotoUrlEmpaque || vars.fotoUrlContenido) ? `
      <p style="color:${TEXT_MUTE};font-size:10px;margin:0 0 10px 0;text-transform:uppercase;letter-spacing:1.5px;font-weight:bold;text-align:center;">
        Fotos de tu paquete
      </p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:4px;">
        <tr>
          ${vars.fotoUrlEmpaque ? `
            <td style="width:50%;padding-right:6px;vertical-align:top;text-align:center;">
              <img src="${vars.fotoUrlEmpaque}" alt="Foto del empaque"
                style="width:100%;max-width:272px;border-radius:8px;border:1px solid ${BORDER_VIS};display:block;margin:0 auto;" />
              <p style="color:${TEXT_MUTE};font-size:11px;margin:6px 0 0 0;">Empaque (con guía)</p>
            </td>
          ` : ''}
          ${vars.fotoUrlContenido ? `
            <td style="width:50%;padding-left:6px;vertical-align:top;text-align:center;">
              <img src="${vars.fotoUrlContenido}" alt="Foto del contenido"
                style="width:100%;max-width:272px;border-radius:8px;border:1px solid ${BORDER_VIS};display:block;margin:0 auto;" />
              <p style="color:${TEXT_MUTE};font-size:11px;margin:6px 0 0 0;">Contenido revisado</p>
            </td>
          ` : ''}
        </tr>
      </table>
    ` : ''}

    <p style="color:${GOLD};font-size:11px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;margin:20px 0 4px 0;">
      Detalles
    </p>
    ${cardDatos(`
      ${bloqueDatos('&#128230; Producto', vars.descripcion)}
      ${vars.tracking_origen ? bloqueDatos('&#128666; Guía de llegada', vars.tracking_origen) : ''}
      ${vars.peso ? bloqueDatos('&#9878;&#65039; Peso', vars.peso) : ''}
      ${bloqueDatos('&#128278; Número CeladaShopper', vars.tracking)}
    `)}

    ${vars.tarifaCalculada && vars.tarifaCalculada.metodo !== 'sin_tarifa' && vars.tarifaCalculada.total > 0 ? `
      <div style="background-color:${BG_INNER};border:1px solid ${GOLD_DIM};border-radius:12px;padding:22px;margin:20px 0;">
        <p style="color:${GOLD};font-size:10px;margin:0 0 4px 0;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;">
          ${vars.tarifaCalculada.requiere_peso ? 'Costo aproximado mínimo' : 'Costo aproximado del envío'}
        </p>
        <p style="color:${GOLD};font-size:34px;margin:0 0 12px 0;font-weight:bold;font-family:Arial,sans-serif;">
          ${vars.tarifaCalculada.requiere_peso ? 'desde ' : ''}<span>$${vars.tarifaCalculada.total.toFixed(2)}</span>
          <span style="font-size:14px;font-weight:normal;color:${TEXT_MUTE};">USD</span>
        </p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
          style="border-top:1px solid ${BORDER_VIS};padding-top:10px;">
          <tr>
            <td style="color:${TEXT_MUTE};font-size:12px;padding:3px 0;">Envío:</td>
            <td style="color:${TEXT_PRIM};font-size:13px;text-align:right;font-weight:bold;padding:3px 0;">$${vars.tarifaCalculada.subtotal_envio.toFixed(2)} USD</td>
          </tr>
          ${vars.tarifaCalculada.seguro > 0 ? `
          <tr>
            <td style="color:${TEXT_MUTE};font-size:12px;padding:3px 0;">Seguro:</td>
            <td style="color:${TEXT_PRIM};font-size:13px;text-align:right;font-weight:bold;padding:3px 0;">$${vars.tarifaCalculada.seguro.toFixed(2)} USD</td>
          </tr>
          ` : ''}
        </table>
        <p style="color:${TEXT_MUTE};font-size:11px;margin:10px 0 0 0;line-height:1.5;">
          ${vars.tarifaCalculada.detalle}
        </p>
        <p style="color:#f87171;font-size:11px;margin:6px 0 0 0;line-height:1.5;">
          &#9888;&#65039; Costo aproximado. Se confirma definitivamente al despachar.
        </p>
      </div>
    ` : vars.tarifaCalculada && vars.tarifaCalculada.metodo === 'sin_tarifa' ? `
      <div style="background-color:${BG_INNER};border:1px solid ${BORDER_VIS};border-radius:10px;padding:14px 16px;margin:20px 0;">
        <p style="color:${PURPLE};font-size:13px;margin:0;line-height:1.5;">
          <strong>Tarifa especial</strong> — el costo se calcula al hacer la consolidación. Te confirmamos próximamente.
        </p>
      </div>
    ` : ''}

    <p style="color:${TEXT_BODY};font-size:14px;line-height:1.6;margin:20px 0 0 0;">
      Pronto lo despacharemos a Colombia. Te avisaremos cuando esté en tránsito y cuando llegue a tu ciudad.
    </p>

    ${botonVerSeguimiento(vars.link)}
  `
  const textoCosto = vars.tarifaCalculada && vars.tarifaCalculada.total > 0
    ? ` Costo aproximado: $${vars.tarifaCalculada.total.toFixed(2)} USD.`
    : ''
  return {
    subject,
    html: layout(subject, contenido, vars),
    text: `Hola ${vars.nombre}, tu paquete "${vars.descripcion}" llegó a la bodega de Miami. Peso: ${vars.peso}.${textoCosto} Sigue en ${vars.link}`,
  }
}

export function plantillaPaqueteEnTransito(vars: VariablesPlantilla): { subject: string; html: string; text: string } {
  const subject = `Tu paquete está en camino a Colombia`
  const contenido = `
    <h2 style="color:${TEXT_PRIM};font-size:22px;margin:0 0 8px 0;">
      &#9992;&#65039; ¡En camino a Colombia!
    </h2>
    <p style="color:${TEXT_BODY};font-size:15px;line-height:1.65;margin:0 0 4px 0;">
      ¡Hola <strong style="color:${TEXT_PRIM};">${vars.nombre}</strong>!
      Tu paquete <strong style="color:${TEXT_PRIM};">${vars.descripcion}</strong> ya salió de Miami rumbo a Colombia.
    </p>

    ${trackerProgreso('en_transito')}

    ${vars.tracking_usaco ? `
      <div style="background-color:${BG_INNER};border:1px solid ${GOLD_DIM};border-radius:10px;padding:16px 20px;margin:20px 0;">
        <p style="color:${GOLD};font-size:10px;margin:0 0 6px 0;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;">
          &#128666; Guía de transporte
        </p>
        <p style="color:${GOLD};font-size:22px;font-weight:bold;margin:0 0 6px 0;font-family:'Courier New',monospace;letter-spacing:2px;">${vars.tracking_usaco}</p>
        <p style="color:${TEXT_MUTE};font-size:11px;margin:0;">Usa este número para rastrear el paquete en la transportadora local.</p>
      </div>
    ` : ''}

    ${cardDatos(`
      ${bloqueDatos('&#128230; Producto', vars.descripcion)}
      ${vars.tracking_origen ? bloqueDatos('&#128666; Guía de llegada a Miami', vars.tracking_origen) : ''}
      ${vars.bodega ? bloqueDatos('&#128205; Ciudad destino', vars.bodega) : ''}
      ${bloqueDatos('&#128278; Número CeladaShopper', vars.tracking)}
    `)}

    <p style="color:${TEXT_BODY};font-size:14px;line-height:1.6;margin:20px 0 0 0;">
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
  const subject = `Tu paquete está listo en bodega ${vars.bodega ?? ''}`
  const contenido = `
    <h2 style="color:${TEXT_PRIM};font-size:22px;margin:0 0 8px 0;">
      &#127881; ¡Listo para recoger!
    </h2>
    <p style="color:${TEXT_BODY};font-size:15px;line-height:1.65;margin:0 0 4px 0;">
      ¡Hola <strong style="color:${TEXT_PRIM};">${vars.nombre}</strong>!
      Tu paquete <strong style="color:${TEXT_PRIM};">${vars.descripcion}</strong> ya llegó a nuestra bodega${vars.bodega ? ` en ${vars.bodega}` : ' local'}.
    </p>

    ${trackerProgreso('en_bodega_local')}

    ${vars.tracking_usaco ? `
      <div style="background-color:${BG_INNER};border:1px solid ${GOLD_DIM};border-radius:10px;padding:16px 20px;margin:20px 0;">
        <p style="color:${GOLD};font-size:10px;margin:0 0 6px 0;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;">
          &#128666; Guía
        </p>
        <p style="color:${GOLD};font-size:22px;font-weight:bold;margin:0;font-family:'Courier New',monospace;letter-spacing:2px;">${vars.tracking_usaco}</p>
      </div>
    ` : ''}

    ${cardDatos(`
      ${bloqueDatos('&#128230; Producto', vars.descripcion)}
      ${vars.tracking_origen ? bloqueDatos('&#128666; Guía del courier', vars.tracking_origen) : ''}
      ${vars.peso ? bloqueDatos('&#9878;&#65039; Peso', vars.peso) : ''}
      ${vars.costo ? bloqueDatos('&#128176; Costo del servicio', vars.costo) : ''}
      ${vars.bodega ? bloqueDatos('&#128205; Bodega', vars.bodega) : ''}
      ${bloqueDatos('&#128278; Número CeladaShopper', vars.tracking)}
    `)}

    <div style="background-color:${BG_INNER};border:1px solid ${GREEN};border-radius:10px;padding:14px 16px;margin:20px 0;">
      <p style="color:${GREEN};font-size:14px;margin:0;font-weight:bold;">
        &#10003; Coordina la entrega o pasa a recogerlo cuando puedas.
      </p>
    </div>

    ${botonVerSeguimiento(vars.link)}
  `
  return {
    subject,
    html: layout(subject, contenido, vars),
    text: `Hola ${vars.nombre}, tu paquete "${vars.descripcion}" está listo en bodega ${vars.bodega ?? ''}. Costo: ${vars.costo}. Detalle en ${vars.link}`,
  }
}

export function plantillaPaqueteEntregado(vars: VariablesPlantilla): { subject: string; html: string; text: string } {
  const subject = `Paquete entregado: ${vars.descripcion}`
  const contenido = `
    <h2 style="color:${TEXT_PRIM};font-size:22px;margin:0 0 8px 0;">
      &#10003; ¡Entregado!
    </h2>
    <p style="color:${TEXT_BODY};font-size:15px;line-height:1.65;margin:0 0 4px 0;">
      ¡Hola <strong style="color:${TEXT_PRIM};">${vars.nombre}</strong>!
      Confirmamos que tu paquete <strong style="color:${TEXT_PRIM};">${vars.descripcion}</strong> fue entregado.
    </p>

    ${trackerProgreso('entregado')}

    ${vars.fotoUrlContenido ? `
      <div style="margin:20px 0;text-align:center;">
        <p style="color:${TEXT_MUTE};font-size:10px;margin:0 0 8px 0;text-transform:uppercase;letter-spacing:1.5px;font-weight:bold;">Comprobante de entrega</p>
        <img src="${vars.fotoUrlContenido}" alt="Comprobante de entrega"
          style="max-width:100%;border-radius:8px;border:1px solid ${BORDER_VIS};" />
      </div>
    ` : ''}

    ${cardDatos(`
      ${bloqueDatos('&#128230; Producto', vars.descripcion)}
      ${vars.tracking_origen ? bloqueDatos('&#128666; Guía del courier', vars.tracking_origen) : ''}
      ${vars.tracking_usaco ? bloqueDatos('&#128666; Guía', vars.tracking_usaco) : ''}
      ${vars.bodega ? bloqueDatos('&#128205; Bodega', vars.bodega) : ''}
      ${bloqueDatos('&#128278; Número CeladaShopper', vars.tracking)}
    `)}

    <p style="color:${TEXT_BODY};font-size:14px;line-height:1.6;margin:20px 0 0 0;">
      Gracias por confiar en <strong style="color:${TEXT_PRIM};">CeladaShopper</strong>.
      Si tienes algún comentario o inconveniente, contáctanos por WhatsApp.
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
  const subject = `Costo calculado para tu paquete: ${vars.costo}`
  const contenido = `
    <h2 style="color:${TEXT_PRIM};font-size:22px;margin:0 0 8px 0;">
      &#128181; Costo de envío calculado
    </h2>
    <p style="color:${TEXT_BODY};font-size:15px;line-height:1.65;margin:0 0 4px 0;">
      ¡Hola <strong style="color:${TEXT_PRIM};">${vars.nombre}</strong>!
      Ya pesamos tu paquete <strong style="color:${TEXT_PRIM};">${vars.descripcion}</strong> y este es el costo:
    </p>

    <div style="background-color:${BG_INNER};border:1px solid ${GOLD_DIM};border-radius:12px;padding:28px 24px;margin:24px 0;text-align:center;">
      <p style="color:${TEXT_MUTE};font-size:11px;margin:0 0 6px 0;text-transform:uppercase;letter-spacing:1.5px;font-weight:bold;">Costo del servicio</p>
      <p style="color:${GOLD};font-size:40px;font-weight:bold;margin:0;font-family:Arial,sans-serif;">${vars.costo}</p>
      ${vars.peso ? `<p style="color:${TEXT_MUTE};font-size:12px;margin:10px 0 0 0;">Peso: ${vars.peso}</p>` : ''}
    </div>

    ${cardDatos(`
      ${bloqueDatos('&#128230; Producto', vars.descripcion)}
      ${vars.tracking_origen ? bloqueDatos('&#128666; Guía del courier', vars.tracking_origen) : ''}
      ${bloqueDatos('&#128278; Número CeladaShopper', vars.tracking)}
    `)}

    <p style="color:${TEXT_BODY};font-size:14px;line-height:1.6;margin:0 0 0 0;">
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

const ESTADO_LABELS_EMAIL: Record<string, string> = {
  reportado:         'Pedido reportado',
  recibido_usa:      'Recibido en bodega Miami',
  en_consolidacion:  'En consolidación',
  listo_envio:       'Listo para envío',
  en_transito:       'En tránsito a Colombia',
  en_colombia:       'Llegó a Colombia',
  en_bodega_local:   'Listo para recoger',
  en_camino_cliente: 'En camino al cliente',
  entregado:         'Entregado',
  retenido:          'Retenido en aduana',
  devuelto:          'Devuelto',
}

export function plantillaEstadoGenerico(estado: string, vars: VariablesPlantilla): { subject: string; html: string; text: string } {
  const label = ESTADO_LABELS_EMAIL[estado] ?? estado
  const subject = `${label}: ${vars.descripcion}`
  const contenido = `
    <h2 style="color:${TEXT_PRIM};font-size:22px;margin:0 0 8px 0;">${label}</h2>
    <p style="color:${TEXT_BODY};font-size:15px;line-height:1.65;margin:0 0 4px 0;">
      ¡Hola <strong style="color:${TEXT_PRIM};">${vars.nombre}</strong>!
      Tu paquete <strong style="color:${TEXT_PRIM};">${vars.descripcion}</strong> tiene una nueva actualización:
      <strong style="color:${PURPLE};">${label}</strong>.
    </p>

    ${trackerProgreso(estado)}

    ${vars.tracking_usaco ? `
      <div style="background-color:${BG_INNER};border:1px solid ${GOLD_DIM};border-radius:10px;padding:16px 20px;margin:20px 0;">
        <p style="color:${GOLD};font-size:10px;margin:0 0 6px 0;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;">
          &#128666; Guía
        </p>
        <p style="color:${GOLD};font-size:22px;font-weight:bold;margin:0;font-family:'Courier New',monospace;letter-spacing:2px;">${vars.tracking_usaco}</p>
      </div>
    ` : ''}

    ${cardDatos(`
      ${bloqueDatos('&#128230; Producto', vars.descripcion)}
      ${vars.tracking_origen ? bloqueDatos('&#128666; Guía de llegada', vars.tracking_origen) : ''}
      ${bloqueDatos('&#128278; Número CeladaShopper', vars.tracking)}
      ${vars.bodega ? bloqueDatos('&#128205; Bodega', vars.bodega) : ''}
    `)}

    ${botonVerSeguimiento(vars.link)}
  `
  return {
    subject,
    html: layout(subject, contenido, vars),
    text: `Hola ${vars.nombre}, tu paquete "${vars.descripcion}" tiene actualización: ${estado}. Detalle en ${vars.link}`,
  }
}

export function plantillaTrackingActualizado(vars: VariablesPlantilla): { subject: string; html: string; text: string } {
  const subject = `Actualización de seguimiento: ${vars.descripcion}`
  const contenido = `
    <h2 style="color:${TEXT_PRIM};font-size:22px;margin:0 0 8px 0;">
      &#128278; Seguimiento asignado
    </h2>
    <p style="color:${TEXT_BODY};font-size:15px;line-height:1.65;margin:0 0 4px 0;">
      ¡Hola <strong style="color:${TEXT_PRIM};">${vars.nombre}</strong>!
      Tu paquete <strong style="color:${TEXT_PRIM};">${vars.descripcion}</strong> ya tiene número de seguimiento asignado.
    </p>

    ${badgeTracking('Tu número CeladaShopper', vars.tracking)}

    ${cardDatos(`
      ${bloqueDatos('&#128230; Producto', vars.descripcion)}
      ${vars.tracking_origen ? bloqueDatos('&#128666; Guía de llegada', vars.tracking_origen) : ''}
      ${bloqueDatos('&#128278; Número CeladaShopper', vars.tracking)}
    `)}

    <p style="color:${TEXT_BODY};font-size:14px;line-height:1.6;margin:20px 0 0 0;">
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

export function plantillaPrueba(nombre: string): { subject: string; html: string; text: string } {
  const subject = 'Prueba de email — CeladaShopper'
  const contenido = `
    <h2 style="color:${TEXT_PRIM};font-size:22px;margin:0 0 8px 0;">
      &#128075; ¡Hola ${nombre}!
    </h2>
    <p style="color:${TEXT_BODY};font-size:15px;line-height:1.65;margin:0 0 20px 0;">
      Este es un correo de prueba para verificar que las notificaciones por email están funcionando correctamente.
    </p>
    <div style="background-color:${BG_INNER};border:1px solid ${GREEN};border-radius:10px;padding:16px 20px;margin:0 0 20px 0;">
      <p style="color:${GREEN};font-size:14px;margin:0;line-height:1.5;font-weight:bold;">
        &#10003; Si recibiste este mensaje, las notificaciones automáticas de tus paquetes te llegarán correctamente.
      </p>
    </div>
    <p style="color:${TEXT_MUTE};font-size:13px;margin:0;line-height:1.5;">
      Equipo CeladaShopper
    </p>
  `
  return {
    subject,
    html: layout(subject, contenido, { nombre }),
    text: `Hola ${nombre}, este es un correo de prueba para verificar que las notificaciones por email funcionan.`,
  }
}
