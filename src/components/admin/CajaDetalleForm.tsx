'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ScanBarcode, Package, MapPin, X, Loader2, CheckCircle2, AlertCircle,
  Lock, Truck, Trash2, Camera, Search, Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CATEGORIA_LABELS, ESTADO_LABELS, ESTADO_COLORES, type CategoriaProducto, type EstadoPaquete } from '@/types'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'

const BODEGA_LABELS: Record<string, string> = {
  medellin: 'Medellín', bogota: 'Bogotá', barranquilla: 'Barranquilla',
}

const ESTADO_CAJA_BADGE: Record<string, string> = {
  abierta: 'bg-amber-100 text-amber-800 border-amber-300',
  cerrada: 'bg-blue-100 text-blue-800 border-blue-300',
  despachada: 'bg-orange-100 text-orange-800 border-orange-300',
  recibida_colombia: 'bg-green-100 text-green-800 border-green-300',
}

const ESTADO_CAJA_LABEL: Record<string, string> = {
  abierta: 'Abierta',
  cerrada: 'Cerrada',
  despachada: 'Despachada',
  recibida_colombia: 'Recibida en Colombia',
}

export interface PaqueteCaja {
  id: string
  tracking_casilla: string | null
  descripcion: string
  categoria: string
  peso_libras: number | string | null
  estado: string
  bodega_destino: string
  cliente: { nombre_completo: string; numero_casilla: string | null } | null
}

export interface CajaDetalle {
  id: string
  codigo_interno: string
  tracking_usaco: string | null
  courier: string | null
  bodega_destino: string
  peso_estimado: number | string | null
  peso_real: number | string | null
  costo_total_usaco: number | string | null
  estado: string
  notas: string | null
  created_at: string
  fecha_cierre: string | null
  fecha_despacho: string | null
}

