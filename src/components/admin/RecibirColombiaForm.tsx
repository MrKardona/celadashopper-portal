'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ScanBarcode, Search, CheckCircle2, AlertCircle, Loader2,
  X, MapPin, MessageCircle, Camera, PackageCheck, Clock, ChevronDown,
} from 'lucide-react'
import { ESTADO_LABELS, CATEGORIA_LABELS, type EstadoPaquete, type CategoriaProducto } from '@/types'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import HistorialRecibidasColombia from '@/components/admin/HistorialRecibidasColombia'
import FotoThumb from '@/components/ui/FotoThumb'

const tw = 'rgba(255,255,255,'

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
  paquete_origen_id: string | null
  espera_hermanos: boolean
  foto_url: string | null
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

interface CajaPendiente {
  id: string
  codigo_interno: string | null
  tracking_usaco: string | null
  courier: string | null
  bodega_destino: string | null
  peso_estimado: number | null
  peso_real: number | null
  fecha_despacho: string | null
  estado: string
  estado_usaco: string | null
  created_at: string
  paquetes_count: number
  estados_paquetes: Record<string, number>
}

const USACO_STYLE: Record<string, { bg: string; color: string; border: string; label: string; emoji: string }> = {
  'GuiaCreadaColaborador': { bg: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)',  border: 'rgba(255,255,255,0.08)', label: 'Guía creada',                 emoji: '🏷️' },
  'Pre-Alertado':          { bg: 'rgba(99,130,255,0.1)',  color: '#8899ff',                 border: 'rgba(99,130,255,0.2)',   label: 'Pre-alertado',               emoji: '📋' },
  'RecibidoOrigen':        { bg: 'rgba(99,130,255,0.12)', color: '#8899ff',                 border: 'rgba(99,130,255,0.25)',  label: 'En bodega Miami',            emoji: '📦' },
  'IncluidoEnGuia':        { bg: 'rgba(168,85,247,0.12)', color: '#c084fc',                 border: 'rgba(168,85,247,0.25)',  label: 'Incluido en guía',           emoji: '🏷️' },
  'TransitoInternacional': { bg: 'rgba(245,184,0,0.15)',  color: '#F5B800',                 border: 'rgba(245,184,0,0.3)',    label: 'Tránsito internacional',     emoji: '✈️' },
  'ProcesoDeAduana':       { bg: 'rgba(251,146,60,0.15)', color: '#fb923c',                 border: 'rgba(251,146,60,0.3)',   label: 'En aduana',                  emoji: '🛃' },
  'BodegaDestino':         { bg: 'rgba(52,211,153,0.12)', color: '#34d399',                 border: 'rgba(52,211,153,0.25)', label: 'Llegó a Colombia',            emoji: '🇨🇴' },
  'EnRuta':                { bg: 'rgba(52,211,153,0.12)', color: '#34d399',                 border: 'rgba(52,211,153,0.25)', label: 'En ruta de entrega',          emoji: '🛵' },
  'En ruta transito':      { bg: 'rgba(52,211,153,0.12)', color: '#34d399',                 border: 'rgba(52,211,153,0.25)', label: 'En camino transportadora',    emoji: '🚚' },
  'EnTransportadora':      { bg: 'rgba(52,211,153,0.12)', color: '#34d399',                 border: 'rgba(52,211,153,0.25)', label: 'Con transportadora',          emoji: '📬' },
  'EntregaFallida':        { bg: 'rgba(239,68,68,0.12)',  color: '#f87171',                 border: 'rgba(239,68,68,0.25)',  label: 'Entrega fallida',             emoji: '⚠️' },
  'Entregado':             { bg: 'rgba(52,211,153,0.15)', color: '#34d399',                 border: 'rgba(52,211,153,0.3)',  label: 'Entregado',                   emoji: '✅' },
}

