// src/lib/email/notificaciones.ts
// Helpers de envío de emails transaccionales por evento.
// Las funciones reciben datos del paquete + perfil y disparan el email correcto.

import { enviarEmail, type ResultadoEmail } from './transporter'
import {
  plantillaPaqueteReportado,
  plantillaPaqueteRecibidoUSA,
  plantillaPaqueteEnTransito,
  plantillaPaqueteListoRecoger,
  plantillaPaqueteEntregado,
  plantillaCostoCalculado,
  plantillaTrackingActualizado,
  plantillaEstadoGenerico,
  plantillaPrueba,
} from './plantillas'

const BODEGA_LABELS: Record<string, string> = {
  medellin: 'Medellín',
  bogota: 'Bogotá',
  barranquilla: 'Barranquilla',
}

interface TarifaCalculadaDatos {
  subtotal_envio: number
  seguro: number
  total: number
  metodo: string
  detalle: string
  requiere_peso?: boolean
}

interface DatosEmail {
  emailDestino: string
  nombre: string
  paqueteId: string
  tracking: string
  descripcion: string
  tracking_origen?: string | null
  tracking_usaco?: string | null
  peso_libras?: number | string | null
  costo_servicio?: number | string | null
  bodega_destino?: string
  tienda?: string | null
  fotoUrl?: string | null
  fotoUrlContenido?: string | null
  fotoUrlEmpaque?: string | null
  // Datos extra del pedido (al reportar)
  categoria?: string | null
  valor_declarado?: number | string | null
  fecha_compra?: string | null
  fecha_estimada_llegada?: string | null
  notas_cliente?: string | null
  estadoActual?: string | null
  // Tarifa calculada al recibir en USA (incluye desglose)
  tarifaCalculada?: TarifaCalculadaDatos | null
}

function buildVars(d: DatosEmail) {
  const peso = d.peso_libras ? `${d.peso_libras} lbs` : 'Por determinar'
  const costo = d.costo_servicio ? `$${d.costo_servicio} USD` : 'Por determinar'
  const bodega = d.bodega_destino ? (BODEGA_LABELS[d.bodega_destino] ?? d.bodega_destino) : undefined
  const link = `https://portal.celadashopper.com/paquetes/${d.paqueteId}`
  const valor = d.valor_declarado ? `$${d.valor_declarado} USD` : undefined

  return {
    nombre: d.nombre,
    descripcion: d.descripcion,
    tracking: d.tracking,
    tracking_origen: d.tracking_origen,
    tracking_usaco: d.tracking_usaco,
    peso,
    costo,
    bodega,
    tienda: d.tienda ?? undefined,
    link,
    fotoUrl: d.fotoUrl,
    fotoUrlContenido: d.fotoUrlContenido,
    fotoUrlEmpaque: d.fotoUrlEmpaque,
    categoria: d.categoria ?? undefined,
    valor,
    fecha_compra: d.fecha_compra ?? undefined,
    fecha_estimada_llegada: d.fecha_estimada_llegada ?? undefined,
    notas_cliente: d.notas_cliente ?? undefined,
    estadoActual: d.estadoActual ?? undefined,
    tarifaCalculada: d.tarifaCalculada ?? undefined,
  }
}

// ─── Por estado ─────────────────────────────────────────────────────────────
export async function enviarEmailPorEstado(
  estadoNuevo: string,
  d: DatosEmail,
): Promise<ResultadoEmail> {
  const vars = buildVars({ ...d, estadoActual: estadoNuevo })

  let plantilla: { subject: string; html: string; text: string }

  switch (estadoNuevo) {
    case 'recibido_usa':
      plantilla = plantillaPaqueteRecibidoUSA(vars)
      break
    case 'en_transito':
      plantilla = plantillaPaqueteEnTransito(vars)
      break
    case 'en_bodega_local':
      plantilla = plantillaPaqueteListoRecoger(vars)
      break
    case 'entregado':
      plantilla = plantillaPaqueteEntregado(vars)
      break
    default:
      plantilla = plantillaEstadoGenerico(estadoNuevo, vars)
      break
  }

  return enviarEmail({
    to: d.emailDestino,
    subject: plantilla.subject,
    html: plantilla.html,
    text: plantilla.text,
  })
}

// ─── Pedido reportado (al crear paquete nuevo) ──────────────────────────────
export async function enviarEmailPedidoReportado(d: DatosEmail): Promise<ResultadoEmail> {
  const vars = buildVars(d)
  const p = plantillaPaqueteReportado(vars)
  return enviarEmail({ to: d.emailDestino, subject: p.subject, html: p.html, text: p.text })
}

// ─── Costo calculado ────────────────────────────────────────────────────────
export async function enviarEmailCostoCalculado(d: DatosEmail): Promise<ResultadoEmail> {
  const vars = buildVars(d)
  const p = plantillaCostoCalculado(vars)
  return enviarEmail({ to: d.emailDestino, subject: p.subject, html: p.html, text: p.text })
}

// ─── Tracking USACO actualizado ─────────────────────────────────────────────
export async function enviarEmailTrackingActualizado(d: DatosEmail): Promise<ResultadoEmail> {
  const vars = buildVars(d)
  const p = plantillaTrackingActualizado(vars)
  return enviarEmail({ to: d.emailDestino, subject: p.subject, html: p.html, text: p.text })
}

// ─── Email de prueba ────────────────────────────────────────────────────────
export async function enviarEmailPrueba(emailDestino: string, nombre = 'amigo'): Promise<ResultadoEmail> {
  const p = plantillaPrueba(nombre)
  return enviarEmail({ to: emailDestino, subject: p.subject, html: p.html, text: p.text })
}