export default function CajaDetalleForm({
  caja: cajaInicial,
  paquetesIniciales,
}: {
  caja: CajaDetalle
  paquetesIniciales: PaqueteCaja[]
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerControlsRef = useRef<IScannerControls | null>(null)

  const [caja, setCaja] = useState(cajaInicial)
  const [paquetes, setPaquetes] = useState<PaqueteCaja[]>(paquetesIniciales)
  const [tracking, setTracking] = useState('')
  const [agregando, setAgregando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error' | 'aviso'; texto: string; pendiente?: { tracking: string } } | null>(null)
  const [scannerAbierto, setScannerAbierto] = useState(false)

  // Modales
  const [modalCerrar, setModalCerrar] = useState(false)
  const [modalDespachar, setModalDespachar] = useState(false)
  const [modalEliminar, setModalEliminar] = useState(false)

  const editable = caja.estado === 'abierta'
  const pesoTotal = paquetes.reduce((s, p) => s + Number(p.peso_libras ?? 0), 0)

  useEffect(() => { if (editable) inputRef.current?.focus() }, [editable])

  // ─── Refrescar datos desde el servidor ─────────────────────────────────────
  async function refrescar() {
    const res = await fetch(`/api/admin/cajas/${caja.id}`)
    const data = await res.json() as { caja?: CajaDetalle; paquetes?: PaqueteCaja[] }
    if (data.caja) setCaja(data.caja)
    if (data.paquetes) setPaquetes(data.paquetes)
  }

  // ─── Agregar paquete ───────────────────────────────────────────────────────
  async function agregar(t: string, ignorarBodega = false) {
    const term = t.trim()
    if (!term) return
    setAgregando(true)
    setMensaje(null)
    try {
      const res = await fetch(`/api/admin/cajas/${caja.id}/paquetes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracking: term, ignorar_bodega: ignorarBodega }),
      })
      const data = await res.json() as { ok?: boolean; error?: string; codigo?: string; paquete?: { tracking_casilla: string } }

      if (!res.ok || !data.ok) {
        if (data.codigo === 'bodega_distinta') {
          setMensaje({
            tipo: 'aviso',
            texto: data.error ?? 'La bodega del paquete no coincide. ¿Agregar igual?',
            pendiente: { tracking: term },
          })
          return
        }
        setMensaje({ tipo: 'error', texto: data.error ?? 'Error al agregar' })
        return
      }

      setMensaje({ tipo: 'ok', texto: `✓ Agregado: ${data.paquete?.tracking_casilla}` })
      setTracking('')
      await refrescar()
      inputRef.current?.focus()
    } finally {
      setAgregando(false)
    }
  }

  async function quitarPaquete(paqueteId: string) {
    if (!confirm('¿Quitar este paquete de la caja?')) return
    const res = await fetch(`/api/admin/cajas/${caja.id}/paquetes?id=${paqueteId}`, {
      method: 'DELETE',
    })
    if (res.ok) await refrescar()
  }

  async function abrirScanner() {
    setScannerAbierto(true)
    await new Promise(r => setTimeout(r, 100))
    if (!videoRef.current) return
    try {
      const reader = new BrowserMultiFormatReader()
      const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, (result, _err, ctrl) => {
        if (result) {
          ctrl.stop()
          setScannerAbierto(false)
          const text = result.getText()
          setTracking(text)
          agregar(text)
        }
      })
      scannerControlsRef.current = controls
    } catch {
      setScannerAbierto(false)
    }
  }
  function cerrarScanner() {
    scannerControlsRef.current?.stop()
    setScannerAbierto(false)
  }

  return (
    <div className="space-y-5">
      {/* Stats de la caja */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${ESTADO_CAJA_BADGE[caja.estado]}`}>
              {ESTADO_CAJA_LABEL[caja.estado]}
            </span>
            <span className="text-sm text-gray-600 flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {BODEGA_LABELS[caja.bodega_destino] ?? caja.bodega_destino}
            </span>
            {caja.tracking_usaco && (
              <span className="text-sm text-orange-700 font-mono">USACO: {caja.tracking_usaco}</span>
            )}
            {caja.courier && (
              <span className="text-xs text-gray-500">via {caja.courier}</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <p className="text-xs text-gray-500">Paquetes</p>
            <p className="font-bold text-gray-900">{paquetes.length}</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <p className="text-xs text-gray-500">Peso suma</p>
            <p className="font-bold text-gray-900">{pesoTotal.toFixed(1)} lb</p>
          </div>
          {caja.peso_estimado && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              <p className="text-xs text-blue-600">Peso al cerrar</p>
              <p className="font-bold text-blue-900">{Number(caja.peso_estimado).toFixed(1)} lb</p>
            </div>
          )}
          {caja.peso_real && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
              <p className="text-xs text-orange-600">Peso USACO</p>
              <p className="font-bold text-orange-900">{Number(caja.peso_real).toFixed(1)} lb</p>
            </div>
          )}
        </div>

        {/* Acciones según estado */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
          {caja.estado === 'abierta' && (
            <>
              <Button
                onClick={() => setModalCerrar(true)}
                disabled={paquetes.length === 0}
                variant="outline"
                className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                <Lock className="h-4 w-4" />
                Cerrar caja
              </Button>
              <Button
                onClick={() => setModalDespachar(true)}
                disabled={paquetes.length === 0}
                className="gap-2 bg-orange-600 hover:bg-orange-700 text-white"
              >
                <Truck className="h-4 w-4" />
                Despachar a USACO
              </Button>
              {paquetes.length === 0 && (
                <Button
                  onClick={() => setModalEliminar(true)}
                  variant="outline"
                  className="gap-2 border-red-200 text-red-600 hover:bg-red-50 ml-auto"
                >
                  <Trash2 className="h-4 w-4" />
                  Eliminar caja
                </Button>
              )}
            </>
          )}
          {caja.estado === 'cerrada' && (
            <Button
              onClick={() => setModalDespachar(true)}
              className="gap-2 bg-orange-600 hover:bg-orange-700 text-white"
            >
              <Truck className="h-4 w-4" />
              Despachar a USACO
            </Button>
          )}
        </div>
      </div>

      {/* Escáner para agregar (solo si abierta) */}
      {editable && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center gap-2 text-gray-700 font-semibold">
            <ScanBarcode className="h-5 w-5 text-orange-600" />
            Agregar paquete a la caja
          </div>
          <p className="text-xs text-gray-500 -mt-2">
            Escanea o escribe el tracking CLD del paquete que vas a meter en esta caja.
            Solo se aceptan paquetes en estado &quot;Recibido en USA&quot;.
          </p>

          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={tracking}
              onChange={e => { setTracking(e.target.value); setMensaje(null) }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregar(tracking) } }}
              placeholder="CLD-XXXX o tracking del courier..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-base font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
              autoComplete="off"
              autoFocus
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
              onClick={() => agregar(tracking)}
              disabled={!tracking.trim() || agregando}
              className="bg-orange-600 hover:bg-orange-700 text-white gap-2"
            >
              {agregando
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Agregando...</>
                : <><Plus className="h-4 w-4" /> Agregar</>}
            </Button>
          </div>

          {mensaje && (
            <div className={`flex items-start gap-2 text-sm p-3 rounded-md border ${
              mensaje.tipo === 'ok' ? 'bg-green-50 border-green-200 text-green-700'
                : mensaje.tipo === 'aviso' ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-red-50 border-red-200 text-red-600'
            }`}>
              {mensaje.tipo === 'ok'
                ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
                : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />}
              <div className="flex-1">
                <p>{mensaje.texto}</p>
                {mensaje.pendiente && (
                  <Button
                    onClick={() => agregar(mensaje.pendiente!.tracking, true)}
                    size="sm"
                    className="mt-2 bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    Sí, agregarlo igual
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Scanner overlay */}
      {scannerAbierto && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={cerrarScanner}>
          <div className="bg-black rounded-lg overflow-hidden max-w-md w-full" onClick={e => e.stopPropagation()}>
            <video ref={videoRef} className="w-full max-h-[70vh] object-cover" playsInline muted />
            <button onClick={cerrarScanner} className="absolute top-4 right-4 bg-white text-gray-900 p-2 rounded-full">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Lista de paquetes adentro */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">
            Contenido de la caja
          </span>
          <span className="text-xs bg-orange-100 text-orange-700 font-semibold px-2 py-0.5 rounded-full">
            {paquetes.length}
          </span>
        </div>

        {paquetes.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
            La caja está vacía. Escanea paquetes para llenarla.
          </div>
        ) : (
          <div className="divide-y divide-gray-50 max-h-[480px] overflow-y-auto">
            {paquetes.map(p => (
              <div key={p.id} className="flex items-center gap-3 px-5 py-3 text-sm group hover:bg-gray-50">
                <Package className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <span className="font-mono text-xs font-semibold text-orange-700 w-32 truncate">
                  {p.tracking_casilla}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${!p.cliente ? 'text-amber-700 italic' : 'text-gray-900 font-medium'}`}>
                    {p.cliente?.nombre_completo ?? '⏳ Sin asignar'}
                    {p.cliente?.numero_casilla && (
                      <span className="text-gray-400 text-xs ml-1">({p.cliente.numero_casilla})</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {p.descripcion} · {CATEGORIA_LABELS[p.categoria as CategoriaProducto] ?? p.categoria}
                  </p>
                </div>
                {p.bodega_destino !== caja.bodega_destino && (
                  <span className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                    ⚠️ {BODEGA_LABELS[p.bodega_destino] ?? p.bodega_destino}
                  </span>
                )}
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  {p.peso_libras ? `${p.peso_libras} lb` : '—'}
                </span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${ESTADO_COLORES[p.estado as EstadoPaquete] ?? 'bg-gray-100'}`}>
                  {ESTADO_LABELS[p.estado as EstadoPaquete] ?? p.estado}
                </span>
                {editable && (
                  <button
                    onClick={() => quitarPaquete(p.id)}
                    className="text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100"
                    title="Quitar de la caja"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modales */}
      {modalCerrar && (
        <ModalCerrarCaja cajaId={caja.id} pesoSugerido={pesoTotal} onClose={() => setModalCerrar(false)} onDone={() => { setModalCerrar(false); router.refresh(); refrescar() }} />
      )}
      {modalDespachar && (
        <ModalDespacharCaja cajaId={caja.id} pesoSugerido={Number(caja.peso_estimado ?? pesoTotal)} onClose={() => setModalDespachar(false)} onDone={() => { setModalDespachar(false); router.refresh(); refrescar() }} />
      )}
      {modalEliminar && (
        <ModalEliminarCaja cajaId={caja.id} codigo={caja.codigo_interno} onClose={() => setModalEliminar(false)} onDone={() => router.push('/admin/cajas')} />
      )}
    </div>
  )
}

// ─── Modales ────────────────────────────────────────────────────────────────
function ModalCerrarCaja({ cajaId, pesoSugerido, onClose, onDone }: { cajaId: string; pesoSugerido: number; onClose: () => void; onDone: () => void }) {
  const [peso, setPeso] = useState(pesoSugerido.toFixed(1))
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  async function confirmar() {
    setCargando(true)
    setError('')
    const res = await fetch(`/api/admin/cajas/${cajaId}/cerrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ peso_estimado: parseFloat(peso) }),
    })
    const data = await res.json() as { ok?: boolean; error?: string }
    setCargando(false)
    if (!res.ok || !data.ok) { setError(data.error ?? 'Error'); return }
    onDone()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !cargando && onClose()}>
      <div className="bg-white rounded-xl p-5 max-w-md w-full space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold flex items-center gap-2"><Lock className="h-5 w-5 text-blue-600" /> Cerrar caja</h3>
        <p className="text-sm text-gray-600">
          Al cerrar la caja, ya no podrás agregar ni quitar paquetes. Los paquetes pasarán a estado &quot;Listo para envío&quot;.
        </p>
        <div>
          <label className="text-xs font-medium text-gray-700 block mb-1">Peso final estimado (lb)</label>
          <input type="number" step="0.1" value={peso} onChange={e => setPeso(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <p className="text-[11px] text-gray-400 mt-1">Suma actual de los paquetes: {pesoSugerido.toFixed(1)} lb</p>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={cargando}>Cancelar</Button>
          <Button onClick={confirmar} disabled={cargando} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
            {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cerrar caja'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function ModalDespacharCaja({ cajaId, pesoSugerido, onClose, onDone }: { cajaId: string; pesoSugerido: number; onClose: () => void; onDone: () => void }) {
  const [trackingUsaco, setTrackingUsaco] = useState('')
  const [pesoReal, setPesoReal] = useState('')
  const [costo, setCosto] = useState('')
  const [courier, setCourier] = useState('')
  const [notificar, setNotificar] = useState(true)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  async function confirmar() {
    if (!trackingUsaco.trim()) { setError('Tracking USACO requerido'); return }
    setCargando(true)
    setError('')
    const res = await fetch(`/api/admin/cajas/${cajaId}/despachar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tracking_usaco: trackingUsaco.trim(),
        peso_real: pesoReal ? parseFloat(pesoReal) : undefined,
        costo_total_usaco: costo ? parseFloat(costo) : undefined,
        courier: courier.trim() || undefined,
        notificar,
      }),
    })
    const data = await res.json() as { ok?: boolean; error?: string; notificados?: number; paquetes?: number }
    setCargando(false)
    if (!res.ok || !data.ok) { setError(data.error ?? 'Error'); return }
    onDone()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !cargando && onClose()}>
      <div className="bg-white rounded-xl p-5 max-w-md w-full space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold flex items-center gap-2"><Truck className="h-5 w-5 text-orange-600" /> Despachar a USACO</h3>
        <p className="text-sm text-gray-600">
          Pega los datos que te dio USACO al recoger la caja. Los paquetes pasarán a &quot;En tránsito&quot; y los clientes recibirán WhatsApp.
        </p>

        <div>
          <label className="text-xs font-medium text-gray-700 block mb-1">Tracking USACO *</label>
          <input type="text" value={trackingUsaco} onChange={e => setTrackingUsaco(e.target.value)}
            placeholder="Ej: 1Z9999AA1234567890"
            className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Peso real USACO (lb)</label>
            <input type="number" step="0.1" value={pesoReal} onChange={e => setPesoReal(e.target.value)}
              placeholder={pesoSugerido.toFixed(1)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Costo total USD</label>
            <input type="number" step="0.01" value={costo} onChange={e => setCosto(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 block mb-1">Courier (opcional)</label>
          <input type="text" value={courier} onChange={e => setCourier(e.target.value)}
            placeholder="USACO Express"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={notificar} onChange={e => setNotificar(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500" />
          Notificar a los clientes por WhatsApp
        </label>
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={cargando}>Cancelar</Button>
          <Button onClick={confirmar} disabled={cargando} className="flex-1 bg-orange-600 hover:bg-orange-700 text-white">
            {cargando ? <><Loader2 className="h-4 w-4 animate-spin" /> Despachando...</> : <><Truck className="h-4 w-4 mr-1" /> Despachar</>}
          </Button>
        </div>
      </div>
    </div>
  )
}

function ModalEliminarCaja({ cajaId, codigo, onClose, onDone }: { cajaId: string; codigo: string; onClose: () => void; onDone: () => void }) {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  async function confirmar() {
    setCargando(true)
    const res = await fetch(`/api/admin/cajas/${cajaId}`, { method: 'DELETE' })
    const data = await res.json() as { ok?: boolean; error?: string }
    setCargando(false)
    if (!res.ok || !data.ok) { setError(data.error ?? 'Error'); return }
    onDone()
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !cargando && onClose()}>
      <div className="bg-white rounded-xl p-5 max-w-md w-full space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold flex items-center gap-2"><Trash2 className="h-5 w-5 text-red-600" /> Eliminar caja</h3>
        <p className="text-sm text-gray-700">¿Estás seguro de que quieres eliminar la caja <span className="font-mono font-bold">{codigo}</span>? Esta acción no se puede deshacer.</p>
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={cargando}>Cancelar</Button>
          <Button onClick={confirmar} disabled={cargando} className="flex-1 bg-red-600 hover:bg-red-700 text-white">
            {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sí, eliminar'}
          </Button>
        </div>
      </div>
    </div>
  )
}
