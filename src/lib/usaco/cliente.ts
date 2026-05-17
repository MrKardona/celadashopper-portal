// src/lib/usaco/cliente.ts
// Wrapper para la API de USACO — solo uso server-side (cron, admin)

const USACO_URL = 'https://apiserviceusaco.uc.r.appspot.com/usaco/agencia-paqueteria/'

export interface UsacoGuia {
  tracking: string
  guia: string
  estado: string
  casillero: string
}

// Solo envía números reales (descarta textos como "PENDIENTE POR REVISAR")
const esNumeroGuia = (g: string) => /^\d+$/.test(g.trim())

export async function consultarGuias(guias: string[]): Promise<UsacoGuia[]> {
  if (guias.length === 0) return []

  const apiKey = process.env.USACO_API_KEY ?? ''
  const password = process.env.USACO_PASSWORD ?? ''
  const results: UsacoGuia[] = []

  // Filtrar solo guías numéricas y enviar TAL CUAL (con ceros) — USACO los necesita
  const soloNumericas = guias.filter(esNumeroGuia)
  if (soloNumericas.length === 0) return []

  // Máximo 100 por request según la documentación
  for (let i = 0; i < soloNumericas.length; i += 100) {
    const batch = soloNumericas.slice(i, i + 100).map(g => g.trim())
    try {
      const res = await fetch(USACO_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
        body: JSON.stringify({ agency_password: password, type: 'guias', info: batch }),
        signal: AbortSignal.timeout(15_000),
      })
      if (!res.ok) {
        console.error('[USACO] HTTP error:', res.status, await res.text().catch(() => ''))
        continue
      }
      const data = await res.json() as UsacoGuia[]
      results.push(...data)
    } catch (err) {
      console.error('[USACO] Error en batch:', err)
    }
  }

  return results
}
