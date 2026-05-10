// Utilidades de fecha para Bogotá, Colombia (America/Bogota, UTC-5, sin DST)
// Usar SIEMPRE estas funciones para mostrar fechas al usuario.
// Los timestamps se almacenan en UTC en la DB — solo el display cambia.

export const TZ = 'America/Bogota'

/** "8 may 2026" */
export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: TZ,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
}

/** "8 may 2026, 21:25" */
export function fechaHora(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: TZ,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

/** "8 may, 21:25" (sin año) */
export function fechaHoraCorta(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: TZ,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

/** "8 de mayo de 2026 · 21:25" — para portal cliente (24h, sin p.m. raro) */
export function fechaHoraLarga(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const fecha = new Intl.DateTimeFormat('es-CO', {
    timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric',
  }).format(d)
  const hora = new Intl.DateTimeFormat('es-CO', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d)
  return `${fecha} · ${hora}`
}

/** "8 de mayo de 2026" — para emails */
export function fechaLarga(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: TZ,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso))
}

/** "21:25" */
export function soloHora(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

/** Hora actual en Bogotá: "21:25" */
export function horaActualBogota(): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date())
}

/** Inicio del día actual en Bogotá (medianoche Bogotá → UTC) */
export function inicioDiaBogota(): Date {
  // Obtener fecha "YYYY-MM-DD" en Bogotá
  const fechaBogota = new Intl.DateTimeFormat('en-CA', { timeZone: TZ })
    .format(new Date()) // devuelve "2026-05-08"
  // Bogotá es UTC-5 fijo (sin DST)
  return new Date(`${fechaBogota}T00:00:00-05:00`)
}
