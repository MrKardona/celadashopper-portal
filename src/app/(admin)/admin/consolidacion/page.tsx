export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { Layers } from 'lucide-react'
import { fechaCorta } from '@/lib/fecha'

const tw = 'rgba(255,255,255,'

const ESTADO_DARK: Record<string, { bg: string; color: string; border: string }> = {
  recibido_usa:     { bg: 'rgba(99,130,255,0.12)',  color: '#8899ff', border: 'rgba(99,130,255,0.3)'  },
  en_consolidacion: { bg: 'rgba(245,184,0,0.10)',   color: '#F5B800', border: 'rgba(245,184,0,0.25)'  },
  listo_envio:      { bg: 'rgba(168,85,247,0.12)',  color: '#c084fc', border: 'rgba(168,85,247,0.3)'  },
}

const ESTADO_LABELS: Record<string, string> = {
  recibido_usa: 'En Miami',
  en_consolidacion: 'Consolidando',
  listo_envio: 'Listo envío',
}

const BODEGA_LABELS: Record<string, string> = {
  medellin: 'Medellín',
  bogota: 'Bogotá',
  barranquilla: 'Barranquilla',
}

const US_ESTADOS = ['recibido_usa', 'en_consolidacion', 'listo_envio']

interface PaqueteUS {
  id: string
  tracking_casilla: string | null
  tracking_origen: string | null
  cliente_id: string | null
  descripcion: string | null
  estado: string
  bodega_destino: string | null
  peso_libras: number | null
  peso_facturable: number | null
  created_at: string
}

interface Perfil {
  id: string
  nombre_completo: string
  numero_casilla: string
}

interface GrupoBodega {
  bodega: string | null
  paquetes: PaqueteUS[]
  pesoTotal: number | null
}

interface GrupoCliente {
  cliente: Perfil | null
  clienteId: string
  bodegas: GrupoBodega[]
  totalPaquetes: number
  oldestDate: string
}

