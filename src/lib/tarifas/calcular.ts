// src/lib/tarifas/calcular.ts
// Cálculo de tarifa según categoría, condición, cantidad, valor declarado y peso.
//
// Modelo: cada fila de `tarifas_rangos` define filtros (categoria, condicion,
// min/max_unidades, valor_min/valor_max) y componentes de costo (precio_por_unidad,
// cargo_fijo, tarifa_por_libra, peso_minimo_facturable, seguro_porcentaje).
//
// Búsqueda: filtra todas las reglas activas que matchean condicion+cantidad+valor
// y elige la de menor `prioridad`. Esto permite tener varias reglas mutuamente
// excluyentes (ej. "normal" vs "comercial por valor" vs "comercial por cantidad").

import { createClient } from '@supabase/supabase-js'

export interface ParametrosCalculo {
  categoria: string
  condicion?: 'nuevo' | 'usado' | null
  cantidad?: number | null
  peso_libras?: number | null
  valor_declarado?: number | null
}

export interface ResultadoCalculo {
  subtotal_envio: number
  seguro: number
  total: number
  metodo: 'rango' | 'fijo_por_unidad' | 'por_libra' | 'sin_tarifa' | 'estimado_pendiente_peso'
  detalle: string
  // Si la regla requiere peso real para calcular total exacto, lo indicamos.
  requiere_peso?: boolean
  peso_minimo?: number
  // Para que el admin sepa qué regla aplicó (auditoría / facturación)
  regla_id?: string
}

interface ReglaRango {
  id: string
  categoria: string
  condicion: string | null
  min_unidades: number
  max_unidades: number | null
  valor_min: string | number | null
  valor_max: string | number | null
  precio_por_unidad: string | number
  cargo_fijo: string | number
  tarifa_por_libra: string | number
  peso_minimo_facturable: string | number | null
  seguro_porcentaje: string | number
  prioridad: number
  notas: string | null
}

