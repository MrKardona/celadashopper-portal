// GET /api/admin/domiciliarios/informe-excel?fecha=YYYY-MM-DD
// Genera un Excel con todas las entregas del día (paquetes + manuales) por domiciliario

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

  // Fecha (default: hoy en Bogotá)
  const fechaParam = req.nextUrl.searchParams.get('fecha')
  const fechaBog = fechaParam ?? new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  const inicio = new Date(`${fechaBog}T05:00:00.000Z`)   // 00:00 Bogotá = 05:00 UTC
  const fin    = new Date(`${fechaBog}T28:59:59.999Z`)   // 23:59:59 Bogotá

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
    .select('id, tracking_casilla, tracking_origen, descripcion, bodega_destino, cliente_id, direccion_entrega, barrio_entrega, domiciliario_id, updated_at')
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
    .select('id, nombre, direccion, telefono, notas, notas_entrega, tipo, domiciliario_id, completado_at')
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
    Tipo: string
    'Nombre / Tracking': string
    Descripción: string
    Dirección: string
    Teléfono: string
    Notas: string
    'Hora entrega': string
  }

  const filas: Fila[] = []

  for (const p of paquetes ?? []) {
    const tracking = p.tracking_origen ?? p.tracking_casilla ?? ''
    const cliente  = p.cliente_id ? (clienteNombres[p.cliente_id] ?? '') : ''
    const dir      = [p.direccion_entrega, p.barrio_entrega].filter(Boolean).join(', ')
    const bodega   = BODEGA_LABELS[p.bodega_destino ?? ''] ?? p.bodega_destino ?? ''
    filas.push({
      Domiciliario:      domMap[p.domiciliario_id ?? ''] ?? '',
      Tipo:              'Productos',
      'Nombre / Tracking': cliente ? `${cliente} (${tracking})` : tracking,
      Descripción:       p.descripcion ?? '',
      Dirección:         dir,
      Teléfono:          '',
      Notas:             bodega,
      'Hora entrega':    p.updated_at ? fechaBogota(p.updated_at) : '',
    })
  }

  for (const m of manuales ?? []) {
    filas.push({
      Domiciliario:        domMap[m.domiciliario_id ?? ''] ?? '',
      Tipo:                TIPO_LABELS[m.tipo ?? 'productos'] ?? m.tipo ?? '',
      'Nombre / Tracking': m.nombre,
      Descripción:         m.notas ?? '',
      Dirección:           m.direccion ?? '',
      Teléfono:            m.telefono ?? '',
      Notas:               m.notas_entrega ?? '',
      'Hora entrega':      m.completado_at ? fechaBogota(m.completado_at) : '',
    })
  }

  // Ordenar por domiciliario luego hora
  filas.sort((a, b) => {
    const dom = a.Domiciliario.localeCompare(b.Domiciliario, 'es')
    if (dom !== 0) return dom
    return a['Hora entrega'].localeCompare(b['Hora entrega'])
  })

  // Generar Excel
  const wb   = XLSX.utils.book_new()
  const ws   = XLSX.utils.json_to_sheet(filas)

  // Anchos de columna
  ws['!cols'] = [
    { wch: 22 }, // Domiciliario
    { wch: 12 }, // Tipo
    { wch: 35 }, // Nombre / Tracking
    { wch: 40 }, // Descripción
    { wch: 30 }, // Dirección
    { wch: 15 }, // Teléfono
    { wch: 30 }, // Notas
    { wch: 20 }, // Hora entrega
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Entregas')

  // Hoja resumen por domiciliario
  const resumenMap: Record<string, { personal: number; servicios: number; productos: number; total: number }> = {}
  for (const f of filas) {
    if (!resumenMap[f.Domiciliario]) resumenMap[f.Domiciliario] = { personal: 0, servicios: 0, productos: 0, total: 0 }
    const t = f.Tipo.toLowerCase() as 'personal' | 'servicios' | 'productos'
    if (t in resumenMap[f.Domiciliario]) resumenMap[f.Domiciliario][t]++
    resumenMap[f.Domiciliario].total++
  }

  const resumenFilas = Object.entries(resumenMap).map(([dom, v]) => ({
    Domiciliario: dom,
    Personal:     v.personal,
    Servicios:    v.servicios,
    Productos:    v.productos,
    Total:        v.total,
  }))

  const wsResumen = XLSX.utils.json_to_sheet(resumenFilas)
  wsResumen['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }]
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  const nombreArchivo = `informe-domicilios-${fechaBog}.xlsx`
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
    },
  })
}
