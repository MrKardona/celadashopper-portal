'use client'

// Botón "Marcar como entregado" con modal:
// - Subida opcional de foto de la entrega (con preview).
// - Notas internas opcionales.
// - Toggle para notificar o no al cliente por email/WhatsApp.
// Al confirmar: POST /api/admin/paquetes/[id]/entregar.
// Si el envío incluye foto, llega al cliente en el email "entregado".

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Camera, Upload, X, Loader2, AlertCircle, Image as ImageIcon, MailCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  paqueteId: string
  tracking: string
  descripcion: string
  clienteEmail: string | null
}

export default function EntregarPaqueteButton({ paqueteId, tracking, descripcion, clienteEmail }: Props) {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="w-full bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors"
      >
        <CheckCircle2 className="h-4 w-4" />
        Marcar como entregado
      </button>
      {abierto && (
        <ModalEntregar
          paqueteId={paqueteId}
          tracking={tracking}
          descripcion={descripcion}
          clienteEmail={clienteEmail}
          onClose={() => setAbierto(false)}
        />
      )}
    </>
  )
}

function ModalEntregar({
  paqueteId, tracking, descripcion, clienteEmail, onClose,
}: Props & { onClose: () => void }) {
  const router = useRouter()
  const galeriaInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [notas, setNotas] = useState('')
  const [notificar, setNotificar] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState(false)
  const [camaraAbierta, setCamaraAbierta] = useState(false)
  const [errorCamara, setErrorCamara] = useState('')

  // Cleanup al desmontar el modal: detener cámara si quedó activa
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
    }
  }, [])

  async function abrirCamara() {
    setErrorCamara('')
    setCamaraAbierta(true)
    await new Promise(r => setTimeout(r, 100)) // esperar render del <video>
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {/* autoplay puede fallar, ignorar */})
      }
    } catch (err) {
      console.error('[entregar] getUserMedia:', err)
      const msg = err instanceof Error ? err.message : ''
      setErrorCamara(
        msg.includes('Permission') || msg.includes('NotAllowed')
          ? 'Permiso de cámara denegado. Activa el permiso en la configuración del navegador.'
          : msg.includes('NotFound') || msg.includes('not found')
            ? 'No se detectó cámara en este dispositivo.'
            : 'No se pudo acceder a la cámara. Verifica los permisos del navegador.'
      )
      setCamaraAbierta(false)
    }
  }

  function cerrarCamara() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setCamaraAbierta(false)
  }

  async function capturarFoto() {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current

    // Tamaño del canvas igual al stream actual
    const w = video.videoWidth || 1280
    const h = video.videoHeight || 720
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, w, h)

    // Convertir a blob → File para reusar handleFile
    canvas.toBlob(async (blob) => {
      if (!blob) return
      const file = new File([blob], `entrega-${Date.now()}.jpg`, { type: 'image/jpeg' })
      cerrarCamara()
      await handleFile(file)
    }, 'image/jpeg', 0.9)
  }

  async function handleFile(file: File) {
    setError('')
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic'].includes(file.type)) {
      setError('Solo se permiten imágenes (JPG, PNG, WEBP, HEIC)')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('La imagen es demasiado grande (máx 10 MB)')
      return
    }

    // Preview local instantáneo
    const reader = new FileReader()
    reader.onloadend = () => setFotoPreview(reader.result as string)
    reader.readAsDataURL(file)

    // Subir al servidor
    setSubiendo(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/admin/foto', { method: 'POST', body: formData })
      const data = await res.json() as { url?: string; error?: string }
      if (!res.ok || !data.url) {
        setError(data.error ?? 'No se pudo subir la foto')
        setFotoPreview(null)
        return
      }
      setFotoUrl(data.url)
    } catch (err) {
      console.error('[entregar] subir foto:', err)
      setError('Error de conexión al subir la foto')
      setFotoPreview(null)
    } finally {
      setSubiendo(false)
    }
  }

  function quitarFoto() {
    setFotoUrl(null)
    setFotoPreview(null)
    if (galeriaInputRef.current) galeriaInputRef.current.value = ''
  }

  async function confirmar() {
    setEnviando(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/paquetes/${paqueteId}/entregar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          foto_url: fotoUrl ?? null,
          notas: notas.trim() || null,
          notificar,
        }),
      })
      const data = await res.json() as { ok?: boolean; error?: string; mensaje?: string }
      if (!res.ok || !data.ok) {
        setError(data.mensaje ?? data.error ?? 'No se pudo marcar como entregado')
        return
      }
      setExito(true)
      setTimeout(() => {
        onClose()
        router.refresh()
      }, 1200)
    } catch (err) {
      console.error('[entregar] confirmar:', err)
      setError('Error de conexión')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={() => !enviando && !exito && onClose()}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 border-b border-gray-100 flex items-center gap-2">
          <div className="h-9 w-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900">Marcar como entregado</h3>
            <p className="text-xs text-gray-500 font-mono truncate">{tracking}</p>
          </div>
        </div>

        {exito ? (
          <div className="p-8 text-center space-y-3">
            <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-7 w-7 text-green-600" />
            </div>
            <p className="font-bold text-gray-900">¡Paquete entregado!</p>
            <p className="text-sm text-gray-600">
              {notificar && clienteEmail
                ? 'Se envió el reporte al cliente con foto incluida.'
                : 'Estado actualizado correctamente.'}
            </p>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <p className="text-sm text-gray-700">
              Confirmas la entrega de <strong className="text-gray-900">{descripcion}</strong>.
              Al guardar, el cliente recibirá email con la foto y se cerrará el flujo del paquete.
            </p>

            {/* Foto de entrega */}
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1.5">
                Foto de la entrega <span className="text-gray-400 font-normal">(opcional pero recomendado)</span>
              </label>

              {fotoPreview ? (
                <div className="relative">
                  <img
                    src={fotoPreview}
                    alt="Preview entrega"
                    className="w-full max-h-72 object-contain bg-gray-50 rounded-lg border border-gray-200"
                  />
                  {subiendo && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-lg">
                      <Loader2 className="h-6 w-6 text-white animate-spin" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={quitarFoto}
                    disabled={subiendo}
                    aria-label="Quitar foto"
                    className="absolute top-2 right-2 bg-white/90 hover:bg-white text-gray-900 p-1.5 rounded-full shadow disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={abrirCamara}
                    className="border-2 border-dashed border-gray-300 hover:border-orange-400 hover:bg-orange-50 rounded-lg p-4 flex flex-col items-center gap-1 text-xs text-gray-600 transition-colors"
                  >
                    <Camera className="h-5 w-5 text-orange-600" />
                    Tomar foto
                  </button>
                  <button
                    type="button"
                    onClick={() => galeriaInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 hover:border-orange-400 hover:bg-orange-50 rounded-lg p-4 flex flex-col items-center gap-1 text-xs text-gray-600 transition-colors"
                  >
                    <Upload className="h-5 w-5 text-orange-600" />
                    Subir desde galería
                  </button>
                </div>
              )}

              {errorCamara && (
                <p className="text-xs text-red-600 mt-2 flex items-start gap-1">
                  <AlertCircle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                  {errorCamara}
                </p>
              )}

              {/* Input para GALERÍA: sin capture, abre selector de archivos */}
              <input
                ref={galeriaInputRef}
                type="file"
                accept="image/*"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                className="hidden"
              />
              {/* Canvas oculto para capturar el frame de video */}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            {/* Notas */}
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">
                Notas internas <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <textarea
                value={notas}
                onChange={e => setNotas(e.target.value)}
                placeholder="Ej: Recibido por María, mamá del cliente"
                rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
              />
            </div>

            {/* Notificar cliente */}
            <label className="flex items-start gap-2 cursor-pointer bg-gray-50 px-3 py-2.5 rounded-lg border border-gray-200">
              <input
                type="checkbox"
                checked={notificar}
                onChange={e => setNotificar(e.target.checked)}
                className="h-4 w-4 mt-0.5 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
              />
              <div className="flex-1 text-sm">
                <p className="font-medium text-gray-900 flex items-center gap-1">
                  <MailCheck className="h-3.5 w-3.5 text-green-600" />
                  Enviar reporte al cliente
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {clienteEmail
                    ? <>Se enviará email a <span className="font-mono text-gray-700">{clienteEmail}</span> con la foto y los datos del paquete entregado.</>
                    : 'Cliente sin email registrado — solo se notificará por WhatsApp si tiene número.'}
                </p>
              </div>
            </label>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2 text-sm text-red-700 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={onClose}
                disabled={enviando}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={confirmar}
                disabled={enviando || subiendo}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-2"
              >
                {enviando
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Entregando...</>
                  : <><CheckCircle2 className="h-4 w-4" /> Confirmar entrega</>}
              </Button>
            </div>

            {!fotoUrl && !fotoPreview && (
              <p className="text-[11px] text-gray-400 flex items-center gap-1 justify-center">
                <ImageIcon className="h-3 w-3" />
                Sin foto, solo se enviará el texto al cliente
              </p>
            )}
          </div>
        )}
      </div>

      {/* Overlay de cámara — encima del modal */}
      {camaraAbierta && (
        <div
          className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center"
          onClick={e => e.stopPropagation()}
        >
          <div className="relative w-full h-full flex items-center justify-center">
            <video
              ref={videoRef}
              className="max-w-full max-h-full object-contain"
              playsInline
              muted
              autoPlay
            />
            {/* Botón cerrar */}
            <button
              type="button"
              onClick={cerrarCamara}
              className="absolute top-4 right-4 bg-white text-gray-900 p-2 rounded-full shadow-lg hover:bg-gray-100"
              aria-label="Cerrar cámara"
            >
              <X className="h-5 w-5" />
            </button>
            {/* Indicador */}
            <p className="absolute top-4 left-4 right-16 text-center text-xs text-white bg-black/60 rounded px-3 py-2">
              Apunta la cámara al paquete y toma la foto
            </p>
            {/* Botón de captura */}
            <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-6">
              <button
                type="button"
                onClick={capturarFoto}
                aria-label="Tomar foto"
                className="h-16 w-16 rounded-full bg-white border-4 border-orange-500 shadow-2xl active:scale-95 transition-transform flex items-center justify-center"
              >
                <div className="h-12 w-12 rounded-full bg-orange-500" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
