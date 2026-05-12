'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ScanBarcode, Package, MapPin, X, Loader2, CheckCircle2, AlertCircle,
  Lock, Truck, Trash2, Camera, Plus, RefreshCw, Globe, Pencil, Save, Box,
} from 'lucide-react'
import { CATEGORIA_LABELS, ESTADO_LABELS, type CategoriaProducto, type EstadoPaquete } from '@/types'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import FotoThumb from '@/components/ui/FotoThumb'

const ESTADO_DARK: Record<string, { bg: string; color: string; border: string }> = {
  reportado:         { bg: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)', border: 'rgba(255,255,255,0.12)' },
  recibido_usa:      { bg: 'rgba(99,130,255,0.12)',  color: '#8899ff',               border: 'rgba(99,130,255,0.3)'  },
  en_consolidacion:  { bg: 'rgba(245,184,0,0.10)',   color: '#F5B800',               border: 'rgba(245,184,0,0.25)'  },
  listo_envio:       { bg: 'rgba(168,85,247,0.12)',  color: '#c084fc',               border: 'rgba(168,85,247,0.3)'  },
  en_transito:       { bg: 'rgba(251,146,60,0.12)',  color: '#fb923c',               border: 'rgba(251,146,60,0.3)'  },
  en_colombia:       { bg: 'rgba(34,211,238,0.10)',  color: '#22d3ee',               border: 'rgba(34,211,238,0.25)' },
  en_bodega_local:   { bg: 'rgba(99,130,255,0.10)',  color: '#818cf8',               border: 'rgba(99,130,255,0.25)' },
  en_camino_cliente: { bg: 'rgba(132,204,22,0.10)',  color: '#a3e635',               border: 'rgba(132,204,22,0.25)' },
  entregado:         { bg: 'rgba(52,211,153,0.12)',  color: '#34d399',               border: 'rgba(52,211,153,0.3)'  },
  retenido:          { bg: 'rgba(239,68,68,0.12)',   color: '#f87171',               border: 'rgba(239,68,68,0.3)'   },
  devuelto:          { bg: 'rgba(244,63,94,0.12)',   color: '#fb7185',               border: 'rgba(244,63,94,0.3)'   },
}

const tw = 'rgba(255,255,255,'

const BODEGA_LABELS: Record<string, string> = {
  medellin: 'Medellín', bogota: 'Bogotá', barranquilla: 'Barranquilla',
}

const ESTADO_CAJA_STYLE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  abierta:           { bg: 'rgba(245,184,0,0.12)',  color: '#F5B800',  border: 'rgba(245,184,0,0.3)',  label: 'Abierta' },
  cerrada:           { bg: 'rgba(99,130,255,0.12)', color: '#8899ff',  border: 'rgba(99,130,255,0.3)', label: 'Cerrada' },
  despachada:        { bg: 'rgba(168,85,247,0.12)', color: '#c084fc',  border: 'rgba(168,85,247,0.3)', label: 'Despachada' },
  recibida_colombia: { bg: 'rgba(52,211,153,0.12)', color: '#34d399',  border: 'rgba(52,211,153,0.3)', label: 'Recibida en Colombia' },
}

export interface PaqueteCaja {
  id: string
  tracking_casilla: string | null
  descripcion: string
  categoria: string
  peso_libras: number | string | null
  valor_declarado: number | string | null
  estado: string
  bodega_destino: string
  cliente: { nombre_completo: string; numero_casilla: string | null } | null
  foto_url?: string | null
}

export interface CajaDetalle {
  id: string
  codigo_interno: string
  tracking_usaco: string | null
  courier: string | null
  bodega_destino: string
  tipo: 'correo' | 'manejo' | null
  peso_estimado: number | string | null
  peso_real: number | string | null
  costo_total_usaco: number | string | null
  estado: string
  notas: string | null
  created_at: string
  fecha_cierre: string | null
  fecha_despacho: string | null
}

