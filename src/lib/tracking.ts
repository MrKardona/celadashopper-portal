// src/lib/tracking.ts
// Labels, mapeos y helper para insertar eventos de tracking

// ─── Labels visibles al cliente ─────────────────────────────────────────────
export const TRACKING_LABELS: Record<string, { label: string; emoji: string }> = {
  // CeladaShopper
  reportado:            { label: 'Pedido registrado',           emoji: '📋' },
  recibido_miami:       { label: 'Recibido en Miami',           emoji: '📦' },
  procesado:            { label: 'Procesado y empacado',        emoji: '🗃️' },
  listo_entrega:        { label: 'Listo para entrega',          emoji: '🛵' },
  entregado:            { label: 'Entregado',                   emoji: '✅' },
  // Transporte
  guia_creada:          { label: 'Guía de envío generada',      emoji: '🏷️' },
  pre_alertado:         { label: 'Alertado para despacho',      emoji: '📋' },
  recibido_origen:      { label: 'Recibido en bodega Miami',    emoji: '📦' },
  incluido_guia:        { label: 'Incluido en guía de envío',   emoji: '🏷️' },
  transito_internacional: { label: 'En tránsito internacional', emoji: '✈️' },
  proceso_aduana:       { label: 'En proceso de aduana',        emoji: '🛃' },
  llego_colombia:       { label: 'Llegó a Colombia',            emoji: '🇨🇴' },
  en_ruta:              { label: 'En ruta de entrega',          emoji: '🛵' },
  en_ruta_transito:     { label: 'En camino con transportadora',emoji: '🚚' },
  en_transportadora:    { label: 'Con transportadora local',    emoji: '📬' },
  entrega_fallida:      { label: 'Intento de entrega fallido',  emoji: '⚠️' },
  entregado_transporte: { label: 'Entregado',                   emoji: '✅' },
}

// Pasos principales por ciudad
export const PASOS_PRINCIPALES_MEDELLIN = [
  'reportado', 'recibido_miami', 'procesado', 'guia_creada',
  'transito_internacional', 'proceso_aduana', 'llego_colombia',
  'listo_entrega', 'entregado',
] as const

export const PASOS_PRINCIPALES_BOGOTA = [
  'reportado', 'recibido_miami', 'procesado', 'guia_creada',
  'transito_internacional', 'proceso_aduana', 'llego_colombia',
  'en_ruta', 'entregado',
] as const

// Retrocompatibilidad
export const PASOS_PRINCIPALES = PASOS_PRINCIPALES_MEDELLIN

// ─── Helper server-side para insertar evento ─────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function insertarEventoTracking(
  supabase: any,
  paqueteId: string,
  evento: string,
  fuente: 'celada' | 'usaco' = 'celada',
  descripcion?: string,
): Promise<void> {
  const { error } = await supabase.from('paquetes_tracking').insert({
    paquete_id: paqueteId,
    evento,
    fuente,
    descripcion: descripcion ?? null,
    fecha: new Date().toISOString(),
  })
  if (error) console.error(`[tracking] Error "${evento}" paquete ${paqueteId}:`, error.message)
}