const ESTADO_DARK: Record<string, { bg: string; color: string; border: string }> = {
  recibido_usa:      { bg: 'rgba(99,130,255,0.12)', color: '#8899ff',  border: 'rgba(99,130,255,0.3)' },
  en_consolidacion:  { bg: 'rgba(245,184,0,0.10)',  color: '#F5B800',  border: 'rgba(245,184,0,0.25)' },
  listo_envio:       { bg: 'rgba(168,85,247,0.12)', color: '#c084fc',  border: 'rgba(168,85,247,0.3)' },
  en_transito:       { bg: 'rgba(251,146,60,0.12)', color: '#fb923c',  border: 'rgba(251,146,60,0.3)' },
  en_camino_colombia:{ bg: 'rgba(168,85,247,0.12)', color: '#c084fc',  border: 'rgba(168,85,247,0.3)' },
  en_bodega_local:   { bg: 'rgba(52,211,153,0.12)', color: '#34d399',  border: 'rgba(52,211,153,0.3)' },
  en_camino_cliente: { bg: 'rgba(245,184,0,0.12)',  color: '#F5B800',  border: 'rgba(245,184,0,0.3)'  },
  entregado:         { bg: 'rgba(52,211,153,0.18)', color: '#34d399',  border: 'rgba(52,211,153,0.4)' },
}

interface PaqueteExpansion {
  id: string
  tracking_casilla: string | null
  descripcion: string
  categoria: string
  peso_libras: number | string | null
  valor_declarado: number | string | null
  estado: string
  bodega_destino: string
  foto_url: string | null
  cliente: { nombre_completo: string; numero_casilla: string | null } | null
}

