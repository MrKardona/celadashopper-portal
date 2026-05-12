'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Camera, Upload, X, Loader2, AlertCircle } from 'lucide-react'

const tw = 'rgba(255,255,255,'

interface Props {
  paqueteId: string
  descripcion: string
}

export default function EntregarDomiciliarioButton({ paqueteId, descripcion }: Props) {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors"
        style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(52,211,153,0.22)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(52,211,153,0.15)')}
      >
        <CheckCircle2 className="h-4 w-4" />
        Confirmar entrega
      </button>
      {abierto && (
        <Modal paqueteId={paqueteId} descripcion={descripcion} onClose={() => setAbierto(false)} />
      )}
    </>
  )
}

function Modal({ paqueteId, descripcion, onClose }: Props & { onClose: () => void }) {
  const router = useRouter()
  const galeriaRef    = useRef<HTMLInputElement>(null)
  const videoRef      = useRef<HTMLVideoElement>(null)
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const streamRef     = useRef<MediaStream | null>(null)
  // Bloquea el cierre del backdrop mientras se sube una foto o acaba de cerrar la cámara
  const bloqueoCierreRef = useRef(false)

  const [camaraAbierta, setCamaraAbierta] = useState(false)
  const [fotoPreview,   setFotoPreview]   = useState<string | null>(null)
  const [fotoUrl,       setFotoUrl]       = useState<string | null>(null)
  const [subiendo,      setSubiendo]      = useState(false)
  const [notas,         setNotas]         = useState('')
  const [enviando,      setEnviando]      = useState(false)
  const [error,         setError]         = useState('')
  const [exito,         setExito]         = useState(false)
  const [errorCamara,   setErrorCamara]   = useState('')

  // Limpiar stream al desmontar
  useEffect(() => {
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()) }
  }, [])

  const cerrarCamara = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setCamaraAbierta(false)
    // Bloquea el cierre del modal por 400ms para absorber el clic residual de la cámara
    bloqueoCierreRef.current = true
    setTimeout(() => { bloqueoCierreRef.current = false }, 400)
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
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}) }
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      setErrorCamara(msg.includes('Permission') || msg.includes('NotAllowed')
        ? 'Permiso de cámara denegado.'
        : 'No se pudo acceder a la cámara.')
      setCamaraAbierta(false)
    }
  }

  function capturarFoto() {
    if (!videoRef.current || !canvasRef.current) return
    const v = videoRef.current; const c = canvasRef.current
    c.width = v.videoWidth || 1280; c.height = v.videoHeight || 720
    c.getContext('2d')?.drawImage(v, 0, 0, c.width, c.height)
    c.toBlob(async blob => {
      if (!blob) return
      cerrarCamara()
      await subirArchivo(new File([blob], `entrega-${Date.now()}.jpg`, { type: 'image/jpeg' }))
    }, 'image/jpeg', 0.9)
  }

  async function subirArchivo(file: File) {
    setError('')
    // Mostrar preview inmediatamente
    const reader = new FileReader()
    reader.onloadend = () => setFotoPreview(reader.result as string)
    reader.readAsDataURL(file)
    setSubiendo(true)
    try {
      const form = new FormData(); form.append('file', file)
      const res = await fetch('/api/domiciliario/foto', { method: 'POST', body: form })
      const data = await res.json() as { url?: string; error?: string }
      if (!res.ok || !data.url) { setError(data.error ?? 'No se pudo subir la foto'); setFotoPreview(null); return }
      setFotoUrl(data.url)
    } catch { setError('Error al subir la foto'); setFotoPreview(null) }
    finally { setSubiendo(false) }
  }

  async function confirmar() {
    setEnviando(true); setError('')
    try {
      const res = await fetch(`/api/domiciliario/paquetes/${paqueteId}/entregar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ foto_url: fotoUrl ?? null, notas: notas.trim() || null }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) { setError(data.error ?? 'Error al confirmar'); return }
      setExito(true)
      setTimeout(() => { onClose(); router.refresh() }, 1800)
    } catch { setError('Error de conexión') }
    finally { setEnviando(false) }
  }

  // Cierra el backdrop solo si no hay operación en curso
  function intentarCerrar() {
    if (bloqueoCierreRef.current || subiendo || enviando || exito) return
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}
      onClick={intentarCerrar}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: 'rgba(10,10,25,0.97)', backdropFilter: 'blur(20px)', border: `1px solid ${tw}0.1)` }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: `1px solid ${tw}0.08)` }}>
          <div className="h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(52,211,153,0.12)' }}>
            <CheckCircle2 className="h-5 w-5" style={{ color: '#34d399' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white text-sm">Confirmar entrega</p>
            <p className="text-xs truncate" style={{ color: `${tw}0.45)` }}>{descripcion}</p>
          </div>
          {!enviando && !exito && !subiendo && (
            <button onClick={onClose} className="p-1.5 rounded-lg text-white/40 hover:text-white/70 transition-colors">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Éxito */}
        {exito ? (
          <div className="p-10 text-center space-y-3">
            <div className="h-14 w-14 rounded-full flex items-center justify-center mx-auto"
              style={{ background: 'rgba(52,211,153,0.15)' }}>
              <CheckCircle2 className="h-7 w-7" style={{ color: '#34d399' }} />
            </div>
            <p className="font-bold text-white">¡Entregado!</p>
            <p className="text-sm" style={{ color: `${tw}0.5)` }}>El cliente fue notificado por correo.</p>
          </div>
        ) : (
          <div className="p-5 space-y-4">

            {/* ── Foto ── */}
            <div>
              <label className="text-xs font-medium block mb-2" style={{ color: `${tw}0.55)` }}>
                Foto de entrega <span style={{ color: `${tw}0.3)`, fontWeight: 400 }}>(opcional)</span>
              </label>

              {fotoPreview ? (
                /* Preview de la foto tomada */
                <div className="relative">
                  <img
                    src={fotoPreview}
                    alt="preview"
                    className="w-full max-h-52 object-contain rounded-xl"
                    style={{ background: `${tw}0.04)`, border: `1px solid ${tw}0.1)` }}
                  />
                  {subiendo && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center rounded-xl gap-2">
                      <Loader2 className="h-5 w-5 text-white animate-spin" />
                      <p className="text-xs text-white/70">Subiendo foto...</p>
                    </div>
                  )}
                  {!subiendo && (
                    <button
                      onClick={() => { setFotoUrl(null); setFotoPreview(null) }}
                      className="absolute top-2 right-2 p-1.5 rounded-full"
                      style={{ background: 'rgba(0,0,0,0.65)', color: 'white' }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  {!subiendo && fotoUrl && (
                    <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                      style={{ background: 'rgba(52,211,153,0.9)', color: 'white' }}>
                      <CheckCircle2 className="h-3 w-3" /> Subida
                    </div>
                  )}
                </div>
              ) : (
                /* Botones tomar / galería */
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Tomar foto',     icon: Camera, action: abrirCamara },
                    { label: 'Desde galería',  icon: Upload, action: () => galeriaRef.current?.click() },
                  ].map(({ label, icon: Icon, action }) => (
                    <button
                      key={label}
                      onClick={action}
                      className="border-2 border-dashed rounded-xl p-4 flex flex-col items-center gap-1.5 text-xs transition-colors"
                      style={{ borderColor: `${tw}0.12)`, color: `${tw}0.5)` }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = 'rgba(52,211,153,0.4)'
                        e.currentTarget.style.color = '#34d399'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = `${tw}0.12)`
                        e.currentTarget.style.color = `${tw}0.5)`
                      }}
                    >
                      <Icon className="h-5 w-5" />{label}
                    </button>
                  ))}
                </div>
              )}

              {errorCamara && (
                <p className="text-xs mt-1.5" style={{ color: '#f87171' }}>{errorCamara}</p>
              )}
              <input
                ref={galeriaRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) subirArchivo(f) }}
              />
              <canvas ref={canvasRef} className="hidden" />
            </div>

            {/* ── Notas (quién recibe) ── */}
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: `${tw}0.55)` }}>
                ¿Quién recibió? <span style={{ color: `${tw}0.3)`, fontWeight: 400 }}>(opcional)</span>
              </label>
              <textarea
                value={notas}
                onChange={e => setNotas(e.target.value)}
                placeholder="Ej: Recibido por la mamá del cliente, Dejado en portería, etc."
                rows={2}
                disabled={enviando}
                className="w-full px-3 py-2.5 text-sm rounded-xl focus:outline-none resize-none transition-colors"
                style={{
                  background: `${tw}0.05)`,
                  border: `1px solid ${tw}0.1)`,
                  color: 'white',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl text-sm"
                style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />{error}
              </div>
            )}

            {/* ── Botones ── */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={onClose}
                disabled={enviando || subiendo}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium disabled:opacity-40"
                style={{ border: `1px solid ${tw}0.12)`, color: `${tw}0.6)` }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmar}
                disabled={enviando || subiendo}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}
              >
                {enviando
                  ? <><Loader2 className="h-4 w-4 animate-spin" />Enviando...</>
                  : subiendo
                    ? <><Loader2 className="h-4 w-4 animate-spin" />Subiendo foto...</>
                    : <><CheckCircle2 className="h-4 w-4" />Confirmar entrega</>}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Cámara ── */}
      {camaraAbierta && (
        <div
          className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center"
          onClick={e => e.stopPropagation()}
        >
          <video ref={videoRef} className="max-w-full max-h-full object-contain" playsInline muted autoPlay />

          <button
            onClick={cerrarCamara}
            className="absolute top-4 right-4 p-2.5 rounded-full"
            style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}
          >
            <X className="h-5 w-5" />
          </button>

          <p className="absolute top-4 left-4 text-xs text-white/50">Apunta al paquete entregado</p>

          <div className="absolute bottom-8 flex items-center justify-center w-full">
            <button
              onClick={e => { e.stopPropagation(); capturarFoto() }}
              aria-label="Capturar"
              className="h-18 w-18 rounded-full border-4 active:scale-95 transition-transform"
              style={{ background: 'white', borderColor: '#34d399', width: 72, height: 72 }}
            >
              <div className="rounded-full mx-auto" style={{ background: '#34d399', width: 56, height: 56 }} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
