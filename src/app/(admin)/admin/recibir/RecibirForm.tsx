'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { ScanBarcode, Search, CheckCircle2, AlertCircle, Package, Scale, Loader2, X } from 'lucide-react'
import { ESTADO_LABELS, CATEGORIA_LABELS, type EstadoPaquete, type CategoriaProducto } from '@/types'

interface PaqueteEncontrado {
  id: string
  tracking_casilla: string | null
  tracking_origen: string | null
  tracking_usaco: string | null
  descripcion: string
  tienda: string
  categoria: CategoriaProducto
  estado: EstadoPaquete
  peso_libras: number | null
  valor_declarado: number | null
  notas_cliente: string | null
  bodega_destino: string
  perfiles: {
    nombre_completo: string
    numero_casilla: string
    whatsapp: string | null
    telefono: string | null
  } | null
}

interface PaqueteRecibido {
  id: string
  tracking: string
  cliente: string
  peso: number
  hora: string
}

const BODEGA_LABELS: Record<string, string> = {
  medellin: 'Medellín',
  bogota: 'Bogotá',
  barranquilla: 'Barranquilla',
}

export default function RecibirForm() {
  const inputRef = useRef<HTMLInputElement>(null)
  const pesoRef = useRef<HTMLInputElement>(null)

  const [tracking, setTracking] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [paquete, setPaquete] = useState<PaqueteEncontrado | null>(null)
  const [errorBusqueda, setErrorBusqueda] = useState('')

  const [peso, setPeso] = useState('')
  const [trackingUsaco, setTrackingUsaco] = useState('')
  const [notas, setNotas] = useState('')

  const [guardando, setGuardando] = useState(false)
  const [ultimoRecibido, setUltimoRecibido] = useState<PaqueteRecibido | null>(null)
  const [recibidosHoy, setRecibidosHoy] = useState<PaqueteRecibido[]>([])

  // Auto-focus al cargar
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Cuando se encuentra un paquete, enfocar campo de peso
  useEffect(() => {
    if (paquete) {
      pesoRef.current?.focus()
      // Prellenar peso si ya tiene
      if (paquete.peso_libras) setPeso(String(paquete.peso_libras))
    }
  }, [paquete])

  const buscarPaquete = useCallback(async (valor: string) => {
    const q = valor.trim()
    if (!q) return

    setBuscando(true)
    setErrorBusqueda('')
    setPaquete(null)

    try {
      const res = await fetch(`/api/admin/recibir?tracking=${encodeURIComponent(q)}`)
      const data = await res.json() as { paquete?: PaqueteEncontrado; error?: string }

      if (!res.ok || !data.paquete) {
        setErrorBusqueda(data.error ?? 'Paquete no encontrado')
      } else {
        setPaquete(data.paquete)
      }
    } catch {
      setErrorBusqueda('Error de conexión')
    } finally {
      setBuscando(false)
    }
  }, [])

  function handleTrackingKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      buscarPaquete(tracking)
    }
  }

  function limpiar() {
    setTracking('')
    setPaquete(null)
    setErrorBusqueda('')
    setPeso('')
    setTrackingUsaco('')
    setNotas('')
    setUltimoRecibido(null)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  async function handleConfirmar(e: React.FormEvent) {
    e.preventDefault()
    if (!paquete || !peso) return

    setGuardando(true)
    try {
      const res = await fetch('/api/admin/recibir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paquete_id: paquete.id,
          peso_libras: parseFloat(peso),
          tracking_usaco: trackingUsaco || undefined,
          notas_internas: notas || undefined,
        }),
      })

      const data = await res.json() as { ok?: boolean; error?: string }

      if (!res.ok || !data.ok) {
        setErrorBusqueda(data.error ?? 'Error al guardar')
        return
      }

      const nuevo: PaqueteRecibido = {
        id: paquete.id,
        tracking: paquete.tracking_casilla ?? tracking,
        cliente: paquete.perfiles?.nombre_completo ?? '—',
        peso: parseFloat(peso),
        hora: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
      }

      setUltimoRecibido(nuevo)
      setRecibidosHoy(prev => [nuevo, ...prev.slice(0, 29)])
      limpiar()
    } finally {
      setGuardando(false)
    }
  }

  const yaRecibido = paquete?.estado === 'recibido_usa' || paquete?.estado === 'en_consolidacion' ||
    paquete?.estado === 'listo_envio' || paquete?.estado === 'en_transito' ||
    paquete?.estado === 'en_colombia' || paquete?.estado === 'en_bodega_local' ||
    paquete?.estado === 'en_camino_cliente' || paquete?.estado === 'entregado'

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Éxito último recibido */}
      {ultimoRecibido && (
        <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-green-800">¡Paquete recibido correctamente!</p>
            <p className="text-sm text-green-700 mt-0.5">
              <span className="font-mono font-bold">{ultimoRecibido.tracking}</span>
              {' · '}{ultimoRecibido.cliente}
              {' · '}{ultimoRecibido.peso} lb
            </p>
          </div>
          <button onClick={() => setUltimoRecibido(null)} className="text-green-500 hover:text-green-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Scanner de tracking */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center gap-2 text-gray-700 font-semibold">
          <ScanBarcode className="h-5 w-5 text-orange-600" />
          Escanear o escribir tracking
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={tracking}
              onChange={e => {
                setTracking(e.target.value)
                setErrorBusqueda('')
                if (paquete) { setPaquete(null); setPeso('') }
              }}
              onKeyDown={handleTrackingKeyDown}
              placeholder="Escanear código de barras o escribir tracking..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base font-mono focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <button
            type="button"
            onClick={() => buscarPaquete(tracking)}
            disabled={!tracking.trim() || buscando}
            className="px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2 font-medium"
          >
            {buscando
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Search className="h-4 w-4" />
            }
            Buscar
          </button>
        </div>

        {/* Error búsqueda */}
        {errorBusqueda && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg px-4 py-3 text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {errorBusqueda}
          </div>
        )}

        {/* Info del paquete encontrado */}
        {paquete && (
          <div className={`rounded-lg border p-4 space-y-3 ${yaRecibido ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Package className={`h-5 w-5 flex-shrink-0 ${yaRecibido ? 'text-amber-600' : 'text-blue-600'}`} />
                <span className="font-mono font-bold text-gray-900">
                  {paquete.tracking_casilla ?? paquete.tracking_origen ?? tracking}
                </span>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                yaRecibido ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
              }`}>
                {ESTADO_LABELS[paquete.estado]}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">Cliente</span>
                <p className="font-semibold text-gray-900">{paquete.perfiles?.nombre_completo ?? '—'}</p>
                <p className="text-xs text-gray-400">Casilla: {paquete.perfiles?.numero_casilla}</p>
              </div>
              <div>
                <span className="text-gray-500">Destino</span>
                <p className="font-semibold text-gray-900">{BODEGA_LABELS[paquete.bodega_destino] ?? paquete.bodega_destino}</p>
              </div>
              <div>
                <span className="text-gray-500">Producto</span>
                <p className="font-semibold text-gray-900 truncate">{paquete.descripcion}</p>
                <p className="text-xs text-gray-400">{paquete.tienda} · {CATEGORIA_LABELS[paquete.categoria]}</p>
              </div>
              {paquete.valor_declarado && (
                <div>
                  <span className="text-gray-500">Valor declarado</span>
                  <p className="font-semibold text-gray-900">${paquete.valor_declarado.toLocaleString()} USD</p>
                </div>
              )}
            </div>

            {paquete.notas_cliente && (
              <p className="text-xs text-gray-500 italic bg-white/60 rounded px-3 py-2">
                Nota del cliente: {paquete.notas_cliente}
              </p>
            )}

            {yaRecibido && (
              <p className="text-sm text-amber-700 font-medium flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                Este paquete ya fue procesado (estado: {ESTADO_LABELS[paquete.estado]})
              </p>
            )}
          </div>
        )}
      </div>

      {/* Formulario de recepción */}
      {paquete && (
        <form onSubmit={handleConfirmar} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center gap-2 text-gray-700 font-semibold">
            <Scale className="h-5 w-5 text-orange-600" />
            Registrar recepción
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Peso */}
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <label className="text-sm font-medium text-gray-700">
                Peso en libras <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  ref={pesoRef}
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="999"
                  value={peso}
                  onChange={e => setPeso(e.target.value)}
                  placeholder="0.0"
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-lg font-bold focus:outline-none focus:ring-2 focus:ring-orange-500 pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">lb</span>
              </div>
            </div>

            {/* Tracking USACO */}
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <label className="text-sm font-medium text-gray-700">Tracking USACO <span className="text-gray-400 font-normal">(opcional)</span></label>
              <input
                type="text"
                value={trackingUsaco}
                onChange={e => setTrackingUsaco(e.target.value)}
                placeholder="1Z..."
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                autoComplete="off"
              />
            </div>

            {/* Notas internas */}
            <div className="space-y-1.5 col-span-2">
              <label className="text-sm font-medium text-gray-700">Notas internas <span className="text-gray-400 font-normal">(opcional)</span></label>
              <input
                type="text"
                value={notas}
                onChange={e => setNotas(e.target.value)}
                placeholder="Ej: Caja con daño leve, producto bien..."
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={!peso || parseFloat(peso) <= 0 || guardando}
              className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 text-base"
            >
              {guardando ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  Confirmar recepción
                </>
              )}
            </button>
            <button
              type="button"
              onClick={limpiar}
              className="px-4 py-3 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Historial de la sesión */}
      {recibidosHoy.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">Recibidos en esta sesión</span>
            <span className="text-xs bg-orange-100 text-orange-700 font-semibold px-2 py-0.5 rounded-full">
              {recibidosHoy.length}
            </span>
          </div>
          <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
            {recibidosHoy.map((r) => (
              <div key={`${r.id}-${r.hora}`} className="flex items-center gap-3 px-5 py-3 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                <span className="font-mono font-semibold text-orange-700 w-32 truncate">{r.tracking}</span>
                <span className="flex-1 text-gray-600 truncate">{r.cliente}</span>
                <span className="text-gray-500 font-medium">{r.peso} lb</span>
                <span className="text-gray-400 text-xs w-12 text-right">{r.hora}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