function estadoBadgeStyle(estado: string): React.CSSProperties {
  const s = ESTADO_DARK[estado]
  if (s) return { background: s.bg, color: s.color, border: `1px solid ${s.border}` }
  return { background: `${tw}0.06)`, color: `${tw}0.5)`, border: `1px solid ${tw}0.12)` }
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
  const [historialKey, setHistorialKey] = useState(0)
  const [resultado, setResultado] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [scannerAbierto, setScannerAbierto] = useState(false)
  const [cajasPendientes, setCajasPendientes] = useState<CajaPendiente[]>([])
  const [expandidoId, setExpandidoId] = useState<string | null>(null)
  const [paquetesCargados, setPaquetesCargados] = useState<Record<string, PaqueteExpansion[] | 'loading' | 'error'>>({})

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    fetch('/api/admin/cajas/pendientes-colombia')
      .then(r => r.json())
      .then((d: { cajas?: CajaPendiente[] }) => setCajasPendientes(d.cajas ?? []))
      .catch(() => {/* silencioso */})
  }, [historialKey])

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
    setHistorialKey(k => k + 1)
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

  async function cargarPaquetes(id: string) {
    if (paquetesCargados[id] && paquetesCargados[id] !== 'error') return
    setPaquetesCargados(prev => ({ ...prev, [id]: 'loading' }))
    try {
      const res = await fetch(`/api/admin/cajas/${id}`)
      const data = await res.json() as { paquetes?: PaqueteExpansion[] }
      setPaquetesCargados(prev => ({ ...prev, [id]: data.paquetes ?? [] }))
    } catch {
      setPaquetesCargados(prev => ({ ...prev, [id]: 'error' }))
    }
  }

  function toggleExpandir(id: string) {
    if (expandidoId === id) {
      setExpandidoId(null)
    } else {
      setExpandidoId(id)
      cargarPaquetes(id)
    }
  }

  async function abrirScanner() {
    setScannerAbierto(true)
    await new Promise(r => setTimeout(r, 100))
    if (!videoRef.current) return
    try {
      const codeReader = new BrowserMultiFormatReader()
      const controls = await codeReader.decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
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
        <div className="flex items-start gap-3 rounded-xl p-4"
          style={resultado.tipo === 'ok'
            ? { background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }
            : { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          {resultado.tipo === 'ok'
            ? <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: '#34d399' }} />
            : <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: '#f87171' }} />}
          <p className="text-sm flex-1" style={{ color: resultado.tipo === 'ok' ? '#34d399' : '#f87171' }}>
            {resultado.texto}
          </p>
          <button
            onClick={() => setResultado(null)}
            className="transition-colors"
            style={{ color: `${tw}0.35)` }}
            onMouseEnter={e => (e.currentTarget.style.color = 'white')}
            onMouseLeave={e => (e.currentTarget.style.color = `${tw}0.35)`)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Scanner de tracking USACO */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center gap-2 font-semibold text-white">
          <ScanBarcode className="h-5 w-5" style={{ color: '#F5B800' }} />
          Escanear tracking USACO de la caja
        </div>
        <p className="text-xs -mt-2" style={{ color: `${tw}0.4)` }}>
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
            className="glass-input flex-1 px-4 py-3 rounded-xl text-base font-mono focus:outline-none"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={abrirScanner}
            className="px-3 py-2 rounded-xl transition-colors"
            style={{ border: `1px solid ${tw}0.12)`, color: `${tw}0.5)` }}
            onMouseEnter={e => { e.currentTarget.style.background = `${tw}0.06)`; e.currentTarget.style.color = 'white' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = `${tw}0.5)` }}
            title="Escanear con cámara"
          >
            <Camera className="h-5 w-5" />
          </button>
          <button
            onClick={() => buscar(tracking)}
            disabled={!tracking.trim() || buscando}
            className="btn-gold flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
          >
            {buscando
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Buscando...</>
              : <><Search className="h-4 w-4" /> Buscar</>}
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm rounded-xl px-3 py-2"
            style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}
      </div>

      {/* Scanner overlay */}
      {scannerAbierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.92)' }}
          onClick={cerrarScanner}
        >
          <div
            className="relative rounded-xl overflow-hidden max-w-md w-full"
            onClick={e => e.stopPropagation()}
          >
            <video ref={videoRef} className="w-full max-h-[70vh] object-cover" playsInline muted />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-3/4 h-24 border-2 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"
                style={{ borderColor: '#F5B800' }} />
            </div>
            <button
              type="button"
              onClick={cerrarScanner}
              className="absolute top-3 right-3 p-2 rounded-full"
              style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}
              aria-label="Cerrar escáner"
            >
              <X className="h-5 w-5" />
            </button>
            <p className="absolute bottom-3 left-3 right-3 text-center text-xs text-white rounded px-3 py-2"
              style={{ background: 'rgba(0,0,0,0.6)' }}>
              Apunta la cámara al código de barras del tracking USACO
            </p>
          </div>
        </div>
      )}

      {/* Información de la caja */}
      {caja && (
        <div className="glass-card overflow-hidden">
          <div className="px-5 py-4" style={{ background: `${tw}0.03)`, borderBottom: `1px solid ${tw}0.07)` }}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-xs" style={{ color: `${tw}0.4)` }}>Caja USACO</p>
                <p className="font-mono font-bold text-white">{caja.tracking_usaco}</p>
              </div>
              <button
                onClick={limpiar}
                className="text-xs flex items-center gap-1 transition-colors"
                style={{ color: `${tw}0.4)` }}
                onMouseEnter={e => (e.currentTarget.style.color = 'white')}
                onMouseLeave={e => (e.currentTarget.style.color = `${tw}0.4)`)}
              >
                <X className="h-3 w-3" /> Limpiar
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mt-3 text-xs">
              <div className="px-3 py-1.5 rounded-lg" style={{ background: `${tw}0.05)`, border: `1px solid ${tw}0.1)`, color: `${tw}0.65)` }}>
                <span style={{ color: `${tw}0.4)` }}>Total: </span>
                <span className="font-bold">{caja.total}</span> paquetes
              </div>
              <div className="px-3 py-1.5 rounded-lg" style={{ background: `${tw}0.05)`, border: `1px solid ${tw}0.1)`, color: `${tw}0.65)` }}>
                <span style={{ color: `${tw}0.4)` }}>Peso: </span>
                <span className="font-bold">{caja.peso_total.toFixed(1)}</span> lb
              </div>
              {caja.sin_asignar > 0 && (
                <div className="px-3 py-1.5 rounded-lg"
                  style={{ background: 'rgba(245,184,0,0.08)', border: '1px solid rgba(245,184,0,0.2)', color: '#F5B800' }}>
                  ⏳ {caja.sin_asignar} sin asignar
                </div>
              )}
              {caja.ya_recibidos_colombia > 0 && (
                <div className="px-3 py-1.5 rounded-lg"
                  style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', color: '#34d399' }}>
                  ✓ {caja.ya_recibidos_colombia} ya en Colombia
                </div>
              )}
            </div>
          </div>

          {/* Lista de paquetes */}
          <div className="max-h-[480px] overflow-y-auto">
            {caja.paquetes.map((p, i) => {
              const yaEnColombia = ['en_bodega_local', 'en_camino_cliente', 'entregado'].includes(p.estado)
              return (
                <div key={p.id}>
                  <label
                    className="flex items-center gap-3 px-5 py-3 text-sm cursor-pointer transition-colors"
                    style={{
                      borderTop: i > 0 ? `1px solid ${tw}0.05)` : undefined,
                      opacity: yaEnColombia ? 0.45 : 1,
                      ...(p.espera_hermanos ? {
                        background: 'rgba(239,68,68,0.06)',
                        boxShadow: 'inset 3px 0 0 rgba(239,68,68,0.7)',
                      } : {}),
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = p.espera_hermanos ? 'rgba(239,68,68,0.10)' : 'rgba(245,184,0,0.04)')}
                    onMouseLeave={e => (e.currentTarget.style.background = p.espera_hermanos ? 'rgba(239,68,68,0.06)' : 'transparent')}
                  >
                    <input
                      type="checkbox"
                      checked={seleccionados.has(p.id)}
                      onChange={() => toggleSeleccion(p.id)}
                      disabled={yaEnColombia}
                      className="h-4 w-4 rounded"
                      style={{ accentColor: '#F5B800' }}
                    />
                    <FotoThumb url={p.foto_url} alt={p.descripcion} width={36} height={36} radius="0.375rem" />
                    <span className="font-mono text-xs font-semibold w-32 truncate" style={{ color: '#F5B800' }}>
                      {p.tracking_casilla}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate"
                        style={{ color: !p.cliente ? '#F5B800' : 'white', fontStyle: !p.cliente ? 'italic' : 'normal' }}>
                        {p.cliente?.nombre_completo ?? '⏳ Sin asignar'}
                        {p.cliente?.numero_casilla && (
                          <span className="text-xs ml-1" style={{ color: `${tw}0.35)` }}>({p.cliente.numero_casilla})</span>
                        )}
                      </p>
                      <p className="text-xs truncate" style={{ color: `${tw}0.4)` }}>
                        {p.descripcion} · {CATEGORIA_LABELS[p.categoria as CategoriaProducto] ?? p.categoria}
                      </p>
                    </div>
                    <span className="text-xs whitespace-nowrap" style={{ color: `${tw}0.45)` }}>
                      <MapPin className="h-3 w-3 inline mr-0.5" />
                      {BODEGA_LABELS[p.bodega_destino] ?? p.bodega_destino}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap"
                      style={estadoBadgeStyle(p.estado)}>
                      {ESTADO_LABELS[p.estado as EstadoPaquete] ?? p.estado}
                    </span>
                  </label>
                  {p.espera_hermanos && (
                    <div
                      className="flex items-center gap-1.5 px-5 py-1.5 text-[11px] font-semibold"
                      style={{
                        background: 'rgba(239,68,68,0.08)',
                        borderTop: '1px solid rgba(239,68,68,0.15)',
                        color: '#f87171',
                      }}
                    >
                      <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0" style={{ background: '#f87171' }} />
                      ⏳ A la espera de más productos — otras partes vienen en otra caja
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Footer con acción */}
          {seleccionados.size > 0 && (
            <div className="px-5 py-4 space-y-3" style={{ borderTop: `1px solid ${tw}0.07)`, background: `${tw}0.02)` }}>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: `${tw}0.6)` }}>
                  Notas internas (opcional)
                </label>
                <input
                  type="text"
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  placeholder="Ej: Caja con avería, falta verificar..."
                  className="glass-input w-full px-3 py-2 text-sm rounded-xl focus:outline-none"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: `${tw}0.7)` }}>
                <input
                  type="checkbox"
                  checked={notificar}
                  onChange={e => setNotificar(e.target.checked)}
                  className="h-4 w-4 rounded"
                  style={{ accentColor: '#34d399' }}
                />
                <MessageCircle className="h-4 w-4" style={{ color: '#34d399' }} />
                Notificar a los clientes por WhatsApp ({seleccionados.size} mensajes)
              </label>
              <button
                onClick={confirmar}
                disabled={confirmando}
                className="btn-gold w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {confirmando
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Procesando...</>
                  : <><CheckCircle2 className="h-4 w-4" /> Confirmar recepción de {seleccionados.size} paquete{seleccionados.size > 1 ? 's' : ''} en Colombia</>}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Cajas despachadas — en tránsito a Colombia */}
      {cajasPendientes.length > 0 && (
        <div className="glass-card overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <Clock className="h-4 w-4 flex-shrink-0" style={{ color: '#F5B800' }} />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-white">Cajas despachadas — en tránsito a Colombia</h3>
              <p className="text-xs mt-0.5" style={{ color: `${tw}0.35)` }}>Clic en una caja para ver su contenido · clic en Recibir para procesarla</p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full font-bold flex-shrink-0"
              style={{ background: 'rgba(245,184,0,0.12)', color: '#F5B800', border: '1px solid rgba(245,184,0,0.25)' }}>
              {cajasPendientes.length}
            </span>
          </div>

          {/* Cabecera de columnas */}
          <div className="hidden md:grid px-5 py-2 text-[11px] font-semibold uppercase tracking-wider select-none"
            style={{
              gridTemplateColumns: '28px 2.2fr 90px 110px 130px 90px',
              color: `${tw}0.28)`,
              background: `${tw}0.02)`,
              borderBottom: `1px solid ${tw}0.06)`,
            }}>
            <span />
            <span>Tracking USACO</span>
            <span className="text-center">Paquetes</span>
            <span className="text-center">Destino</span>
            <span className="text-center">Desde creación</span>
            <span />
          </div>

          {/* Filas */}
          <div>
            {cajasPendientes.map(c => {
              const msDesdeCreacion = Date.now() - new Date(c.created_at).getTime()
              const horas = Math.floor(msDesdeCreacion / 3600000)
              const dias = Math.floor(horas / 24)
              const tiempoLabel = dias >= 1
                ? `${dias} día${dias !== 1 ? 's' : ''}`
                : horas >= 1
                  ? `${horas} h`
                  : 'Recién'
              const esAntigua = dias >= 3
              const expandido = expandidoId === c.id
              const pkgs = paquetesCargados[c.id]

              return (
                <div key={c.id} style={{ borderTop: `1px solid ${tw}0.05)` }}>
                  {/* Fila principal */}
                  <div
                    className="grid items-center px-5 py-3 cursor-pointer select-none transition-colors"
                    style={{
                      gridTemplateColumns: '28px 2.2fr 90px 110px 130px 90px',
                      background: esAntigua ? 'rgba(239,68,68,0.04)' : 'transparent',
                    }}
                    onClick={() => toggleExpandir(c.id)}
                    onMouseEnter={e => (e.currentTarget.style.background = esAntigua ? 'rgba(239,68,68,0.08)' : `${tw}0.03)`)}
                    onMouseLeave={e => (e.currentTarget.style.background = esAntigua ? 'rgba(239,68,68,0.04)' : 'transparent')}
                  >
                    {/* Chevron */}
                    <ChevronDown
                      className="h-3.5 w-3.5 flex-shrink-0 transition-transform duration-200"
                      style={{ color: `${tw}0.3)`, transform: expandido ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    />

                    {/* Tracking USACO + estado USACO de la caja */}
                    <div className="min-w-0 pr-2">
                      <p className="font-mono text-sm font-bold text-white truncate">
                        {c.tracking_usaco ?? <span style={{ color: `${tw}0.3)`, fontStyle: 'italic', fontWeight: 400 }}>Sin tracking</span>}
                      </p>
                      <p className="text-[11px] truncate" style={{ color: `${tw}0.28)` }}>{c.codigo_interno}</p>
                      {/* Badge USACO de la caja */}
                      {c.estado_usaco && (() => {
                        const esInconsistencia = c.estado_usaco.toLowerCase().includes('inconsistencia')
                        const u = !esInconsistencia ? (USACO_STYLE[c.estado_usaco] ?? null) : null
                        if (esInconsistencia) return (
                          <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md"
                            style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }}>
                            ⚠️ Inconsistencia
                          </span>
                        )
                        if (u) return (
                          <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md"
                            style={{ background: u.bg, color: u.color, border: `1px solid ${u.border}` }}>
                            {u.emoji} {u.label}
                          </span>
                        )
                        return (
                          <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md"
                            style={{ background: `${tw}0.06)`, color: `${tw}0.4)`, border: `1px solid ${tw}0.1)` }}>
                            {c.estado_usaco}
                          </span>
                        )
                      })()}
                    </div>

                    {/* Paquetes */}
                    <div className="text-center">
                      <span className="text-sm font-bold text-white">{c.paquetes_count}</span>
                      <span className="text-xs ml-0.5" style={{ color: `${tw}0.4)` }}>paq</span>
                      {(c.peso_real ?? c.peso_estimado) && (
                        <p className="text-[11px]" style={{ color: `${tw}0.3)` }}>{c.peso_real ?? c.peso_estimado} lb</p>
                      )}
                    </div>

                    {/* Destino */}
                    <div className="text-center">
                      <span className="inline-flex items-center gap-0.5 text-xs px-2 py-1 rounded-lg"
                        style={{ background: `${tw}0.07)`, color: `${tw}0.6)` }}>
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        {BODEGA_LABELS[c.bodega_destino ?? ''] ?? c.bodega_destino ?? '—'}
                      </span>
                    </div>

                    {/* Tiempo desde creación */}
                    <div className="text-center">
                      <span
                        className="text-xs font-semibold px-2 py-1 rounded-lg whitespace-nowrap"
                        style={esAntigua
                          ? { background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }
                          : { color: `${tw}0.5)` }}
                      >
                        {esAntigua && '⚠ '}{tiempoLabel}
                      </span>
                    </div>

                    {/* Botón recibir */}
                    <div className="text-right">
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          if (c.tracking_usaco) {
                            setTracking(c.tracking_usaco)
                            buscar(c.tracking_usaco)
                            window.scrollTo({ top: 0, behavior: 'smooth' })
                          }
                        }}
                        disabled={!c.tracking_usaco}
                        className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-xl transition-colors disabled:opacity-30"
                        style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}
                      >
                        <PackageCheck className="h-3.5 w-3.5" />
                        Recibir
                      </button>
                    </div>
                  </div>

                  {/* Panel expandible */}
                  {expandido && (
                    <div style={{ background: `${tw}0.02)`, borderTop: `1px solid ${tw}0.05)` }}>
                      {pkgs === 'loading' || pkgs === undefined ? (
                        <div className="flex items-center gap-2 px-6 py-4 text-sm" style={{ color: `${tw}0.35)` }}>
                          <Loader2 className="h-4 w-4 animate-spin" /> Cargando paquetes...
                        </div>
                      ) : pkgs === 'error' ? (
                        <div className="flex items-center gap-2 px-6 py-3 text-sm" style={{ color: '#f87171' }}>
                          <AlertCircle className="h-4 w-4" /> Error al cargar los paquetes
                        </div>
                      ) : pkgs.length === 0 ? (
                        <div className="px-6 py-4 text-sm" style={{ color: `${tw}0.35)` }}>
                          Esta caja no tiene paquetes registrados
                        </div>
                      ) : (
                        <div>
                          {pkgs.map((p, pi) => {
                            const s = ESTADO_DARK[p.estado] ?? null
                            return (
                              <div key={p.id} className="flex items-center gap-3 px-6 py-2.5 text-sm"
                                style={{ borderTop: pi > 0 ? `1px solid ${tw}0.04)` : undefined }}>
                                <FotoThumb url={p.foto_url} alt={p.descripcion} width={36} height={36} />
                                <span className="font-mono text-[11px] font-bold w-28 truncate flex-shrink-0" style={{ color: '#F5B800' }}>
                                  {p.tracking_casilla ?? '—'}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm truncate ${p.cliente ? 'font-medium text-white' : ''}`}
                                    style={!p.cliente ? { color: '#fbbf24', fontStyle: 'italic' } : undefined}>
                                    {p.cliente?.nombre_completo ?? '⏳ Sin asignar'}
                                    {p.cliente?.numero_casilla && (
                                      <span className="text-xs ml-1" style={{ color: `${tw}0.35)` }}>({p.cliente.numero_casilla})</span>
                                    )}
                                  </p>
                                  <p className="text-xs truncate" style={{ color: `${tw}0.4)` }}>
                                    {p.descripcion}
                                    {p.peso_libras ? ` · ${p.peso_libras} lb` : ''}
                                    {Number(p.valor_declarado) > 0 ? ` · $${Number(p.valor_declarado).toFixed(2)}` : ''}
                                  </p>
                                </div>
                                <span className="text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0"
                                  style={s
                                    ? { background: s.bg, color: s.color, border: `1px solid ${s.border}` }
                                    : { background: `${tw}0.06)`, color: `${tw}0.5)`, border: `1px solid ${tw}0.12)` }}>
                                  {ESTADO_LABELS[p.estado as EstadoPaquete] ?? p.estado}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <HistorialRecibidasColombia refreshKey={historialKey} />
    </div>
  )
}