const modalOverlay = { background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }
const modalCard = {
  background: 'rgba(10,10,25,0.92)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: `1px solid ${tw}0.1)`,
  borderRadius: '1rem',
}
const inputClass = 'glass-input w-full px-3 py-2 text-sm rounded-xl focus:outline-none'
const labelStyle = { color: `${tw}0.6)` }

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

  const [modalCerrar, setModalCerrar] = useState(false)
  const [modalDespachar, setModalDespachar] = useState(false)
  const [modalEliminar, setModalEliminar] = useState(false)
  const [modalEditar, setModalEditar] = useState(false)

  const editable = true // admin siempre puede agregar/quitar paquetes
  const pesoTotal = paquetes.reduce((s, p) => s + Number(p.peso_libras ?? 0), 0)
  const valorTotal = paquetes.reduce((s, p) => s + Number(p.valor_declarado ?? 0), 0)

  useEffect(() => { if (editable) inputRef.current?.focus() }, [editable])

  async function refrescar() {
    const res = await fetch(`/api/admin/cajas/${caja.id}`)
    const data = await res.json() as { caja?: CajaDetalle; paquetes?: PaqueteCaja[] }
    if (data.caja) setCaja(data.caja)
    if (data.paquetes) setPaquetes(data.paquetes)
  }

  async function agregar(t: string, ignorarBodega = false, mover = false) {
    const term = t.trim()
    if (!term) return
    setAgregando(true)
    setMensaje(null)
    try {
      const res = await fetch(`/api/admin/cajas/${caja.id}/paquetes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracking: term, ignorar_bodega: ignorarBodega, mover }),
      })
      const data = await res.json() as { ok?: boolean; error?: string; codigo?: string; movido?: boolean; paquete?: { tracking_casilla: string }; caja_origen?: { codigo_interno: string } | null }

      if (!res.ok || !data.ok) {
        if (data.codigo === 'bodega_distinta') {
          setMensaje({ tipo: 'aviso', texto: data.error ?? 'La bodega del paquete no coincide. ¿Agregar igual?', pendiente: { tracking: term } })
          return
        }
        setMensaje({ tipo: 'error', texto: data.error ?? 'Error al agregar' })
        return
      }

      const textoOk = data.movido && data.caja_origen
        ? `✓ Movido desde ${data.caja_origen.codigo_interno}: ${data.paquete?.tracking_casilla}`
        : `✓ Agregado: ${data.paquete?.tracking_casilla}`
      setMensaje({ tipo: 'ok', texto: textoOk })
      setTracking('')
      await refrescar()
      inputRef.current?.focus()
    } finally {
      setAgregando(false)
    }
  }

  async function quitarPaquete(paqueteId: string) {
    if (!confirm('¿Quitar este paquete de la caja?')) return
    const res = await fetch(`/api/admin/cajas/${caja.id}/paquetes?id=${paqueteId}`, { method: 'DELETE' })
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

  const estadoStyle = ESTADO_CAJA_STYLE[caja.estado] ?? { bg: `${tw}0.06)`, color: `${tw}0.5)`, border: `${tw}0.1)`, label: caja.estado }

  return (
    <div className="space-y-5">
      {/* Stats de la caja */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
              style={{ background: estadoStyle.bg, color: estadoStyle.color, border: `1px solid ${estadoStyle.border}` }}>
              {estadoStyle.label}
            </span>
            <span className="text-sm flex items-center gap-1" style={{ color: `${tw}0.55)` }}>
              <MapPin className="h-3.5 w-3.5" />
              {BODEGA_LABELS[caja.bodega_destino] ?? caja.bodega_destino}
            </span>
            {caja.tracking_usaco && (
              <span className="text-sm font-mono" style={{ color: '#F5B800' }}>USACO: {caja.tracking_usaco}</span>
            )}
            {caja.courier && (
              <span className="text-xs" style={{ color: `${tw}0.4)` }}>via {caja.courier}</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div className="rounded-xl px-3 py-2" style={{ background: `${tw}0.04)`, border: `1px solid ${tw}0.08)` }}>
            <p className="text-xs" style={{ color: `${tw}0.45)` }}>Paquetes</p>
            <p className="font-bold text-white">{paquetes.length}</p>
          </div>
          <div className="rounded-xl px-3 py-2" style={{ background: `${tw}0.04)`, border: `1px solid ${tw}0.08)` }}>
            <p className="text-xs" style={{ color: `${tw}0.45)` }}>Peso suma</p>
            <p className="font-bold text-white">{pesoTotal.toFixed(1)} lb</p>
          </div>
          {caja.peso_estimado && (
            <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(99,130,255,0.08)', border: '1px solid rgba(99,130,255,0.2)' }}>
              <p className="text-xs" style={{ color: '#8899ff' }}>Peso al cerrar</p>
              <p className="font-bold" style={{ color: '#8899ff' }}>{Number(caja.peso_estimado).toFixed(1)} lb</p>
            </div>
          )}
          {caja.peso_real && (
            <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(245,184,0,0.08)', border: '1px solid rgba(245,184,0,0.2)' }}>
              <p className="text-xs" style={{ color: '#F5B800' }}>Peso USACO</p>
              <p className="font-bold" style={{ color: '#F5B800' }}>{Number(caja.peso_real).toFixed(1)} lb</p>
            </div>
          )}
          {valorTotal > 0 && (
            <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
              <p className="text-xs" style={{ color: '#34d399' }}>Valor declarado</p>
              <p className="font-bold" style={{ color: '#34d399' }}>${valorTotal.toFixed(2)} USD</p>
            </div>
          )}
        </div>

        {/* Acciones */}
        <div className="flex flex-wrap gap-2 pt-2" style={{ borderTop: `1px solid ${tw}0.06)` }}>
          {caja.estado === 'abierta' && (
            <>
              <button
                onClick={() => setModalCerrar(true)}
                disabled={paquetes.length === 0}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium disabled:opacity-40 transition-colors"
                style={{ background: 'rgba(99,130,255,0.1)', color: '#8899ff', border: '1px solid rgba(99,130,255,0.25)' }}
              >
                <Lock className="h-4 w-4" />
                Cerrar caja
              </button>
              <button
                onClick={() => setModalDespachar(true)}
                disabled={paquetes.length === 0}
                className="btn-gold flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
              >
                <Truck className="h-4 w-4" />
                Despachar a USACO
              </button>
            </>
          )}
          {caja.estado === 'cerrada' && (
            <button
              onClick={() => setModalDespachar(true)}
              className="btn-gold flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold"
            >
              <Truck className="h-4 w-4" />
              Despachar a USACO
            </button>
          )}

          <button
            onClick={() => setModalEditar(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{ border: `1px solid ${tw}0.12)`, color: `${tw}0.65)` }}
            onMouseEnter={e => (e.currentTarget.style.background = `${tw}0.05)`)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <Pencil className="h-4 w-4" />
            Editar caja
          </button>

          {caja.estado !== 'recibida_colombia' && (
            <button
              onClick={() => setModalEliminar(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium ml-auto transition-colors"
              style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              <Trash2 className="h-4 w-4" />
              Eliminar caja
            </button>
          )}
        </div>
      </div>

      {/* Escáner para agregar */}
      {editable && (
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center gap-2 font-semibold text-white">
            <ScanBarcode className="h-5 w-5" style={{ color: '#F5B800' }} />
            Agregar paquete a la caja
          </div>
          <p className="text-xs -mt-2" style={{ color: `${tw}0.45)` }}>
            Escanea o escribe el tracking CLD del paquete. Solo se aceptan paquetes en estado &quot;Recibido en USA&quot;.
          </p>

          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={tracking}
              onChange={e => { setTracking(e.target.value); setMensaje(null) }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregar(tracking) } }}
              placeholder="CLD-XXXX o tracking del courier..."
              className="flex-1 glass-input px-4 py-3 rounded-xl text-base font-mono focus:outline-none"
              autoComplete="off"
              autoFocus
            />
            <button
              type="button"
              onClick={abrirScanner}
              className="px-3 py-2 rounded-xl transition-colors"
              style={{ border: `1px solid ${tw}0.12)`, color: `${tw}0.5)` }}
              onMouseEnter={e => (e.currentTarget.style.background = `${tw}0.05)`)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              title="Escanear con cámara"
            >
              <Camera className="h-5 w-5" />
            </button>
            <button
              onClick={() => agregar(tracking)}
              disabled={!tracking.trim() || agregando}
              className="btn-gold flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
            >
              {agregando
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Agregando...</>
                : <><Plus className="h-4 w-4" /> Agregar</>}
            </button>
          </div>

          {mensaje && (
            <div className="flex items-start gap-2 text-sm p-3 rounded-xl" style={
              mensaje.tipo === 'ok'
                ? { background: 'rgba(52,211,153,0.08)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }
                : mensaje.tipo === 'aviso'
                  ? { background: 'rgba(245,184,0,0.08)', color: '#F5B800', border: '1px solid rgba(245,184,0,0.2)' }
                  : { background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }
            }>
              {mensaje.tipo === 'ok'
                ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
                : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />}
              <div className="flex-1">
                <p>{mensaje.texto}</p>
                {mensaje.pendiente && (
                  <button
                    onClick={() => agregar(mensaje.pendiente!.tracking, true)}
                    className="mt-2 px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: 'rgba(245,184,0,0.15)', color: '#F5B800', border: '1px solid rgba(245,184,0,0.3)' }}
                  >
                    Sí, agregarlo igual
                  </button>
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
            <button onClick={cerrarScanner} className="absolute top-4 right-4 p-2 rounded-full" style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}>
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Lista de paquetes adentro */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${tw}0.07)` }}>
          <div>
            <span className="text-sm font-semibold text-white">Contenido de la caja</span>
            <p className="text-xs mt-0.5" style={{ color: `${tw}0.4)` }}>
              Clic en la imagen para ampliarla · Clic en la fila para ver el paquete
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(245,184,0,0.12)', color: '#F5B800', border: '1px solid rgba(245,184,0,0.2)' }}>
            {paquetes.length} paq.
          </span>
        </div>

        {paquetes.length === 0 ? (
          <div className="text-center py-14 text-sm" style={{ color: `${tw}0.35)` }}>
            <Package className="h-10 w-10 mx-auto mb-3 opacity-20 text-white" />
            La caja está vacía. Escanea paquetes para llenarla.
          </div>
        ) : (
          <div className="max-h-[520px] overflow-y-auto divide-y" style={{ borderColor: `${tw}0.05)` }}>
            {paquetes.map((p) => {
              const estadoS = ESTADO_DARK[p.estado] ?? { bg: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)', border: 'rgba(255,255,255,0.12)' }
              const bodegaMismatch = p.bodega_destino !== caja.bodega_destino
              return (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3 group cursor-pointer transition-colors"
                  onClick={() => router.push(`/admin/paquetes/${p.id}`)}
                  onMouseEnter={e => (e.currentTarget.style.background = `${tw}0.04)`)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

                  {/* Thumbnail */}
                  <FotoThumb url={p.foto_url} alt={p.descripcion} width={52} height={52} />

                  {/* Main info */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-xs font-bold flex-shrink-0" style={{ color: '#F5B800' }}>
                        {p.tracking_casilla ?? '—'}
                      </span>
                      <span className={`text-sm truncate ${p.cliente ? 'font-medium text-white' : ''}`}
                        style={!p.cliente ? { color: '#fbbf24', fontStyle: 'italic' } : undefined}>
                        {p.cliente?.nombre_completo ?? '⏳ Sin asignar'}
                      </span>
                      {p.cliente?.numero_casilla && (
                        <span className="text-xs flex-shrink-0" style={{ color: `${tw}0.35)` }}>
                          ({p.cliente.numero_casilla})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs" style={{ color: `${tw}0.45)`, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.descripcion}
                      </span>
                      <span className="text-[11px]" style={{ color: `${tw}0.3)` }}>
                        {CATEGORIA_LABELS[p.categoria as CategoriaProducto] ?? p.categoria}
                      </span>
                      {p.peso_libras && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded"
                          style={{ color: `${tw}0.5)`, background: `${tw}0.04)`, border: `1px solid ${tw}0.07)` }}>
                          {p.peso_libras} lb
                        </span>
                      )}
                      {Number(p.valor_declarado) > 0 && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded font-semibold"
                          style={{ color: '#34d399', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
                          ${Number(p.valor_declarado).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: badges + remove */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {bodegaMismatch && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded inline-flex items-center gap-0.5"
                        style={{ color: '#fbbf24', background: 'rgba(245,184,0,0.08)', border: '1px solid rgba(245,184,0,0.2)' }}
                        title={`Distinta a la caja: ${BODEGA_LABELS[p.bodega_destino] ?? p.bodega_destino}`}>
                        <MapPin className="h-2.5 w-2.5" />
                        {BODEGA_LABELS[p.bodega_destino] ?? p.bodega_destino}
                        <span aria-hidden="true"> ⚠️</span>
                      </span>
                    )}
                    <span className="text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap"
                      style={{ background: estadoS.bg, color: estadoS.color, border: `1px solid ${estadoS.border}` }}>
                      {ESTADO_LABELS[p.estado as EstadoPaquete] ?? p.estado}
                    </span>
                    {editable && (
                      <button
                        onClick={e => { e.stopPropagation(); quitarPaquete(p.id) }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all ml-1"
                        style={{ color: `${tw}0.3)` }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)' }}
                        onMouseLeave={e => { e.currentTarget.style.color = `${tw}0.3)`; e.currentTarget.style.background = 'transparent' }}
                        title="Quitar de la caja"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Paquetes disponibles */}
      {editable && (
        <PaquetesDisponibles
          bodegaCaja={caja.bodega_destino}
          cajaIdActual={caja.id}
          onAgregar={async (tracking) => { await agregar(tracking) }}
          onAgregarConBodegaDistinta={async (tracking) => { await agregar(tracking, true) }}
          onMover={async (tracking, codigoOrigen) => {
            const ok = window.confirm(`Este paquete está en la caja ${codigoOrigen}. ¿Moverlo a esta caja?`)
            if (!ok) return
            await agregar(tracking, false, true)
          }}
        />
      )}

      {/* Modales */}
      {modalCerrar && (
        <ModalCerrarCaja cajaId={caja.id} pesoSugerido={pesoTotal} valorDeclaradoSugerido={valorTotal}
          onClose={() => setModalCerrar(false)} onDone={() => { setModalCerrar(false); router.refresh(); refrescar() }} />
      )}
      {modalDespachar && (
        <ModalDespacharCaja cajaId={caja.id} pesoSugerido={Number(caja.peso_estimado ?? pesoTotal)} valorDeclaradoSugerido={valorTotal}
          onClose={() => setModalDespachar(false)} onDone={() => { setModalDespachar(false); router.refresh(); refrescar() }} />
      )}
      {modalEliminar && (
        <ModalEliminarCaja cajaId={caja.id} codigo={caja.codigo_interno} paquetesCount={paquetes.length}
          onClose={() => setModalEliminar(false)} onDone={() => router.push('/admin/cajas')} />
      )}
      {modalEditar && (
        <ModalEditarCaja caja={caja}
          onClose={() => setModalEditar(false)} onDone={() => { setModalEditar(false); router.refresh(); refrescar() }} />
      )}

    </div>
  )
}

// ─── Modal Cerrar Caja ───────────────────────────────────────────────────────
function ModalCerrarCaja({ cajaId, pesoSugerido, valorDeclaradoSugerido, onClose, onDone }: {
  cajaId: string; pesoSugerido: number; valorDeclaradoSugerido: number; onClose: () => void; onDone: () => void
}) {
  const [peso, setPeso] = useState(pesoSugerido.toFixed(1))
  const [valorDeclarado, setValorDeclarado] = useState(valorDeclaradoSugerido > 0 ? valorDeclaradoSugerido.toFixed(2) : '')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  async function confirmar() {
    setCargando(true); setError('')
    const res = await fetch(`/api/admin/cajas/${cajaId}/cerrar`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ peso_estimado: parseFloat(peso), valor_declarado: valorDeclarado ? parseFloat(valorDeclarado) : undefined }),
    })
    const data = await res.json() as { ok?: boolean; error?: string }
    setCargando(false)
    if (!res.ok || !data.ok) { setError(data.error ?? 'Error'); return }
    onDone()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={modalOverlay} onClick={() => !cargando && onClose()}>
      <div className="max-w-md w-full p-5 space-y-4" style={modalCard} onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-white flex items-center gap-2">
          <Lock className="h-5 w-5" style={{ color: '#8899ff' }} />
          Cerrar caja
        </h3>
        <p className="text-sm" style={{ color: `${tw}0.6)` }}>
          Al cerrar la caja, ya no podrás agregar ni quitar paquetes. Los paquetes pasarán a estado &quot;Listo para envío&quot;.
        </p>
        <div>
          <label className="text-xs font-medium block mb-1" style={labelStyle}>Peso final estimado (lb)</label>
          <input type="number" step="0.1" value={peso} onChange={e => setPeso(e.target.value)} className="glass-input w-full px-3 py-2 text-sm rounded-xl focus:outline-none" />
          <p className="text-[11px] mt-1" style={{ color: `${tw}0.35)` }}>Suma actual de los paquetes: {pesoSugerido.toFixed(1)} lb</p>
        </div>
        <div>
          <label className="text-xs font-medium block mb-1" style={labelStyle}>Valor declarado (USD)</label>
          <input type="number" step="0.01" min="0" value={valorDeclarado} onChange={e => setValorDeclarado(e.target.value)} className="glass-input w-full px-3 py-2 text-sm rounded-xl focus:outline-none" />
          <p className="text-[11px] mt-1" style={{ color: `${tw}0.35)` }}>Suma de los valores declarados: ${valorDeclaradoSugerido.toFixed(2)} USD</p>
        </div>
        {error && <p className="text-sm p-2 rounded-xl" style={{ color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} disabled={cargando}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
            style={{ border: `1px solid ${tw}0.12)`, color: `${tw}0.65)` }}
            onMouseEnter={e => (e.currentTarget.style.background = `${tw}0.05)`)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            Cancelar
          </button>
          <button onClick={confirmar} disabled={cargando}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: 'rgba(99,130,255,0.15)', color: '#8899ff', border: '1px solid rgba(99,130,255,0.3)' }}>
            {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cerrar caja'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Despachar ─────────────────────────────────────────────────────────
function ModalDespacharCaja({ cajaId, pesoSugerido, valorDeclaradoSugerido, onClose, onDone }: {
  cajaId: string; pesoSugerido: number; valorDeclaradoSugerido: number; onClose: () => void; onDone: () => void
}) {
  const [trackingUsaco, setTrackingUsaco] = useState('')
  const [pesoReal, setPesoReal] = useState('')
  const [costo, setCosto] = useState('')
  const [valorDeclarado, setValorDeclarado] = useState(valorDeclaradoSugerido > 0 ? valorDeclaradoSugerido.toFixed(2) : '')
  const [courier, setCourier] = useState('')
  const [notificar, setNotificar] = useState(true)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [scannerAbierto, setScannerAbierto] = useState(false)
  const [scannerError, setScannerError] = useState('')
  const videoScanRef = useRef<HTMLVideoElement>(null)
  const scanControlsRef = useRef<IScannerControls | null>(null)

  async function abrirScanner() {
    setScannerError('')
    setScannerAbierto(true)
    await new Promise(r => setTimeout(r, 100))
    try {
      const reader = new BrowserMultiFormatReader()
      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
        videoScanRef.current!,
        (result) => {
          if (result) {
            const texto = result.getText()
            controls.stop()
            setScannerAbierto(false)
            setTrackingUsaco(texto.trim())
          }
        }
      )
      scanControlsRef.current = controls
    } catch {
      setScannerAbierto(false)
      setScannerError('No se pudo acceder a la cámara. Verifica los permisos del navegador.')
    }
  }

  function cerrarScanner() {
    scanControlsRef.current?.stop()
    scanControlsRef.current = null
    setScannerAbierto(false)
  }

  useEffect(() => { return () => { scanControlsRef.current?.stop() } }, [])

  async function confirmar() {
    if (!trackingUsaco.trim()) { setError('Tracking USACO requerido'); return }
    setCargando(true); setError('')
    const res = await fetch(`/api/admin/cajas/${cajaId}/despachar`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tracking_usaco: trackingUsaco.trim(),
        peso_real: pesoReal ? parseFloat(pesoReal) : undefined,
        costo_total_usaco: costo ? parseFloat(costo) : undefined,
        valor_declarado: valorDeclarado ? parseFloat(valorDeclarado) : undefined,
        courier: courier.trim() || undefined, notificar,
      }),
    })
    const data = await res.json() as { ok?: boolean; error?: string }
    setCargando(false)
    if (!res.ok || !data.ok) { setError(data.error ?? 'Error'); return }
    onDone()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={modalOverlay} onClick={() => !cargando && onClose()}>
      <div className="max-w-md w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto" style={modalCard} onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-white flex items-center gap-2">
          <Truck className="h-5 w-5" style={{ color: '#F5B800' }} />
          Despachar a USACO
        </h3>
        <p className="text-sm" style={{ color: `${tw}0.6)` }}>
          Pega los datos que te dio USACO al recoger la caja. Los paquetes pasarán a &quot;En tránsito&quot; y los clientes recibirán WhatsApp.
        </p>

        <div>
          <label className="text-xs font-medium block mb-1" style={labelStyle}>Tracking USACO *</label>
          <div className="flex gap-2">
            <input type="text" value={trackingUsaco} onChange={e => setTrackingUsaco(e.target.value)}
              placeholder="Ej: 1Z9999AA1234567890"
              className="flex-1 glass-input px-3 py-2 text-sm font-mono rounded-xl focus:outline-none" autoFocus />
            <button type="button" onClick={abrirScanner} title="Escanear código de barras"
              className="px-3 py-2 rounded-xl transition-colors"
              style={{ border: `1px solid ${tw}0.12)`, color: `${tw}0.5)` }}
              onMouseEnter={e => (e.currentTarget.style.background = `${tw}0.05)`)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <Camera className="h-5 w-5" />
            </button>
          </div>
          {scannerError && (
            <p className="text-[11px] mt-1 flex items-center gap-1" style={{ color: '#f87171' }}>
              <AlertCircle className="h-3 w-3" /> {scannerError}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium block mb-1" style={labelStyle}>Peso real USACO (lb)</label>
            <input type="number" step="0.1" value={pesoReal} onChange={e => setPesoReal(e.target.value)}
              placeholder={pesoSugerido.toFixed(1)} className="glass-input w-full px-3 py-2 text-sm rounded-xl focus:outline-none" />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1" style={labelStyle}>Costo total USD</label>
            <input type="number" step="0.01" value={costo} onChange={e => setCosto(e.target.value)}
              placeholder="0.00" className="glass-input w-full px-3 py-2 text-sm rounded-xl focus:outline-none" />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium block mb-1" style={labelStyle}>Valor declarado (USD)</label>
          <input type="number" step="0.01" min="0" value={valorDeclarado} onChange={e => setValorDeclarado(e.target.value)}
            className="glass-input w-full px-3 py-2 text-sm rounded-xl focus:outline-none" />
          <p className="text-[11px] mt-1" style={{ color: `${tw}0.35)` }}>Suma declarada de los paquetes: ${valorDeclaradoSugerido.toFixed(2)} USD</p>
        </div>
        <div>
          <label className="text-xs font-medium block mb-1" style={labelStyle}>Courier (opcional)</label>
          <input type="text" value={courier} onChange={e => setCourier(e.target.value)}
            placeholder="USACO Express" className="glass-input w-full px-3 py-2 text-sm rounded-xl focus:outline-none" />
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: `${tw}0.65)` }}>
          <input type="checkbox" checked={notificar} onChange={e => setNotificar(e.target.checked)}
            className="h-4 w-4 rounded" style={{ accentColor: '#F5B800' }} />
          Notificar a los clientes por WhatsApp
        </label>

        {error && <p className="text-sm p-2 rounded-xl" style={{ color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</p>}

        <div className="flex gap-2">
          <button type="button" onClick={onClose} disabled={cargando}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
            style={{ border: `1px solid ${tw}0.12)`, color: `${tw}0.65)` }}
            onMouseEnter={e => (e.currentTarget.style.background = `${tw}0.05)`)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            Cancelar
          </button>
          <button onClick={confirmar} disabled={cargando}
            className="btn-gold flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
            {cargando
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Despachando...</>
              : <><Truck className="h-4 w-4" /> Despachar</>}
          </button>
        </div>
      </div>

      {scannerAbierto && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4" onClick={cerrarScanner}>
          <div className="relative bg-black rounded-lg overflow-hidden max-w-md w-full" onClick={e => e.stopPropagation()}>
            <video ref={videoScanRef} className="w-full max-h-[70vh] object-cover" playsInline muted />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-3/4 h-24 border-2 border-yellow-400 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
            </div>
            <button type="button" onClick={cerrarScanner}
              className="absolute top-3 right-3 p-2 rounded-full" style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }} aria-label="Cerrar escáner">
              <X className="h-5 w-5" />
            </button>
            <p className="absolute bottom-3 left-3 right-3 text-center text-xs text-white bg-black/60 rounded px-3 py-2">
              Apunta la cámara al código de barras del tracking USACO
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Modal Eliminar Caja ─────────────────────────────────────────────────────
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={modalOverlay} onClick={() => !cargando && onClose()}>
      <div className="max-w-md w-full p-5 space-y-4" style={modalCard} onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-white flex items-center gap-2">
          <Trash2 className="h-5 w-5" style={{ color: '#f87171' }} />
          Eliminar caja
        </h3>
        <p className="text-sm" style={{ color: `${tw}0.65)` }}>
          ¿Estás seguro de que quieres eliminar la caja <span className="font-mono font-bold text-white">{codigo}</span>?
        </p>
        {paquetesCount > 0 && (
          <div className="rounded-xl p-3 space-y-1" style={{ background: 'rgba(245,184,0,0.08)', border: '1px solid rgba(245,184,0,0.2)' }}>
            <p className="text-sm font-semibold flex items-center gap-1" style={{ color: '#F5B800' }}>
              <AlertCircle className="h-4 w-4" /> Esta caja tiene {paquetesCount} paquete{paquetesCount > 1 ? 's' : ''} adentro
            </p>
            <p className="text-xs leading-relaxed" style={{ color: `${tw}0.6)` }}>
              Al eliminar la caja, los paquetes volverán al estado &quot;Recibido en USA&quot; y quedarán disponibles para meterlos en otra caja.
            </p>
          </div>
        )}
        <p className="text-xs" style={{ color: `${tw}0.4)` }}>Esta acción no se puede deshacer.</p>
        {error && <p className="text-sm p-2 rounded-xl" style={{ color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} disabled={cargando}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
            style={{ border: `1px solid ${tw}0.12)`, color: `${tw}0.65)` }}
            onMouseEnter={e => (e.currentTarget.style.background = `${tw}0.05)`)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            Cancelar
          </button>
          <button onClick={confirmar} disabled={cargando}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}>
            {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sí, eliminar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Editar Caja ───────────────────────────────────────────────────────
const ESTADOS_CAJA = [
  { value: 'abierta',           label: 'Abierta',              color: '#F5B800' },
  { value: 'cerrada',           label: 'Cerrada',              color: '#8899ff' },
  { value: 'despachada',        label: 'Despachada',           color: '#c084fc' },
  { value: 'recibida_colombia', label: 'Recibida en Colombia', color: '#34d399' },
]

function ModalEditarCaja({ caja, onClose, onDone }: { caja: CajaDetalle; onClose: () => void; onDone: () => void }) {
  const [estado, setEstado] = useState(caja.estado)
  const [tipo, setTipo] = useState<'correo' | 'manejo'>(caja.tipo ?? 'correo')
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
    setCargando(true); setError('')
    const res = await fetch(`/api/admin/cajas/${caja.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        estado,
        tipo,
        bodega_destino: bodega, courier: courier.trim() || null,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={modalOverlay} onClick={() => !cargando && onClose()}>
      <div className="max-w-lg w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto" style={modalCard} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white flex items-center gap-2">
            <Pencil className="h-5 w-5" style={{ color: '#F5B800' }} />
            Editar caja
          </h3>
          <button onClick={onClose} disabled={cargando}
            className="disabled:opacity-50 p-1 rounded-lg transition-colors"
            style={{ color: `${tw}0.4)` }}
            onMouseEnter={e => (e.currentTarget.style.color = 'white')}
            onMouseLeave={e => (e.currentTarget.style.color = `${tw}0.4)`)}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-xs -mt-3" style={{ color: `${tw}0.4)` }}>Modifica los datos de la caja. Los cambios se aplicarán de inmediato.</p>

        <div>
          <label className="text-xs font-medium block mb-1" style={labelStyle}>Estado de la caja</label>
          <div className="grid grid-cols-2 gap-2">
            {ESTADOS_CAJA.map(e => (
              <button
                key={e.value}
                type="button"
                onClick={() => setEstado(e.value)}
                className="py-2 px-3 rounded-xl text-xs font-semibold text-left transition-all"
                style={estado === e.value
                  ? { background: `${e.color}22`, color: e.color, border: `1px solid ${e.color}55` }
                  : { color: `${tw}0.45)`, border: `1px solid ${tw}0.1)` }
                }
              >
                {estado === e.value ? '● ' : '○ '}{e.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium block mb-2" style={labelStyle}>Tipo de mercancía</label>
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: 'correo', label: 'Correo', sub: '≤ $200 USD', color: '#4ade80', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.45)' },
              { value: 'manejo', label: 'Manejo', sub: '> $200 USD', color: '#fb923c', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.45)' },
            ] as const).map(opt => (
              <button key={opt.value} type="button" onClick={() => setTipo(opt.value)}
                className="py-2.5 px-3 rounded-xl text-sm font-semibold transition-all border flex flex-col items-center gap-0.5"
                style={tipo === opt.value
                  ? { background: opt.bg, border: `1px solid ${opt.border}`, color: opt.color }
                  : { background: 'transparent', border: `1px solid ${tw}0.1)`, color: `${tw}0.4)` }}>
                <span>{opt.label}</span>
                <span className="text-[10px] font-normal opacity-70">{opt.sub}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium block mb-1" style={labelStyle}>Ciudad destino</label>
          <select value={bodega} onChange={e => setBodega(e.target.value)} className={inputClass}>
            <option value="medellin">Medellín</option>
            <option value="bogota">Bogotá</option>
            <option value="barranquilla">Barranquilla</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium block mb-1" style={labelStyle}>Courier</label>
          <input type="text" value={courier} onChange={e => setCourier(e.target.value)} placeholder="USACO Express" className={inputClass} />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1" style={labelStyle}>Tracking USACO</label>
          <input type="text" value={trackingUsaco} onChange={e => setTrackingUsaco(e.target.value)} placeholder="1Z9999AA1234567890"
            className={`${inputClass} font-mono`} />
          <p className="text-[11px] mt-1" style={{ color: `${tw}0.35)` }}>Si lo cambias, todos los paquetes de la caja heredarán el nuevo tracking automáticamente.</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-xs font-medium block mb-1" style={labelStyle}>Peso est. (lb)</label>
            <input type="number" step="0.1" value={pesoEstimado} onChange={e => setPesoEstimado(e.target.value)}
              className="glass-input w-full px-2 py-1.5 text-sm rounded-lg focus:outline-none" />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1" style={labelStyle}>Peso real (lb)</label>
            <input type="number" step="0.1" value={pesoReal} onChange={e => setPesoReal(e.target.value)}
              className="glass-input w-full px-2 py-1.5 text-sm rounded-lg focus:outline-none" />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1" style={labelStyle}>Costo USD</label>
            <input type="number" step="0.01" value={costo} onChange={e => setCosto(e.target.value)}
              className="glass-input w-full px-2 py-1.5 text-sm rounded-lg focus:outline-none" />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium block mb-1" style={labelStyle}>Notas</label>
          <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
            className={inputClass} style={{ resize: 'none' }} />
        </div>

        {error && <p className="text-sm p-2 rounded-xl" style={{ color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</p>}

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} disabled={cargando}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
            style={{ border: `1px solid ${tw}0.12)`, color: `${tw}0.65)` }}
            onMouseEnter={e => (e.currentTarget.style.background = `${tw}0.05)`)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            Cancelar
          </button>
          <button onClick={guardar} disabled={cargando}
            className="btn-gold flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
            {cargando ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</> : <><Save className="h-4 w-4" /> Guardar cambios</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Paquetes disponibles ────────────────────────────────────────────────────
interface PaqueteDisponible {
  id: string
  tracking_casilla: string | null
  tracking_origen: string | null
  descripcion: string
  categoria: string
  peso_libras: number | string | null
  valor_declarado: number | string | null
  bodega_destino: string
  fecha_recepcion_usa: string | null
  estado: string
  cliente: { nombre_completo: string; numero_casilla: string | null } | null
  caja_actual: { id: string; codigo_interno: string } | null
  foto_url: string | null
}

type FiltroEstado = 'todos' | 'recibido_usa' | 'listo_envio' | 'en_consolidacion'

function PaquetesDisponibles({
  bodegaCaja, cajaIdActual, onAgregar, onAgregarConBodegaDistinta, onMover,
}: {
  bodegaCaja: string; cajaIdActual: string
  onAgregar: (tracking: string) => Promise<void>
  onAgregarConBodegaDistinta: (tracking: string) => Promise<void>
  onMover: (tracking: string, codigoOrigen: string) => Promise<void>
}) {
  const [paquetes, setPaquetes] = useState<PaqueteDisponible[]>([])
  const [stats, setStats] = useState<{
    total: number; mostrando: number;
    porEstado: { recibido_usa: number; listo_envio: number; en_consolidacion: number };
  } | null>(null)
  const [cargando, setCargando] = useState(false)
  const [query, setQuery] = useState('')
  const [todasBodegas, setTodasBodegas] = useState(false)
  const [incluirOtras, setIncluirOtras] = useState(false)
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos')
  const [agregandoId, setAgregandoId] = useState<string | null>(null)

  async function cargar() {
    setCargando(true)
    const params = new URLSearchParams()
    params.set('bodega', bodegaCaja)
    if (todasBodegas) params.set('todas', '1')
    if (incluirOtras) { params.set('incluir_otras', '1'); params.set('excluir_caja', cajaIdActual) }
    if (query.trim()) params.set('q', query.trim())
    if (filtroEstado === 'todos') params.set('estados', 'recibido_usa,listo_envio,en_consolidacion')
    else params.set('estados', filtroEstado)
    const res = await fetch(`/api/admin/cajas/disponibles?${params}`)
    const data = await res.json() as {
      paquetes?: PaqueteDisponible[]; total_disponibles?: number; mostrando?: number; conteo_por_estado?: Record<string, number>
    }
    setPaquetes(data.paquetes ?? [])
    setStats({
      total: data.total_disponibles ?? 0, mostrando: data.mostrando ?? 0,
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
  }, [query, todasBodegas, filtroEstado, incluirOtras])

  async function handleAgregar(p: PaqueteDisponible) {
    if (!p.tracking_casilla) return
    setAgregandoId(p.id)
    try {
      if (p.caja_actual) await onMover(p.tracking_casilla, p.caja_actual.codigo_interno)
      else if (p.bodega_destino !== bodegaCaja) await onAgregarConBodegaDistinta(p.tracking_casilla)
      else await onAgregar(p.tracking_casilla)
      await cargar()
    } finally { setAgregandoId(null) }
  }

  const tabStyle = (active: boolean, color: string) => active
    ? { background: color, color: 'white', border: `1px solid ${color}` }
    : { color: `${tw}0.5)`, border: `1px solid ${tw}0.1)` }

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-5 py-3 flex items-center justify-between flex-wrap gap-2" style={{ borderBottom: `1px solid ${tw}0.07)` }}>
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4" style={{ color: '#F5B800' }} />
          <span className="text-sm font-semibold text-white">Paquetes disponibles para agregar</span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: `${tw}0.55)` }}>
            <input type="checkbox" checked={todasBodegas} onChange={e => setTodasBodegas(e.target.checked)}
              className="h-3.5 w-3.5 rounded" style={{ accentColor: '#F5B800' }} />
            <Globe className="h-3 w-3" /> Todas las bodegas
          </label>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: `${tw}0.55)` }}>
            <input type="checkbox" checked={incluirOtras} onChange={e => setIncluirOtras(e.target.checked)}
              className="h-3.5 w-3.5 rounded" style={{ accentColor: '#fbbf24' }} />
            <Box className="h-3 w-3" style={{ color: '#fbbf24' }} /> Incluir otras cajas abiertas
          </label>
          <button onClick={cargar} className="transition-colors" style={{ color: `${tw}0.35)` }}
            onMouseEnter={e => (e.currentTarget.style.color = 'white')} onMouseLeave={e => (e.currentTarget.style.color = `${tw}0.35)`)}
            title="Recargar">
            <RefreshCw className={`h-4 w-4 ${cargando ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      {stats && (
        <div className="px-5 py-2 flex flex-wrap gap-2" style={{ borderBottom: `1px solid ${tw}0.06)`, background: `${tw}0.02)` }}>
          {([
            ['todos', 'Todos', '#F5B800', `${stats.porEstado.recibido_usa + stats.porEstado.listo_envio + stats.porEstado.en_consolidacion}`],
            ['recibido_usa', 'Recibidos USA', '#8899ff', `${stats.porEstado.recibido_usa}`],
            ['en_consolidacion', 'En consolidación', '#fbbf24', `${stats.porEstado.en_consolidacion}`],
            ['listo_envio', 'Listos para envío', '#34d399', `${stats.porEstado.listo_envio}`],
          ] as [FiltroEstado, string, string, string][]).map(([val, label, color, count]) => (
            <button key={val} type="button" onClick={() => setFiltroEstado(val)}
              className="text-xs px-3 py-1.5 rounded-full transition-colors"
              style={tabStyle(filtroEstado === val, color)}>
              {label} · {count}
            </button>
          ))}
        </div>
      )}

      {/* Búsqueda */}
      <div className="px-5 py-2" style={{ borderBottom: `1px solid ${tw}0.06)`, background: `${tw}0.02)` }}>
        <input type="text" value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Buscar por tracking, descripción o nombre del cliente..."
          className="glass-input w-full px-3 py-1.5 text-sm rounded-xl focus:outline-none" />
        {stats && (
          <p className="text-[11px] mt-1" style={{ color: `${tw}0.35)` }}>
            {todasBodegas
              ? `${stats.mostrando} de ${stats.total} paquetes (todas las bodegas)`
              : `${stats.mostrando} de ${stats.total} paquetes para ${BODEGA_LABELS[bodegaCaja] ?? bodegaCaja}`}
          </p>
        )}
      </div>

      {/* Lista */}
      <div className="max-h-[420px] overflow-y-auto">
        {cargando ? (
          <div className="text-center py-12 text-sm flex items-center justify-center gap-2" style={{ color: `${tw}0.35)` }}>
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
          </div>
        ) : paquetes.length === 0 ? (
          <div className="text-center py-12 text-sm" style={{ color: `${tw}0.35)` }}>
            <Package className="h-8 w-8 mx-auto mb-2 opacity-20 text-white" />
            {query ? 'Sin resultados con ese filtro' : todasBodegas
              ? 'No hay paquetes disponibles para agregar a cajas'
              : `No hay paquetes recibidos para ${BODEGA_LABELS[bodegaCaja] ?? bodegaCaja}`}
          </div>
        ) : (
          paquetes.map((p, i) => {
            const bodegaDistinta = p.bodega_destino !== bodegaCaja
            const borderLeftColor =
              p.estado === 'listo_envio' ? '#34d399'
                : p.estado === 'recibido_usa' ? '#8899ff'
                  : p.estado === 'en_consolidacion' ? '#fbbf24'
                    : `${tw}0.1)`
            const diasEnBodega = p.fecha_recepcion_usa
              ? Math.floor((Date.now() - new Date(p.fecha_recepcion_usa).getTime()) / 86_400_000)
              : null
            return (
              <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-sm"
                style={{
                  borderTop: i > 0 ? `1px solid ${tw}0.05)` : undefined,
                  borderLeft: `3px solid ${borderLeftColor}`,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = `${tw}0.03)`)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                {/* Miniatura */}
                <FotoThumb url={p.foto_url} alt={p.descripcion} width={44} height={44} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${p.cliente ? 'font-medium text-white' : ''}`}
                    style={!p.cliente ? { color: '#fbbf24', fontStyle: 'italic', fontWeight: 500 } : undefined}>
                    {p.cliente?.nombre_completo ?? '⏳ Sin cliente asignado'}
                    {p.cliente?.numero_casilla && (
                      <span className="text-xs ml-1" style={{ color: `${tw}0.35)` }}>({p.cliente.numero_casilla})</span>
                    )}
                  </p>
                  <p className="text-xs truncate" style={{ color: `${tw}0.45)` }}>
                    {p.descripcion} · {CATEGORIA_LABELS[p.categoria as CategoriaProducto] ?? p.categoria}
                    {p.tracking_origen && (
                      <span className="ml-1 font-mono font-semibold" style={{ color: '#F5B800' }}> · {p.tracking_origen}</span>
                    )}
                  </p>
                </div>
                {!p.cliente && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded whitespace-nowrap"
                    style={{ color: '#fbbf24', background: 'rgba(245,184,0,0.08)', border: '1px solid rgba(245,184,0,0.2)' }}>
                    Sin cliente
                  </span>
                )}
                {p.caja_actual && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded whitespace-nowrap inline-flex items-center gap-0.5 font-medium"
                    style={{ color: '#F5B800', background: 'rgba(245,184,0,0.1)', border: '1px solid rgba(245,184,0,0.25)' }}
                    title={`Actualmente en caja ${p.caja_actual.codigo_interno}`}>
                    <Box className="h-2.5 w-2.5" /> {p.caja_actual.codigo_interno}
                  </span>
                )}
                <span className="text-[11px] px-1.5 py-0.5 rounded whitespace-nowrap inline-flex items-center gap-0.5"
                  style={bodegaDistinta
                    ? { color: '#fbbf24', background: 'rgba(245,184,0,0.08)', border: '1px solid rgba(245,184,0,0.2)' }
                    : { color: `${tw}0.45)`, background: `${tw}0.04)`, border: `1px solid ${tw}0.08)` }}>
                  <MapPin className="h-2.5 w-2.5" />
                  {BODEGA_LABELS[p.bodega_destino] ?? p.bodega_destino}
                  {bodegaDistinta && <span aria-hidden="true">⚠️</span>}
                </span>
                <span className="text-xs whitespace-nowrap" style={{ color: `${tw}0.45)` }}>
                  {p.peso_libras ? `${p.peso_libras} lb` : '—'}
                </span>
                {diasEnBodega !== null && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded whitespace-nowrap"
                    style={diasEnBodega > 14
                      ? { color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }
                      : diasEnBodega > 7
                        ? { color: '#fbbf24', background: 'rgba(245,184,0,0.08)', border: '1px solid rgba(245,184,0,0.2)' }
                        : { color: `${tw}0.4)`, background: `${tw}0.04)`, border: `1px solid ${tw}0.08)` }}
                    title={`Recibido hace ${diasEnBodega} días en bodega USA`}>
                    {diasEnBodega === 0 ? 'Hoy' : `${diasEnBodega}d`}
                  </span>
                )}
                {Number(p.valor_declarado) > 0 && (
                  <span className="text-xs font-semibold whitespace-nowrap" style={{ color: '#34d399' }}>
                    ${Number(p.valor_declarado).toFixed(2)}
                  </span>
                )}
                <button
                  onClick={() => handleAgregar(p)}
                  disabled={agregandoId !== null}
                  className="flex items-center gap-1 text-xs h-7 px-2 rounded-lg font-semibold disabled:opacity-40 transition-colors"
                  style={p.caja_actual
                    ? { background: 'rgba(245,184,0,0.12)', color: '#fbbf24', border: '1px solid rgba(245,184,0,0.25)' }
                    : { background: 'rgba(245,184,0,0.12)', color: '#F5B800', border: '1px solid rgba(245,184,0,0.25)' }}>
                  {agregandoId === p.id
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : p.caja_actual
                      ? <><Truck className="h-3 w-3" /> Mover</>
                      : <><Plus className="h-3 w-3" /> Agregar</>}
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
