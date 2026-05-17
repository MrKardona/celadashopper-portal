// src/lib/rate-limit.ts
// Rate limiter en memoria — 50 peticiones por segundo por IP
// Nota: en Vercel serverless cada instancia tiene su propio contador.
// Para producción de alto volumen considera @upstash/ratelimit con Redis.

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

const LIMIT = 50          // máx peticiones por ventana
const WINDOW_MS = 1000    // ventana de 1 segundo

// Limpia entradas expiradas cada 30 segundos para no acumular memoria
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) store.delete(key)
  }
}, 30_000)

/**
 * Retorna true si la IP superó el límite, false si puede continuar.
 */
export function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = store.get(ip)

  if (!entry || entry.resetAt < now) {
    store.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }

  entry.count++
  if (entry.count > LIMIT) return true

  return false
}
