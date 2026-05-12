'use client'

/**
 * FotoThumb – miniatura clicable que abre un lightbox a pantalla completa.
 * Usa createPortal para montar el lightbox en document.body, completamente
 * fuera del árbol DOM del componente, evitando cualquier propagación de clicks.
 * Soporta zoom con rueda del ratón y botones +/-.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, Maximize2, Package, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'

const MIN_SCALE = 0.25
const MAX_SCALE = 5
const STEP = 0.25

export default function FotoThumb({
  url,
  alt = '',
  width = 40,
  height = 40,
  radius = '0.5rem',
}: {
  url: string | null | undefined
  alt?: string
  width?: number
  height?: number
  radius?: number | string
}) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [scale, setScale] = useState(1)
  const containerRef = useRef<HTMLDivElement>(null)
  const borderRadius = typeof radius === 'number' ? `${radius}px` : radius

  useEffect(() => { setMounted(true) }, [])

  // Reset zoom when closing
  useEffect(() => {
    if (!open) setScale(1)
  }, [open])

  // Escape key
  useEffect(() => {
    if (!open) return
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [open])

  // Mouse wheel zoom (non-passive so we can preventDefault)
  useEffect(() => {
    const el = containerRef.current
    if (!el || !open) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY < 0 ? STEP : -STEP
      setScale(prev => Math.min(MAX_SCALE, Math.max(MIN_SCALE, +(prev + delta).toFixed(2))))
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [open])

  const zoomIn  = useCallback((e: React.MouseEvent) => { e.stopPropagation(); setScale(s => Math.min(MAX_SCALE, +(s + STEP).toFixed(2))) }, [])
  const zoomOut = useCallback((e: React.MouseEvent) => { e.stopPropagation(); setScale(s => Math.max(MIN_SCALE, +(s - STEP).toFixed(2))) }, [])
  const reset   = useCallback((e: React.MouseEvent) => { e.stopPropagation(); setScale(1) }, [])

  if (!url) {
    return (
      <span
        className="flex-shrink-0 flex items-center justify-center"
        style={{
          width, height, borderRadius,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <Package
          style={{
            width: Math.max(10, Math.round(width * 0.4)),
            height: Math.max(10, Math.round(height * 0.4)),
            color: 'rgba(255,255,255,0.2)',
          }}
        />
      </span>
    )
  }

  return (
    <>
      {/* Thumbnail */}
      <button
        type="button"
        onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(true) }}
        className="flex-shrink-0 group relative overflow-hidden"
        style={{ width, height, borderRadius, cursor: 'zoom-in' }}
        title="Ver imagen completa"
      >
        <img
          src={url}
          alt={alt}
          className="w-full h-full object-cover transition-opacity group-hover:opacity-70"
        />
        <div
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: 'rgba(0,0,0,0.42)' }}
        >
          <Maximize2
            style={{
              width: Math.max(10, Math.round(width * 0.32)),
              height: Math.max(10, Math.round(height * 0.32)),
              color: 'white',
            }}
          />
        </div>
      </button>

      {/* Lightbox — montado en document.body via portal */}
      {mounted && open && createPortal(
        <div
          ref={containerRef}
          className="fixed inset-0 flex items-center justify-center p-6 select-none"
          style={{ background: 'rgba(0,0,0,0.93)', backdropFilter: 'blur(10px)', zIndex: 9999 }}
          onClick={() => setOpen(false)}
        >
          {/* Cerrar */}
          <button
            type="button"
            className="absolute top-4 right-4 p-2 rounded-full transition-colors"
            style={{ background: 'rgba(255,255,255,0.1)', color: 'white', zIndex: 10000 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
            onClick={() => setOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>

          {/* Imagen con zoom */}
          <img
            src={url}
            alt={alt}
            className="rounded-xl object-contain shadow-2xl"
            style={{
              maxHeight: '82vh',
              maxWidth: '88vw',
              cursor: scale > 1 ? 'zoom-out' : 'default',
              transform: `scale(${scale})`,
              transformOrigin: 'center center',
              transition: 'transform 0.12s ease-out',
            }}
            onClick={e => {
              e.stopPropagation()
              // Click en imagen con zoom: reducir; sin zoom: nada
              if (scale > 1) setScale(s => Math.max(MIN_SCALE, +(s - STEP).toFixed(2)))
            }}
          />

          {/* Controles de zoom */}
          <div
            className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1.5 rounded-full"
            style={{
              background: 'rgba(10,10,18,0.75)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.1)',
              zIndex: 10000,
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Zoom out */}
            <button
              type="button"
              onClick={zoomOut}
              disabled={scale <= MIN_SCALE}
              className="flex items-center justify-center w-7 h-7 rounded-full transition-all disabled:opacity-30"
              style={{ color: 'rgba(255,255,255,0.7)' }}
              onMouseEnter={e => { if (scale > MIN_SCALE) e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              title="Alejar"
            >
              <ZoomOut className="h-4 w-4" />
            </button>

            {/* Porcentaje / reset */}
            <button
              type="button"
              onClick={reset}
              className="text-xs font-semibold tabular-nums px-2 py-0.5 rounded-full transition-all"
              style={{
                color: scale !== 1 ? 'rgba(245,184,0,0.9)' : 'rgba(255,255,255,0.45)',
                minWidth: '3rem',
                textAlign: 'center',
              }}
              title="Restablecer zoom"
            >
              {Math.round(scale * 100)}%
            </button>

            {/* Zoom in */}
            <button
              type="button"
              onClick={zoomIn}
              disabled={scale >= MAX_SCALE}
              className="flex items-center justify-center w-7 h-7 rounded-full transition-all disabled:opacity-30"
              style={{ color: 'rgba(255,255,255,0.7)' }}
              onMouseEnter={e => { if (scale < MAX_SCALE) e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              title="Acercar"
            >
              <ZoomIn className="h-4 w-4" />
            </button>

            {/* Reset explícito cuando no está en 100% */}
            {scale !== 1 && (
              <>
                <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)', margin: '0 2px' }} />
                <button
                  type="button"
                  onClick={reset}
                  className="flex items-center justify-center w-7 h-7 rounded-full transition-all"
                  style={{ color: 'rgba(255,255,255,0.45)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  title="Restablecer a 100%"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
