import { getSupabaseAdmin } from '@/lib/supabase/admin'

const US_ESTADOS: string[] = ['recibido_usa', 'en_consolidacion', 'listo_envio']

/**
 * Returns the number of clients who have 2 or more packages currently
 * in the US warehouse (recibido_usa | en_consolidacion | listo_envio).
 */
export async function getConsolidacionCount(): Promise<number> {
  const supabase = getSupabaseAdmin()

  const { data } = await supabase
    .from('paquetes')
    .select('cliente_id')
    .in('estado', US_ESTADOS)
    .not('cliente_id', 'is', null)

  if (!data) return 0

  const counts: Record<string, number> = {}
  for (const row of data) {
    if (!row.cliente_id) continue
    counts[row.cliente_id] = (counts[row.cliente_id] ?? 0) + 1
  }

  return Object.values(counts).filter(n => n >= 2).length
}
