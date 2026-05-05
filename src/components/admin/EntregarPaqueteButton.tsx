'use client'

// Botón "Marcar como entregado" con modal:
// - Subida opcional de foto de la entrega (con preview).
// - Notas internas opcionales.
// - Toggle para notificar o no al cliente por email/WhatsApp.
// Al confirmar: POST /api/admin/paquetes/[id]/entregar.
// Si el envío incluye foto, llega al cliente en el email "entregado".

import { useRef, useState } from 'react'
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
  const camaraInputRef = useRef<HTMLInputElement>(null)
  const galeriaInputRef = useRef<HTMLInputElement>(null)
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [notas, setNotas] = useState('')
  const [notificar, setNotificar] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState(false)

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
    if (camaraInputRef.current) camaraInputRef.current.value = ''
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
                    onClick={() => camaraInputRef.current?.click()}
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

              {/* Input para CÁMARA (móvil): el atributo capture fuerza abrir la cámara */}
              <input
                ref={camaraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                className="hidden"
              />
              {/* Input para GALERÍA: sin capture, abre selector de archivos */}
              <input
                ref={galeriaInputRef}
                type="file"
                accept="image/*"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                className="hidden"
              />
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
    </div>
  )
}
