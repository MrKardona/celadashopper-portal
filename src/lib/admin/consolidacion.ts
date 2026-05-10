import { createClient } from '@supabase/supabase-js'

const US_ESTADOS = ['recibido_usa', 'en_consolidacion', 'listo_envio'] as const

/**
 * Returns the number of clients who have 2 or more packages currently
 * in the US warehouse (recibido_usa | en_consolidacion | listo_envio).
 */
export async function getConsolidacionCount(): Promise<number> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: 'public' }, auth: { persistSession: false } }
  )

  const { data } = await supabase
    .from('paquetes')
    .select('cliente_id')
    .in('estado', US_ESTADOS as unknown as string[])
    .not('cliente_id', 'is', null)

  if (!data) return 0

  const counts: Record<string, number> = {}
  for (const row of data) {
    if (!row.cliente_id) continue
    counts[row.cliente_id] = (counts[row.cliente_id] ?? 0) + 1
  }

  return Object.values(counts).filter(n => n >= 2).length
}