export default async function ConsolidacionPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: 'public' }, auth: { persistSession: false } }
  )

  const { data: paquetesRaw } = await supabase
    .from('paquetes')
    .select('id, tracking_casilla, tracking_origen, cliente_id, descripcion, estado, bodega_destino, peso_libras, peso_facturable, created_at')
    .in('estado', US_ESTADOS)
    .not('cliente_id', 'is', null)
    .order('created_at', { ascending: true })

  const paquetes: PaqueteUS[] = (paquetesRaw ?? []) as PaqueteUS[]

  // Gather unique cliente_ids
  const clienteIds = [...new Set(paquetes.map(p => p.cliente_id).filter((id): id is string => !!id))]

  let perfilesMap: Record<string, Perfil> = {}
  if (clienteIds.length > 0) {
    const { data: perfiles } = await supabase
      .from('perfiles')
      .select('id, nombre_completo, numero_casilla')
      .in('id', clienteIds)
    if (perfiles) {
      perfilesMap = Object.fromEntries(
        (perfiles as Perfil[]).map(p => [p.id, p])
      )
    }
  }

  // Group by cliente_id → bodega_destino
  const byCliente: Record<string, PaqueteUS[]> = {}
  for (const p of paquetes) {
    if (!p.cliente_id) continue
    if (!byCliente[p.cliente_id]) byCliente[p.cliente_id] = []
    byCliente[p.cliente_id].push(p)
  }

  const grupos: GrupoCliente[] = Object.entries(byCliente).map(([clienteId, pkgs]) => {
    // Group by bodega
    const byBodega: Record<string, PaqueteUS[]> = {}
    for (const p of pkgs) {
      const key = p.bodega_destino ?? '__null__'
      if (!byBodega[key]) byBodega[key] = []
      byBodega[key].push(p)
    }

    const bodegas: GrupoBodega[] = Object.entries(byBodega).map(([bodegaKey, bpkgs]) => {
      const bodega = bodegaKey === '__null__' ? null : bodegaKey
      // Compute total weight only if all packages have a weight
      const allHaveWeight = bpkgs.every(p => (p.peso_facturable ?? p.peso_libras) !== null)
      const pesoTotal = allHaveWeight
        ? bpkgs.reduce((sum, p) => sum + (p.peso_facturable ?? p.peso_libras ?? 0), 0)
        : null
      return { bodega, paquetes: bpkgs, pesoTotal }
    })

    // Sort bodegas: multi-package first
    bodegas.sort((a, b) => b.paquetes.length - a.paquetes.length)

    const oldestDate = pkgs.reduce((oldest, p) => (p.created_at < oldest ? p.created_at : oldest), pkgs[0].created_at)

    return {
      cliente: perfilesMap[clienteId] ?? null,
      clienteId,
      bodegas,
      totalPaquetes: pkgs.length,
      oldestDate,
    }
  })

  // Sort: more packages first, then oldest date
  grupos.sort((a, b) => {
    if (b.totalPaquetes !== a.totalPaquetes) return b.totalPaquetes - a.totalPaquetes
    return a.oldestDate.localeCompare(b.oldestDate)
  })

  // Separate: multi-package (any bodega group with 2+) vs single
  const multiGrupos = grupos.filter(g => g.bodegas.some(b => b.paquetes.length >= 2))
  const soloGrupos  = grupos.filter(g => g.bodegas.every(b => b.paquetes.length < 2))

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm transition-colors"
        style={{ color: `${tw}0.4)` }}>
        ← Volver al dashboard
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Consolidación de paquetes</h1>
        <p className="text-sm mt-1" style={{ color: `${tw}0.45)` }}>
          Clientes con varios paquetes en bodega Miami
        </p>
      </div>

      {/* Alert banner */}
      <div className="flex items-center gap-3 px-5 py-4 rounded-2xl"
        style={{
          background: 'rgba(168,85,247,0.08)',
          border: '1px solid rgba(168,85,247,0.25)',
        }}>
        <Layers className="h-5 w-5 flex-shrink-0" style={{ color: '#c084fc' }} />
        <p className="text-sm" style={{ color: '#c084fc' }}>
          {multiGrupos.length === 0
            ? 'No hay grupos para consolidar en este momento.'
            : multiGrupos.length === 1
              ? '1 cliente con varios paquetes en Miami — puede consolidarse en una sola caja.'
              : `${multiGrupos.length} clientes con varios paquetes en Miami — pueden consolidarse en una sola caja.`}
        </p>
      </div>

      {/* ── Multi-package section ── */}
      {multiGrupos.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <div className="text-4xl mb-3">✅</div>
          <p className="font-semibold text-white">No hay paquetes para consolidar</p>
          <p className="text-sm mt-1" style={{ color: `${tw}0.4)` }}>
            Todos los clientes tienen 1 paquete en bodega
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: `${tw}0.3)` }}>
            Consolidar ahora — {multiGrupos.length} cliente{multiGrupos.length !== 1 ? 's' : ''}
          </h2>

          {multiGrupos.map(grupo => (
            <div key={grupo.clienteId}>
              {grupo.bodegas.filter(b => b.paquetes.length >= 2).map(bodegaGrupo => (
                <GrupoCard
                  key={`${grupo.clienteId}-${bodegaGrupo.bodega}`}
                  grupo={grupo}
                  bodegaGrupo={bodegaGrupo}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── Single-package section ── */}
      {soloGrupos.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer list-none flex items-center gap-2 py-2">
            <span className="text-xs font-bold uppercase tracking-widest select-none" style={{ color: `${tw}0.25)` }}>
              Clientes con 1 paquete — {soloGrupos.length}
            </span>
            <span className="text-xs" style={{ color: `${tw}0.18)` }}>▸</span>
          </summary>
          <div className="mt-3 space-y-2">
            {soloGrupos.map(grupo => (
              <div key={grupo.clienteId}
                className="flex items-center justify-between px-4 py-3 rounded-xl"
                style={{ background: `${tw}0.03)`, border: `1px solid ${tw}0.06)` }}>
                <div className="min-w-0">
                  <p className="text-sm font-medium" style={{ color: `${tw}0.5)` }}>
                    {grupo.cliente?.nombre_completo ?? grupo.clienteId}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: `${tw}0.25)` }}>
                    {grupo.cliente?.numero_casilla ?? '—'} · {grupo.bodegas[0]?.paquetes[0]?.descripcion ?? '—'}
                  </p>
                </div>
                <Link href={`/admin/paquetes?cliente_id=${grupo.clienteId}`}
                  className="text-xs ml-3 flex-shrink-0"
                  style={{ color: `${tw}0.3)` }}>
                  Ver →
                </Link>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

function GrupoCard({ grupo, bodegaGrupo }: { grupo: GrupoCliente; bodegaGrupo: GrupoBodega }) {
  const { cliente, clienteId } = grupo
  const { bodega, paquetes, pesoTotal } = bodegaGrupo
  const count = paquetes.length

  return (
    <div className="glass-card overflow-hidden"
      style={{ borderColor: 'rgba(168,85,247,0.2)' }}>
      {/* Top accent strip */}
      <div className="h-0.5 w-full"
        style={{ background: 'linear-gradient(90deg, rgba(168,85,247,0.7) 0%, rgba(99,130,255,0.4) 100%)' }} />

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="font-bold text-white text-base leading-tight">
              {cliente?.nombre_completo ?? clienteId}
            </p>
            <p className="text-xs mt-0.5" style={{ color: `${tw}0.38)` }}>
              {cliente?.numero_casilla ?? '—'}
            </p>
          </div>
          {/* Gold badge: package count */}
          <span className="flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-full tabular-nums"
            style={{ background: 'rgba(245,184,0,0.14)', color: '#F5B800', border: '1px solid rgba(245,184,0,0.3)' }}>
            {count} paquete{count !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Subtitle: city + weight */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {bodega && (
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ background: 'rgba(168,85,247,0.1)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.22)' }}>
              {BODEGA_LABELS[bodega] ?? bodega}
            </span>
          )}
          {pesoTotal !== null && (
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ background: `${tw}0.06)`, color: `${tw}0.55)`, border: `1px solid ${tw}0.1)` }}>
              {pesoTotal.toFixed(2)} lb total
            </span>
          )}
        </div>

        {/* Divider */}
        <div className="my-4" style={{ borderTop: `1px solid ${tw}0.06)` }} />

        {/* Package list */}
        <div className="space-y-2.5">
          {paquetes.map(p => {
            const s = ESTADO_DARK[p.estado] ?? { bg: `${tw}0.07)`, color: `${tw}0.6)`, border: `${tw}0.12)` }
            return (
              <div key={p.id}
                className="flex items-center gap-3 py-2 px-3 rounded-xl"
                style={{ background: `${tw}0.03)`, border: `1px solid ${tw}0.05)` }}>
                {/* Estado badge */}
                <span className="flex-shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                  {ESTADO_LABELS[p.estado] ?? p.estado}
                </span>
                {/* Tracking */}
                <span className="font-mono text-xs flex-shrink-0" style={{ color: `${tw}0.5)` }}>
                  {p.tracking_origen ?? p.tracking_casilla ?? '—'}
                </span>
                {/* Description */}
                <span className="text-sm truncate flex-1" style={{ color: `${tw}0.75)` }}>
                  {p.descripcion ?? '—'}
                </span>
                {/* Date */}
                <span className="text-xs flex-shrink-0" style={{ color: `${tw}0.3)` }}>
                  {fechaCorta(p.created_at)}
                </span>
              </div>
            )
          })}
        </div>

        {/* Footer links */}
        <div className="flex items-center gap-4 mt-5 pt-4"
          style={{ borderTop: `1px solid ${tw}0.06)` }}>
          <Link href={`/admin/paquetes?cliente_id=${clienteId}`}
            className="text-sm font-semibold transition-colors hover:opacity-80"
            style={{ color: '#F5B800' }}>
            Ver todos sus paquetes →
          </Link>
          <Link href="/admin/cajas"
            className="text-sm font-semibold transition-colors hover:opacity-80"
            style={{ color: '#c084fc' }}>
            Ir a cajas →
          </Link>
        </div>
      </div>
    </div>
  )
}
