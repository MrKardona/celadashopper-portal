// GET /api/admin/domiciliarios/informe-excel?fecha=YYYY-MM-DD
//      /api/admin/domiciliarios/informe-excel?fechaDesde=YYYY-MM-DD&fechaHasta=YYYY-MM-DD
// Genera un Excel con todas las entregas del período (paquetes + manuales) por domiciliario

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

function fechaBogota(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

const TIPO_LABELS: Record<string, string> = {
  personal: 'Personal',
  servicios: 'Servicios',
  productos: 'Productos',
}

const BODEGA_LABELS: Record<string, string> = {
  medellin: 'Medellín', bogota: 'Bogotá', barranquilla: 'Barranquilla',
}

export async function GET(req: NextRequest) {
  // Auth
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdmin()
  const { data: perfil } = await admin.from('perfiles').select('rol').eq('id', user.id).single()
  if (perfil?.rol !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  // Rango de fechas
  const sp = req.nextUrl.searchParams
  const hoyBog = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })

  const fechaDesde = sp.get('fechaDesde') ?? sp.get('fecha') ?? hoyBog
  const fechaHasta = sp.get('fechaHasta') ?? sp.get('fecha') ?? hoyBog

  const inicio = new Date(`${fechaDesde}T05:00:00.000Z`)
  const fin    = new Date(new Date(`${fechaHasta}T05:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000 - 1)

  const esRango = fechaDesde !== fechaHasta

  // Domiciliarios activos
  const { data: domiciliarios } = await admin
    .from('perfiles')
    .select('id, nombre_completo')
    .eq('rol', 'domiciliario')
    .eq('activo', true)
    .order('nombre_completo')

  const domList = domiciliarios ?? []
  const domIds  = domList.map(d => d.id)
  const domMap  = Object.fromEntries(domList.map(d => [d.id, d.nombre_completo]))

  if (domIds.length === 0) {
    return NextResponse.json({ error: 'No hay domiciliarios activos' }, { status: 404 })
  }

  // Paquetes entregados en el rango
  const { data: paquetes } = await admin
    .from('paquetes')
    .select('id, tracking_casilla, tracking_origen, descripcion, bodega_destino, cliente_id, direccion_entrega, barrio_entrega, domiciliario_id, updated_at, valor_domicilio')
    .in('domiciliario_id', domIds)
    .eq('estado', 'entregado')
    .gte('updated_at', inicio.toISOString())
    .lte('updated_at', fin.toISOString())
    .is('paquete_origen_id', null)
    .order('domiciliario_id')
    .order('updated_at')

  // Manuales completados en el rango
  const { data: manuales } = await admin
    .from('domicilios_manuales')
    .select('id, nombre, direccion, telefono, notas, notas_entrega, tipo, domiciliario_id, completado_at, valor')
    .in('domiciliario_id', domIds)
    .eq('estado', 'completado')
    .gte('completado_at', inicio.toISOString())
    .lte('completado_at', fin.toISOString())
    .order('domiciliario_id')
    .order('completado_at')

  // Nombres de clientes
  const clienteIds = [...new Set((paquetes ?? []).map(p => p.cliente_id).filter(Boolean))] as string[]
  const clienteNombres: Record<string, string> = {}
  if (clienteIds.length > 0) {
    const { data: pfs } = await admin.from('perfiles').select('id, nombre_completo').in('id', clienteIds)
    for (const p of pfs ?? []) clienteNombres[p.id] = p.nombre_completo
  }

  // Construir filas
  type Fila = {
    Domiciliario: string
    Fecha: string
    Tipo: string
    'Nombre / Tracking': string
    Descripción: string
    Dirección: string
    Teléfono: string
    Notas: string
    'Hora entrega': string
    'Valor ($)': number | string
  }

  const filas: Fila[] = []

  for (const p of paquetes ?? []) {
    const tracking = p.tracking_origen ?? p.tracking_casilla ?? ''
    const cliente  = p.cliente_id ? (clienteNombres[p.cliente_id] ?? '') : ''
    const dir      = [p.direccion_entrega, p.barrio_entrega].filter(Boolean).join(', ')
    const bodega   = BODEGA_LABELS[p.bodega_destino ?? ''] ?? p.bodega_destino ?? ''
    filas.push({
      Domiciliario:        domMap[p.domiciliario_id ?? ''] ?? '',
      Fecha:               p.updated_at ? fechaCorta(p.updated_at) : '',
      Tipo:                'Productos',
      'Nombre / Tracking': cliente ? `${cliente} (${tracking})` : tracking,
      Descripción:         p.descripcion ?? '',
      Dirección:           dir,
      Teléfono:            '',
      Notas:               bodega,
      'Hora entrega':      p.updated_at ? fechaBogota(p.updated_at) : '',
      'Valor ($)':         p.valor_domicilio ?? '',
    })
  }

  for (const m of manuales ?? []) {
    filas.push({
      Domiciliario:        domMap[m.domiciliario_id ?? ''] ?? '',
      Fecha:               m.completado_at ? fechaCorta(m.completado_at) : '',
      Tipo:                TIPO_LABELS[m.tipo ?? 'productos'] ?? m.tipo ?? '',
      'Nombre / Tracking': m.nombre,
      Descripción:         m.notas ?? '',
      Dirección:           m.direccion ?? '',
      Teléfono:            m.telefono ?? '',
      Notas:               m.notas_entrega ?? '',
      'Hora entrega':      m.completado_at ? fechaBogota(m.completado_at) : '',
      'Valor ($)':         m.valor ?? '',
    })
  }

  // Ordenar por domiciliario → fecha → hora
  filas.sort((a, b) => {
    const dom = a.Domiciliario.localeCompare(b.Domiciliario, 'es')
    if (dom !== 0) return dom
    const fecha = a.Fecha.localeCompare(b.Fecha)
    if (fecha !== 0) return fecha
    return a['Hora entrega'].localeCompare(b['Hora entrega'])
  })

  // Generar Excel
  const wb = XLSX.utils.book_new()

  // Columnas a mostrar (Fecha solo para rangos)
  const colsEntregas = esRango
    ? ['Domiciliario', 'Fecha', 'Tipo', 'Nombre / Tracking', 'Descripción', 'Dirección', 'Teléfono', 'Notas', 'Hora entrega', 'Valor ($)']
    : ['Domiciliario', 'Tipo', 'Nombre / Tracking', 'Descripción', 'Dirección', 'Teléfono', 'Notas', 'Hora entrega', 'Valor ($)']

  const filasEntregas = filas.map(f => {
    const row: Record<string, unknown> = {}
    for (const col of colsEntregas) row[col] = (f as unknown as Record<string, unknown>)[col]
    return row
  })

  const ws = XLSX.utils.json_to_sheet(filasEntregas)
  ws['!cols'] = esRango
    ? [{ wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 35 }, { wch: 40 }, { wch: 30 }, { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 12 }]
    : [{ wch: 22 }, { wch: 12 }, { wch: 35 }, { wch: 40 }, { wch: 30 }, { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Entregas')

  // Hoja resumen por domiciliario
  const resumenMap: Record<string, { personal: number; servicios: number; productos: number; total: number }> = {}
  const valorMap:   Record<string, number> = {}

  for (const f of filas) {
    if (!resumenMap[f.Domiciliario]) resumenMap[f.Domiciliario] = { personal: 0, servicios: 0, productos: 0, total: 0 }
    if (!valorMap[f.Domiciliario])   valorMap[f.Domiciliario]   = 0
    const t = f.Tipo.toLowerCase() as 'personal' | 'servicios' | 'productos'
    if (t in resumenMap[f.Domiciliario]) resumenMap[f.Domiciliario][t]++
    resumenMap[f.Domiciliario].total++
    if (typeof f['Valor ($)'] === 'number') valorMap[f.Domiciliario] += f['Valor ($)']
  }

  const resumenFilas = Object.entries(resumenMap).map(([dom, v]) => ({
    Domiciliario:      dom,
    Personal:          v.personal,
    Servicios:         v.servicios,
    Productos:         v.productos,
    'Total entregas':  v.total,
    'Total valor ($)': valorMap[dom] ?? 0,
  }))

  const wsResumen = XLSX.utils.json_to_sheet(resumenFilas)
  wsResumen['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 16 }]
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  const nombreArchivo = esRango
    ? `informe-domicilios-${fechaDesde}-a-${fechaHasta}.xlsx`
    : `informe-domicilios-${fechaDesde}.xlsx`

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
    },
  })
}
