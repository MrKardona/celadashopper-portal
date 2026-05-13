'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import {
  MapPin, Navigation, Package, FileText, Phone, User,
  ExternalLink, Pencil, Check, X, Loader2, Map,
} from 'lucide-react'
import EntregarDomiciliarioButton from './EntregarDomiciliarioButton'
import CompletarDomicilioManualButton from './CompletarDomicilioManualButton'
import { tw } from '@/lib/ui'
const BODEGA_LABELS: Record<string, string> = {
  medellin: 'Medellín', bogota: 'Bogotá', barranquilla: 'Barranquilla',
}

// Mapa reutilizado del admin (ya tiene origen Celada Shopper)
const RutaMapa = dynamic(() => import('@/components/admin/RutaMapaInner'), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl flex items-center justify-center gap-2"
      style={{ height: 300, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="h-4 w-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      <span className="text-xs" style={{ color: `${tw}0.3)` }}>Cargando mapa...</span>
    </div>
  ),
})

export interface ParadaPaquete {
  kind: 'paquete'
  num: number
  id: string
  tracking: string | null
  descripcion: string | null
  bodega: string | null
  clienteNombre: string | null
  tel: string | null
  direccion: string | null
  barrio: string | null
  referencia: string | null
  pesoLibras: number | null
  costoServicio: number | null
}

export interface ParadaManual {
  kind: 'manual'
  num: number
  id: string
  nombre: string
  direccion: string
  telefono: string | null
  notas: string | null
}

export type Parada = ParadaPaquete | ParadaManual

interface Props { paradas: Parada[] }

