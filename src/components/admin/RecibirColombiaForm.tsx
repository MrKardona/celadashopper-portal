'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ScanBarcode, Search, Package, CheckCircle2, AlertCircle, Loader2,
  X, MapPin, MessageCircle, Camera,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ESTADO_LABELS, ESTADO_COLORES, CATEGORIA_LABELS, type EstadoPaquete, type CategoriaProducto } from '@/types'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import HistorialRecibidasColombia from '@/components/admin/HistorialRecibidasColombia'

interface PaqueteCaja {
  id: string
  tracking_casilla: string | null
  tracking_usaco: string | null
  descripcion: string
  categoria: string
  peso_libras: number | string | null
  estado: string
  cliente_id: string | null
  bodega_destino: string
  cliente: { nombre_completo: string; numero_casilla: string | null } | null
}

interface CajaResponse {
  tracking_usaco: string
  total: number
  peso_total: number
  sin_asignar: number
  ya_recibidos_colombia: number
  estados: Record<string, number>
  paquetes: PaqueteCaja[]
}

const BODEGA_LABELS: Record<string, string> = {
  medellin: 'Medellín', bogota: 'Bogotá', barranquilla: 'Barranquilla',
}

export default function RecibirColombiaForm() {
  const inputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerControlsRef = useRef<IScannerControls | null>(null)

  const [tracking, setTracking] = useState('')
  const [caja, setCaja] = useState<CajaResponse | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState('')
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [notificar, setNotificar] = useState(true)
  const [notas, setNotas] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  // refreshKey para que el historial se recargue tras cada recepción exitosa
  const [historialKey, setHistorialKey] = useState(0)
  const [resultado, setResultado] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [scannerAbierto, setScannerAbierto] = useState(false)

  useEffect(() => { inputRef.current?.focus() }, [])

  // ─── Buscar caja por tracking USACO ──────────────────────────────────────
  async function buscar(q: string) {
    const term = q.trim()
    if (!term) return
    setBuscando(true)
    setError('')
    setCaja(null)
    setSeleccionados(new Set())
    setResultado(null)

    try {
      const res = await fetch(`/api/admin/recibir-colombia?tracking_usaco=${encodeURIComponent(term)}`)
      const data = await res.json() as { caja?: CajaResponse; error?: string }
      if (!res.ok || !data.caja) {
        setError(data.error ?? 'No se encontraron paquetes con ese tracking')
        return
      }
      setCaja(data.caja)
      // Pre-seleccionar todos los que aún no están en Colombia
      const elegibles = data.caja.paquetes.filter(p =>
        !['en_bodega_local', 'en_camino_cliente', 'entregado'].includes(p.estado)
      )
      setSeleccionados(new Set(elegibles.map(p => p.id)))
    } catch {
      setError('Error de conexión')
    } finally {
      setBuscando(false)
    }
  }

  // ─── Confirmar recepción ──────────────────────────────────────────────────
  async function confirmar() {
    if (!caja || seleccionados.size === 0) return
    setConfirmando(true)
    setResultado(null)

    const res = await fetch('/api/admin/recibir-colombia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tracking_usaco: caja.tracking_usaco,
        paquete_ids: Array.from(seleccionados),
        notas: notas || undefined,
        notificar,
      }),
    })
    const data = await res.json() as {
      ok?: boolean; error?: string;
      procesados?: number; notificados?: number; fallidos?: number; sin_cliente?: number;
      ya_estaban?: boolean;
    }

    setConfirmando(false)

    if (!res.ok || !data.ok) {
      setResultado({ tipo: 'error', texto: data.error ?? 'Error al procesar' })
      return
    }

    if (data.ya_estaban) {
      setResultado({ tipo: 'ok', texto: 'Estos paquetes ya estaban marcados como recibidos en Colombia.' })
      return
    }

    let txt = `✅ ${data.procesados} paquetes recibidos en bodega Colombia.`
    if (notificar && data.notificados) {
      txt += ` ${data.notificados} clientes notificados por WhatsApp.`
      if (data.fallidos) txt += ` ${data.fallidos} notificaciones fallaron.`
    }
    if (data.sin_cliente) txt += ` ${data.sin_cliente} sin cliente asignado.`

    setResultado({ tipo: 'ok', texto: txt })
    setHistorialKey(k => k + 1) // refresca el historial inferior

    // Recargar la caja después de 1.5s
    setTimeout(() => buscar(caja.tracking_usaco), 1500)
  }

  function toggleSeleccion(id: string) {
    setSeleccionados(prev => {
      const nuevo = new Set(prev)
      if (nuevo.has(id)) nuevo.delete(id); else nuevo.add(id)
      return nuevo
    })
  }

  function limpiar() {
    setCaja(null)
    setTracking('')
    setSeleccionados(new Set())
    setNotas('')
    setError('')
    setResultado(null)
    inputRef.current?.focus()
  }

  // ─── Scanner de cámara ────────────────────────────────────────────────────
  // Usa cámara trasera (facingMode 'environment') con resolución HD —
  // mejor enfoque para leer códigos de barra que el modo default.
  async function abrirScanner() {
    setScannerAbierto(true)
    await new Promise(r => setTimeout(r, 100)) // esperar a que el video monte
    if (!videoRef.current) return
    try {
      const codeReader = new BrowserMultiFormatReader()
      const controls = await codeReader.decodeFromConstraints(
        {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        videoRef.current,
        (result, _err, ctrl) => {
          if (result) {
            const text = result.getText().trim()
            ctrl.stop()
            setScannerAbierto(false)
            setTracking(text)
            buscar(text)
          }
        },
      )
      scannerControlsRef.current = controls
    } catch (err) {
      console.error('[scanner]', err)
      setError('No se pudo acceder a la cámara. Verifica los permisos del navegador.')
      setScannerAbierto(false)
    }
  }

  function cerrarScanner() {
    scannerControlsRef.current?.stop()
    scannerControlsRef.current = null
    setScannerAbierto(false)
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Resultado de operación */}
      {resultado && (
        <div className={`flex items-start gap-3 rounded-xl p-4 border ${
          resultado.tipo === 'ok' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
        }`}>
          {resultado.tipo === 'ok'
            ? <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0 text-green-600" />
            : <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0 text-red-600" />}
          <p className={`text-sm flex-1 ${resultado.tipo === 'ok' ? 'text-green-800' : 'text-red-700'}`}>
            {resultado.texto}
          </p>
          <button onClick={() => setResultado(null)} className="text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Scanner de tracking USACO */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center gap-2 text-gray-700 font-semibold">
          <ScanBarcode className="h-5 w-5 text-orange-600" />
          Escanear tracking USACO de la caja
        </div>
        <p className="text-xs text-gray-500 -mt-2">
          Cada caja USACO trae varios paquetes de distintos clientes. Escanea o escribe el tracking de la caja para ver lo que contiene.
        </p>

        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={tracking}
            onChange={e => { setTracking(e.target.value); setError('') }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); buscar(tracking) } }}
            placeholder="Tracking USACO de la caja..."
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-base font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={abrirScanner}
            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            title="Escanear con cámara"
          >
            <Camera className="h-5 w-5 text-gray-600" />
          </button>
          <Button
            onClick={() => buscar(tracking)}
            disabled={!tracking.trim() || buscando}
            className="bg-orange-600 hover:bg-orange-700 text-white gap-2"
          >
            {buscando
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Buscando...</>
              : <><Search className="h-4 w-4" /> Buscar</>}
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}
      </div>

      {/* Scanner overlay */}
      {scannerAbierto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={cerrarScanner}
        >
          <div
            className="relative bg-black rounded-lg overflow-hidden max-w-md w-full"
            onClick={e => e.stopPropagation()}
          >
            <video ref={videoRef} className="w-full max-h-[70vh] object-cover" playsInline muted />
            {/* Marco de guía visual */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-3/4 h-24 border-2 border-orange-500 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
            </div>
            <button
              type="button"
              onClick={cerrarScanner}
              className="absolute top-3 right-3 bg-white text-gray-900 p-2 rounded-full shadow-lg hover:bg-gray-100"
              aria-label="Cerrar escáner"
            >
              <X className="h-5 w-5" />
            </button>
            <p className="absolute bottom-3 left-3 right-3 text-center text-xs text-white bg-black/60 rounded px-3 py-2">
              Apunta la cámara al código de barras del tracking USACO
            </p>
          </div>
        </div>
      )}

      {/* Información de la caja */}
      {caja && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-xs text-gray-500">Caja USACO</p>
                <p className="font-mono font-bold text-gray-900">{caja.tracking_usaco}</p>
              </div>
              <button
                onClick={limpiar}
                className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <X className="h-3 w-3" /> Limpiar
              </button>
            </div>
            <div className="flex flex-wrap gap-3 mt-3 text-xs">
              <div className="bg-white border border-gray-200 rounded px-3 py-1.5">
                <span className="text-gray-500">Total: </span>
                <span className="font-bold">{caja.total}</span> paquetes
              </div>
              <div className="bg-white border border-gray-200 rounded px-3 py-1.5">
                <span className="text-gray-500">Peso: </span>
                <span className="font-bold">{caja.peso_total.toFixed(1)}</span> lb
              </div>
              {caja.sin_asignar > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded px-3 py-1.5 text-amber-800">
                  ⏳ {caja.sin_asignar} sin asignar
                </div>
              )}
              {caja.ya_recibidos_colombia > 0 && (
                <div className="bg-green-50 border border-green-200 rounded px-3 py-1.5 text-green-800">
                  ✓ {caja.ya_recibidos_colombia} ya en Colombia
                </div>
              )}
            </div>
          </div>

          {/* Lista de paquetes */}
          <div className="divide-y divide-gray-50 max-h-[480px] overflow-y-auto">
            {caja.paquetes.map(p => {
              const yaEnColombia = ['en_bodega_local', 'en_camino_cliente', 'entregado'].includes(p.estado)
              return (
                <label
                  key={p.id}
                  className={`flex items-center gap-3 px-5 py-3 text-sm cursor-pointer hover:bg-orange-50/40 ${
                    yaEnColombia ? 'opacity-50' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={seleccionados.has(p.id)}
                    onChange={() => toggleSeleccion(p.id)}
                    disabled={yaEnColombia}
                    className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  />
                  <Package className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span className="font-mono text-xs text-orange-700 font-semibold w-32 truncate">
                    {p.tracking_casilla}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${!p.cliente ? 'text-amber-700 italic' : 'text-gray-900'}`}>
                      {p.cliente?.nombre_completo ?? '⏳ Sin asignar'}
                      {p.cliente?.numero_casilla && (
                        <span className="text-gray-400 text-xs ml-1">({p.cliente.numero_casilla})</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {p.descripcion} · {CATEGORIA_LABELS[p.categoria as CategoriaProducto] ?? p.categoria}
                    </p>
                  </div>
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    <MapPin className="h-3 w-3 inline mr-0.5" />
                    {BODEGA_LABELS[p.bodega_destino] ?? p.bodega_destino}
                  </span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${ESTADO_COLORES[p.estado as EstadoPaquete] ?? 'bg-gray-100 text-gray-600'}`}>
                    {ESTADO_LABELS[p.estado as EstadoPaquete] ?? p.estado}
                  </span>
                </label>
              )
            })}
          </div>

          {/* Footer con acción */}
          {seleccionados.size > 0 && (
            <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">
                  Notas internas (opcional)
                </label>
                <input
                  type="text"
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  placeholder="Ej: Caja con avería, falta verificar..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={notificar}
                  onChange={e => setNotificar(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                />
                <MessageCircle className="h-4 w-4 text-green-600" />
                Notificar a los clientes por WhatsApp ({seleccionados.size} mensajes)
              </label>
              <Button
                onClick={confirmar}
                disabled={confirmando}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white gap-2 h-11"
              >
                {confirmando
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Procesando...</>
                  : <><CheckCircle2 className="h-4 w-4" /> Confirmar recepción de {seleccionados.size} paquete{seleccionados.size > 1 ? 's' : ''} en Colombia</>}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Historial de cajas recibidas en Colombia */}
      <HistorialRecibidasColombia refreshKey={historialKey} />
    </div>
  )
}
