export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { Layers, Package } from 'lucide-react'
import { fechaCorta } from '@/lib/fecha'
import ArmarCajaDesdeConsolidacion from '@/components/admin/ArmarCajaDesdeConsolidacion'
import FotoThumb from '@/components/ui/FotoThumb'

const tw = 'rgba(255,255,255,'

const ESTADO_DARK: Record<string, { bg: string; color: string; border: string }> = {
  recibido_usa:      { bg: 'rgba(99,130,255,0.12)',  color: '#8899ff', border: 'rgba(99,130,255,0.3)'  },
  en_consolidacion:  { bg: 'rgba(245,184,0,0.10)',   color: '#F5B800', border: 'rgba(245,184,0,0.25)'  },
  listo_envio:       { bg: 'rgba(168,85,247,0.12)',  color: '#c084fc', border: 'rgba(168,85,247,0.3)'  },
  en_bodega_local:   { bg: 'rgba(99,130,255,0.10)',  color: '#818cf8', border: 'rgba(99,130,255,0.25)' },
  en_camino_cliente: { bg: 'rgba(132,204,22,0.10)',  color: '#a3e635', border: 'rgba(132,204,22,0.25)' },
}

const ESTADO_LABELS: Record<string, string> = {
  recibido_usa: 'En Miami',
  en_consolidacion: 'Consolidando',
  listo_envio: 'Listo envío',
  en_bodega_local: 'En bodega CO',
  en_camino_cliente: 'En camino',
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

  const { data: paquetesColRaw } = await supabase
    .from('paquetes')
    .select('id, tracking_casilla, tracking_origen, cliente_id, descripcion, estado, bodega_destino, peso_libras, peso_facturable, created_at')
    .in('estado', ['en_bodega_local', 'en_camino_cliente'])
    .not('cliente_id', 'is', null)
    .order('created_at', { ascending: true })

  const paquetesCol: PaqueteUS[] = (paquetesColRaw ?? []) as PaqueteUS[]

  // Fotos
  const todosIds = [...paquetes, ...paquetesCol].map(p => p.id)
  const { data: fotosRaw } = todosIds.length > 0
    ? await supabase.from('fotos_paquetes').select('paquete_id, url, descripcion, created_at').in('paquete_id', todosIds).order('created_at')
    : { data: [] as { paquete_id: string; url: string; descripcion?: string | null; created_at: string }[] }

  const fotosGrupo: Record<string, { url: string; descripcion?: string | null; created_at: string }[]> = {}
  for (const f of (fotosRaw ?? []) as { paquete_id: string; url: string; descripcion?: string | null; created_at: string }[]) {
    if (!fotosGrupo[f.paquete_id]) fotosGrupo[f.paquete_id] = []
    fotosGrupo[f.paquete_id].push(f)
  }
  const fotosMap: Record<string, string> = {}
  for (const [pid, fotos] of Object.entries(fotosGrupo)) {
    const sorted = [...fotos].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    const contenido = sorted.find(f => (f.descripcion ?? '').toLowerCase().includes('contenido'))
    const thumb = contenido ?? (sorted.length > 1 ? sorted[1] : sorted[0])
    if (thumb) fotosMap[pid] = thumb.url
  }

  const clienteIdsUS  = [...new Set(paquetes.map(p => p.cliente_id).filter((id): id is string => !!id))]
  const clienteIdsCol = [...new Set(paquetesCol.map(p => p.cliente_id).filter((id): id is string => !!id))]
  const clienteIds    = [...new Set([...clienteIdsUS, ...clienteIdsCol])]

  let perfilesMap: Record<string, Perfil> = {}
  if (clienteIds.length > 0) {
    const { data: perfiles } = await supabase
      .from('perfiles').select('id, nombre_completo, numero_casilla').in('id', clienteIds)
    if (perfiles) perfilesMap = Object.fromEntries((perfiles as Perfil[]).map(p => [p.id, p]))
  }

  function buildGrupos(list: PaqueteUS[]): GrupoCliente[] {
    const byCliente: Record<string, PaqueteUS[]> = {}
    for (const p of list) {
      if (!p.cliente_id) continue
      if (!byCliente[p.cliente_id]) byCliente[p.cliente_id] = []
      byCliente[p.cliente_id].push(p)
    }
    return Object.entries(byCliente).map(([clienteId, pkgs]) => {
      const byBodega: Record<string, PaqueteUS[]> = {}
      for (const p of pkgs) {
        const key = p.bodega_destino ?? '__null__'
        if (!byBodega[key]) byBodega[key] = []
        byBodega[key].push(p)
      }
      const bodegas: GrupoBodega[] = Object.entries(byBodega).map(([bodegaKey, bpkgs]) => {
        const bodega = bodegaKey === '__null__' ? null : bodegaKey
        const allHaveWeight = bpkgs.every(p => (p.peso_facturable ?? p.peso_libras) !== null)
        const pesoTotal = allHaveWeight ? bpkgs.reduce((sum, p) => sum + (p.peso_facturable ?? p.peso_libras ?? 0), 0) : null
        return { bodega, paquetes: bpkgs, pesoTotal }
      })
      bodegas.sort((a, b) => b.paquetes.length - a.paquetes.length)
      const oldestDate = pkgs.reduce((o, p) => (p.created_at < o ? p.created_at : o), pkgs[0].created_at)
      return { cliente: perfilesMap[clienteId] ?? null, clienteId, bodegas, totalPaquetes: pkgs.length, oldestDate }
    }).sort((a, b) => {
      if (b.totalPaquetes !== a.totalPaquetes) return b.totalPaquetes - a.totalPaquetes
      return a.oldestDate.localeCompare(b.oldestDate)
    })
  }

  const grupos    = buildGrupos(paquetes)
  const gruposCol = buildGrupos(paquetesCol)

  const multiGrupos    = grupos.filter(g => g.bodegas.some(b => b.paquetes.length >= 2))
  const soloGrupos     = grupos.filter(g => g.bodegas.every(b => b.paquetes.length < 2))
  const multiGruposCol = gruposCol.filter(g => g.bodegas.some(b => b.paquetes.length >= 2))

  // Stats globales
  const totalPaqUS    = paquetes.length
  const totalPesoUS   = paquetes.filter(p => p.peso_facturable ?? p.peso_libras).reduce((s, p) => s + (p.peso_facturable ?? p.peso_libras ?? 0), 0)
  const listos        = paquetes.filter(p => p.estado === 'listo_envio').length

  return (
    <div className="space-y-6">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm" style={{ color: `${tw}0.35)` }}>
        ← Dashboard
      </Link>

      {/* ── Header + stats ───────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Consolidación</h1>
          <p className="text-sm mt-0.5" style={{ color: `${tw}0.4)` }}>Clientes con varios paquetes en Miami</p>
        </div>

        {/* Resumen rápido */}
        <div className="flex items-center gap-3 flex-wrap">
          <Stat label="En USA" value={totalPaqUS} icon="📦" />
          {listos > 0 && <Stat label="Listos" value={listos} icon="✅" accent="#c084fc" />}
          {totalPesoUS > 0 && <Stat label="Peso total" value={`${totalPesoUS.toFixed(1)} lb`} icon="⚖️" />}
        </div>
      </div>

      {/* Banner */}
      <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl"
        style={{ background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.2)' }}>
        <Layers className="h-4 w-4 flex-shrink-0" style={{ color: '#c084fc' }} />
        <p className="text-sm" style={{ color: '#c084fc' }}>
          {multiGrupos.length === 0
            ? 'Sin grupos para consolidar.'
            : `${multiGrupos.length} cliente${multiGrupos.length !== 1 ? 's' : ''} con varios paquetes en Miami — pueden ir en una sola caja.`}
        </p>
      </div>

      {/* ── Multi-package ────────────────────────────────────────────── */}
      {multiGrupos.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <p className="text-3xl mb-2">✅</p>
          <p className="font-semibold text-white">Todo en orden</p>
          <p className="text-sm mt-1" style={{ color: `${tw}0.4)` }}>Todos los clientes tienen 1 paquete en bodega</p>
        </div>
      ) : (
        <section className="space-y-3">
          <SectionTitle icon="🟣" label="Consolidar ahora" count={multiGrupos.length} />
          {multiGrupos.map(grupo =>
            grupo.bodegas.filter(b => b.paquetes.length >= 2).map(bodegaGrupo => (
              <GrupoCard
                key={`${grupo.clienteId}-${bodegaGrupo.bodega}`}
                grupo={grupo}
                bodegaGrupo={bodegaGrupo}
                fotosMap={fotosMap}
              />
            ))
          )}
        </section>
      )}

      {/* ── Single-package (colapsado) ───────────────────────────────── */}
      {soloGrupos.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer list-none flex items-center gap-2 py-2 select-none">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: `${tw}0.22)` }}>
              Clientes con 1 paquete ({soloGrupos.length})
            </span>
            <span className="text-xs group-open:rotate-90 transition-transform inline-block" style={{ color: `${tw}0.15)` }}>▸</span>
          </summary>
          <div className="mt-2 rounded-xl overflow-hidden" style={{ border: `1px solid ${tw}0.06)` }}>
            {soloGrupos.map((grupo, i) => (
              <div key={grupo.clienteId}
                className="flex items-center gap-3 px-4 py-2.5"
                style={{ borderTop: i > 0 ? `1px solid ${tw}0.05)` : undefined }}>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-white truncate block">{grupo.cliente?.nombre_completo ?? grupo.clienteId}</span>
                  <span className="text-[10px]" style={{ color: `${tw}0.28)` }}>
                    {grupo.cliente?.numero_casilla} · {grupo.bodegas[0]?.paquetes[0]?.descripcion ?? '—'}
                  </span>
                </div>
                <Link href={`/admin/paquetes?cliente_id=${grupo.clienteId}`}
                  className="text-[11px] flex-shrink-0" style={{ color: `${tw}0.3)` }}>
                  Ver →
                </Link>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* ── Colombia ─────────────────────────────────────────────────── */}
      {multiGruposCol.length > 0 && (
        <section className="space-y-3 pt-4" style={{ borderTop: `1px solid ${tw}0.06)` }}>
          <SectionTitle icon="🇨🇴" label="Entregar juntos — Bodega Colombia" count={multiGruposCol.length} />
          {multiGruposCol.map(grupo =>
            grupo.bodegas.filter(b => b.paquetes.length >= 2).map(bodegaGrupo => (
              <GrupoCard
                key={`col-${grupo.clienteId}-${bodegaGrupo.bodega}`}
                grupo={grupo}
                bodegaGrupo={bodegaGrupo}
                accentColor="green"
                fotosMap={fotosMap}
              />
            ))
          )}
        </section>
      )}
    </div>
  )
}

// ── Componentes auxiliares ──────────────────────────────────────────────────

function SectionTitle({ icon, label, count }: { icon: string; label: string; count: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm">{icon}</span>
      <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.28)' }}>
        {label}
      </h2>
      <span className="text-xs font-bold px-2 py-0.5 rounded-full tabular-nums"
        style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' }}>
        {count}
      </span>
    </div>
  )
}

function Stat({ label, value, icon, accent }: { label: string; value: string | number; icon: string; accent?: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <span className="text-base leading-none">{icon}</span>
      <div>
        <p className="text-xs leading-none" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</p>
        <p className="text-sm font-bold mt-0.5 leading-none" style={{ color: accent ?? 'white' }}>{value}</p>
      </div>
    </div>
  )
}

// ── GrupoCard ───────────────────────────────────────────────────────────────

function GrupoCard({
  grupo, bodegaGrupo, accentColor = 'purple', fotosMap = {},
}: {
  grupo: GrupoCliente
  bodegaGrupo: GrupoBodega
  accentColor?: 'purple' | 'green'
  fotosMap?: Record<string, string>
}) {
  const { cliente, clienteId, oldestDate } = grupo
  const { bodega, paquetes, pesoTotal } = bodegaGrupo

  const isGreen = accentColor === 'green'
  const dias    = Math.floor((Date.now() - new Date(oldestDate).getTime()) / 86_400_000)

  const stripGradient   = isGreen
    ? 'linear-gradient(90deg,#10b981 0%,rgba(52,211,153,0.25) 100%)'
    : 'linear-gradient(90deg,#a855f7 0%,rgba(99,130,255,0.3) 100%)'
  const cardBorderColor = isGreen ? 'rgba(52,211,153,0.18)' : 'rgba(168,85,247,0.18)'

  // Estado breakdown
  const estadoCount: Record<string, number> = {}
  for (const p of paquetes) estadoCount[p.estado] = (estadoCount[p.estado] ?? 0) + 1

  // Semáforo de urgencia por días
  const diasColor = dias > 14 ? '#f87171' : dias > 7 ? '#f59e0b' : 'rgba(255,255,255,0.3)'
  const diasBg    = dias > 14 ? 'rgba(239,68,68,0.1)' : dias > 7 ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.04)'

  return (
    <div className="glass-card overflow-hidden" style={{ borderColor: cardBorderColor }}>
      {/* Barra de acento */}
      <div className="h-[3px]" style={{ background: stripGradient }} />

      <div className="p-4 space-y-3">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link href={`/admin/paquetes?cliente_id=${clienteId}`}
                className="font-bold text-white text-base leading-tight hover:underline decoration-white/30 underline-offset-2 truncate">
                {cliente?.nombre_completo ?? clienteId}
              </Link>
              {cliente?.numero_casilla && (
                <span className="text-xs font-mono font-semibold flex-shrink-0" style={{ color: '#F5B800' }}>
                  {cliente.numero_casilla}
                </span>
              )}
            </div>

            {/* Sub-info: bodega + peso + días */}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {bodega && (
                <span className="text-[11px] px-2 py-0.5 rounded-md font-semibold"
                  style={{
                    background: isGreen ? 'rgba(52,211,153,0.1)' : 'rgba(168,85,247,0.1)',
                    color:      isGreen ? '#34d399'              : '#c084fc',
                    border:     `1px solid ${isGreen ? 'rgba(52,211,153,0.2)' : 'rgba(168,85,247,0.2)'}`,
                  }}>
                  📍 {BODEGA_LABELS[bodega] ?? bodega}
                </span>
              )}
              {pesoTotal !== null && (
                <span className="text-[11px] px-2 py-0.5 rounded-md font-semibold"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  ⚖️ {pesoTotal.toFixed(2)} lb
                </span>
              )}
              <span className="text-[11px] px-2 py-0.5 rounded-md font-semibold"
                style={{ background: diasBg, color: diasColor, border: `1px solid ${diasColor}30` }}>
                ⏱ {dias === 0 ? 'Hoy' : dias === 1 ? '1 día' : `${dias} días`}
              </span>
            </div>

            {/* Estado breakdown */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {Object.entries(estadoCount).map(([estado, n]) => {
                const s = ESTADO_DARK[estado] ?? { bg: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', border: 'rgba(255,255,255,0.1)' }
                return (
                  <span key={estado} className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap"
                    style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                    {n} {ESTADO_LABELS[estado] ?? estado}
                  </span>
                )
              })}
            </div>
          </div>

          {/* Count badge */}
          <div className="flex-shrink-0 text-center px-3 py-2 rounded-xl"
            style={{ background: 'rgba(245,184,0,0.1)', border: '1px solid rgba(245,184,0,0.22)' }}>
            <p className="text-xl font-bold leading-none tabular-nums" style={{ color: '#F5B800' }}>{paquetes.length}</p>
            <p className="text-[9px] font-bold uppercase mt-0.5" style={{ color: 'rgba(245,184,0,0.6)' }}>paq.</p>
          </div>
        </div>

        {/* ── Lista de paquetes ───────────────────────────────────────── */}
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          {paquetes.map((p, i) => {
            const s      = ESTADO_DARK[p.estado] ?? { bg: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', border: 'rgba(255,255,255,0.12)' }
            const fotoUrl = fotosMap[p.id] ?? null
            const peso    = p.peso_facturable ?? p.peso_libras
            return (
              <Link key={p.id} href={`/admin/paquetes/${p.id}`}
                className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-white/[0.04]"
                style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : undefined }}>

                {/* Miniatura */}
                <FotoThumb url={fotoUrl} width={36} height={36} radius="0.4rem" />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium leading-snug truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>
                    {p.descripcion ?? '—'}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[10px] font-mono truncate" style={{ color: 'rgba(255,255,255,0.28)' }}>
                      {p.tracking_origen ?? p.tracking_casilla ?? '—'}
                    </p>
                    {peso && (
                      <span className="text-[10px] flex-shrink-0" style={{ color: 'rgba(255,255,255,0.28)' }}>
                        {peso.toFixed(1)} lb
                      </span>
                    )}
                  </div>
                </div>

                {/* Estado + fecha */}
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                    style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                    {ESTADO_LABELS[p.estado] ?? p.estado}
                  </span>
                  <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.22)' }}>
                    {fechaCorta(p.created_at)}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>

        {/* ── Footer: acciones ────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <Link href={`/admin/paquetes?cliente_id=${clienteId}`}
            className="text-xs font-medium transition-opacity hover:opacity-70"
            style={{ color: 'rgba(255,255,255,0.35)' }}>
            Ver todos los paquetes →
          </Link>
          {isGreen ? (
            <Link href="/admin/listos-entrega"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
              style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}>
              🚴 Listos entrega
            </Link>
          ) : (
            <ArmarCajaDesdeConsolidacion
              paqueteIds={paquetes.map(p => p.id)}
              bodega={bodega ?? 'medellin'}
              pesoTotal={pesoTotal}
              accentColor={accentColor}
            />
          )}
        </div>
      </div>
    </div>
  )
}