export default function RutaDomiciliarioPanel({ paradas: inicial }: Props) {
  const [paradas, setParadas] = useState(inicial)
  const [mapaAbierto, setMapaAbierto] = useState(false)

  // Edición de dirección de paquete
  const [editandoId, setEditandoId]   = useState<string | null>(null)
  const [dirTemp,    setDirTemp]      = useState('')
  const [guardando,  setGuardando]    = useState(false)
  const [errorDir,   setErrorDir]     = useState('')

  // Paradas con dirección para el mapa
  const paradasMapa = paradas
    .filter(p => p.direccion)
    .map(p => ({ num: p.num, label: p.kind === 'paquete' ? (p.tracking ?? 'Paquete') : p.nombre, direccion: p.direccion!, tipo: p.kind as 'paquete' | 'manual' }))

  // URL Google Maps con todas las paradas desde Celada Shopper
  const CELADA = 'Celada Personal Shopper, Itagüí, Antioquia, Colombia'
  const googleMapsUrl = paradasMapa.length > 0
    ? `https://www.google.com/maps/dir/${encodeURIComponent(CELADA)}/${paradasMapa.map(p => encodeURIComponent(p.direccion)).join('/')}`
    : `https://www.google.com/maps/search/${encodeURIComponent(CELADA)}`

  async function guardarDireccion(paqueteId: string) {
    if (!dirTemp.trim()) { setEditandoId(null); return }
    setGuardando(true); setErrorDir('')
    try {
      const res = await fetch(`/api/domiciliario/paquetes/${paqueteId}/direccion`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direccion_entrega: dirTemp.trim() }),
      })
      if (!res.ok) { setErrorDir('No se pudo guardar'); return }
      setParadas(prev => prev.map(p =>
        p.kind === 'paquete' && p.id === paqueteId ? { ...p, direccion: dirTemp.trim() } : p
      ))
      setEditandoId(null)
    } catch { setErrorDir('Error de conexión') }
    finally { setGuardando(false) }
  }

  function abrirEdicion(p: ParadaPaquete) {
    setEditandoId(p.id)
    setDirTemp(p.direccion ?? '')
    setErrorDir('')
    setGuardando(false) // reset por si una tarjeta anterior quedó en estado guardando
  }

  return (
    <div className="space-y-4">

      {/* ── Barra de acciones de ruta ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Mapa */}
        <button
          onClick={() => setMapaAbierto(v => !v)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all"
          style={{
            background: mapaAbierto ? 'rgba(129,140,248,0.18)' : 'rgba(129,140,248,0.1)',
            color: '#818cf8',
            border: `1px solid rgba(129,140,248,${mapaAbierto ? '0.4' : '0.2'})`,
          }}
        >
          <Map className="h-3.5 w-3.5" />
          {mapaAbierto ? 'Ocultar mapa' : 'Ver mapa de ruta'}
        </button>

        {/* Google Maps */}
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-opacity hover:opacity-80"
          style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}
        >
          <Navigation className="h-3.5 w-3.5" />
          Iniciar navegación
        </a>
      </div>

      {/* ── Mapa colapsable ── */}
      {mapaAbierto && (
        <div className="glass-card p-4" style={{ borderColor: 'rgba(129,140,248,0.15)' }}>
          <RutaMapa paradas={paradasMapa} />
        </div>
      )}

      {/* ── Lista de entregas ── */}
      <div className="grid grid-cols-1 gap-4">
        {paradas.map(parada => {

          /* ── Domicilio manual ── */
          if (parada.kind === 'manual') {
            const m = parada
            return (
              <div key={`manual-${m.id}`} className="glass-card p-4 space-y-3"
                style={{ borderColor: 'rgba(129,140,248,0.2)' }}>

                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(129,140,248,0.12)' }}>
                      <FileText className="h-3.5 w-3.5" style={{ color: '#818cf8' }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">{m.nombre}</p>
                      <p className="text-[11px]" style={{ color: '#818cf8' }}>Domicilio manual</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: 'rgba(129,140,248,0.12)', color: '#818cf8', border: '1px solid rgba(129,140,248,0.25)' }}>
                    #{m.num}
                  </span>
                </div>

                <a href={`https://maps.google.com/?q=${encodeURIComponent(m.direccion)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-start gap-2 text-xs hover:opacity-80 transition-opacity"
                  style={{ color: `${tw}0.7)` }}>
                  <MapPin className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: '#818cf8' }} />
                  <div>
                    <p>{m.direccion}</p>
                    <p className="mt-0.5 flex items-center gap-1" style={{ color: '#818cf8' }}>
                      <ExternalLink className="h-2.5 w-2.5" /> Abrir en Maps
                    </p>
                  </div>
                </a>

                {m.telefono && (
                  <a href={`https://wa.me/${m.telefono.replace(/\D/g, '')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs hover:underline"
                    style={{ color: '#34d399' }}>
                    <Phone className="h-3 w-3" />{m.telefono}
                  </a>
                )}

                {m.notas && (
                  <p className="text-xs px-3 py-2 rounded-xl"
                    style={{ background: `${tw}0.04)`, color: `${tw}0.55)`, border: `1px solid ${tw}0.07)` }}>
                    {m.notas}
                  </p>
                )}

                <CompletarDomicilioManualButton id={m.id} />
              </div>
            )
          }

          /* ── Paquete del sistema ── */
          const p = parada
          const editando = editandoId === p.id

          return (
            <div key={`paquete-${p.id}`} className="glass-card p-4 space-y-3">

              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-sm font-bold" style={{ color: '#F5B800' }}>
                      {p.tracking ?? '—'}
                    </p>
                    <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}>
                      #{p.num}
                    </span>
                  </div>
                  {p.descripcion && (
                    <p className="text-sm mt-0.5 text-white font-medium">{p.descripcion}</p>
                  )}
                </div>
                {p.bodega && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap flex-shrink-0"
                    style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}>
                    {BODEGA_LABELS[p.bodega] ?? p.bodega}
                  </span>
                )}
              </div>

              {/* Cliente */}
              {(p.clienteNombre || p.tel) && (
                <div className="rounded-xl p-3 space-y-2"
                  style={{ background: `${tw}0.05)`, border: `1px solid ${tw}0.08)` }}>
                  {p.clienteNombre && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-3.5 w-3.5 flex-shrink-0" style={{ color: `${tw}0.4)` }} />
                      <span className="font-semibold text-white truncate">{p.clienteNombre}</span>
                    </div>
                  )}
                  {p.tel && (
                    <a href={`https://wa.me/${p.tel.replace(/\D/g, '')}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs hover:underline"
                      style={{ color: '#34d399' }}>
                      <Phone className="h-3 w-3" />{p.tel}
                    </a>
                  )}
                </div>
              )}

              {/* Dirección — con edición inline */}
              {editando ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <input
                      autoFocus
                      value={dirTemp}
                      onChange={e => setDirTemp(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') guardarDireccion(p.id)
                        if (e.key === 'Escape') setEditandoId(null)
                      }}
                      placeholder="Ej: Calle 50 #40-10, El Poblado"
                      className="flex-1 text-xs px-3 py-2 rounded-xl focus:outline-none"
                      style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(245,184,0,0.4)', color: 'white' }}
                    />
                    <button
                      onClick={() => guardarDireccion(p.id)}
                      disabled={guardando || !dirTemp.trim()}
                      className="p-2 rounded-lg disabled:opacity-40"
                      style={{ color: '#34d399' }}>
                      {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </button>
                    <button onClick={() => setEditandoId(null)} className="p-2 rounded-lg"
                      style={{ color: `${tw}0.4)` }}>
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  {/* Buscar en Maps para copiar dirección */}
                  <a
                    href="https://maps.google.com"
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[11px]"
                    style={{ color: '#F5B800' }}>
                    <ExternalLink className="h-3 w-3" />
                    Buscar en Google Maps y copiar la dirección
                  </a>
                  {errorDir && <p className="text-[11px]" style={{ color: '#f87171' }}>{errorDir}</p>}
                </div>
              ) : p.direccion ? (
                <div className="flex items-start gap-2">
                  <a href={`https://maps.google.com/?q=${encodeURIComponent([p.direccion, p.barrio, BODEGA_LABELS[p.bodega ?? ''] ?? p.bodega].filter(Boolean).join(', '))}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex-1 flex items-start gap-2 text-xs hover:opacity-80 transition-opacity"
                    style={{ color: `${tw}0.7)` }}>
                    <MapPin className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: '#F5B800' }} />
                    <div>
                      <p>{p.direccion}</p>
                      {(p.barrio || p.referencia) && (
                        <p className="mt-0.5" style={{ color: `${tw}0.4)` }}>
                          {[p.barrio, p.referencia].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      <p className="mt-0.5 flex items-center gap-1" style={{ color: '#F5B800' }}>
                        <ExternalLink className="h-2.5 w-2.5" /> Abrir en Maps
                      </p>
                    </div>
                  </a>
                  <button
                    onClick={() => abrirEdicion(p)}
                    className="p-1.5 rounded-lg flex-shrink-0 mt-0.5 transition-colors hover:opacity-70"
                    title="Editar dirección"
                    style={{ color: `${tw}0.3)` }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => abrirEdicion(p)}
                  className="flex items-center gap-1.5 text-xs font-medium w-full px-3 py-2 rounded-xl"
                  style={{ background: 'rgba(245,184,0,0.08)', color: '#F5B800', border: '1px solid rgba(245,184,0,0.2)' }}>
                  <MapPin className="h-3.5 w-3.5" />
                  Sin dirección — tocar para agregar
                </button>
              )}

              {/* Peso / costo */}
              {(p.pesoLibras || p.costoServicio) && (
                <div className="flex gap-3 text-xs pt-1"
                  style={{ borderTop: `1px solid ${tw}0.06)`, color: `${tw}0.4)` }}>
                  {p.pesoLibras && <span>{Number(p.pesoLibras).toFixed(1)} lb</span>}
                  {p.costoServicio && <span>${Number(p.costoServicio).toFixed(2)} USD</span>}
                </div>
              )}

              <EntregarDomiciliarioButton paqueteId={p.id} descripcion={p.descripcion ?? ''} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
