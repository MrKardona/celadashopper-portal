'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Camera, Upload, X, Loader2, AlertCircle, Image as ImageIcon, MailCheck } from 'lucide-react'

const tw = 'rgba(255,255,255,'

interface Props {
  paqueteId: string
  tracking: string
  descripcion: string
  clienteEmail: string | null
}

const modalOverlay: React.CSSProperties = {
  background: 'rgba(0,0,0,0.75)',
  backdropFilter: 'blur(4px)',
}
const modalCard: React.CSSProperties = {
  background: 'rgba(10,10,25,0.92)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: `1px solid ${tw}0.1)`,
  borderRadius: '1rem',
}

export default function EntregarPaqueteButton({ paqueteId, tracking, descripcion, clienteEmail }: Props) {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="w-full text-sm font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors"
        style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(52,211,153,0.18)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(52,211,153,0.12)')}
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
    await new Promise(r => setTimeout(r, 100))
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
    } catch (err) {
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
    const w = video.videoWidth || 1280
    const h = video.videoHeight || 720
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, w, h)
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
    const reader = new FileReader()
    reader.onloadend = () => setFotoPreview(reader.result as string)
    reader.readAsDataURL(file)
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
    } catch {
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
        body: JSON.stringify({ foto_url: fotoUrl ?? null, notas: notas.trim() || null, notificar }),
      })
      const data = await res.json() as { ok?: boolean; error?: string; mensaje?: string }
      if (!res.ok || !data.ok) {
        setError(data.mensaje ?? data.error ?? 'No se pudo marcar como entregado')
        return
      }
      setExito(true)
      setTimeout(() => { onClose(); router.refresh() }, 1200)
    } catch {
      setError('Error de conexión')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={modalOverlay}
      onClick={() => !enviando && !exito && onClose()}
    >
      <div
        className="max-w-md w-full max-h-[90vh] overflow-y-auto"
        style={modalCard}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 flex items-center gap-3" style={{ borderBottom: `1px solid ${tw}0.08)` }}>
          <div className="h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(52,211,153,0.12)' }}>
            <CheckCircle2 className="h-5 w-5" style={{ color: '#34d399' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-white">Marcar como entregado</h3>
            <p className="text-xs font-mono truncate" style={{ color: `${tw}0.45)` }}>{tracking}</p>
          </div>
        </div>

        {exito ? (
          <div className="p-10 text-center space-y-3">
            <div className="h-14 w-14 rounded-full flex items-center justify-center mx-auto"
              style={{ background: 'rgba(52,211,153,0.15)' }}>
              <CheckCircle2 className="h-7 w-7" style={{ color: '#34d399' }} />
            </div>
            <p className="font-bold text-white">¡Paquete entregado!</p>
            <p className="text-sm" style={{ color: `${tw}0.55)` }}>
              {notificar && clienteEmail
                ? 'Se envió el reporte al cliente con foto incluida.'
                : 'Estado actualizado correctamente.'}
            </p>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <p className="text-sm" style={{ color: `${tw}0.65)` }}>
              Confirmas la entrega de <strong className="text-white">{descripcion}</strong>.
              Al guardar, el cliente recibirá email con la foto y se cerrará el flujo del paquete.
            </p>

            {/* Foto de entrega */}
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: `${tw}0.6)` }}>
                Foto de la entrega <span style={{ color: `${tw}0.35)`, fontWeight: 400 }}>(opcional pero recomendado)</span>
              </label>

              {fotoPreview ? (
                <div className="relative">
                  <img
                    src={fotoPreview}
                    alt="Preview entrega"
                    className="w-full max-h-72 object-contain rounded-xl"
                    style={{ background: `${tw}0.04)`, border: `1px solid ${tw}0.1)` }}
                  />
                  {subiendo && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-xl">
                      <Loader2 className="h-6 w-6 text-white animate-spin" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={quitarFoto}
                    disabled={subiendo}
                    aria-label="Quitar foto"
                    className="absolute top-2 right-2 p-1.5 rounded-full disabled:opacity-50"
                    style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={abrirCamara}
                    className="border-2 border-dashed rounded-xl p-4 flex flex-col items-center gap-1.5 text-xs transition-colors"
                    style={{ borderColor: `${tw}0.12)`, color: `${tw}0.5)` }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'rgba(52,211,153,0.4)'
                      e.currentTarget.style.background = 'rgba(52,211,153,0.06)'
                      e.currentTarget.style.color = '#34d399'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = `${tw}0.12)`
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color = `${tw}0.5)`
                    }}
                  >
                    <Camera className="h-5 w-5" />
                    Tomar foto
                  </button>
                  <button
                    type="button"
                    onClick={() => galeriaInputRef.current?.click()}
                    className="border-2 border-dashed rounded-xl p-4 flex flex-col items-center gap-1.5 text-xs transition-colors"
                    style={{ borderColor: `${tw}0.12)`, color: `${tw}0.5)` }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'rgba(52,211,153,0.4)'
                      e.currentTarget.style.background = 'rgba(52,211,153,0.06)'
                      e.currentTarget.style.color = '#34d399'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = `${tw}0.12)`
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color = `${tw}0.5)`
                    }}
                  >
                    <Upload className="h-5 w-5" />
                    Subir desde galería
                  </button>
                </div>
              )}

              {errorCamara && (
                <p className="text-xs mt-2 flex items-start gap-1" style={{ color: '#f87171' }}>
                  <AlertCircle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                  {errorCamara}
                </p>
              )}

              <input
                ref={galeriaInputRef}
                type="file"
                accept="image/*"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                className="hidden"
              />
              <canvas ref={canvasRef} className="hidden" />
            </div>

            {/* Notas */}
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: `${tw}0.6)` }}>
                Notas internas <span style={{ color: `${tw}0.35)`, fontWeight: 400 }}>(opcional)</span>
              </label>
              <textarea
                value={notas}
                onChange={e => setNotas(e.target.value)}
                placeholder="Ej: Recibido por María, mamá del cliente"
                rows={2}
                className="glass-input w-full px-3 py-2 text-sm rounded-xl focus:outline-none"
                style={{ resize: 'none' }}
              />
            </div>

            {/* Notificar cliente */}
            <label
              className="flex items-start gap-3 cursor-pointer rounded-xl px-3 py-2.5"
              style={{ background: `${tw}0.04)`, border: `1px solid ${tw}0.08)` }}
            >
              <input
                type="checkbox"
                checked={notificar}
                onChange={e => setNotificar(e.target.checked)}
                className="h-4 w-4 mt-0.5 rounded"
                style={{ accentColor: '#34d399' }}
              />
              <div className="flex-1 text-sm">
                <p className="font-medium text-white flex items-center gap-1.5">
                  <MailCheck className="h-3.5 w-3.5" style={{ color: '#34d399' }} />
                  Enviar reporte al cliente
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: `${tw}0.4)` }}>
                  {clienteEmail
                    ? <>Se enviará email a <span className="font-mono" style={{ color: `${tw}0.65)` }}>{clienteEmail}</span> con la foto y los datos del paquete entregado.</>
                    : 'Cliente sin email registrado — solo se notificará por WhatsApp si tiene número.'}
                </p>
              </div>
            </label>

            {error && (
              <div className="text-sm p-3 rounded-xl flex items-start gap-2"
                style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={enviando}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
                style={{ border: `1px solid ${tw}0.12)`, color: `${tw}0.65)` }}
                onMouseEnter={e => (e.currentTarget.style.background = `${tw}0.05)`)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmar}
                disabled={enviando || subiendo}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(52,211,153,0.22)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(52,211,153,0.15)')}
              >
                {enviando
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Entregando...</>
                  : <><CheckCircle2 className="h-4 w-4" /> Confirmar entrega</>}
              </button>
            </div>

            {!fotoUrl && !fotoPreview && (
              <p className="text-[11px] flex items-center gap-1 justify-center" style={{ color: `${tw}0.3)` }}>
                <ImageIcon className="h-3 w-3" />
                Sin foto, solo se enviará el texto al cliente
              </p>
            )}
          </div>
        )}
      </div>

      {/* Overlay de cámara */}
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
            <button
              type="button"
              onClick={cerrarCamara}
              className="absolute top-4 right-4 p-2 rounded-full"
              style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}
              aria-label="Cerrar cámara"
            >
              <X className="h-5 w-5" />
            </button>
            <p className="absolute top-4 left-4 right-16 text-center text-xs text-white rounded px-3 py-2"
              style={{ background: 'rgba(0,0,0,0.6)' }}>
              Apunta la cámara al paquete y toma la foto
            </p>
            <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center">
              <button
                type="button"
                onClick={capturarFoto}
                aria-label="Tomar foto"
                className="h-16 w-16 rounded-full border-4 shadow-2xl active:scale-95 transition-transform flex items-center justify-center"
                style={{ background: 'white', borderColor: '#34d399' }}
              >
                <div className="h-12 w-12 rounded-full" style={{ background: '#34d399' }} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
