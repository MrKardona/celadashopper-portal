'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, X, Loader2, User, Phone } from 'lucide-react'

const tw = 'rgba(255,255,255,'

export interface PaquetePendienteSimple {
  id: string
  tracking_casilla: string | null
  tracking_origen: string | null
  descripcion: string
  tienda: string
  bodega_destino: string
  created_at: string
}

export interface ClienteSugerido {
  id: string
  nombre_completo: string
  email: string
  numero_casilla: string | null
  whatsapp: string | null
  telefono: string | null
  ciudad: string | null
  paquetes_pendientes?: PaquetePendienteSimple[]
}

interface Props {
  valor: ClienteSugerido | null
  onSelect: (cliente: ClienteSugerido | null) => void
  placeholder?: string
  className?: string
  defaultQuery?: string
}

export default function BuscadorClienteInline({
  valor,
  onSelect,
  placeholder = 'Buscar por casillero, nombre, email o teléfono...',
  className = '',
  defaultQuery,
}: Props) {
  const [query, setQuery] = useState(defaultQuery ?? '')
  const [sugerencias, setSugerencias] = useState<ClienteSugerido[]>([])
  const [cargando, setCargando] = useState(false)
  const [abierto, setAbierto] = useState(false)
  const [resaltado, setResaltado] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!valor && defaultQuery && !query) {
      setQuery(defaultQuery)
      setAbierto(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultQuery, valor])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAbierto(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (valor) return
    const term = query.trim()
    if (term.length < 2) {
      setSugerencias([])
      return
    }
    setCargando(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/clientes/buscar?q=${encodeURIComponent(term)}`)
        const data = await res.json() as { clientes?: ClienteSugerido[] }
        setSugerencias(data.clientes ?? [])
        setResaltado(0)
      } catch {
        setSugerencias([])
      } finally {
        setCargando(false)
      }
    }, 200)
    return () => clearTimeout(t)
  }, [query, valor])

  function seleccionar(c: ClienteSugerido) {
    onSelect(c)
    setQuery('')
    setSugerencias([])
    setAbierto(false)
  }

  function limpiar() {
    onSelect(null)
    setQuery('')
    setSugerencias([])
    setAbierto(true)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!abierto || sugerencias.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setResaltado(r => Math.min(r + 1, sugerencias.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setResaltado(r => Math.max(r - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      seleccionar(sugerencias[resaltado])
    } else if (e.key === 'Escape') {
      setAbierto(false)
    }
  }

  if (valor) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${className}`}
        style={{ background: 'rgba(245,184,0,0.08)', border: '1px solid rgba(245,184,0,0.2)' }}>
        <div className="h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(245,184,0,0.15)' }}>
          <User className="h-3.5 w-3.5" style={{ color: '#F5B800' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{valor.nombre_completo}</p>
          <p className="text-[11px] flex items-center gap-2 flex-wrap" style={{ color: `${tw}0.5)` }}>
            <span className="font-mono" style={{ color: '#F5B800' }}>{valor.numero_casilla ?? 'sin casillero'}</span>
            {(valor.whatsapp || valor.telefono) && (
              <span className="flex items-center gap-1">
                <Phone className="h-2.5 w-2.5" />
                {valor.whatsapp ?? valor.telefono}
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={limpiar}
          aria-label="Quitar cliente"
          className="p-1 rounded-lg transition-colors"
          style={{ color: `${tw}0.35)` }}
          onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
          onMouseLeave={e => (e.currentTarget.style.color = `${tw}0.35)`)}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: `${tw}0.3)` }} />
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setAbierto(true) }}
          onFocus={() => setAbierto(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className="glass-input w-full pl-9 pr-9 py-2.5 text-sm rounded-xl focus:outline-none"
        />
        {cargando && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" style={{ color: `${tw}0.35)` }} />
        )}
      </div>

      {abierto && query.trim().length >= 2 && (
        <div
          className="absolute z-20 mt-1 w-full rounded-xl overflow-hidden max-h-72 overflow-y-auto"
          style={{
            background: 'rgba(10,10,25,0.95)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: `1px solid ${tw}0.1)`,
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          }}
        >
          {sugerencias.length === 0 && !cargando ? (
            <div className="px-4 py-3 text-sm text-center" style={{ color: `${tw}0.4)` }}>
              Sin coincidencias para &quot;{query}&quot;
            </div>
          ) : (
            sugerencias.map((c, idx) => (
              <button
                key={c.id}
                type="button"
                onClick={() => seleccionar(c)}
                onMouseEnter={() => setResaltado(idx)}
                className="w-full text-left px-3 py-2.5 transition-colors"
                style={{
                  background: idx === resaltado ? 'rgba(245,184,0,0.08)' : 'transparent',
                  borderBottom: idx < sugerencias.length - 1 ? `1px solid ${tw}0.05)` : undefined,
                }}
              >
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: `${tw}0.06)` }}>
                    <User className="h-3.5 w-3.5" style={{ color: `${tw}0.4)` }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{c.nombre_completo}</p>
                    <p className="text-[11px] flex items-center gap-2 flex-wrap" style={{ color: `${tw}0.45)` }}>
                      <span className="font-mono" style={{ color: '#F5B800' }}>{c.numero_casilla ?? 'sin casillero'}</span>
                      <span style={{ color: `${tw}0.2)` }}>·</span>
                      <span className="truncate">{c.email}</span>
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
