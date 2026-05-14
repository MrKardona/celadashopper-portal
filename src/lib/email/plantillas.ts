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
  bodegaKey?: string            // 'medellin' | 'bogota' | 'barranquilla' — decide el timeline
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
  notas_entrega?: string        // quién recibió / notas del domiciliario
  direccion_entrega?: string    // dirección de entrega (con barrio)
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
// 7 pasos. El paso 6 cambia según la ciudad:
//   Medellín → "En bodega" (CeladaShopper entrega)
//   Bogotá/otras → "En ruta" (USACO entrega)

type Hito = { icono: string; label: string }

const HITOS_BASE: Hito[] = [
  { icono: '&#128221;',           label: 'Reportado'  },
  { icono: '&#127482;&#127480;',  label: 'Miami'      },
  { icono: '&#128230;',           label: 'Procesado'  },
  { icono: '&#9992;&#65039;',     label: 'Tránsito'   },
  { icono: '&#127464;&#127476;',  label: 'Colombia'   },
  { icono: '&#128205;',           label: 'En bodega'  }, // slot 5 — varía por ciudad
  { icono: '&#10003;',            label: 'Entregado'  },
]

const HITO_RUTA_BOGOTA: Hito = { icono: '&#128666;', label: 'En ruta' }

// Estados internos (CeladaShopper) → índice de hito
const ESTADO_A_HITO: Record<string, number> = {
  reportado:          0,
  recibido_usa:       1,
  en_consolidacion:   2,
  listo_envio:        2,
  en_transito:        3,
  proceso_aduana:     4,
  en_colombia:        4,
  llego_colombia:     4,
  en_bodega_local:    5,
  listo_entrega:      5,
  en_camino_cliente:  5,
  // USACO estados (usados para Bogotá)
  guia_creada:        2,
  incluido_guia:      2,
  transito_internacional: 3,
  en_ruta:            5,
  en_ruta_transito:   5,
  en_transportadora:  5,
  entrega_fallida:    5,
  entregado:          6,
  entregado_transporte: 6,
  retenido:           1,
  devuelto:           6,
}

