export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Box, Package, MapPin, Truck, FileText } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import CajaDetalleForm from '@/components/admin/CajaDetalleForm'
import type { CajaDetalle, PaqueteCaja } from '@/components/admin/CajaDetalleForm'

interface Props {
  params: Promise<{ id: string }>
}

export default async function CajaDetallePage({ params }: Props) {
  const { id } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: 'public' }, auth: { persistSession: false } }
  )

  const { data: caja } = await supabase
    .from('cajas_consolidacion')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!caja) notFound()

  // Cargar paquetes adentro
  const { data: paquetes } = await supabase
    .from('paquetes')
    .select('id, tracking_casilla, descripcion, categoria, peso_libras, valor_declarado, estado, cliente_id, bodega_destino')
    .eq('caja_id', id)
    .order('created_at', { ascending: true })

  // Perfiles de los clientes
  const clienteIds = [...new Set((paquetes ?? []).map(p => p.cliente_id).filter(Boolean))] as string[]
  const perfilesMap: Record<string, { nombre_completo: string; numero_casilla: string | null }> = {}
  if (clienteIds.length > 0) {
    const { data: perfiles } = await supabase
      .from('perfiles')
      .select('id, nombre_completo, numero_casilla')
      .in('id', clienteIds)
    for (const p of perfiles ?? []) {
      perfilesMap[p.id] = { nombre_completo: p.nombre_completo, numero_casilla: p.numero_casilla }
    }
  }

  // Segunda foto de cada paquete (foto del contenido)
  const paqueteIds = (paquetes ?? []).map(p => p.id)
  const fotosMap: Record<string, string> = {}
  if (paqueteIds.length > 0) {
    const { data: fotos } = await supabase
      .from('fotos_paquetes')
      .select('paquete_id, url')
      .in('paquete_id', paqueteIds)
      .order('created_at', { ascending: true })
    const acum: Record<string, string[]> = {}
    for (const f of fotos ?? []) {
      if (!acum[f.paquete_id]) acum[f.paquete_id] = []
      acum[f.paquete_id].push(f.url)
    }
    for (const [id, urls] of Object.entries(acum)) {
      fotosMap[id] = urls[1] ?? urls[0]
    }
  }

  const paquetesConCliente: PaqueteCaja[] = (paquetes ?? []).map(p => ({
    id: p.id,
    tracking_casilla: p.tracking_casilla,
    descripcion: p.descripcion,
    categoria: p.categoria,
    peso_libras: p.peso_libras,
    valor_declarado: p.valor_declarado,
    estado: p.estado,
    bodega_destino: p.bodega_destino,
    cliente: p.cliente_id ? (perfilesMap[p.cliente_id] ?? null) : null,
    foto_url: fotosMap[p.id] ?? null,
  }))

  const cajaDetalle: CajaDetalle = {
    id: caja.id,
    codigo_interno: caja.codigo_interno,
    tracking_usaco: caja.tracking_usaco,
    courier: caja.courier,
    bodega_destino: caja.bodega_destino,
    peso_estimado: caja.peso_estimado,
    peso_real: caja.peso_real,
    costo_total_usaco: caja.costo_total_usaco,
    estado: caja.estado,
    notas: caja.notas,
    created_at: caja.created_at,
    fecha_cierre: caja.fecha_cierre,
    fecha_despacho: caja.fecha_despacho,
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-start gap-3">
        <Link href="/admin/cajas" className="mt-1 transition-colors hover:text-white/70" style={{ color: 'rgba(255,255,255,0.35)' }}>
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-white font-mono flex items-center gap-2">
            <Box className="h-5 w-5" style={{ color: '#F5B800' }} />
            {caja.codigo_interno}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Creada {format(new Date(caja.created_at), "d 'de' MMMM, HH:mm", { locale: es })}
            {caja.fecha_cierre && ` · Cerrada ${format(new Date(caja.fecha_cierre), "d MMM HH:mm", { locale: es })}`}
            {caja.fecha_despacho && ` · Despachada ${format(new Date(caja.fecha_despacho), "d MMM HH:mm", { locale: es })}`}
          </p>
        </div>
      </div>

      <CajaDetalleForm caja={cajaDetalle} paquetesIniciales={paquetesConCliente} />
    </div>
  )
}
