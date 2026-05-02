'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ScanBarcode, Package, MapPin, X, Loader2, CheckCircle2, AlertCircle,
  Lock, Truck, Trash2, Camera, Plus, RefreshCw, Globe, Pencil, Save,
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
  const [modalEditar, setModalEditar] = useState(false)

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

          {/* Editar y eliminar siempre visibles (excepto si ya recibida en Colombia para eliminar) */}
          <Button
            onClick={() => setModalEditar(true)}
            variant="outline"
            className="gap-2"
            size="sm"
          >
            <Pencil className="h-4 w-4" />
            Editar caja
          </Button>
          {caja.estado !== 'recibida_colombia' && (
            <Button
              onClick={() => setModalEliminar(true)}
              variant="outline"
              size="sm"
              className="gap-2 border-red-200 text-red-600 hover:bg-red-50 ml-auto"
            >
              <Trash2 className="h-4 w-4" />
              Eliminar caja
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

      {/* Paquetes disponibles para agregar (solo si abierta) */}
      {editable && (
        <PaquetesDisponibles
          bodegaCaja={caja.bodega_destino}
          onAgregar={async (tracking) => {
            await agregar(tracking)
          }}
          onAgregarConBodegaDistinta={async (tracking) => {
            await agregar(tracking, true)
          }}
        />
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
        <ModalEliminarCaja
          cajaId={caja.id}
          codigo={caja.codigo_interno}
          paquetesCount={paquetes.length}
          onClose={() => setModalEliminar(false)}
          onDone={() => router.push('/admin/cajas')}
        />
      )}
      {modalEditar && (
        <ModalEditarCaja
          caja={caja}
          onClose={() => setModalEditar(false)}
          onDone={() => { setModalEditar(false); router.refresh(); refrescar() }}
        />
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

function ModalEliminarCaja({ cajaId, codigo, paquetesCount, onClose, onDone }: {
  cajaId: string; codigo: string; paquetesCount: number; onClose: () => void; onDone: () => void
}) {
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
        <p className="text-sm text-gray-700">
          ¿Estás seguro de que quieres eliminar la caja <span className="font-mono font-bold">{codigo}</span>?
        </p>
        {paquetesCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 space-y-1">
            <p className="font-semibold flex items-center gap-1">
              <AlertCircle className="h-4 w-4" /> Esta caja tiene {paquetesCount} paquete{paquetesCount > 1 ? 's' : ''} adentro
            </p>
            <p className="text-xs leading-relaxed">
              Al eliminar la caja, los paquetes volverán al estado &quot;Recibido en USA&quot; y quedarán
              disponibles para meterlos en otra caja. Su tracking USACO (si lo tenían heredado) se limpia.
            </p>
          </div>
        )}
        <p className="text-xs text-gray-500">Esta acción no se puede deshacer.</p>
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

// ─── Modal editar datos de la caja ──────────────────────────────────────────
function ModalEditarCaja({ caja, onClose, onDone }: { caja: CajaDetalle; onClose: () => void; onDone: () => void }) {
  const [bodega, setBodega] = useState(caja.bodega_destino)
  const [courier, setCourier] = useState(caja.courier ?? '')
  const [trackingUsaco, setTrackingUsaco] = useState(caja.tracking_usaco ?? '')
  const [pesoEstimado, setPesoEstimado] = useState(caja.peso_estimado != null ? String(caja.peso_estimado) : '')
  const [pesoReal, setPesoReal] = useState(caja.peso_real != null ? String(caja.peso_real) : '')
  const [costo, setCosto] = useState(caja.costo_total_usaco != null ? String(caja.costo_total_usaco) : '')
  const [notas, setNotas] = useState(caja.notas ?? '')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  async function guardar() {
    setCargando(true)
    setError('')
    const res = await fetch(`/api/admin/cajas/${caja.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bodega_destino: bodega,
        courier: courier.trim() || null,
        tracking_usaco: trackingUsaco.trim() || null,
        peso_estimado: pesoEstimado ? parseFloat(pesoEstimado) : null,
        peso_real: pesoReal ? parseFloat(pesoReal) : null,
        costo_total_usaco: costo ? parseFloat(costo) : null,
        notas: notas.trim() || null,
      }),
    })
    const data = await res.json() as { ok?: boolean; error?: string }
    setCargando(false)
    if (!res.ok || !data.ok) { setError(data.error ?? 'Error al guardar'); return }
    onDone()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !cargando && onClose()}>
      <div className="bg-white rounded-xl p-5 max-w-lg w-full space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold flex items-center gap-2"><Pencil className="h-5 w-5 text-orange-600" /> Editar caja</h3>
          <button onClick={onClose} disabled={cargando} className="text-gray-400 hover:text-gray-600 disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-xs text-gray-500 -mt-3">Modifica los datos de la caja. Los cambios se aplicarán de inmediato.</p>

        <div>
          <label className="text-xs font-medium text-gray-700 block mb-1">Ciudad destino</label>
          <select
            value={bodega}
            onChange={e => setBodega(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="medellin">Medellín</option>
            <option value="bogota">Bogotá</option>
            <option value="barranquilla">Barranquilla</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-700 block mb-1">Courier</label>
          <input
            type="text" value={courier} onChange={e => setCourier(e.target.value)}
            placeholder="USACO Express"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-700 block mb-1">Tracking USACO</label>
          <input
            type="text" value={trackingUsaco} onChange={e => setTrackingUsaco(e.target.value)}
            placeholder="1Z9999AA1234567890"
            className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <p className="text-[11px] text-gray-400 mt-1">Si lo cambias, todos los paquetes de la caja heredarán el nuevo tracking automáticamente.</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Peso est. (lb)</label>
            <input type="number" step="0.1" value={pesoEstimado} onChange={e => setPesoEstimado(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Peso real (lb)</label>
            <input type="number" step="0.1" value={pesoReal} onChange={e => setPesoReal(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Costo USD</label>
            <input type="number" step="0.01" value={costo} onChange={e => setCosto(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500" />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-700 block mb-1">Notas</label>
          <textarea
            value={notas} onChange={e => setNotas(e.target.value)} rows={2}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
          />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={cargando}>Cancelar</Button>
          <Button onClick={guardar} disabled={cargando} className="flex-1 bg-orange-600 hover:bg-orange-700 text-white gap-2">
            {cargando ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</> : <><Save className="h-4 w-4" /> Guardar cambios</>}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Lista de paquetes disponibles para agregar a la caja ───────────────────
interface PaqueteDisponible {
  id: string
  tracking_casilla: string | null
  tracking_origen: string | null
  descripcion: string
  categoria: string
  peso_libras: number | string | null
  bodega_destino: string
  fecha_recepcion_usa: string | null
  estado: string
  cliente: { nombre_completo: string; numero_casilla: string | null } | null
}

type FiltroEstado = 'todos' | 'recibido_usa' | 'listo_envio' | 'en_consolidacion'

const ESTADO_PAQUETE_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  recibido_usa: { bg: 'bg-blue-100 border-blue-200', text: 'text-blue-700', label: 'Recibido en USA' },
  listo_envio: { bg: 'bg-green-100 border-green-200', text: 'text-green-700', label: 'Listo para envío' },
  en_consolidacion: { bg: 'bg-amber-100 border-amber-200', text: 'text-amber-700', label: 'En consolidación' },
}

function PaquetesDisponibles({
  bodegaCaja,
  onAgregar,
  onAgregarConBodegaDistinta,
}: {
  bodegaCaja: string
  onAgregar: (tracking: string) => Promise<void>
  onAgregarConBodegaDistinta: (tracking: string) => Promise<void>
}) {
  const [paquetes, setPaquetes] = useState<PaqueteDisponible[]>([])
  const [stats, setStats] = useState<{
    total: number; mostrando: number;
    porEstado: { recibido_usa: number; listo_envio: number; en_consolidacion: number };
  } | null>(null)
  const [cargando, setCargando] = useState(false)
  const [query, setQuery] = useState('')
  const [todasBodegas, setTodasBodegas] = useState(false)
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos')
  const [agregandoId, setAgregandoId] = useState<string | null>(null)

  async function cargar() {
    setCargando(true)
    const params = new URLSearchParams()
    params.set('bodega', bodegaCaja)
    if (todasBodegas) params.set('todas', '1')
    if (query.trim()) params.set('q', query.trim())
    if (filtroEstado === 'todos') params.set('estados', 'recibido_usa,listo_envio,en_consolidacion')
    else params.set('estados', filtroEstado)

    const res = await fetch(`/api/admin/cajas/disponibles?${params}`)
    const data = await res.json() as {
      paquetes?: PaqueteDisponible[]
      total_disponibles?: number
      mostrando?: number
      conteo_por_estado?: Record<string, number>
    }
    setPaquetes(data.paquetes ?? [])
    setStats({
      total: data.total_disponibles ?? 0,
      mostrando: data.mostrando ?? 0,
      porEstado: {
        recibido_usa: data.conteo_por_estado?.recibido_usa ?? 0,
        listo_envio: data.conteo_por_estado?.listo_envio ?? 0,
        en_consolidacion: data.conteo_por_estado?.en_consolidacion ?? 0,
      },
    })
    setCargando(false)
  }

  useEffect(() => {
    const t = setTimeout(cargar, 200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, todasBodegas, filtroEstado])

  async function handleAgregar(p: PaqueteDisponible) {
    if (!p.tracking_casilla) return
    setAgregandoId(p.id)
    try {
      const fn = (p.bodega_destino !== bodegaCaja) ? onAgregarConBodegaDistinta : onAgregar
      await fn(p.tracking_casilla)
      // Recargar lista (el agregado ya no debe aparecer)
      await cargar()
    } finally {
      setAgregandoId(null)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-orange-600" />
          <span className="text-sm font-semibold text-gray-700">Paquetes disponibles para agregar</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={todasBodegas}
              onChange={e => setTodasBodegas(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
            />
            <Globe className="h-3 w-3" /> Todas las bodegas
          </label>
          <button
            onClick={cargar}
            className="text-gray-400 hover:text-gray-700"
            title="Recargar"
          >
            <RefreshCw className={`h-4 w-4 ${cargando ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs por estado */}
      {stats && (
        <div className="px-5 py-2 border-b border-gray-100 bg-gray-50/50 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFiltroEstado('todos')}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              filtroEstado === 'todos'
                ? 'bg-orange-600 text-white border-orange-600'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
            }`}
          >
            Todos · {stats.porEstado.recibido_usa + stats.porEstado.listo_envio + stats.porEstado.en_consolidacion}
          </button>
          <button
            type="button"
            onClick={() => setFiltroEstado('recibido_usa')}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors flex items-center gap-1.5 ${
              filtroEstado === 'recibido_usa'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${filtroEstado === 'recibido_usa' ? 'bg-white' : 'bg-blue-500'}`} />
            Recibidos en USA · {stats.porEstado.recibido_usa}
          </button>
          <button
            type="button"
            onClick={() => setFiltroEstado('en_consolidacion')}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors flex items-center gap-1.5 ${
              filtroEstado === 'en_consolidacion'
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${filtroEstado === 'en_consolidacion' ? 'bg-white' : 'bg-amber-500'}`} />
            En consolidación · {stats.porEstado.en_consolidacion}
          </button>
          <button
            type="button"
            onClick={() => setFiltroEstado('listo_envio')}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors flex items-center gap-1.5 ${
              filtroEstado === 'listo_envio'
                ? 'bg-green-600 text-white border-green-600'
                : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${filtroEstado === 'listo_envio' ? 'bg-white' : 'bg-green-500'}`} />
            Listos para envío · {stats.porEstado.listo_envio}
          </button>
        </div>
      )}

      {/* Búsqueda */}
      <div className="px-5 py-2 border-b border-gray-100 bg-gray-50">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar por tracking, descripción o nombre del cliente..."
          className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        {stats && (
          <p className="text-[11px] text-gray-500 mt-1">
            {todasBodegas
              ? `${stats.mostrando} de ${stats.total} paquetes (todas las bodegas)`
              : `${stats.mostrando} de ${stats.total} paquetes para ${BODEGA_LABELS[bodegaCaja] ?? bodegaCaja}`}
          </p>
        )}
      </div>

      {/* Lista */}
      <div className="divide-y divide-gray-50 max-h-[420px] overflow-y-auto">
        {cargando ? (
          <div className="text-center py-12 text-gray-400 text-sm flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
          </div>
        ) : paquetes.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
            {query
              ? 'Sin resultados con ese filtro'
              : todasBodegas
                ? 'No hay paquetes disponibles para agregar a cajas'
                : `No hay paquetes recibidos para ${BODEGA_LABELS[bodegaCaja] ?? bodegaCaja}`}
            {!todasBodegas && (
              <p className="text-[11px] mt-1">
                ¿Buscas paquetes de otras ciudades? Activa &quot;Todas las bodegas&quot; arriba.
              </p>
            )}
          </div>
        ) : (
          paquetes.map(p => {
            const bodegaDistinta = p.bodega_destino !== bodegaCaja
            const estadoStyle = ESTADO_PAQUETE_BADGE[p.estado] ?? ESTADO_PAQUETE_BADGE.recibido_usa
            // Borde izquierdo del color del estado
            const borderColor =
              p.estado === 'listo_envio' ? 'border-l-green-500'
                : p.estado === 'recibido_usa' ? 'border-l-blue-500'
                  : p.estado === 'en_consolidacion' ? 'border-l-amber-500'
                    : 'border-l-gray-300'
            return (
              <div key={p.id} className={`flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-gray-50 group border-l-4 ${borderColor}`}>
                <Package className={`h-4 w-4 flex-shrink-0 ${bodegaDistinta ? 'text-amber-500' : 'text-gray-400'}`} />
                <span className="font-mono text-xs font-semibold text-orange-700 w-32 truncate">
                  {p.tracking_casilla}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${p.cliente ? 'text-gray-900 font-medium' : 'text-amber-700 italic font-medium'}`}>
                    {p.cliente?.nombre_completo ?? '⏳ Sin cliente asignado'}
                    {p.cliente?.numero_casilla && (
                      <span className="text-gray-400 text-xs ml-1">({p.cliente.numero_casilla})</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {p.descripcion} · {CATEGORIA_LABELS[p.categoria as CategoriaProducto] ?? p.categoria}
                  </p>
                </div>
                {/* Badge si no tiene cliente */}
                {!p.cliente && (
                  <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded whitespace-nowrap">
                    Sin cliente
                  </span>
                )}
                {/* Badge del estado del paquete */}
                <span className={`text-[11px] px-2 py-0.5 rounded-full border whitespace-nowrap ${estadoStyle.bg} ${estadoStyle.text}`}>
                  {estadoStyle.label}
                </span>
                {bodegaDistinta && (
                  <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded whitespace-nowrap">
                    ⚠️ {BODEGA_LABELS[p.bodega_destino] ?? p.bodega_destino}
                  </span>
                )}
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  {p.peso_libras ? `${p.peso_libras} lb` : '—'}
                </span>
                <Button
                  size="sm"
                  onClick={() => handleAgregar(p)}
                  disabled={agregandoId !== null}
                  className="bg-orange-600 hover:bg-orange-700 text-white gap-1 text-xs h-7 px-2"
                >
                  {agregandoId === p.id
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <><Plus className="h-3 w-3" /> Agregar</>}
                </Button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