function trackerProgreso(estadoActual?: string, bodegaKey?: string): string {
  if (!estadoActual) return ''

  const esMedellin = !bodegaKey || bodegaKey === 'medellin'
  const hitos: Hito[] = HITOS_BASE.map((h, i) =>
    i === 5 && !esMedellin ? HITO_RUTA_BOGOTA : h
  )

  const hitoActivo = ESTADO_A_HITO[estadoActual] ?? 0
  const porcentaje = Math.round((hitoActivo / (hitos.length - 1)) * 100)
  const anchoCol   = `${Math.round(100 / hitos.length)}%`

  const celdas = hitos.map((h, i) => {
    const completado  = i < hitoActivo
    const actual      = i === hitoActivo
    const circleBg    = actual ? GOLD    : completado ? PURPLE   : BORDER_VIS
    const circleColor = actual ? '#000'  : completado ? '#000'   : TEXT_MUTE
    const labelColor  = actual ? GOLD    : completado ? PURPLE   : TEXT_MUTE
    const labelWeight = actual ? 'bold'  : 'normal'
    const ringStyle   = actual ? `outline:2px solid ${GOLD_DIM};outline-offset:2px;` : ''

    return `
      <td align="center" style="vertical-align:top;padding:0 2px;width:${anchoCol};">
        <div style="background-color:${circleBg};color:${circleColor};width:36px;height:36px;border-radius:50%;line-height:36px;font-size:14px;margin:0 auto;text-align:center;${ringStyle}">
          ${h.icono}
        </div>
        <p style="margin:5px 0 0 0;font-size:9px;font-weight:${labelWeight};color:${labelColor};font-family:Arial,sans-serif;text-align:center;line-height:1.3;">
          ${h.label}
        </p>
      </td>
    `
  }).join('')

  return `
    <div style="margin:24px 0 28px 0;padding:18px 10px 16px 10px;background-color:${BG_INNER};border:1px solid ${BORDER_VIS};border-radius:12px;">
      <p style="margin:0 0 14px 0;text-align:center;font-size:10px;color:${TEXT_MUTE};font-family:Arial,sans-serif;letter-spacing:1.5px;text-transform:uppercase;font-weight:bold;">
        Estado del envío
      </p>
      <div style="height:3px;background-color:${BORDER_VIS};border-radius:2px;margin:0 20px 12px 20px;">
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

// ─── Sección de tracking ────────────────────────────────────────────────────
// - Guía de envío internacional (tracking_usaco): badge amarillo prominente
// - Guía del courier (tracking_origen): badge secundario gris
// - Número CeladaShopper: eliminado del cuerpo del correo
function seccionTracking(vars: Pick<VariablesPlantilla, 'tracking' | 'tracking_origen' | 'tracking_usaco'>, opts?: { mostrarUsaco?: boolean }): string {
  const filas: string[] = []

  // Guía de envío internacional — badge principal amarillo cuando está disponible
  if (opts?.mostrarUsaco && vars.tracking_usaco) {
    filas.push(`
      <tr>
        <td style="padding-bottom:${vars.tracking_origen ? '12px' : '0'};">
          <div style="background-color:${BG_INNER};border:2px solid ${GOLD_DIM};border-radius:10px;padding:16px 20px;">
            <p style="margin:0 0 4px 0;color:${GOLD};font-size:10px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;">
              &#9992;&#65039; Guía de envío internacional
            </p>
            <p style="margin:0;color:${GOLD};font-size:28px;font-weight:bold;font-family:'Courier New',monospace;letter-spacing:3px;">
              ${vars.tracking_usaco}
            </p>
          </div>
        </td>
      </tr>
    `)
  }

  // Guía del courier (tracking_origen) — badge secundario gris
  if (vars.tracking_origen) {
    filas.push(`
      <tr>
        <td>
          <div style="background-color:${BG_INNER};border:1px solid ${BORDER_VIS};border-radius:10px;padding:14px 18px;">
            <p style="margin:0 0 3px 0;color:${TEXT_MUTE};font-size:10px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;">
              &#128666; Guía del courier
            </p>
            <p style="margin:0;color:${TEXT_PRIM};font-size:15px;font-weight:bold;font-family:'Courier New',monospace;letter-spacing:1.5px;">
              ${vars.tracking_origen}
            </p>
          </div>
        </td>
      </tr>
    `)
  }

  if (filas.length === 0) return ''

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0;">
      ${filas.join('')}
    </table>
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

    ${trackerProgreso('reportado', vars.bodegaKey)}

    ${seccionTracking(vars)}

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
      ${vars.bodega ? bloqueDatos('&#128205; Ciudad destino', vars.bodega) : ''}
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

    ${trackerProgreso('recibido_usa', vars.bodegaKey)}

    ${seccionTracking(vars, { mostrarUsaco: true })}

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
      ${vars.peso ? bloqueDatos('&#9878;&#65039; Peso', vars.peso) : ''}
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

    ${trackerProgreso('en_transito', vars.bodegaKey)}

    ${seccionTracking(vars, { mostrarUsaco: true })}

    ${cardDatos(`
      ${bloqueDatos('&#128230; Producto', vars.descripcion)}
      ${vars.bodega ? bloqueDatos('&#128205; Ciudad destino', vars.bodega) : ''}
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

    ${trackerProgreso('en_bodega_local', vars.bodegaKey)}

    ${seccionTracking(vars, { mostrarUsaco: true })}

    ${cardDatos(`
      ${bloqueDatos('&#128230; Producto', vars.descripcion)}
      ${vars.peso ? bloqueDatos('&#9878;&#65039; Peso', vars.peso) : ''}
      ${vars.costo ? bloqueDatos('&#128176; Costo del servicio', vars.costo) : ''}
      ${vars.bodega ? bloqueDatos('&#128205; Bodega', vars.bodega) : ''}
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

    ${trackerProgreso('entregado', vars.bodegaKey)}

    ${seccionTracking(vars, { mostrarUsaco: true })}

    ${vars.fotoUrlContenido ? `
      <div style="margin:20px 0;text-align:center;">
        <p style="color:${TEXT_MUTE};font-size:10px;margin:0 0 8px 0;text-transform:uppercase;letter-spacing:1.5px;font-weight:bold;">Comprobante de entrega</p>
        <img src="${vars.fotoUrlContenido}" alt="Comprobante de entrega"
          style="max-width:100%;border-radius:8px;border:1px solid ${BORDER_VIS};" />
      </div>
    ` : ''}

    ${cardDatos(`
      ${bloqueDatos('&#128230; Producto', vars.descripcion)}
      ${vars.bodega ? bloqueDatos('&#127968; Ciudad', vars.bodega) : ''}
      ${vars.direccion_entrega ? bloqueDatos('&#128205; Dirección', vars.direccion_entrega) : ''}
      ${vars.notas_entrega ? bloqueDatos('&#128221; Recibido por', vars.notas_entrega) : ''}
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

    ${seccionTracking(vars)}

    ${cardDatos(`
      ${bloqueDatos('&#128230; Producto', vars.descripcion)}
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
  reportado:            'Pedido reportado',
  recibido_usa:         'Recibido en bodega Miami',
  en_consolidacion:     'En consolidación',
  listo_envio:          'Listo para envío',
  en_transito:          'En tránsito a Colombia',
  en_colombia:          'Llegó a Colombia',
  en_bodega_local:      'Listo para recoger',
  en_camino_cliente:    'En camino al cliente',
  entregado:            'Entregado',
  retenido:             'Retenido en aduana',
  devuelto:             'Devuelto',
  // USACO
  guia_creada:          '✈️ Guía de envío asignada',
  proceso_aduana:       '🛃 Tu paquete está en aduana',
  llego_colombia:       'Tu paquete llegó a Colombia',
  en_ruta:              'Tu paquete está en camino',
  en_ruta_transito:     'Tu paquete está en tránsito',
  en_transportadora:    'Tu paquete con transportadora',
  entrega_fallida:      '⚠️ Intento de entrega fallido',
  entregado_transporte: 'Entregado',
}

export function plantillaPaqueteLlegoColombia(vars: VariablesPlantilla): { subject: string; html: string; text: string } {
  const esMedellin = !vars.bodegaKey || vars.bodegaKey === 'medellin'
  const subject = `Tu paquete llegó a Colombia: ${vars.descripcion}`
  const contenido = `
    <h2 style="color:${TEXT_PRIM};font-size:22px;margin:0 0 8px 0;">
      &#127464;&#127476; ¡Tu paquete llegó a Colombia!
    </h2>
    <p style="color:${TEXT_BODY};font-size:15px;line-height:1.65;margin:0 0 4px 0;">
      ¡Hola <strong style="color:${TEXT_PRIM};">${vars.nombre}</strong>!
      Tu paquete <strong style="color:${TEXT_PRIM};">${vars.descripcion}</strong> superó la aduana y ya está en Colombia.
    </p>

    ${trackerProgreso('llego_colombia', vars.bodegaKey)}

    ${seccionTracking(vars, { mostrarUsaco: true })}

    ${cardDatos(`
      ${bloqueDatos('&#128230; Producto', vars.descripcion)}
      ${vars.bodega ? bloqueDatos('&#128205; Ciudad destino', vars.bodega) : ''}
    `)}

    <p style="color:${TEXT_BODY};font-size:14px;line-height:1.6;margin:20px 0 0 0;">
      ${esMedellin
        ? 'Pronto lo tendrás listo para recoger en bodega.'
        : 'La transportadora lo llevará hasta tu puerta.'}
    </p>

    ${botonVerSeguimiento(vars.link)}
  `
  return {
    subject,
    html: layout(subject, contenido, vars),
    text: `Hola ${vars.nombre}, tu paquete "${vars.descripcion}" llegó a Colombia. ${esMedellin ? 'Pronto estará listo en bodega.' : 'La transportadora lo llevará a tu puerta.'} Detalle en ${vars.link}`,
  }
}

export function plantillaPaqueteEnRuta(vars: VariablesPlantilla): { subject: string; html: string; text: string } {
  const subject = `Tu paquete está en camino: ${vars.descripcion}`
  const contenido = `
    <h2 style="color:${TEXT_PRIM};font-size:22px;margin:0 0 8px 0;">
      &#128666; ¡En camino a tu puerta!
    </h2>
    <p style="color:${TEXT_BODY};font-size:15px;line-height:1.65;margin:0 0 4px 0;">
      ¡Hola <strong style="color:${TEXT_PRIM};">${vars.nombre}</strong>!
      Tu paquete <strong style="color:${TEXT_PRIM};">${vars.descripcion}</strong> está en ruta de entrega.
    </p>

    ${trackerProgreso('en_ruta', vars.bodegaKey)}

    ${seccionTracking(vars, { mostrarUsaco: true })}

    ${cardDatos(`
      ${bloqueDatos('&#128230; Producto', vars.descripcion)}
      ${vars.bodega ? bloqueDatos('&#128205; Ciudad', vars.bodega) : ''}
    `)}

    <p style="color:${TEXT_BODY};font-size:14px;line-height:1.6;margin:20px 0 0 0;">
      La transportadora está en ruta para entregar tu paquete. Asegúrate de estar disponible para recibirlo.
    </p>

    ${botonVerSeguimiento(vars.link)}
  `
  return {
    subject,
    html: layout(subject, contenido, vars),
    text: `Hola ${vars.nombre}, tu paquete "${vars.descripcion}" está en camino. La transportadora está en ruta. Detalle en ${vars.link}`,
  }
}

export function plantillaEntregaFallida(vars: VariablesPlantilla): { subject: string; html: string; text: string } {
  const subject = `⚠️ Intento de entrega fallido: ${vars.descripcion}`
  const contenido = `
    <h2 style="color:${TEXT_PRIM};font-size:22px;margin:0 0 8px 0;">
      &#9888;&#65039; No pudimos entregar tu paquete
    </h2>
    <p style="color:${TEXT_BODY};font-size:15px;line-height:1.65;margin:0 0 4px 0;">
      ¡Hola <strong style="color:${TEXT_PRIM};">${vars.nombre}</strong>!
      Tuvimos un inconveniente al intentar entregar tu paquete <strong style="color:${TEXT_PRIM};">${vars.descripcion}</strong>.
    </p>

    ${trackerProgreso('entrega_fallida', vars.bodegaKey)}

    ${seccionTracking(vars, { mostrarUsaco: true })}

    ${cardDatos(`
      ${bloqueDatos('&#128230; Producto', vars.descripcion)}
      ${vars.bodega ? bloqueDatos('&#128205; Ciudad', vars.bodega) : ''}
    `)}

    <div style="background-color:#1a0a0a;border:1px solid #7f1d1d;border-radius:10px;padding:16px 20px;margin:20px 0;">
      <p style="color:#f87171;font-size:14px;margin:0;line-height:1.6;">
        <strong>&#9888;&#65039; La transportadora intentó entregarte el paquete pero no fue posible.</strong><br>
        Se realizará un nuevo intento. Asegúrate de estar disponible o contáctanos para coordinar.
      </p>
    </div>

    ${botonVerSeguimiento(vars.link)}
  `
  return {
    subject,
    html: layout(subject, contenido, vars),
    text: `Hola ${vars.nombre}, no pudimos entregar tu paquete "${vars.descripcion}". Se realizará un nuevo intento. Contáctanos si necesitas coordinar. Detalle en ${vars.link}`,
  }
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

    ${trackerProgreso(estado, vars.bodegaKey)}

    ${seccionTracking(vars, { mostrarUsaco: true })}

    ${cardDatos(`
      ${bloqueDatos('&#128230; Producto', vars.descripcion)}
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

    ${seccionTracking(vars)}

    ${cardDatos(`
      ${bloqueDatos('&#128230; Producto', vars.descripcion)}
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
