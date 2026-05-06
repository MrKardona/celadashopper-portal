'use client'

// Buscador de cliente con autocompletar.
// Llama a /api/admin/clientes/buscar con debounce y muestra sugerencias.
// Se selecciona un cliente y se notifica al padre vía onSelect(cliente).
//
// Uso:
//   <BuscadorClienteInline
//     valor={clienteSeleccionado}
//     onSelect={setClienteSeleccionado}
//   />

import { useEffect, useRef, useState } from 'react'
import { Search, X, Loader2, User, Phone } from 'lucide-react'

export interface ClienteSugerido {
  id: string
  nombre_completo: string
  email: string
  numero_casilla: string | null
  whatsapp: string | null
  telefono: string | null
  ciudad: string | null
}

interface Props {
  valor: ClienteSugerido | null
  onSelect: (cliente: ClienteSugerido | null) => void
  placeholder?: string
  /** clase opcional para el contenedor externo */
  className?: string
  /** Valor con el que pre-llenar el input cuando no hay cliente seleccionado (ej: nombre extraído por OCR de la etiqueta) */
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

  // Sincronizar query cuando defaultQuery cambia desde afuera (ej: OCR extrajo un nombre).
  // Solo si no hay cliente seleccionado y el agente no ha empezado a escribir algo distinto.
  useEffect(() => {
    if (!valor && defaultQuery && !query) {
      setQuery(defaultQuery)
      setAbierto(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultQuery, valor])

  // Cerrar al click fuera
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAbierto(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Debounce de búsqueda
  useEffect(() => {
    if (valor) return // si ya hay un cliente seleccionado, no buscamos
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

  // Cliente seleccionado: mostrar pill compacto
  if (valor) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg ${className}`}>
        <div className="h-7 w-7 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
          <User className="h-3.5 w-3.5 text-orange-700" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{valor.nombre_completo}</p>
          <p className="text-[11px] text-gray-500 flex items-center gap-2 flex-wrap">
            <span className="font-mono text-orange-700">{valor.numero_casilla ?? 'sin casillero'}</span>
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
          className="p-1 text-gray-400 hover:text-red-600 hover:bg-white rounded transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  // Sin cliente seleccionado: input de búsqueda
  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setAbierto(true) }}
          onFocus={() => setAbierto(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full pl-9 pr-9 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        {cargando && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
        )}
      </div>

      {abierto && query.trim().length >= 2 && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
          {sugerencias.length === 0 && !cargando ? (
            <div className="px-4 py-3 text-sm text-gray-500 text-center">
              Sin coincidencias para &quot;{query}&quot;
            </div>
          ) : (
            sugerencias.map((c, idx) => (
              <button
                key={c.id}
                type="button"
                onClick={() => seleccionar(c)}
                onMouseEnter={() => setResaltado(idx)}
                className={`w-full text-left px-3 py-2 border-b border-gray-50 last:border-b-0 transition-colors ${
                  idx === resaltado ? 'bg-orange-50' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <User className="h-3.5 w-3.5 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{c.nombre_completo}</p>
                    <p className="text-[11px] text-gray-500 flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-orange-600">{c.numero_casilla ?? 'sin casillero'}</span>
                      <span className="text-gray-300">·</span>
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
