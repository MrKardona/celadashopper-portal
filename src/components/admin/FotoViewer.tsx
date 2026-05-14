'use client'

import { useState, useEffect, useRef } from 'react'
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'

interface Props {
  src: string
  alt?: string
  borderColor?: string
  width?: number
  height?: number
}

export default function FotoViewer({ src, alt = 'Foto', borderColor = 'rgba(255,255,255,0.15)', width = 72, height = 72 }: Props) {
  const [open, setOpen]   = useState(false)
  const [zoom, setZoom]   = useState(1)
  const imgRef            = useRef<HTMLImageElement>(null)

  const zoomIn  = () => setZoom(z => Math.min(parseFloat((z + 0.5).toFixed(1)), 5))
  const zoomOut = () => setZoom(z => Math.max(parseFloat((z - 0.5).toFixed(1)), 0.5))
  const reset   = () => setZoom(1)
  const close   = () => { setOpen(false); setZoom(1) }

  // Cerrar con Escape
  useEffect(() => {
    if (!open) return
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [open])

  // Bloquear scroll del body cuando el lightbox está abierto
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Zoom con rueda del ratón
  useEffect(() => {
    if (!open) return
    const fn = (e: WheelEvent) => {
      e.preventDefault()
      setZoom(z => {
        const next = z - e.deltaY * 0.001
        return parseFloat(Math.min(5, Math.max(0.5, next)).toFixed(2))
      })
    }
    window.addEventListener('wheel', fn, { passive: false })
    return () => window.removeEventListener('wheel', fn)
  }, [open])

  return (
    <>
      {/* Miniatura */}
      <button
        onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(true) }}
        className="flex-shrink-0 rounded-xl overflow-hidden transition-opacity hover:opacity-85 active:opacity-70"
        style={{ width, height, border: `1px solid ${borderColor}` }}
        aria-label="Ver foto"
      >
        <img src={src} alt={alt} className="object-cover w-full h-full" />
      </button>

      {/* Lightbox */}
      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.93)', backdropFilter: 'blur(10px)' }}
          onClick={close}
        >
          {/* Barra de controles */}
          <div
            className="absolute top-4 right-4 flex items-center gap-1.5"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={zoomOut}
              disabled={zoom <= 0.5}
              className="flex items-center justify-center rounded-xl text-white transition-colors disabled:opacity-30"
              style={{ width: 38, height: 38, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}
              aria-label="Alejar"
            >
              <ZoomOut className="h-4 w-4" />
            </button>

            <button
              onClick={reset}
              className="px-3 h-[38px] rounded-xl text-xs font-mono font-bold text-white transition-colors"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', minWidth: 52 }}
              aria-label="Restablecer zoom"
            >
              {Math.round(zoom * 100)}%
            </button>

            <button
              onClick={zoomIn}
              disabled={zoom >= 5}
              className="flex items-center justify-center rounded-xl text-white transition-colors disabled:opacity-30"
              style={{ width: 38, height: 38, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}
              aria-label="Acercar"
            >
              <ZoomIn className="h-4 w-4" />
            </button>

            <div className="w-px h-6 mx-1" style={{ background: 'rgba(255,255,255,0.15)' }} />

            <button
              onClick={close}
              className="flex items-center justify-center rounded-xl text-white transition-colors"
              style={{ width: 38, height: 38, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Imagen */}
          <div
            className="flex items-center justify-center"
            style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            <img
              ref={imgRef}
              src={src}
              alt={alt}
              style={{
                maxWidth: '90vw',
                maxHeight: '90vh',
                objectFit: 'contain',
                transform: `scale(${zoom})`,
                transformOrigin: 'center center',
                transition: 'transform 0.15s ease-out',
                cursor: zoom > 1 ? 'grab' : 'default',
                userSelect: 'none',
              }}
              draggable={false}
            />
          </div>

          {/* Hint cierre */}
          <p
            className="absolute bottom-5 left-1/2 -translate-x-1/2 text-[11px] select-none"
            style={{ color: 'rgba(255,255,255,0.25)' }}
          >
            Clic fuera para cerrar · Rueda para zoom
          </p>
        </div>
      )}
    </>
  )
}