function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0
  return typeof v === 'string' ? parseFloat(v) : v
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
  const valor = p.valor_declarado ?? 0
  const peso = p.peso_libras ?? 0
  const supabase = getSupabase()

  // 1. Cargar todas las reglas activas de la categoría
  const { data: reglas } = await supabase
    .from('tarifas_rangos')
    .select('*')
    .eq('categoria', p.categoria)
    .eq('activo', true)
    .order('prioridad', { ascending: true })

  if (reglas && reglas.length > 0) {
    // Filtrar reglas que matchean
    const candidatas = (reglas as ReglaRango[]).filter(r => {
      // Condición: NULL en regla = aplica a cualquiera
      if (r.condicion !== null && r.condicion !== p.condicion) {
        // Si el cliente no especificó condición y la regla la requiere, no matchea
        if (p.condicion) return false
        // Si el cliente no envió condición, asumimos 'nuevo' como default
        if (r.condicion !== 'nuevo') return false
      }
      // Cantidad
      if (cantidad < r.min_unidades) return false
      if (r.max_unidades !== null && cantidad > r.max_unidades) return false
      // Valor declarado
      const vmin = num(r.valor_min)
      const vmax = num(r.valor_max)
      if (r.valor_min !== null && valor < vmin) return false
      if (r.valor_max !== null && valor > vmax) return false
      return true
    })

    if (candidatas.length > 0) {
      const r = candidatas[0] // la de menor prioridad
      const precioUnit = num(r.precio_por_unidad)
      const cargoFijo = num(r.cargo_fijo)
      const tarifaLibra = num(r.tarifa_por_libra)
      const pesoMin = r.peso_minimo_facturable !== null ? num(r.peso_minimo_facturable) : 0
      const seguroPct = num(r.seguro_porcentaje)

      let subtotal = cargoFijo + precioUnit * cantidad
      const seguro = (valor * seguroPct) / 100
      let detalle: string
      let requierePeso = false

      if (tarifaLibra > 0) {
        // Si hay tarifa por libra, necesitamos peso (real o estimado)
        if (peso > 0) {
          const pesoFacturable = Math.max(peso, pesoMin)
          subtotal += tarifaLibra * pesoFacturable
          const partes: string[] = []
          if (cargoFijo > 0) partes.push(`$${cargoFijo.toFixed(2)} fijo`)
          if (precioUnit > 0) partes.push(`${cantidad} × $${precioUnit.toFixed(2)}`)
          partes.push(`${pesoFacturable.toFixed(1)} lb × $${tarifaLibra.toFixed(2)}`)
          if (pesoFacturable > peso) partes[partes.length - 1] += ` (mín ${pesoMin} lb)`
          detalle = partes.join(' + ')
          if (seguroPct > 0) detalle += ` + ${seguroPct}% seguro`
          return {
            subtotal_envio: Math.round(subtotal * 100) / 100,
            seguro: Math.round(seguro * 100) / 100,
            total: Math.round((subtotal + seguro) * 100) / 100,
            metodo: 'rango',
            detalle,
            regla_id: r.id,
          }
        } else {
          // No tenemos peso → cotización parcial
          requierePeso = true
          const partes: string[] = []
          if (cargoFijo > 0) partes.push(`$${cargoFijo.toFixed(2)} fijo`)
          if (precioUnit > 0) partes.push(`${cantidad} × $${precioUnit.toFixed(2)}`)
          partes.push(`+ $${tarifaLibra.toFixed(2)}/lb`)
          if (pesoMin > 0) partes[partes.length - 1] += ` (mín ${pesoMin} lb)`
          detalle = partes.join(' ') + ' — peso lo confirma el agente al recibir'
          // Estimado mínimo si hay peso_minimo
          const minimo = subtotal + (pesoMin > 0 ? tarifaLibra * pesoMin : 0)
          return {
            subtotal_envio: Math.round(minimo * 100) / 100,
            seguro: Math.round(seguro * 100) / 100,
            total: Math.round((minimo + seguro) * 100) / 100,
            metodo: 'estimado_pendiente_peso',
            detalle,
            requiere_peso: true,
            peso_minimo: pesoMin || undefined,
            regla_id: r.id,
          }
        }
      }

      // Sin tarifa por libra: solo precio fijo y/o por unidad
      const partes: string[] = []
      if (cargoFijo > 0) partes.push(`$${cargoFijo.toFixed(2)} fijo`)
      if (precioUnit > 0) partes.push(`${cantidad} × $${precioUnit.toFixed(2)} = $${(precioUnit * cantidad).toFixed(2)}`)
      if (seguroPct > 0) partes.push(`+ ${seguroPct}% seguro ($${seguro.toFixed(2)})`)
      detalle = partes.join(' ')
      return {
        subtotal_envio: Math.round(subtotal * 100) / 100,
        seguro: Math.round(seguro * 100) / 100,
        total: Math.round((subtotal + seguro) * 100) / 100,
        metodo: 'rango',
        detalle,
        regla_id: r.id,
      }
    }
  }

  // Fallback al modelo legacy categorias_tarifas (categorías no migradas)
  const { data: legacy } = await supabase
    .from('categorias_tarifas')
    .select('*')
    .eq('categoria', p.categoria)
    .eq('activo', true)
    .maybeSingle()

  if (!legacy) {
    return {
      subtotal_envio: 0, seguro: 0, total: 0,
      metodo: 'sin_tarifa',
      detalle: 'Tarifa no configurada para esta categoría',
    }
  }

  const seguroPctL = num(legacy.seguro_porcentaje ?? 0)
  const seguroL = (valor * seguroPctL) / 100

  if (legacy.tarifa_tipo === 'fijo_por_unidad') {
    const precio = num(legacy.precio_fijo)
    const subtotal = precio * cantidad
    return {
      subtotal_envio: subtotal, seguro: seguroL, total: subtotal + seguroL,
      metodo: 'fijo_por_unidad',
      detalle: `${cantidad} × $${precio.toFixed(2)}` + (seguroPctL > 0 ? ` + ${seguroPctL}% seguro` : ''),
    }
  }

  // Por libra
  if (peso <= 0) {
    return {
      subtotal_envio: 0, seguro: 0, total: 0,
      metodo: 'por_libra',
      detalle: `Se cobra por libra ($${num(legacy.tarifa_por_libra).toFixed(2)}/lb). Costo final al pesar.`,
      requiere_peso: true,
    }
  }
  const tarifaLibra = num(legacy.tarifa_por_libra)
  const subtotal = tarifaLibra * peso
  return {
    subtotal_envio: subtotal, seguro: seguroL, total: subtotal + seguroL,
    metodo: 'por_libra',
    detalle: `${peso.toFixed(1)} lb × $${tarifaLibra.toFixed(2)}`,
  }
}
