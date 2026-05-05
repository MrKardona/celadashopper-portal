// src/lib/email/plantillas.ts
// Plantillas HTML de emails transaccionales para CeladaShopper.

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
  tienda?: string
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

// ═══════════════════════════════════════════════════════════════════════════
// PLANTILLAS POR TIPO DE EVENTO
// ═══════════════════════════════════════════════════════════════════════════

export function plantillaPaqueteReportado(vars: VariablesPlantilla): { subject: string; html: string; text: string } {
  const subject = `📦 Pedido reportado: ${vars.descripcion}`
  const contenido = `
    <h2 style="color:#1c1917;font-size:24px;margin:0 0 12px 0;">¡Hola ${vars.nombre}! 👋</h2>
    <p style="color:#44403c;font-size:15px;line-height:1.6;margin:0 0 20px 0;">
      Recibimos tu pedido en <strong>CeladaShopper</strong>. Te confirmaremos por correo cada paso.
    </p>
    <div style="background:#ffffff;border:1px solid #fed7aa;border-radius:8px;padding:20px;margin:20px 0;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        ${bloqueDatos('📦 Producto', vars.descripcion)}
        ${vars.tienda ? bloqueDatos('🏬 Tienda', vars.tienda) : ''}
        ${vars.tracking_origen ? bloqueDatos('🚚 Tracking del courier', vars.tracking_origen) : ''}
        ${bloqueDatos('🔖 Tu número CeladaShopper', vars.tracking)}
      </table>
    </div>
    <p style="color:#44403c;font-size:14px;line-height:1.6;margin:0 0 8px 0;">Te avisaremos cuando:</p>
    <ul style="color:#44403c;font-size:14px;line-height:1.8;margin:0 0 24px 24px;padding:0;">
      <li>Llegue a nuestra bodega de Miami 📍</li>
      <li>Esté en camino a Colombia ✈️</li>
      <li>Esté listo para recoger 🎉</li>
    </ul>
    ${botonVerSeguimiento(vars.link)}
  `
  return {
    subject,
    html: layout(subject, contenido, vars),
    text: `Hola ${vars.nombre}, recibimos tu pedido "${vars.descripcion}". Tu número CeladaShopper: ${vars.tracking}. Sigue tu paquete en ${vars.link}`,
  }
}

export function plantillaPaqueteRecibidoUSA(vars: VariablesPlantilla): { subject: string; html: string; text: string } {
  const subject = `📍 Tu paquete llegó a Miami: ${vars.descripcion}`
  const contenido = `
    <h2 style="color:#1c1917;font-size:24px;margin:0 0 12px 0;">¡Tu paquete llegó! 🎉</h2>
    <p style="color:#44403c;font-size:15px;line-height:1.6;margin:0 0 20px 0;">
      ¡Hola ${vars.nombre}! Tu paquete <strong>${vars.descripcion}</strong> ya está en nuestra bodega de Miami.
    </p>
    ${vars.fotoUrlContenido ? `
      <div style="margin:20px 0;text-align:center;">
        <img src="${vars.fotoUrlContenido}" alt="Foto del paquete" style="max-width:100%;border-radius:8px;border:1px solid #fed7aa;" />
        <p style="color:#78716c;font-size:11px;margin:6px 0 0 0;">Foto del contenido</p>
      </div>
    ` : ''}
    <div style="background:#ffffff;border:1px solid #fed7aa;border-radius:8px;padding:20px;margin:20px 0;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        ${bloqueDatos('📦 Producto', vars.descripcion)}
        ${vars.peso ? bloqueDatos('⚖️ Peso', vars.peso) : ''}
        ${bloqueDatos('🔖 Tracking', vars.tracking)}
      </table>
    </div>
    <p style="color:#44403c;font-size:14px;line-height:1.6;margin:0 0 24px 0;">
      Pronto lo despacharemos a Colombia ✈️. Te avisaremos cuando esté en tránsito y cuando llegue a la bodega local.
    </p>
    ${botonVerSeguimiento(vars.link)}
  `
  return {
    subject,
    html: layout(subject, contenido, vars),
    text: `Hola ${vars.nombre}, tu paquete "${vars.descripcion}" llegó a la bodega de Miami. Peso: ${vars.peso}. Sigue su tracking en ${vars.link}`,
  }
}

export function plantillaPaqueteEnTransito(vars: VariablesPlantilla): { subject: string; html: string; text: string } {
  const subject = `✈️ Tu paquete está en camino a Colombia`
  const contenido = `
    <h2 style="color:#1c1917;font-size:24px;margin:0 0 12px 0;">¡En camino a Colombia! ✈️</h2>
    <p style="color:#44403c;font-size:15px;line-height:1.6;margin:0 0 20px 0;">
      ¡Hola ${vars.nombre}! Tu paquete <strong>${vars.descripcion}</strong> ya salió de Miami rumbo a Colombia.
    </p>
    <div style="background:#ffffff;border:1px solid #fed7aa;border-radius:8px;padding:20px;margin:20px 0;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        ${bloqueDatos('📦 Producto', vars.descripcion)}
        ${vars.bodega ? bloqueDatos('📍 Ciudad destino', vars.bodega) : ''}
        ${vars.tracking_usaco ? bloqueDatos('🚚 Tracking USACO', vars.tracking_usaco) : ''}
        ${bloqueDatos('🔖 Tracking CeladaShopper', vars.tracking)}
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
    <p style="color:#44403c;font-size:15px;line-height:1.6;margin:0 0 20px 0;">
      ¡Hola ${vars.nombre}! Tu paquete <strong>${vars.descripcion}</strong> ya llegó a nuestra bodega ${vars.bodega ? `en ${vars.bodega}` : 'local'}.
    </p>
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
    <p style="color:#44403c;font-size:15px;line-height:1.6;margin:0 0 20px 0;">
      ¡Hola ${vars.nombre}! Confirmamos que tu paquete <strong>${vars.descripcion}</strong> fue entregado.
    </p>
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

// Plantilla genérica para estados no específicos
export function plantillaEstadoGenerico(estado: string, vars: VariablesPlantilla): { subject: string; html: string; text: string } {
  const subject = `📦 Actualización de tu paquete: ${vars.descripcion}`
  const contenido = `
    <h2 style="color:#1c1917;font-size:24px;margin:0 0 12px 0;">Actualización</h2>
    <p style="color:#44403c;font-size:15px;line-height:1.6;margin:0 0 20px 0;">
      ¡Hola ${vars.nombre}! Tu paquete <strong>${vars.descripcion}</strong> tiene una actualización: <strong>${estado}</strong>.
    </p>
    <div style="background:#ffffff;border:1px solid #fed7aa;border-radius:8px;padding:20px;margin:20px 0;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        ${bloqueDatos('📦 Producto', vars.descripcion)}
        ${bloqueDatos('🔖 Tracking', vars.tracking)}
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
