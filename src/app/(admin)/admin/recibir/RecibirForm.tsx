'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import {
  ScanBarcode, Search, CheckCircle2, AlertCircle, Package,
  Scale, Loader2, X, ClipboardList, Camera, ImageIcon,
} from 'lucide-react'
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
  sinAsignar?: boolean
}

const BODEGA_LABELS: Record<string, string> = {
  medellin: 'Medellín',
  bogota: 'Bogotá',
  barranquilla: 'Barranquilla',
}

const CATEGORIAS = Object.entries(CATEGORIA_LABELS) as [CategoriaProducto, string][]
const BODEGAS = [
  { value: 'medellin', label: 'Medellín' },
  { value: 'bogota', label: 'Bogotá' },
  { value: 'barranquilla', label: 'Barranquilla' },
]

export default function RecibirForm() {
  const inputRef = useRef<HTMLInputElement>(null)
  const pesoRef = useRef<HTMLInputElement>(null)
  const pesoManualRef = useRef<HTMLInputElement>(null)
  const fotoInputRef = useRef<HTMLInputElement>(null)
  const fotoInputManualRef = useRef<HTMLInputElement>(null)

  // --- Estado: búsqueda normal ---
  const [tracking, setTracking] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [paquete, setPaquete] = useState<PaqueteEncontrado | null>(null)
  const [errorBusqueda, setErrorBusqueda] = useState('')

  // --- Estado: recepción normal ---
  const [peso, setPeso] = useState('')
  const [trackingUsaco, setTrackingUsaco] = useState('')
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)

  // --- Foto (compartida entre ambos modos) ---
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)
  const [subiendoFoto, setSubiendoFoto] = useState(false)

  // --- Estado: modo manual (sin casillero) ---
  const [modoManual, setModoManual] = useState(false)
  const [formManual, setFormManual] = useState({
    descripcion: '',
    tienda: '',
    tracking_courier: '',
    peso: '',
    categoria: '' as CategoriaProducto | '',
    bodega_destino: 'medellin',
    notas: '',
  })
  const [guardandoManual, setGuardandoManual] = useState(false)

  // --- Historial de sesión ---
  const [ultimoRecibido, setUltimoRecibido] = useState<PaqueteRecibido | null>(null)
  const [recibidosHoy, setRecibidosHoy] = useState<PaqueteRecibido[]>([])

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (paquete) {
      pesoRef.current?.focus()
      if (paquete.peso_libras) setPeso(String(paquete.peso_libras))
    }
  }, [paquete])

  useEffect(() => {
    if (modoManual) {
      // Pre-llenar tracking_courier con lo que se buscó
      setFormManual(prev => ({ ...prev, tracking_courier: tracking }))
      setTimeout(() => pesoManualRef.current?.focus(), 100)
    }
  }, [modoManual, tracking])

  const buscarPaquete = useCallback(async (valor: string) => {
    const q = valor.trim()
    if (!q) return
    setBuscando(true)
    setErrorBusqueda('')
    setPaquete(null)
    setModoManual(false)
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
    if (e.key === 'Enter') { e.preventDefault(); buscarPaquete(tracking) }
  }

  function limpiar() {
    setTracking('')
    setPaquete(null)
    setErrorBusqueda('')
    setPeso('')
    setTrackingUsaco('')
    setNotas('')
    setUltimoRecibido(null)
    setModoManual(false)
    setFormManual({ descripcion: '', tienda: '', tracking_courier: '', peso: '', categoria: '', bodega_destino: 'medellin', notas: '' })
    setFotoPreview(null)
    setFotoUrl(null)
    setSubiendoFoto(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  async function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Preview local inmediato
    const preview = URL.createObjectURL(file)
    setFotoPreview(preview)
    setFotoUrl(null)
    setSubiendoFoto(true)

    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/foto', { method: 'POST', body: fd })
      const data = await res.json() as { ok?: boolean; url?: string; error?: string }
      if (res.ok && data.url) {
        setFotoUrl(data.url)
      } else {
        setFotoPreview(null)
        setErrorBusqueda(data.error ?? 'Error subiendo foto')
      }
    } catch {
      setFotoPreview(null)
      setErrorBusqueda('Error de conexión al subir foto')
    } finally {
      setSubiendoFoto(false)
    }
  }

  // ── Confirmar recepción de paquete encontrado ────────────────────────────
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
          foto_url: fotoUrl || undefined,
        }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) { setErrorBusqueda(data.error ?? 'Error al guardar'); return }

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

  // ── Guardar paquete manual (sin cliente asignado) ─────────────────────────
  async function handleGuardarManual(e: React.FormEvent) {
    e.preventDefault()
    if (!formManual.descripcion || !formManual.peso || !formManual.categoria) return
    setGuardandoManual(true)
    try {
      const res = await fetch('/api/admin/recibir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sin_asignar: true,
          descripcion: formManual.descripcion,
          tienda: formManual.tienda || 'Sin especificar',
          tracking_origen: formManual.tracking_courier || undefined,
          peso_libras: parseFloat(formManual.peso),
          categoria: formManual.categoria,
          bodega_destino: formManual.bodega_destino,
          notas_internas: formManual.notas || undefined,
          foto_url: fotoUrl || undefined,
        }),
      })
      const data = await res.json() as { ok?: boolean; tracking_casilla?: string; error?: string }
      if (!res.ok || !data.ok) { setErrorBusqueda(data.error ?? 'Error al guardar'); return }

      const nuevo: PaqueteRecibido = {
        id: data.tracking_casilla ?? '',
        tracking: data.tracking_casilla ?? 'S/N',
        cliente: '⏳ Sin asignar',
        peso: parseFloat(formManual.peso),
        hora: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
        sinAsignar: true,
      }
      setUltimoRecibido(nuevo)
      setRecibidosHoy(prev => [nuevo, ...prev.slice(0, 29)])
      limpiar()
    } finally {
      setGuardandoManual(false)
    }
  }

  const yaRecibido = paquete && ['recibido_usa', 'en_consolidacion', 'listo_envio',
    'en_transito', 'en_colombia', 'en_bodega_local', 'en_camino_cliente', 'entregado'].includes(paquete.estado)

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Notificación de éxito */}
      {ultimoRecibido && (
        <div className={`flex items-start gap-3 rounded-xl p-4 border animate-in fade-in slide-in-from-top-2 duration-300 ${
          ultimoRecibido.sinAsignar
            ? 'bg-amber-50 border-amber-200'
            : 'bg-green-50 border-green-200'
        }`}>
          <CheckCircle2 className={`h-5 w-5 mt-0.5 flex-shrink-0 ${ultimoRecibido.sinAsignar ? 'text-amber-600' : 'text-green-600'}`} />
          <div className="flex-1 min-w-0">
            <p className={`font-semibold ${ultimoRecibido.sinAsignar ? 'text-amber-800' : 'text-green-800'}`}>
              {ultimoRecibido.sinAsignar ? 'Paquete registrado sin asignar' : '¡Paquete recibido correctamente!'}
            </p>
            <p className={`text-sm mt-0.5 ${ultimoRecibido.sinAsignar ? 'text-amber-700' : 'text-green-700'}`}>
              <span className="font-mono font-bold">{ultimoRecibido.tracking}</span>
              {' · '}{ultimoRecibido.cliente}
              {' · '}{ultimoRecibido.peso} lb
            </p>
          </div>
          <button onClick={() => setUltimoRecibido(null)} className="text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Scanner */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center gap-2 text-gray-700 font-semibold">
          <ScanBarcode className="h-5 w-5 text-orange-600" />
          Escanear o escribir tracking
        </div>

        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={tracking}
            onChange={e => {
              setTracking(e.target.value)
              setErrorBusqueda('')
              if (paquete) { setPaquete(null); setPeso('') }
              if (modoManual) setModoManual(false)
            }}
            onKeyDown={handleTrackingKeyDown}
            placeholder="Escanear código de barras o escribir tracking..."
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-base font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={() => buscarPaquete(tracking)}
            disabled={!tracking.trim() || buscando}
            className="px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-40 transition-colors flex items-center gap-2 font-medium"
          >
            {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Buscar
          </button>
        </div>

        {/* Error: no encontrado → opción de recibir sin asignar */}
        {errorBusqueda && !modoManual && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg px-4 py-3 text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {errorBusqueda}
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium text-amber-800">
                ¿El paquete llegó sin casillero registrado?
              </p>
              <p className="text-xs text-amber-700">
                Puedes registrarlo sin asignar. Cuando el cliente lo reporte en el portal,
                el sistema lo asociará automáticamente y le notificará por WhatsApp.
              </p>
              <button
                type="button"
                onClick={() => setModoManual(true)}
                className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                <ClipboardList className="h-4 w-4" />
                Recibir sin asignar
              </button>
            </div>
          </div>
        )}

        {/* Paquete encontrado */}
        {paquete && (
          <div className={`rounded-lg border p-4 space-y-3 ${yaRecibido ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Package className={`h-5 w-5 flex-shrink-0 ${yaRecibido ? 'text-amber-600' : 'text-blue-600'}`} />
                <span className="font-mono font-bold text-gray-900">
                  {paquete.tracking_casilla ?? paquete.tracking_origen ?? tracking}
                </span>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${yaRecibido ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
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

      {/* Formulario recepción normal */}
      {paquete && (
        <form onSubmit={handleConfirmar} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center gap-2 text-gray-700 font-semibold">
            <Scale className="h-5 w-5 text-orange-600" />
            Registrar recepción
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <label className="text-sm font-medium text-gray-700">Peso en libras <span className="text-red-500">*</span></label>
              <div className="relative">
                <input
                  ref={pesoRef}
                  type="number" step="0.1" min="0.1" max="999"
                  value={peso} onChange={e => setPeso(e.target.value)}
                  placeholder="0.0" required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-lg font-bold focus:outline-none focus:ring-2 focus:ring-orange-500 pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">lb</span>
              </div>
            </div>
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <label className="text-sm font-medium text-gray-700">Tracking USACO <span className="text-gray-400 font-normal">(opcional)</span></label>
              <input
                type="text" value={trackingUsaco} onChange={e => setTrackingUsaco(e.target.value)}
                placeholder="1Z..." autoComplete="off"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <label className="text-sm font-medium text-gray-700">Notas internas <span className="text-gray-400 font-normal">(opcional)</span></label>
              <input
                type="text" value={notas} onChange={e => setNotas(e.target.value)}
                placeholder="Ej: Caja con daño leve, producto bien..."
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>
          {/* Foto del paquete */}
          <div className="space-y-1.5 col-span-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
              <Camera className="h-4 w-4 text-gray-400" />
              Foto del paquete <span className="text-gray-400 font-normal">(recomendado)</span>
            </label>
            <input
              ref={fotoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFotoChange}
              className="hidden"
            />
            {!fotoPreview ? (
              <button
                type="button"
                onClick={() => fotoInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-200 rounded-lg py-4 text-sm text-gray-400 hover:border-orange-300 hover:text-orange-500 transition-colors flex items-center justify-center gap-2"
              >
                <ImageIcon className="h-4 w-4" />
                Tomar o subir foto
              </button>
            ) : (
              <div className="relative rounded-lg overflow-hidden border border-gray-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fotoPreview} alt="Vista previa" className="w-full max-h-48 object-cover" />
                {subiendoFoto && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 text-white animate-spin" />
                  </div>
                )}
                {!subiendoFoto && fotoUrl && (
                  <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Subida
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => { setFotoPreview(null); setFotoUrl(null); if (fotoInputRef.current) fotoInputRef.current.value = '' }}
                  className="absolute top-2 left-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={!peso || parseFloat(peso) <= 0 || guardando || subiendoFoto}
              className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:opacity-40 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 text-base"
            >
              {guardando ? <><Loader2 className="h-5 w-5 animate-spin" />Guardando...</> : <><CheckCircle2 className="h-5 w-5" />Confirmar recepción</>}
            </button>
            <button type="button" onClick={limpiar} className="px-4 py-3 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors font-medium">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Formulario recepción manual (sin asignar) */}
      {modoManual && (
        <form onSubmit={handleGuardarManual} className="bg-white rounded-xl border border-amber-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-700 font-semibold">
              <ClipboardList className="h-5 w-5" />
              Recibir sin asignar — datos del paquete
            </div>
            <button type="button" onClick={limpiar} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
            Este paquete quedará en espera. Cuando el cliente lo reporte con el tracking <strong>{formManual.tracking_courier || 'del courier'}</strong>, el sistema lo asociará automáticamente y le enviará un WhatsApp.
          </p>

          <div className="grid grid-cols-2 gap-4">
            {/* Peso */}
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <label className="text-sm font-medium text-gray-700">Peso en libras <span className="text-red-500">*</span></label>
              <div className="relative">
                <input
                  ref={pesoManualRef}
                  type="number" step="0.1" min="0.1" max="999"
                  value={formManual.peso}
                  onChange={e => setFormManual(p => ({ ...p, peso: e.target.value }))}
                  placeholder="0.0" required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-lg font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">lb</span>
              </div>
            </div>

            {/* Categoría */}
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <label className="text-sm font-medium text-gray-700">Categoría <span className="text-red-500">*</span></label>
              <select
                value={formManual.categoria}
                onChange={e => setFormManual(p => ({ ...p, categoria: e.target.value as CategoriaProducto }))}
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">Seleccionar...</option>
                {CATEGORIAS.map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>

            {/* Descripción */}
            <div className="space-y-1.5 col-span-2">
              <label className="text-sm font-medium text-gray-700">Descripción física <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={formManual.descripcion}
                onChange={e => setFormManual(p => ({ ...p, descripcion: e.target.value }))}
                placeholder="Ej: Caja mediana Amazon, posible zapatillas"
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Tienda */}
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <label className="text-sm font-medium text-gray-700">Tienda <span className="text-gray-400 font-normal">(si se ve)</span></label>
              <input
                type="text"
                value={formManual.tienda}
                onChange={e => setFormManual(p => ({ ...p, tienda: e.target.value }))}
                placeholder="Amazon, Nike..."
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Tracking courier */}
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <label className="text-sm font-medium text-gray-700">Tracking courier <span className="text-gray-400 font-normal">(si tiene)</span></label>
              <input
                type="text"
                value={formManual.tracking_courier}
                onChange={e => setFormManual(p => ({ ...p, tracking_courier: e.target.value }))}
                placeholder="1Z, 9400..."
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                autoComplete="off"
              />
            </div>

            {/* Bodega destino */}
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <label className="text-sm font-medium text-gray-700">Bodega destino</label>
              <select
                value={formManual.bodega_destino}
                onChange={e => setFormManual(p => ({ ...p, bodega_destino: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {BODEGAS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </div>

            {/* Notas */}
            <div className="space-y-1.5 col-span-2">
              <label className="text-sm font-medium text-gray-700">Notas internas <span className="text-gray-400 font-normal">(opcional)</span></label>
              <input
                type="text"
                value={formManual.notas}
                onChange={e => setFormManual(p => ({ ...p, notas: e.target.value }))}
                placeholder="Estado del embalaje, observaciones..."
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Foto del paquete */}
            <div className="space-y-1.5 col-span-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <Camera className="h-4 w-4 text-gray-400" />
                Foto del paquete <span className="text-gray-400 font-normal">(muy útil para identificarlo)</span>
              </label>
              <input
                ref={fotoInputManualRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFotoChange}
                className="hidden"
              />
              {!fotoPreview ? (
                <button
                  type="button"
                  onClick={() => fotoInputManualRef.current?.click()}
                  className="w-full border-2 border-dashed border-amber-200 rounded-lg py-4 text-sm text-amber-500 hover:border-amber-400 transition-colors flex items-center justify-center gap-2"
                >
                  <ImageIcon className="h-4 w-4" />
                  Tomar o subir foto
                </button>
              ) : (
                <div className="relative rounded-lg overflow-hidden border border-amber-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={fotoPreview} alt="Vista previa" className="w-full max-h-48 object-cover" />
                  {subiendoFoto && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Loader2 className="h-6 w-6 text-white animate-spin" />
                    </div>
                  )}
                  {!subiendoFoto && fotoUrl && (
                    <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Subida
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => { setFotoPreview(null); setFotoUrl(null); if (fotoInputManualRef.current) fotoInputManualRef.current.value = '' }}
                    className="absolute top-2 left-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={!formManual.peso || !formManual.descripcion || !formManual.categoria || guardandoManual || subiendoFoto}
              className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 text-base"
            >
              {guardandoManual
                ? <><Loader2 className="h-5 w-5 animate-spin" />Guardando...</>
                : <><CheckCircle2 className="h-5 w-5" />Guardar sin asignar</>
              }
            </button>
            <button type="button" onClick={limpiar} className="px-4 py-3 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 font-medium">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Historial sesión */}
      {recibidosHoy.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">Recibidos en esta sesión</span>
            <span className="text-xs bg-orange-100 text-orange-700 font-semibold px-2 py-0.5 rounded-full">
              {recibidosHoy.length}
            </span>
          </div>
          <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
            {recibidosHoy.map((r, i) => (
              <div key={`${r.id}-${i}`} className="flex items-center gap-3 px-5 py-3 text-sm">
                <CheckCircle2 className={`h-4 w-4 flex-shrink-0 ${r.sinAsignar ? 'text-amber-400' : 'text-green-500'}`} />
                <span className="font-mono font-semibold text-orange-700 w-32 truncate">{r.tracking}</span>
                <span className={`flex-1 truncate ${r.sinAsignar ? 'text-amber-600 italic' : 'text-gray-600'}`}>{r.cliente}</span>
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
