'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import {
  ScanBarcode, Search, CheckCircle2, AlertCircle, Package,
  Scale, Loader2, X, ClipboardList, Camera, ImageIcon, Video, VideoOff,
  PackageOpen,
} from 'lucide-react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
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

// ── Tipos para los 2 slots de foto ────────────────────────────────────────────
type FotoSlot = 1 | 2

interface FotoState {
  preview: string | null
  url: string | null
  subiendo: boolean
}

const FOTO_LABELS: Record<FotoSlot, { titulo: string; subtitulo: string; icon: typeof Camera }> = {
  1: { titulo: 'Foto del empaque', subtitulo: 'Con la guía / tracking visible', icon: Package },
  2: { titulo: 'Foto del contenido', subtitulo: 'Paquete abierto — lo que llegó', icon: PackageOpen },
}

export default function RecibirForm() {
  const inputRef = useRef<HTMLInputElement>(null)
  const pesoRef = useRef<HTMLInputElement>(null)
  const pesoManualRef = useRef<HTMLInputElement>(null)
  const fotoInputRef = useRef<HTMLInputElement>(null)
  const fotoInput2Ref = useRef<HTMLInputElement>(null)
  const fotoInputManualRef = useRef<HTMLInputElement>(null)
  const fotoInputManual2Ref = useRef<HTMLInputElement>(null)

  // Camera scanner refs
  const videoScanRef = useRef<HTMLVideoElement>(null)
  const scanControlsRef = useRef<IScannerControls | null>(null)

  // Camera photo refs (shared for both slots)
  const videoFotoRef = useRef<HTMLVideoElement>(null)
  const canvasFotoRef = useRef<HTMLCanvasElement>(null)
  const streamFotoRef = useRef<MediaStream | null>(null)
  // Stream pendiente: se guarda ANTES de setCamaraSlot y se aplica al video
  // en useEffect, cuando el overlay ya está visible y el video es full-size en el DOM
  const pendingStreamRef = useRef<MediaStream | null>(null)

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

  // --- Fotos: 2 slots independientes ---
  const [foto1, setFoto1] = useState<FotoState>({ preview: null, url: null, subiendo: false })
  const [foto2, setFoto2] = useState<FotoState>({ preview: null, url: null, subiendo: false })
  // Para modo manual, mismos 2 slots
  const [fotoManual1, setFotoManual1] = useState<FotoState>({ preview: null, url: null, subiendo: false })
  const [fotoManual2, setFotoManual2] = useState<FotoState>({ preview: null, url: null, subiendo: false })

  // --- Cámara scanner (código de barras) ---
  const [camaraScanner, setCamaraScanner] = useState(false)
  const [errorCamara, setErrorCamara] = useState('')

  // --- Cámara foto: qué slot y qué contexto (normal | manual) ---
  const [camaraSlot, setCamaraSlot] = useState<{ slot: FotoSlot; ctx: 'normal' | 'manual' } | null>(null)

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
      setFormManual(prev => ({ ...prev, tracking_courier: tracking }))
      setTimeout(() => pesoManualRef.current?.focus(), 100)
    }
  }, [modoManual, tracking])

  // Limpiar cámaras al desmontar
  useEffect(() => {
    return () => {
      scanControlsRef.current?.stop()
      if (streamFotoRef.current) {
        streamFotoRef.current.getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  // Aplicar stream al <video> DESPUÉS de que React haya mostrado el overlay.
  // Esto resuelve el problema de iOS Safari donde play() en un elemento oculto/tiny
  // no transfiere la imagen al video cuando éste se hace visible.
  useEffect(() => {
    if (camaraSlot && pendingStreamRef.current && videoFotoRef.current) {
      const video = videoFotoRef.current
      const stream = pendingStreamRef.current
      pendingStreamRef.current = null
      video.srcObject = stream
      video.play().catch(() => { /* autoPlay attribute como respaldo */ })
    }
  }, [camaraSlot])

  // ── Scanner de código de barras ──────────────────────────────────────────
  async function iniciarScanner() {
    setErrorCamara('')
    setCamaraScanner(true)
    // Video siempre está en el DOM — sin delay necesario
    try {
      const reader = new BrowserMultiFormatReader()
      // Constraints simples para máxima compatibilidad iOS Safari
      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } } },
        videoScanRef.current!,
        (result) => {
          if (result) {
            const texto = result.getText()
            controls.stop()
            setCamaraScanner(false)
            setTracking(texto)
            buscarPaquete(texto)
          }
        }
      )
      scanControlsRef.current = controls
    } catch (e) {
      setCamaraScanner(false)
      const err = e as DOMException
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setErrorCamara('Permiso denegado. En iPhone: Ajustes → Safari → Cámara → Permitir.')
      } else {
        setErrorCamara('No se pudo iniciar la cámara. Intenta recargar la página.')
      }
    }
  }

  function detenerScanner() {
    scanControlsRef.current?.stop()
    scanControlsRef.current = null
    setCamaraScanner(false)
  }

  // ── Cámara para foto ─────────────────────────────────────────────────────
  async function iniciarCamaraFoto(slot: FotoSlot, ctx: 'normal' | 'manual') {
    setErrorCamara('')

    // Cadena de fallback: environment ideal → environment estricto → cualquier cámara
    // iOS Safari rechaza constraints estrictas (width/height) con OverconstrainedError
    const constraintsFallback: MediaStreamConstraints[] = [
      { video: { facingMode: { ideal: 'environment' } } },
      { video: { facingMode: 'environment' } },
      { video: true },
    ]

    let stream: MediaStream | null = null
    for (const c of constraintsFallback) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(c)
        break
      } catch (e) {
        const err = e as DOMException
        if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
          setErrorCamara('Permiso denegado. En iPhone: Ajustes → Safari → Cámara → Permitir.')
          return
        }
        // OverconstrainedError u otro → intentar siguiente
      }
    }

    if (!stream) {
      setErrorCamara('No se pudo iniciar la cámara en este dispositivo.')
      return
    }

    streamFotoRef.current = stream

    // Guardamos el stream en pendingStreamRef y PRIMERO mostramos el overlay.
    // El useEffect(camaraSlot) aplicará srcObject + play() después del commit del DOM,
    // cuando el <video> ya tiene tamaño real en pantalla (necesario en iOS Safari).
    pendingStreamRef.current = stream
    setCamaraSlot({ slot, ctx })
  }

  function detenerCamaraFoto() {
    if (streamFotoRef.current) {
      streamFotoRef.current.getTracks().forEach(t => t.stop())
      streamFotoRef.current = null
    }
    // Limpiar srcObject para que iOS libere la cámara correctamente
    if (videoFotoRef.current) {
      videoFotoRef.current.srcObject = null
    }
    setCamaraSlot(null)
  }

  async function capturarFoto() {
    if (!camaraSlot) return
    const video = videoFotoRef.current
    const canvas = canvasFotoRef.current
    if (!video || !canvas) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)

    const { slot, ctx: context } = camaraSlot
    detenerCamaraFoto()

    canvas.toBlob(async (blob) => {
      if (!blob) return
      const file = new File([blob], `foto_${slot}_${Date.now()}.jpg`, { type: 'image/jpeg' })
      await subirFoto(file, slot, context)
    }, 'image/jpeg', 0.92)
  }

  // ── Upload helper ─────────────────────────────────────────────────────────
  async function subirFoto(file: File, slot: FotoSlot, context: 'normal' | 'manual') {
    const preview = URL.createObjectURL(file)
    const setter = context === 'normal'
      ? (slot === 1 ? setFoto1 : setFoto2)
      : (slot === 1 ? setFotoManual1 : setFotoManual2)

    setter({ preview, url: null, subiendo: true })

    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/foto', { method: 'POST', body: fd })
      const data = await res.json() as { ok?: boolean; url?: string; error?: string }
      if (res.ok && data.url) {
        setter({ preview, url: data.url, subiendo: false })
      } else {
        setter({ preview: null, url: null, subiendo: false })
        setErrorBusqueda(data.error ?? 'Error subiendo foto')
      }
    } catch {
      setter({ preview: null, url: null, subiendo: false })
      setErrorBusqueda('Error de conexión al subir foto')
    }
  }

  // ── Foto desde archivo/galería ────────────────────────────────────────────
  async function handleFotoChange(
    e: React.ChangeEvent<HTMLInputElement>,
    slot: FotoSlot,
    context: 'normal' | 'manual',
  ) {
    const file = e.target.files?.[0]
    if (!file) return
    await subirFoto(file, slot, context)
    e.target.value = ''
  }

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

  function limpiarFotoSlot(slot: FotoSlot, context: 'normal' | 'manual') {
    const setter = context === 'normal'
      ? (slot === 1 ? setFoto1 : setFoto2)
      : (slot === 1 ? setFotoManual1 : setFotoManual2)
    setter({ preview: null, url: null, subiendo: false })
    // limpiar input file correspondiente
    const refs: Record<string, React.RefObject<HTMLInputElement | null>> = {
      'normal-1': fotoInputRef,
      'normal-2': fotoInput2Ref,
      'manual-1': fotoInputManualRef,
      'manual-2': fotoInputManual2Ref,
    }
    const ref = refs[`${context}-${slot}`]
    if (ref?.current) ref.current.value = ''
    if (camaraSlot?.slot === slot && camaraSlot?.ctx === context) {
      detenerCamaraFoto()
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
    setModoManual(false)
    setFormManual({ descripcion: '', tienda: '', tracking_courier: '', peso: '', categoria: '', bodega_destino: 'medellin', notas: '' })
    setFoto1({ preview: null, url: null, subiendo: false })
    setFoto2({ preview: null, url: null, subiendo: false })
    setFotoManual1({ preview: null, url: null, subiendo: false })
    setFotoManual2({ preview: null, url: null, subiendo: false })
    detenerCamaraFoto()
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  // ── Confirmar recepción ───────────────────────────────────────────────────
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
          foto_url: foto1.url || undefined,
          foto2_url: foto2.url || undefined,
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

  // ── Guardar manual ────────────────────────────────────────────────────────
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
          foto_url: fotoManual1.url || undefined,
          foto2_url: fotoManual2.url || undefined,
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

  const subiendoCualquiera = foto1.subiendo || foto2.subiendo || fotoManual1.subiendo || fotoManual2.subiendo

  // ── Componente reutilizable para cada slot de foto ────────────────────────
  function SlotFoto({
    slot,
    context,
    accent = 'orange',
  }: {
    slot: FotoSlot
    context: 'normal' | 'manual'
    accent?: 'orange' | 'amber'
  }) {
    const fotoState = context === 'normal'
      ? (slot === 1 ? foto1 : foto2)
      : (slot === 1 ? fotoManual1 : fotoManual2)

    const fileRef = context === 'normal'
      ? (slot === 1 ? fotoInputRef : fotoInput2Ref)
      : (slot === 1 ? fotoInputManualRef : fotoInputManual2Ref)

    const dashed = accent === 'amber'
      ? 'border-amber-200 text-amber-500 hover:border-amber-400 hover:text-amber-600'
      : 'border-gray-200 text-gray-400 hover:border-orange-300 hover:text-orange-500'
    const badge = slot === 1
      ? 'bg-blue-100 text-blue-700'
      : 'bg-purple-100 text-purple-700'

    const meta = FOTO_LABELS[slot]
    const Icon = meta.icon

    return (
      <div className="space-y-1.5">
        {/* Header slot */}
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${badge}`}>
            <Icon className="h-3 w-3" />
            Foto {slot}
          </span>
          <div>
            <p className="text-sm font-medium text-gray-700 leading-tight">{meta.titulo}</p>
            <p className="text-xs text-gray-400 leading-tight">{meta.subtitulo}</p>
          </div>
        </div>

        {/* Vista previa de foto */}
        {fotoState.preview && (
          <div className="relative rounded-lg overflow-hidden border border-gray-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fotoState.preview} alt={`Vista previa foto ${slot}`} className="w-full max-h-48 object-cover" />
            {fotoState.subiendo && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Loader2 className="h-6 w-6 text-white animate-spin" />
              </div>
            )}
            {!fotoState.subiendo && fotoState.url && (
              <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Subida
              </div>
            )}
            <button
              type="button"
              onClick={() => limpiarFotoSlot(slot, context)}
              className="absolute top-2 left-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Botones para agregar foto */}
        {!fotoState.preview && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => iniciarCamaraFoto(slot, context)}
              className={`border-2 border-dashed ${dashed} rounded-lg py-3 text-xs transition-colors flex flex-col items-center justify-center gap-1`}
            >
              <Video className="h-4 w-4" />
              <span>Cámara</span>
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed ${dashed} rounded-lg py-3 text-xs transition-colors flex flex-col items-center justify-center gap-1`}
            >
              <ImageIcon className="h-4 w-4" />
              <span>Galería</span>
            </button>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={e => handleFotoChange(e, slot, context)}
          className="hidden"
        />
      </div>
    )
  }

  // No hay CamaraVivo local — el overlay de cámara es global (ver JSX principal)

  return (
    <div className="space-y-6 max-w-2xl">

      {/* ── Overlay de cámara foto (SIEMPRE en el DOM para que videoFotoRef sea válido en iOS) ── */}
      {/* Cuando camaraSlot es null, el overlay está off-screen pero el <video> sigue montado  */}
      <div
        className={camaraSlot
          ? 'fixed inset-0 z-50 bg-black flex flex-col'
          : 'fixed -left-[9999px] -top-[9999px] w-px h-px overflow-hidden pointer-events-none'}
        aria-hidden={!camaraSlot}
      >
        {camaraSlot && (() => {
          const meta = FOTO_LABELS[camaraSlot.slot]
          const Icon = meta.icon
          return (
            <div className="px-4 py-3 bg-orange-600 flex items-center gap-2 flex-shrink-0 safe-top">
              <Icon className="h-4 w-4 text-white" />
              <span className="text-white font-semibold text-sm">{meta.titulo}</span>
              <span className="text-orange-200 text-xs">— {meta.subtitulo}</span>
            </div>
          )
        })()}
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoFotoRef}
          className="flex-1 w-full object-cover"
          playsInline
          muted
          autoPlay
        />
        {camaraSlot && (
          <div className="flex items-center justify-center gap-4 p-5 bg-black/90 flex-shrink-0 safe-bottom">
            <button
              type="button"
              onClick={capturarFoto}
              className="bg-white text-gray-900 font-bold px-6 py-3 rounded-full shadow-lg flex items-center gap-2 hover:bg-orange-50 active:scale-95 transition-all"
            >
              <Camera className="h-5 w-5 text-orange-600" />
              Capturar foto
            </button>
            <button
              type="button"
              onClick={detenerCamaraFoto}
              className="bg-white/20 text-white p-3 rounded-full hover:bg-white/30 active:scale-95 transition-all"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      {/* Canvas oculto para captura de fotograma */}
      <canvas ref={canvasFotoRef} className="hidden" />

      {/* Notificación de éxito */}
      {ultimoRecibido && (
        <div className={`flex items-start gap-3 rounded-xl p-4 border animate-in fade-in slide-in-from-top-2 duration-300 ${
          ultimoRecibido.sinAsignar ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'
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

      {/* Scanner de tracking */}
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
            onClick={camaraScanner ? detenerScanner : iniciarScanner}
            title={camaraScanner ? 'Cerrar cámara' : 'Escanear con cámara'}
            className={`px-4 py-3 rounded-lg transition-colors flex items-center gap-2 font-medium border ${
              camaraScanner
                ? 'bg-red-50 border-red-300 text-red-600 hover:bg-red-100'
                : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-orange-50 hover:border-orange-400 hover:text-orange-600'
            }`}
          >
            {camaraScanner ? <VideoOff className="h-5 w-5" /> : <Camera className="h-5 w-5" />}
          </button>
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

        {/* Visor de la cámara scanner */}
        {camaraScanner && (
          <div className="relative rounded-xl overflow-hidden bg-black border-2 border-orange-400">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={videoScanRef} className="w-full max-h-64 object-cover" playsInline muted autoPlay />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="border-2 border-orange-400 rounded-lg w-3/4 h-24 opacity-70" />
            </div>
            <div className="absolute top-2 left-0 right-0 flex justify-center">
              <span className="bg-black/60 text-white text-xs px-3 py-1 rounded-full">
                Apunta al código de barras
              </span>
            </div>
            <button
              type="button"
              onClick={detenerScanner}
              className="absolute top-2 right-2 bg-black/60 text-white p-1.5 rounded-full hover:bg-black/80"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {errorCamara && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" /> {errorCamara}
          </p>
        )}

        {/* Error: no encontrado */}
        {errorBusqueda && !modoManual && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg px-4 py-3 text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {errorBusqueda}
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium text-amber-800">¿El paquete llegó sin casillero registrado?</p>
              <p className="text-xs text-amber-700">
                Puedes registrarlo sin asignar. Cuando el cliente lo reporte, el sistema lo asociará y le notificará por WhatsApp.
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

          {/* ── Sección fotos ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">
                Fotos del paquete{' '}
                <span className="text-gray-400 font-normal">— se enviarán al cliente</span>
              </span>
            </div>

            {/* Grid de 2 slots — el overlay de cámara se muestra globalmente */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <SlotFoto slot={1} context="normal" accent="orange" />
              </div>
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <SlotFoto slot={2} context="normal" accent="orange" />
              </div>
            </div>

            {/* Tip */}
            {!foto1.preview && !foto2.preview && !camaraSlot && (
              <p className="text-xs text-gray-400 text-center">
                📸 Toma la foto del empaque antes de abrir y la del contenido después. Ambas se envían al cliente.
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={!peso || parseFloat(peso) <= 0 || guardando || subiendoCualquiera}
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

          {/* ── Fotos modo manual ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium text-amber-700">
                Fotos del paquete <span className="text-amber-500 font-normal">(muy útil para identificarlo)</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                <SlotFoto slot={1} context="manual" accent="amber" />
              </div>
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                <SlotFoto slot={2} context="manual" accent="amber" />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={!formManual.peso || !formManual.descripcion || !formManual.categoria || guardandoManual || subiendoCualquiera}
              className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 text-base"
            >
              {guardandoManual
                ? <><Loader2 className="h-5 w-5 animate-spin" />Guardando...</>
                : <><CheckCircle2 className="h-5 w-5" />Guardar sin asignar</>}
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
