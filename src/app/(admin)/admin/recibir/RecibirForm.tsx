'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import {
  ScanBarcode, Search, CheckCircle2, AlertCircle, Package,
  Scale, Loader2, X, ClipboardList, Camera, ImageIcon, Video, VideoOff,
  PackageOpen, Sparkles,
} from 'lucide-react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { ESTADO_LABELS, CATEGORIA_LABELS, type EstadoPaquete, type CategoriaProducto } from '@/types'
import HistorialRecibidos from '@/components/admin/HistorialRecibidos'
import BuscadorClienteInline, { type ClienteSugerido } from '@/components/admin/BuscadorClienteInline'

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

const PER_UNIT_CATEGORIAS = new Set<CategoriaProducto>(['celular', 'computador', 'ipad_tablet', 'calzado'])
// Para estas categorías el cobro es por unidad — no se requiere peso
const SIN_PESO_CATEGORIAS = new Set<CategoriaProducto>(['celular', 'computador', 'ipad_tablet'])

function unidadLabel(cat: CategoriaProducto | ''): string {
  return cat === 'calzado' ? 'pares' : 'unidades'
}

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
  // ID de la última búsqueda activa — descarta respuestas de búsquedas anteriores
  const busquedaIdRef = useRef(0)

  // Camera photo refs (shared for both slots)
  const videoFotoRef = useRef<HTMLVideoElement>(null)
  const canvasFotoRef = useRef<HTMLCanvasElement>(null)
  const streamFotoRef = useRef<MediaStream | null>(null)

  // --- Estado: búsqueda normal ---
  const [tracking, setTracking] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [paquete, setPaquete] = useState<PaqueteEncontrado | null>(null)
  const [errorBusqueda, setErrorBusqueda] = useState('')

  // --- Estado: recepción normal ---
  const [peso, setPeso] = useState('')
  const [notas, setNotas] = useState('')
  const [valorDeclarado, setValorDeclarado] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [condicion, setCondicion] = useState<'nuevo' | 'usado' | ''>('')
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
    condicion: '' as 'nuevo' | 'usado' | '',
    bodega_destino: 'medellin',
    notas: '',
    valor_declarado: '',
    cantidad: 1,
  })
  const [guardandoManual, setGuardandoManual] = useState(false)
  // Cliente identificado manualmente por el agente (opcional en modo manual)
  const [clienteManual, setClienteManual] = useState<ClienteSugerido | null>(null)
  // Sugerencias de clientes cuando lo ingresado no es un tracking sino un casillero/nombre
  const [clientesSugeridos, setClientesSugeridos] = useState<ClienteSugerido[]>([])

  // --- OCR con Claude Vision (modo manual) ---
  const [analizandoOCR, setAnalizandoOCR] = useState(false)
  const [ocrError, setOcrError] = useState('')
  const [ocrResultado, setOcrResultado] = useState<{
    confianza_etiqueta: 'alta' | 'media' | 'baja'
    confianza_contenido: 'alta' | 'media' | 'baja'
    match_tipo: 'tracking' | 'casillero' | 'nombre' | null
    notas: string | null
    auto_busqueda?: 'encontrado' | 'no_encontrado' | null
  } | null>(null)
  // Nombre del destinatario tal como aparece en la etiqueta — se persiste con el paquete
  const [nombreEtiqueta, setNombreEtiqueta] = useState<string | null>(null)

  // --- Historial de sesión ---
  const [ultimoRecibido, setUltimoRecibido] = useState<PaqueteRecibido | null>(null)
  const [recibidosHoy, setRecibidosHoy] = useState<PaqueteRecibido[]>([])
  // refreshKey para que el HistorialRecibidos persistente se recargue tras cada recepción
  const [historialKey, setHistorialKey] = useState(0)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (paquete) {
      pesoRef.current?.focus()
      if (paquete.peso_libras) setPeso(String(paquete.peso_libras))
      if (paquete.valor_declarado != null) setValorDeclarado(String(paquete.valor_declarado))
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

  // ── Scanner de código de barras ──────────────────────────────────────────
  async function iniciarScanner() {
    setErrorCamara('')
    setCamaraScanner(true)
    await new Promise(r => setTimeout(r, 100))
    try {
      const reader = new BrowserMultiFormatReader()
      // Guard para que el callback solo dispare UNA VEZ aunque ZXing lo llame varias veces
      // antes de que controls.stop() surta efecto completamente.
      let yaEscaneado = false
      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
        videoScanRef.current!,
        (result) => {
          if (result && !yaEscaneado) {
            yaEscaneado = true
            const texto = result.getText()
            controls.stop()
            setCamaraScanner(false)
            setTracking(texto)
            buscarPaquete(texto)
          }
        }
      )
      scanControlsRef.current = controls
    } catch {
      setCamaraScanner(false)
      setErrorCamara('No se pudo acceder a la cámara. Verifica los permisos.')
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      streamFotoRef.current = stream
      setCamaraSlot({ slot, ctx })
      await new Promise(r => setTimeout(r, 60))
      if (videoFotoRef.current) {
        videoFotoRef.current.srcObject = stream
        await videoFotoRef.current.play()
      }
    } catch {
      setCamaraSlot(null)
      setErrorCamara('No se pudo acceder a la cámara. Verifica los permisos.')
    }
  }

  function detenerCamaraFoto() {
    if (streamFotoRef.current) {
      streamFotoRef.current.getTracks().forEach(t => t.stop())
      streamFotoRef.current = null
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

  const buscarPaquete = useCallback(async (valor: string): Promise<boolean> => {
    const q = valor.trim()
    if (!q) return false

    // Cada búsqueda recibe un ID único. Si cuando llega la respuesta ya se lanzó
    // una búsqueda más nueva, descartamos el resultado obsoleto y no tocamos el estado.
    const miId = ++busquedaIdRef.current

    setBuscando(true)
    setErrorBusqueda('')
    setPaquete(null)
    setPeso('')
    setValorDeclarado('')
    setCantidad(1)
    setModoManual(false)
    setClientesSugeridos([])
    try {
      const res = await fetch(`/api/admin/recibir?tracking=${encodeURIComponent(q)}`)
      const data = await res.json() as {
        paquete?: PaqueteEncontrado
        clientes?: ClienteSugerido[]
        error?: string
      }

      // Si ya se lanzó una búsqueda más reciente, ignorar esta respuesta
      if (miId !== busquedaIdRef.current) return false

      if (data.paquete) {
        setPaquete(data.paquete)
        return true
      } else if (data.clientes && data.clientes.length > 0) {
        setClientesSugeridos(data.clientes)
        return false
      } else {
        setErrorBusqueda(data.error ?? 'Paquete no encontrado')
        return false
      }
    } catch {
      if (miId !== busquedaIdRef.current) return false
      setErrorBusqueda('Error de conexión')
      return false
    } finally {
      // Solo limpiamos el spinner si seguimos siendo la búsqueda activa
      if (miId === busquedaIdRef.current) setBuscando(false)
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
    // Cancelar cualquier búsqueda en vuelo incrementando el ID activo
    busquedaIdRef.current++
    setTracking('')
    setPaquete(null)
    setErrorBusqueda('')
    setPeso('')
    setNotas('')
    setCantidad(1)
    setCondicion('')
    setUltimoRecibido(null)
    setModoManual(false)
    setFormManual({ descripcion: '', tienda: '', tracking_courier: '', peso: '', categoria: '', condicion: '', bodega_destino: 'medellin', notas: '', valor_declarado: '', cantidad: 1 })
    setValorDeclarado('')
    setClienteManual(null)
    setClientesSugeridos([])
    setFoto1({ preview: null, url: null, subiendo: false })
    setFoto2({ preview: null, url: null, subiendo: false })
    setFotoManual1({ preview: null, url: null, subiendo: false })
    setFotoManual2({ preview: null, url: null, subiendo: false })
    setOcrResultado(null)
    setOcrError('')
    setNombreEtiqueta(null)
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
          peso_libras: SIN_PESO_CATEGORIAS.has(paquete.categoria) ? 0 : parseFloat(peso),
          notas_internas: notas || undefined,
          foto_url: foto1.url || undefined,
          foto2_url: foto2.url || undefined,
          nombre_etiqueta: nombreEtiqueta || undefined,
          valor_declarado: valorDeclarado.trim() ? parseFloat(valorDeclarado) : undefined,
          cantidad: PER_UNIT_CATEGORIAS.has(paquete.categoria) ? cantidad : 1,
          condicion: condicion || undefined,
        }),
      })
      const data = await res.json() as { ok?: boolean; error?: string; mensaje?: string }
      if (!res.ok || !data.ok) {
        // Mensaje específico si el paquete ya fue reportado
        if (data.error === 'paquete_ya_recibido') {
          setErrorBusqueda(data.mensaje ?? 'Este paquete ya fue reportado.')
        } else {
          setErrorBusqueda(data.error ?? 'Error al guardar')
        }
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
      setHistorialKey(k => k + 1) // refresca historial persistente
      limpiar()
    } finally {
      setGuardando(false)
    }
  }

  // ── Analizar fotos con IA (Claude Vision) ────────────────────────────────
  async function analizarConIA() {
    if (!fotoManual1.url || !fotoManual2.url) return
    setOcrError('')
    setAnalizandoOCR(true)
    try {
      const res = await fetch('/api/admin/recibir/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fotoEmpaqueUrl: fotoManual1.url,
          fotoContenidoUrl: fotoManual2.url,
        }),
      })
      const data = await res.json() as {
        ok?: boolean
        error?: string
        etiqueta?: {
          tracking_origen: string | null
          numero_casilla: string | null
          nombre_destinatario: string | null
          tienda: string | null
          confianza: 'alta' | 'media' | 'baja'
          notas: string | null
        }
        contenido?: {
          descripcion: string
          categoria: CategoriaProducto
          condicion: 'nuevo' | 'usado' | null
          cantidad: number
          confianza: 'alta' | 'media' | 'baja'
        }
        match?: {
          tipo: 'tracking' | 'casillero' | 'nombre' | null
          cliente: ClienteSugerido | null
        }
      }
      if (!res.ok || !data.ok || !data.etiqueta || !data.contenido) {
        setOcrError(data.error ?? 'No se pudo analizar las fotos')
        return
      }

      // Guardar nombre de la etiqueta (se persiste con el paquete)
      if (data.etiqueta.nombre_destinatario) {
        setNombreEtiqueta(data.etiqueta.nombre_destinatario)
      }

      // Pre-llenar formulario manual con lo extraído (el agente puede editar)
      const catOCR = data.contenido!.categoria
      const condOCR = data.contenido!.condicion ?? ''
      setFormManual(prev => ({
        ...prev,
        descripcion: data.contenido!.descripcion || prev.descripcion,
        categoria: catOCR || prev.categoria,
        condicion: (condOCR as 'nuevo' | 'usado' | '') || prev.condicion,
        tienda: data.etiqueta!.tienda ?? prev.tienda,
        tracking_courier: data.etiqueta!.tracking_origen ?? prev.tracking_courier,
        cantidad: PER_UNIT_CATEGORIAS.has(catOCR) ? Math.max(1, data.contenido!.cantidad || 1) : 1,
      }))

      // Pre-asignar cliente si hubo match
      if (data.match?.cliente) {
        setClienteManual(data.match.cliente)
      }

      // ── Auto-búsqueda por tracking ────────────────────────────────────────
      // Si Claude detectó un tracking, intentamos encontrar el paquete reportado
      // por el cliente. Si lo encontramos: salimos de modo manual al flujo normal
      // (peso/notas) y movemos las fotos al slot regular.
      let autoBusqueda: 'encontrado' | 'no_encontrado' | null = null
      const trackingExtraido = data.etiqueta.tracking_origen?.trim()
      if (trackingExtraido) {
        setTracking(trackingExtraido)
        const encontrado = await buscarPaquete(trackingExtraido)
        autoBusqueda = encontrado ? 'encontrado' : 'no_encontrado'
        if (encontrado) {
          // Transferir fotos del modo manual al modo normal para que se guarden
          // con el paquete cuando el agente confirme.
          setFoto1({ ...fotoManual1 })
          setFoto2({ ...fotoManual2 })
          setFotoManual1({ preview: null, url: null, subiendo: false })
          setFotoManual2({ preview: null, url: null, subiendo: false })
        }
      }

      setOcrResultado({
        confianza_etiqueta: data.etiqueta.confianza,
        confianza_contenido: data.contenido.confianza,
        match_tipo: data.match?.tipo ?? null,
        notas: data.etiqueta.notas,
        auto_busqueda: autoBusqueda,
      })
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : 'Error de red')
    } finally {
      setAnalizandoOCR(false)
    }
  }

  // ── Guardar manual ────────────────────────────────────────────────────────
  async function handleGuardarManual(e: React.FormEvent) {
    e.preventDefault()
    if (!formManual.descripcion || !formManual.categoria || (!SIN_PESO_CATEGORIAS.has(formManual.categoria as CategoriaProducto) && !formManual.peso)) return
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
          peso_libras: SIN_PESO_CATEGORIAS.has(formManual.categoria as CategoriaProducto) ? 0 : parseFloat(formManual.peso),
          categoria: formManual.categoria,
          bodega_destino: formManual.bodega_destino,
          notas_internas: formManual.notas || undefined,
          foto_url: fotoManual1.url || undefined,
          foto2_url: fotoManual2.url || undefined,
          cliente_id: clienteManual?.id ?? undefined,
          nombre_etiqueta: nombreEtiqueta || undefined,
          valor_declarado: formManual.valor_declarado.trim() ? parseFloat(formManual.valor_declarado) : undefined,
          cantidad: PER_UNIT_CATEGORIAS.has(formManual.categoria as CategoriaProducto) ? formManual.cantidad : 1,
          condicion: formManual.condicion || undefined,
        }),
      })
      const data = await res.json() as { ok?: boolean; tracking_casilla?: string; error?: string; mensaje?: string; asignado?: boolean }
      if (!res.ok || !data.ok) {
        if (data.error === 'paquete_ya_recibido') {
          setErrorBusqueda(data.mensaje ?? 'Este paquete ya fue reportado.')
        } else {
          setErrorBusqueda(data.error ?? 'Error al guardar')
        }
        return
      }
      const nuevo: PaqueteRecibido = {
        id: data.tracking_casilla ?? '',
        tracking: data.tracking_casilla ?? 'S/N',
        cliente: clienteManual?.nombre_completo ?? '⏳ Sin asignar',
        peso: parseFloat(formManual.peso),
        hora: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
        sinAsignar: !clienteManual,
      }
      setUltimoRecibido(nuevo)
      setRecibidosHoy(prev => [nuevo, ...prev.slice(0, 29)])
      setHistorialKey(k => k + 1) // refresca historial persistente
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

    const isActiveCam = camaraSlot?.slot === slot && camaraSlot?.ctx === context
    const ring = accent === 'amber' ? 'focus:ring-amber-500' : 'focus:ring-orange-500'
    const accentColor = accent === 'amber' ? '#F5B800' : '#8899ff'
    const accentBg = accent === 'amber' ? 'rgba(245,184,0,0.12)' : 'rgba(99,130,255,0.12)'
    const accentBorder = accent === 'amber' ? 'rgba(245,184,0,0.3)' : 'rgba(99,130,255,0.3)'

    const meta = FOTO_LABELS[slot]
    const Icon = meta.icon

    return (
      <div className="space-y-1.5">
        {/* Header slot */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: accentBg, color: accentColor, border: `1px solid ${accentBorder}` }}>
            <Icon className="h-3 w-3" />
            Foto {slot}
          </span>
          <div>
            <p className="text-sm font-medium leading-tight" style={{ color: 'rgba(255,255,255,0.7)' }}>{meta.titulo}</p>
            <p className="text-xs leading-tight" style={{ color: 'rgba(255,255,255,0.35)' }}>{meta.subtitulo}</p>
          </div>
        </div>

        {/* Nota: el <canvas> usado para captura está montado a nivel del form
            (siempre en DOM aunque la cámara esté activa). Antes vivía aquí y
            quedaba desmontado al abrir la cámara, rompiendo el botón Capturar. */}

        {/* Vista previa de foto */}
        {!isActiveCam && fotoState.preview && (
          <div className="relative rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
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
        {!isActiveCam && !fotoState.preview && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => iniciarCamaraFoto(slot, context)}
              className="border-2 border-dashed rounded-xl py-3 text-xs transition-colors flex flex-col items-center justify-center gap-1"
              style={{ borderColor: accentBorder, color: accentColor }}
              onMouseEnter={e => (e.currentTarget.style.background = accentBg)}
              onMouseLeave={e => (e.currentTarget.style.background = '')}
            >
              <Video className="h-4 w-4" />
              <span>Cámara</span>
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed rounded-xl py-3 text-xs transition-colors flex flex-col items-center justify-center gap-1"
              style={{ borderColor: accentBorder, color: accentColor }}
              onMouseEnter={e => (e.currentTarget.style.background = accentBg)}
              onMouseLeave={e => (e.currentTarget.style.background = '')}
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

  // ── Sección de cámara en vivo (compartida, se muestra en el contexto activo) ──
  function CamaraVivo({ context }: { context: 'normal' | 'manual' }) {
    if (!camaraSlot || camaraSlot.ctx !== context) return null
    const slot = camaraSlot.slot
    const meta = FOTO_LABELS[slot]
    const Icon = meta.icon

    return (
      <div className="rounded-xl overflow-hidden bg-black space-y-0" style={{ border: '2px solid #F5B800' }}>
        <div className="px-3 py-2 flex items-center gap-2" style={{ background: 'rgba(245,184,0,0.15)' }}>
          <Icon className="h-4 w-4 text-white" />
          <span className="text-white text-sm font-medium">{meta.titulo} — {meta.subtitulo}</span>
        </div>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <div className="relative">
          <video ref={videoFotoRef} className="w-full max-h-64 object-cover" playsInline muted />
          <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={capturarFoto}
              className="btn-gold font-bold px-5 py-2.5 rounded-full shadow-lg flex items-center gap-2"
            >
              <Camera className="h-5 w-5" />
              Capturar
            </button>
            <button
              type="button"
              onClick={detenerCamaraFoto}
              className="bg-black/60 text-white p-2.5 rounded-full hover:bg-black/80"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Canvas oculto compartido para captura de cámara — siempre en el DOM
          para que capturarFoto() funcione aun con la vista de cámara activa. */}
      <canvas ref={canvasFotoRef} className="hidden" />

      {/* Notificación de éxito */}
      {ultimoRecibido && (
        <div className="flex items-start gap-3 rounded-xl p-4 border animate-in fade-in slide-in-from-top-2 duration-300"
          style={ultimoRecibido.sinAsignar
            ? { background: 'rgba(245,184,0,0.08)', borderColor: 'rgba(245,184,0,0.25)' }
            : { background: 'rgba(52,211,153,0.08)', borderColor: 'rgba(52,211,153,0.25)' }}>
          <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: ultimoRecibido.sinAsignar ? '#F5B800' : '#34d399' }} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold" style={{ color: ultimoRecibido.sinAsignar ? '#F5B800' : '#34d399' }}>
              {ultimoRecibido.sinAsignar ? 'Paquete registrado sin asignar' : '¡Paquete recibido correctamente!'}
            </p>
            <p className="text-sm mt-0.5" style={{ color: ultimoRecibido.sinAsignar ? 'rgba(245,184,0,0.7)' : 'rgba(52,211,153,0.7)' }}>
              <span className="font-mono font-bold">{ultimoRecibido.tracking}</span>
              {' · '}{ultimoRecibido.cliente}
              {' · '}{ultimoRecibido.peso} lb
            </p>
          </div>
          <button onClick={() => setUltimoRecibido(null)} style={{ color: 'rgba(255,255,255,0.4)' }}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Atajo: Recibir por foto (OCR) */}
      {!paquete && !modoManual && clientesSugeridos.length === 0 && (
        <div className="rounded-xl p-4 flex items-center justify-between gap-3"
          style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)' }}>
          <div className="flex items-center gap-2.5 min-w-0">
            <Sparkles className="h-5 w-5 flex-shrink-0" style={{ color: '#c084fc' }} />
            <div className="min-w-0">
              <p className="font-semibold text-sm" style={{ color: '#c084fc' }}>¿No tienes el tracking a la mano?</p>
              <p className="text-xs truncate" style={{ color: 'rgba(192,132,252,0.7)' }}>
                Toma o adjunta 2 fotos del paquete y la IA extrae tracking, casillero y descripción.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setModoManual(true)}
            className="flex-shrink-0 text-sm font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-colors"
            style={{ background: 'rgba(168,85,247,0.15)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(168,85,247,0.25)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(168,85,247,0.15)')}
          >
            <Camera className="h-4 w-4" />
            Recibir por foto
          </button>
        </div>
      )}

      {/* Scanner de tracking */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center gap-2 font-semibold text-white">
          <ScanBarcode className="h-5 w-5" style={{ color: '#F5B800' }} />
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
              if (paquete) {
                setPaquete(null)
                setPeso('')
                setValorDeclarado('')
                setCantidad(1)
              }
              if (modoManual) setModoManual(false)
              setClientesSugeridos([])
            }}
            onKeyDown={handleTrackingKeyDown}
            placeholder="Escanear código de barras o escribir tracking..."
            className="glass-input flex-1 px-4 py-3 text-base font-mono"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={camaraScanner ? detenerScanner : iniciarScanner}
            title={camaraScanner ? 'Cerrar cámara' : 'Escanear con cámara'}
            className="px-4 py-3 rounded-xl transition-colors flex items-center gap-2 font-medium"
            style={camaraScanner
              ? { background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }
              : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            {camaraScanner ? <VideoOff className="h-5 w-5" /> : <Camera className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={() => buscarPaquete(tracking)}
            disabled={!tracking.trim() || buscando}
            className="btn-gold px-4 py-3 rounded-xl disabled:opacity-40 flex items-center gap-2 font-semibold"
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
          <div className="rounded-xl px-3 py-2 flex items-center gap-2 text-sm"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
            <AlertCircle className="h-4 w-4 flex-shrink-0" /> {errorCamara}
          </div>
        )}

        {/* Sugerencias de cliente */}
        {clientesSugeridos.length > 0 && !modoManual && (
          <div className="space-y-3">
            <div className="rounded-xl p-4 space-y-3"
              style={{ background: 'rgba(99,130,255,0.08)', border: '1px solid rgba(99,130,255,0.2)' }}>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: '#8899ff' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: '#8899ff' }}>
                    {clientesSugeridos.length === 1
                      ? 'Este usuario ya está registrado en el sistema'
                      : `${clientesSugeridos.length} usuarios coinciden con la búsqueda`}
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'rgba(136,153,255,0.7)' }}>
                    No hay un paquete con ese tracking, pero el dato coincide con un cliente. Puedes recibir el paquete asignándolo directamente.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {clientesSugeridos.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setClienteManual(c)
                      setClientesSugeridos([])
                      setErrorBusqueda('')
                      setModoManual(true)
                    }}
                    className="w-full text-left rounded-xl p-3 transition-all"
                    style={{ background: 'rgba(99,130,255,0.06)', border: '1px solid rgba(99,130,255,0.15)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,130,255,0.14)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(99,130,255,0.06)')}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(99,130,255,0.15)' }}>
                        <span className="font-bold text-sm" style={{ color: '#8899ff' }}>
                          {c.nombre_completo?.[0]?.toUpperCase() ?? '?'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{c.nombre_completo}</p>
                        <p className="text-[11px] flex items-center gap-2 flex-wrap" style={{ color: 'rgba(255,255,255,0.45)' }}>
                          <span className="font-mono" style={{ color: '#F5B800' }}>{c.numero_casilla ?? 'sin casillero'}</span>
                          <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
                          <span className="truncate">{c.email}</span>
                          {(c.whatsapp || c.telefono) && (
                            <>
                              <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
                              <span>{c.whatsapp ?? c.telefono}</span>
                            </>
                          )}
                        </p>
                      </div>
                      <ClipboardList className="h-4 w-4 flex-shrink-0" style={{ color: '#8899ff' }} />
                    </div>
                  </button>
                ))}
              </div>
              <p className="text-[11px]" style={{ color: 'rgba(136,153,255,0.6)' }}>
                💡 Click en un cliente para iniciar la recepción manual con ese cliente preseleccionado.
              </p>
            </div>
          </div>
        )}

        {/* Error: no encontrado */}
        {errorBusqueda && !modoManual && clientesSugeridos.length === 0 && (
          <div className="space-y-3">
            <div className="rounded-xl px-4 py-3 flex items-center gap-2 text-sm"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {errorBusqueda}
            </div>
            <div className="rounded-xl p-4 space-y-2"
              style={{ background: 'rgba(245,184,0,0.07)', border: '1px solid rgba(245,184,0,0.2)' }}>
              <p className="text-sm font-medium" style={{ color: '#F5B800' }}>¿El paquete llegó sin casillero registrado?</p>
              <p className="text-xs" style={{ color: 'rgba(245,184,0,0.7)' }}>
                Puedes registrarlo sin asignar. Cuando el cliente lo reporte, el sistema lo asociará y le notificará por WhatsApp.
              </p>
              <button
                type="button"
                onClick={() => setModoManual(true)}
                className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl"
                style={{ background: 'rgba(245,184,0,0.12)', color: '#F5B800', border: '1px solid rgba(245,184,0,0.3)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(245,184,0,0.2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(245,184,0,0.12)')}
              >
                <ClipboardList className="h-4 w-4" />
                Recibir sin asignar
              </button>
            </div>
          </div>
        )}

        {/* Paquete encontrado */}
        {paquete && (
          <div className="rounded-xl p-4 space-y-3"
            style={yaRecibido
              ? { background: 'rgba(245,184,0,0.07)', border: '1px solid rgba(245,184,0,0.2)' }
              : { background: 'rgba(99,130,255,0.07)', border: '1px solid rgba(99,130,255,0.2)' }}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 flex-shrink-0" style={{ color: yaRecibido ? '#F5B800' : '#8899ff' }} />
                <span className="font-mono font-bold text-white">
                  {paquete.tracking_casilla ?? paquete.tracking_origen ?? tracking}
                </span>
              </div>
              <span className="text-xs px-2 py-1 rounded-full font-semibold"
                style={yaRecibido
                  ? { background: 'rgba(245,184,0,0.12)', color: '#F5B800', border: '1px solid rgba(245,184,0,0.25)' }
                  : { background: 'rgba(99,130,255,0.12)', color: '#8899ff', border: '1px solid rgba(99,130,255,0.25)' }}>
                {ESTADO_LABELS[paquete.estado]}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span style={{ color: 'rgba(255,255,255,0.45)' }}>Cliente</span>
                <p className="font-semibold text-white">{paquete.perfiles?.nombre_completo ?? '—'}</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Casilla: {paquete.perfiles?.numero_casilla}</p>
              </div>
              <div>
                <span style={{ color: 'rgba(255,255,255,0.45)' }}>Destino</span>
                <p className="font-semibold text-white">{BODEGA_LABELS[paquete.bodega_destino] ?? paquete.bodega_destino}</p>
              </div>
              <div>
                <span style={{ color: 'rgba(255,255,255,0.45)' }}>Producto</span>
                <p className="font-semibold text-white truncate">{paquete.descripcion}</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{paquete.tienda} · {CATEGORIA_LABELS[paquete.categoria]}</p>
              </div>
              {paquete.valor_declarado && (
                <div>
                  <span style={{ color: 'rgba(255,255,255,0.45)' }}>Valor declarado</span>
                  <p className="font-semibold" style={{ color: '#34d399' }}>${paquete.valor_declarado.toLocaleString()} USD</p>
                </div>
              )}
            </div>
            {paquete.notas_cliente && (
              <p className="text-xs italic rounded-xl px-3 py-2"
                style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)' }}>
                Nota del cliente: {paquete.notas_cliente}
              </p>
            )}
            {yaRecibido && (
              <div className="rounded-xl p-4 space-y-2"
                style={{ background: 'rgba(239,68,68,0.1)', border: '2px solid rgba(239,68,68,0.3)' }}>
                <p className="text-sm font-bold flex items-center gap-2" style={{ color: '#f87171' }}>
                  <AlertCircle className="h-5 w-5" />
                  Este paquete ya fue reportado
                </p>
                <p className="text-xs leading-relaxed" style={{ color: 'rgba(248,113,113,0.8)' }}>
                  Estado actual: <strong>{ESTADO_LABELS[paquete.estado]}</strong>.
                  No se permite un segundo registro con el mismo tracking.
                </p>
                {paquete.id && (
                  <a href={`/admin/paquetes/${paquete.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold hover:underline"
                    style={{ color: '#f87171' }}>
                    Ver detalle del paquete →
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Formulario recepción normal — solo si NO fue ya recibido */}
      {paquete && !yaRecibido && (
        <form onSubmit={handleConfirmar} className="glass-card p-5 space-y-4">
          <div className="flex items-center gap-2 font-semibold text-white">
            <Scale className="h-5 w-5" style={{ color: '#F5B800' }} />
            Registrar recepción
          </div>
          <div className="grid grid-cols-2 gap-4">
            {!SIN_PESO_CATEGORIAS.has(paquete.categoria) && (
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <label className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>Peso en libras <span style={{ color: '#f87171' }}>*</span></label>
                <div className="relative">
                  <input
                    ref={pesoRef}
                    type="number" step="0.1" min="0.1" max="999"
                    value={peso} onChange={e => setPeso(e.target.value)}
                    placeholder="0.0" required
                    className="glass-input w-full px-4 py-2.5 text-lg font-bold pr-10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>lb</span>
                </div>
              </div>
            )}
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <label className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>
                Valor declarado <span className="font-normal" style={{ color: 'rgba(255,255,255,0.35)' }}>(USD, opcional — para factura)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>$</span>
                <input
                  type="number" step="0.01" min="0" max="99999"
                  value={valorDeclarado}
                  onChange={e => setValorDeclarado(e.target.value)}
                  placeholder="0.00"
                  className="glass-input w-full pl-7 pr-10 py-2.5 text-sm"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>USD</span>
              </div>
            </div>
            {PER_UNIT_CATEGORIAS.has(paquete.categoria) && (
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <label className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>
                  Cantidad en {unidadLabel(paquete.categoria)} <span style={{ color: '#f87171' }}>*</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCantidad(c => Math.max(1, c - 1))}
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-lg font-bold"
                    style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)' }}
                  >−</button>
                  <input
                    type="number" min="1" max="50"
                    value={cantidad}
                    onChange={e => setCantidad(Math.max(1, parseInt(e.target.value) || 1))}
                    className="glass-input w-16 text-center px-2 py-2 text-lg font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => setCantidad(c => Math.min(50, c + 1))}
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-lg font-bold"
                    style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)' }}
                  >+</button>
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>{unidadLabel(paquete.categoria)}</span>
                </div>
              </div>
            )}
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <label className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>
                Condición <span className="font-normal" style={{ color: 'rgba(255,255,255,0.35)' }}>(opcional)</span>
              </label>
              <div className="flex gap-2">
                {(['nuevo', 'usado'] as const).map(op => (
                  <button
                    key={op}
                    type="button"
                    onClick={() => setCondicion(c => c === op ? '' : op)}
                    style={condicion === op
                      ? { background: '#F5B800', color: '#000', border: '1px solid #F5B800' }
                      : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.65)', border: '1px solid rgba(255,255,255,0.12)' }}
                    className="flex-1 py-2 rounded-xl border text-sm font-medium transition-colors"
                  >
                    {op === 'nuevo' ? '✨ Nuevo' : '🔄 Usado'}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5 col-span-2">
              <label className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>Notas internas <span className="font-normal" style={{ color: 'rgba(255,255,255,0.35)' }}>(opcional)</span></label>
              <input
                type="text" value={notas} onChange={e => setNotas(e.target.value)}
                placeholder="Ej: Caja con daño leve, producto bien..."
                className="glass-input w-full px-4 py-2.5 text-sm"
              />
            </div>
          </div>

          {/* ── Sección fotos ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4" style={{ color: 'rgba(255,255,255,0.4)' }} />
              <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>
                Fotos del paquete{' '}
                <span className="font-normal" style={{ color: 'rgba(255,255,255,0.35)' }}>— se enviarán al cliente</span>
              </span>
            </div>

            <CamaraVivo context="normal" />

            {!camaraSlot && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <SlotFoto slot={1} context="normal" accent="orange" />
                </div>
                <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <SlotFoto slot={2} context="normal" accent="orange" />
                </div>
              </div>
            )}

            {!foto1.preview && !foto2.preview && !camaraSlot && (
              <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.35)' }}>
                📸 Toma la foto del empaque antes de abrir y la del contenido después. Ambas se envían al cliente.
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={(SIN_PESO_CATEGORIAS.has(paquete.categoria) ? false : (!peso || parseFloat(peso) <= 0)) || guardando || subiendoCualquiera}
              className="btn-gold flex-1 py-3 rounded-xl disabled:opacity-40 flex items-center justify-center gap-2 text-base font-semibold"
            >
              {guardando ? <><Loader2 className="h-5 w-5 animate-spin" />Guardando...</> : <><CheckCircle2 className="h-5 w-5" />Confirmar recepción</>}
            </button>
            <button type="button" onClick={limpiar} className="px-4 py-3 rounded-xl font-medium"
              style={{ color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.12)' }}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Formulario recepción manual (sin asignar) */}
      {modoManual && (
        <form onSubmit={handleGuardarManual} className="glass-card p-5 space-y-4"
          style={{ borderColor: 'rgba(245,184,0,0.2)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold" style={{ color: '#F5B800' }}>
              <ClipboardList className="h-5 w-5" />
              Recibir paquete — datos del paquete
            </div>
            <button type="button" onClick={limpiar} style={{ color: 'rgba(255,255,255,0.4)' }}>
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Buscador de cliente */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>
              Cliente <span className="font-normal" style={{ color: 'rgba(255,255,255,0.35)' }}>(opcional — busca por casillero, nombre, email o teléfono)</span>
            </label>
            <BuscadorClienteInline
              valor={clienteManual}
              onSelect={setClienteManual}
              placeholder="CS-1234, nombre, email o teléfono..."
              defaultQuery={nombreEtiqueta ?? undefined}
            />
          </div>

          <p className="text-xs rounded-xl px-3 py-2" style={{ background: 'rgba(245,184,0,0.07)', color: 'rgba(245,184,0,0.85)', border: '1px solid rgba(245,184,0,0.15)' }}>
            {clienteManual
              ? <>El paquete se asignará a <strong>{clienteManual.nombre_completo}</strong> y le llegará notificación por email/WhatsApp con la foto del paquete.</>
              : <>Este paquete quedará en espera. Cuando el cliente lo reporte con el tracking <strong>{formManual.tracking_courier || 'del courier'}</strong>, el sistema lo asociará automáticamente.</>
            }
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <label className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>Categoría <span style={{ color: '#f87171' }}>*</span></label>
              <select
                value={formManual.categoria}
                onChange={e => setFormManual(p => ({ ...p, categoria: e.target.value as CategoriaProducto, cantidad: 1, condicion: '' }))}
                required
                className="glass-input w-full px-3 py-2.5 text-sm"
                style={{ colorScheme: 'dark', background: 'rgba(18,18,30,0.97)' }}
              >
                <option value="">Seleccionar...</option>
                {CATEGORIAS.map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            {!SIN_PESO_CATEGORIAS.has(formManual.categoria as CategoriaProducto) && (
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <label className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>Peso en libras <span style={{ color: '#f87171' }}>*</span></label>
                <div className="relative">
                  <input
                    ref={pesoManualRef}
                    type="number" step="0.1" min="0.1" max="999"
                    value={formManual.peso}
                    onChange={e => setFormManual(p => ({ ...p, peso: e.target.value }))}
                    placeholder="0.0" required
                    className="glass-input w-full px-4 py-2.5 text-lg font-bold pr-10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>lb</span>
                </div>
              </div>
            )}
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <label className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>
                Condición <span className="font-normal" style={{ color: 'rgba(255,255,255,0.35)' }}>(opcional)</span>
              </label>
              <div className="flex gap-2">
                {(['nuevo', 'usado'] as const).map(op => (
                  <button
                    key={op}
                    type="button"
                    onClick={() => setFormManual(p => ({ ...p, condicion: p.condicion === op ? '' : op }))}
                    className="flex-1 py-2 rounded-xl border text-sm font-medium transition-colors"
                    style={formManual.condicion === op
                      ? { background: '#F5B800', color: '#000', border: '1px solid #F5B800' }
                      : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.65)', border: '1px solid rgba(255,255,255,0.12)' }}
                  >
                    {op === 'nuevo' ? '✨ Nuevo' : '🔄 Usado'}
                  </button>
                ))}
              </div>
            </div>
            {PER_UNIT_CATEGORIAS.has(formManual.categoria as CategoriaProducto) && (
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <label className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>
                  Cantidad en {unidadLabel(formManual.categoria)} <span style={{ color: '#f87171' }}>*</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFormManual(p => ({ ...p, cantidad: Math.max(1, p.cantidad - 1) }))}
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-lg font-bold"
                    style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)' }}
                  >−</button>
                  <input
                    type="number" min="1" max="50"
                    value={formManual.cantidad}
                    onChange={e => setFormManual(p => ({ ...p, cantidad: Math.max(1, parseInt(e.target.value) || 1) }))}
                    className="glass-input w-16 text-center px-2 py-2 text-lg font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => setFormManual(p => ({ ...p, cantidad: Math.min(50, p.cantidad + 1) }))}
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-lg font-bold"
                    style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)' }}
                  >+</button>
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>{unidadLabel(formManual.categoria)}</span>
                </div>
              </div>
            )}
            <div className="space-y-1.5 col-span-2">
              <label className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>Descripción física <span style={{ color: '#f87171' }}>*</span></label>
              <input type="text" value={formManual.descripcion}
                onChange={e => setFormManual(p => ({ ...p, descripcion: e.target.value }))}
                placeholder="Ej: Caja mediana Amazon, posible zapatillas" required
                className="glass-input w-full px-4 py-2.5 text-sm" />
            </div>
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <label className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>Tienda <span className="font-normal" style={{ color: 'rgba(255,255,255,0.35)' }}>(si se ve)</span></label>
              <input type="text" value={formManual.tienda}
                onChange={e => setFormManual(p => ({ ...p, tienda: e.target.value }))}
                placeholder="Amazon, Nike..." className="glass-input w-full px-3 py-2.5 text-sm" />
            </div>
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <label className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>Tracking courier <span className="font-normal" style={{ color: 'rgba(255,255,255,0.35)' }}>(si tiene)</span></label>
              <input type="text" value={formManual.tracking_courier}
                onChange={e => setFormManual(p => ({ ...p, tracking_courier: e.target.value }))}
                placeholder="1Z, 9400..." className="glass-input w-full px-3 py-2.5 font-mono text-sm"
                autoComplete="off" />
            </div>
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <label className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>Bodega destino</label>
              <select value={formManual.bodega_destino}
                onChange={e => setFormManual(p => ({ ...p, bodega_destino: e.target.value }))}
                className="glass-input w-full px-3 py-2.5 text-sm">
                {BODEGAS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <label className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>
                Valor declarado <span className="font-normal" style={{ color: 'rgba(255,255,255,0.35)' }}>(USD, opcional)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>$</span>
                <input type="number" step="0.01" min="0" max="99999"
                  value={formManual.valor_declarado}
                  onChange={e => setFormManual(p => ({ ...p, valor_declarado: e.target.value }))}
                  placeholder="0.00" className="glass-input w-full pl-7 pr-10 py-2.5 text-sm" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>USD</span>
              </div>
            </div>
            <div className="space-y-1.5 col-span-2">
              <label className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>Notas internas <span className="font-normal" style={{ color: 'rgba(255,255,255,0.35)' }}>(opcional)</span></label>
              <input type="text" value={formManual.notas}
                onChange={e => setFormManual(p => ({ ...p, notas: e.target.value }))}
                placeholder="Estado del embalaje, observaciones..."
                className="glass-input w-full px-4 py-2.5 text-sm" />
            </div>
          </div>

          {/* ── Fotos modo manual ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4" style={{ color: '#F5B800' }} />
              <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>
                Fotos del paquete <span className="font-normal" style={{ color: 'rgba(255,255,255,0.35)' }}>(muy útil para identificarlo)</span>
              </span>
            </div>

            <CamaraVivo context="manual" />

            {!camaraSlot && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl p-3" style={{ background: 'rgba(245,184,0,0.04)', border: '1px solid rgba(245,184,0,0.12)' }}>
                  <SlotFoto slot={1} context="manual" accent="amber" />
                </div>
                <div className="rounded-xl p-3" style={{ background: 'rgba(245,184,0,0.04)', border: '1px solid rgba(245,184,0,0.12)' }}>
                  <SlotFoto slot={2} context="manual" accent="amber" />
                </div>
              </div>
            )}

            {/* ── Botón Analizar con IA ── */}
            {fotoManual1.url && fotoManual2.url && !camaraSlot && (
              <div className="rounded-xl p-3 space-y-2"
                style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)' }}>
                <button
                  type="button" onClick={analizarConIA} disabled={analizandoOCR}
                  className="w-full font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                  style={{ background: 'rgba(168,85,247,0.15)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(168,85,247,0.25)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(168,85,247,0.15)')}
                >
                  {analizandoOCR
                    ? <><Loader2 className="h-4 w-4 animate-spin" />Analizando con IA...</>
                    : <><Sparkles className="h-4 w-4" />Analizar fotos con IA</>}
                </button>
                <p className="text-[11px] text-center" style={{ color: 'rgba(192,132,252,0.65)' }}>
                  Extrae tracking, casillero, descripción y categoría automáticamente. Revisa siempre antes de guardar.
                </p>
                {ocrError && (
                  <div className="text-xs rounded-xl px-2.5 py-1.5 flex items-start gap-1.5"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <span>{ocrError}</span>
                  </div>
                )}
                {ocrResultado && !ocrError && (
                  <div className="text-xs rounded-xl px-3 py-2 space-y-1"
                    style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.15)' }}>
                    <div className="flex items-center gap-2 font-medium" style={{ color: '#c084fc' }}>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Análisis completo — revisa los campos
                    </div>
                    <div className="grid grid-cols-2 gap-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
                      <span>Etiqueta: <span style={{ color: ocrResultado.confianza_etiqueta === 'alta' ? '#34d399' : ocrResultado.confianza_etiqueta === 'media' ? '#F5B800' : '#f87171', fontWeight: 600 }}>{ocrResultado.confianza_etiqueta}</span></span>
                      <span>Contenido: <span style={{ color: ocrResultado.confianza_contenido === 'alta' ? '#34d399' : ocrResultado.confianza_contenido === 'media' ? '#F5B800' : '#f87171', fontWeight: 600 }}>{ocrResultado.confianza_contenido}</span></span>
                    </div>
                    {ocrResultado.auto_busqueda === 'encontrado' && (
                      <p style={{ color: '#34d399', fontWeight: 600 }}>✓ Paquete encontrado por tracking — pasamos al flujo normal</p>
                    )}
                    {ocrResultado.auto_busqueda === 'no_encontrado' && (
                      <p style={{ color: '#F5B800' }}>⚠ Tracking no coincide con un paquete reportado — se guarda como nuevo</p>
                    )}
                    {ocrResultado.match_tipo && ocrResultado.auto_busqueda !== 'encontrado' && (
                      <p style={{ color: '#34d399', fontWeight: 600 }}>✓ Cliente identificado por {ocrResultado.match_tipo === 'tracking' ? 'tracking del courier' : ocrResultado.match_tipo === 'casillero' ? 'número de casilla' : 'nombre'}</p>
                    )}
                    {ocrResultado.match_tipo === null && ocrResultado.auto_busqueda !== 'encontrado' && (
                      <p style={{ color: '#F5B800' }}>⚠ No se identificó cliente — el paquete quedará sin asignar</p>
                    )}
                    {ocrResultado.notas && (
                      <p className="italic" style={{ color: 'rgba(255,255,255,0.45)' }}>Nota IA: {ocrResultado.notas}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={(!SIN_PESO_CATEGORIAS.has(formManual.categoria as CategoriaProducto) && (!formManual.peso || parseFloat(formManual.peso) <= 0)) || !formManual.descripcion || !formManual.categoria || guardandoManual || subiendoCualquiera}
              className="btn-gold flex-1 py-3 rounded-xl disabled:opacity-40 flex items-center justify-center gap-2 text-base font-semibold"
            >
              {guardandoManual ? (
                <><Loader2 className="h-5 w-5 animate-spin" />Guardando...</>
              ) : clienteManual ? (
                <>
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
                  <span className="truncate">Guardar y asignar a {clienteManual.nombre_completo}</span>
                </>
              ) : (
                <><CheckCircle2 className="h-5 w-5" />Guardar sin asignar</>
              )}
            </button>
            <button type="button" onClick={limpiar} className="px-4 py-3 rounded-xl font-medium"
              style={{ color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.12)' }}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Historial persistente con edición inline */}
      <HistorialRecibidos refreshKey={historialKey} />
    </div>
  )
}
