// src/lib/tarifas/calcular.ts
// Lógica de cálculo de tarifa según categoría, condición, cantidad y valor declarado.
//
// Estrategia:
//  1. Si la categoría tiene tarifas escalonadas (en `tarifas_rangos`), usa la
//     que matchee la condición y cantidad.
//  2. Si no, cae al modelo legacy (`categorias_tarifas`) — fijo por unidad o
//     por libra. (Para mantener compatibilidad con tarifas existentes.)
//  3. Devuelve un desglose: subtotal envío + seguro + total estimado.
//
// El cliente ve este cálculo como ESTIMADO al reportar; el costo final lo
// confirma el admin al recibir el paquete (puede tener ajustes por peso real).

import { createClient } from '@supabase/supabase-js'

export interface ParametrosCalculo {
  categoria: string
  condicion?: 'nuevo' | 'usado' | null
  cantidad?: number | null
  peso_libras?: number | null
  valor_declarado?: number | null
}

export interface ResultadoCalculo {
  // Subtotal por envío (antes de seguro)
  subtotal_envio: number
  // Costo de seguro calculado (0 si no aplica)
  seguro: number
  // Total = subtotal + seguro
  total: number
  // Cómo se calculó (para mostrar al cliente)
  metodo: 'escalonado' | 'fijo_por_unidad' | 'por_libra' | 'sin_tarifa'
  detalle: string
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

export async function calcularTarifa(p: ParametrosCalculo): Promise<ResultadoCalculo | null> {
  const cantidad = Math.max(1, p.cantidad ?? 1)
  const valorDeclarado = p.valor_declarado ?? 0
  const supabase = getSupabase()

  // 1. Buscar tarifa escalonada (tarifas_rangos)
  const { data: rangos } = await supabase
    .from('tarifas_rangos')
    .select('*')
    .eq('categoria', p.categoria)
    .eq('activo', true)

  if (rangos && rangos.length > 0) {
    // Filtrar por condición primero (NULL en BD = aplica a ambas)
    const candidatos = rangos.filter(r =>
      r.condicion === null ||
      r.condicion === p.condicion ||
      (!p.condicion && r.condicion === 'nuevo'), // si no envió condición, asumir nuevo
    )
    // Encontrar el rango que matchea la cantidad
    const match = candidatos.find(r =>
      cantidad >= r.min_unidades &&
      (r.max_unidades === null || cantidad <= r.max_unidades),
    )

    if (match) {
      const precioPorUnidad = Number(match.precio_por_unidad)
      const seguroPct = Number(match.seguro_porcentaje)
      const subtotal = precioPorUnidad * cantidad
      const seguro = (valorDeclarado * seguroPct) / 100
      const detalle =
        `${cantidad} × $${precioPorUnidad.toFixed(2)} = $${subtotal.toFixed(2)}` +
        (seguroPct > 0 ? ` + ${seguroPct}% seguro ($${seguro.toFixed(2)})` : '')
      return {
        subtotal_envio: subtotal,
        seguro,
        total: subtotal + seguro,
        metodo: 'escalonado',
        detalle,
      }
    }
  }

  // 2. Fallback a modelo legacy (categorias_tarifas)
  const { data: legacy } = await supabase
    .from('categorias_tarifas')
    .select('*')
    .eq('categoria', p.categoria)
    .eq('activo', true)
    .maybeSingle()

  if (!legacy) {
    return {
      subtotal_envio: 0,
      seguro: 0,
      total: 0,
      metodo: 'sin_tarifa',
      detalle: 'Tarifa no configurada para esta categoría',
    }
  }

  const seguroPct = Number(legacy.seguro_porcentaje ?? 0)
  const seguro = (valorDeclarado * seguroPct) / 100

  if (legacy.tarifa_tipo === 'fijo_por_unidad') {
    const precio = Number(legacy.precio_fijo ?? 0)
    const subtotal = precio * cantidad
    return {
      subtotal_envio: subtotal,
      seguro,
      total: subtotal + seguro,
      metodo: 'fijo_por_unidad',
      detalle:
        `${cantidad} × $${precio.toFixed(2)} = $${subtotal.toFixed(2)}` +
        (seguroPct > 0 ? ` + ${seguroPct}% seguro` : ''),
    }
  }

  // por_libra — necesita peso
  if (!p.peso_libras || p.peso_libras <= 0) {
    return {
      subtotal_envio: 0,
      seguro: 0,
      total: 0,
      metodo: 'por_libra',
      detalle: `Se cobra por libra ($${Number(legacy.tarifa_por_libra).toFixed(2)}/lb). Costo final al pesar el paquete.`,
    }
  }

  const tarifaLibra = Number(legacy.tarifa_por_libra)
  const subtotal = tarifaLibra * p.peso_libras
  return {
    subtotal_envio: subtotal,
    seguro,
    total: subtotal + seguro,
    metodo: 'por_libra',
    detalle: `${p.peso_libras.toFixed(1)} lb × $${tarifaLibra.toFixed(2)} = $${subtotal.toFixed(2)}`,
  }
}
