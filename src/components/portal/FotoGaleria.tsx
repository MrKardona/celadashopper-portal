'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'

interface Foto {
  id: string
  url: string
  descripcion?: string | null
}

const MIN_SCALE = 0.25
const MAX_SCALE = 5
const STEP = 0.25

export function FotoGaleria({ fotos, cols = 3 }: { fotos: Foto[]; cols?: 2 | 3 | 4 }) {
  const [idx, setIdx]     = useState<number | null>(null)
  const [scale, setScale] = useState(1)
  const containerRef      = useRef<HTMLDivElement>(null)

  // Track touch pinch
  const lastDistRef = useRef<number | null>(null)

  const close = useCallback(() => setIdx(null), [])
  const prev  = useCallback(() => setIdx(i => (i !== null ? (i - 1 + fotos.length) % fotos.length : null)), [fotos.length])
  const next  = useCallback(() => setIdx(i => (i !== null ? (i + 1) % fotos.length : null)), [fotos.length])

  // Reset zoom when switching image or closing
  useEffect(() => { setScale(1); lastDistRef.current = null }, [idx])

  // Keyboard navigation
  useEffect(() => {
    if (idx === null) return
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowLeft')  prev()
      if (e.key === 'ArrowRight') next()
      if (e.key === '+' || e.key === '=') setScale(s => Math.min(MAX_SCALE, +(s + STEP).toFixed(2)))
      if (e.key === '-') setScale(s => Math.max(MIN_SCALE, +(s - STEP).toFixed(2)))
      if (e.key === '0') setScale(1)
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [idx, close, prev, next])

  // Scroll lock
  useEffect(() => {
    if (idx !== null) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [idx])

  // Mouse wheel zoom (non-passive)
  useEffect(() => {
    const el = containerRef.current
    if (!el || idx === null) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY < 0 ? STEP : -STEP
      setScale(s => Math.min(MAX_SCALE, Math.max(MIN_SCALE, +(s + delta).toFixed(2))))
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [idx])

  // Pinch-to-zoom (touch)
  useEffect(() => {
    const el = containerRef.current
    if (!el || idx === null) return

    function dist(t: TouchList) {
      const dx = t[0].clientX - t[1].clientX
      const dy = t[0].clientY - t[1].clientY
      return Math.sqrt(dx * dx + dy * dy)
    }

    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) lastDistRef.current = dist(e.touches)
    }
    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || lastDistRef.current === null) return
      e.preventDefault()
      const d = dist(e.touches)
      const ratio = d / lastDistRef.current
      lastDistRef.current = d
      setScale(s => Math.min(MAX_SCALE, Math.max(MIN_SCALE, +(s * ratio).toFixed(3))))
    }
    const onEnd = () => { lastDistRef.current = null }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove',  onMove,  { passive: false })
    el.addEventListener('touchend',   onEnd,   { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove',  onMove)
      el.removeEventListener('touchend',   onEnd)
    }
  }, [idx])

  const tw = 'rgba(255,255,255,'

  return (
    <>
      {/* Grid de miniaturas */}
      <div className={`p-4 grid gap-3 ${cols === 4 ? 'grid-cols-3 sm:grid-cols-4' : cols === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
        {fotos.map((foto, i) => (
          <button key={foto.id} onClick={() => setIdx(i)} className="text-left group" style={{ cursor: 'zoom-in' }}>
            <img
              src={foto.url}
              alt={foto.descripcion ?? 'Foto del paquete'}
              className="w-full aspect-square object-cover rounded-xl group-hover:opacity-80 transition-opacity"
              style={{ border: `1px solid ${tw}0.08)` }}
            />
            {foto.descripcion && (
              <p className="text-xs mt-1 text-center capitalize" style={{ color: `${tw}0.4)` }}>
                {foto.descripcion}
              </p>
            )}
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {idx !== null && (
        <div
          ref={containerRef}
          className="fixed inset-0 z-50 flex items-center justify-center select-none"
          style={{ background: 'rgba(0,0,0,0.93)', backdropFilter: 'blur(10px)' }}
          onClick={close}
        >
          {/* Botón cerrar */}
          <button
            onClick={e => { e.stopPropagation(); close() }}
            className="absolute top-4 right-4 flex items-center justify-center w-10 h-10 rounded-full transition-all"
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', zIndex: 10 }}
          >
            <X className="h-5 w-5 text-white" />
          </button>

          {/* Imagen */}
          <div
            className="flex items-center justify-center"
            style={{ width: '100%', height: '100%', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            <img
              src={fotos[idx].url}
              alt={fotos[idx].descripcion ?? 'Foto del paquete'}
              className="rounded-2xl object-contain shadow-2xl"
              style={{
                maxHeight: '78vh',
                maxWidth: '88vw',
                transform: `scale(${scale})`,
                transformOrigin: 'center center',
                transition: 'transform 0.1s ease-out',
                cursor: scale > 1 ? 'zoom-out' : 'default',
              }}
              onClick={e => {
                e.stopPropagation()
                if (scale > 1) setScale(1)
              }}
            />
          </div>

          {/* Descripción + contador */}
          {(fotos[idx].descripcion || fotos.length > 1) && (
            <div className="absolute top-5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5 pointer-events-none">
              {fotos[idx].descripcion && (
                <p className="text-sm capitalize px-3" style={{ color: `${tw}0.6)` }}>
                  {fotos[idx].descripcion}
                </p>
              )}
              {fotos.length > 1 && (
                <p className="text-xs font-mono" style={{ color: `${tw}0.3)` }}>
                  {idx + 1} / {fotos.length}
                </p>
              )}
            </div>
          )}

          {/* Controles de zoom */}
          <div
            className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1.5 rounded-full"
            style={{
              background: 'rgba(10,10,18,0.75)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.1)',
              zIndex: 10,
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setScale(s => Math.max(MIN_SCALE, +(s - STEP).toFixed(2)))}
              disabled={scale <= MIN_SCALE}
              className="flex items-center justify-center w-8 h-8 rounded-full transition-all disabled:opacity-30"
              style={{ color: 'rgba(255,255,255,0.7)' }}
              title="Alejar (−)"
            >
              <ZoomOut className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setScale(1)}
              className="text-xs font-semibold tabular-nums px-2 py-0.5 rounded-full transition-all"
              style={{
                color: scale !== 1 ? 'rgba(245,184,0,0.9)' : 'rgba(255,255,255,0.45)',
                minWidth: '3.2rem',
                textAlign: 'center',
              }}
              title="Restablecer (0)"
            >
              {Math.round(scale * 100)}%
            </button>

            <button
              type="button"
              onClick={() => setScale(s => Math.min(MAX_SCALE, +(s + STEP).toFixed(2)))}
              disabled={scale >= MAX_SCALE}
              className="flex items-center justify-center w-8 h-8 rounded-full transition-all disabled:opacity-30"
              style={{ color: 'rgba(255,255,255,0.7)' }}
              title="Acercar (+)"
            >
              <ZoomIn className="h-4 w-4" />
            </button>

            {scale !== 1 && (
              <>
                <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)', margin: '0 2px' }} />
                <button
                  type="button"
                  onClick={() => setScale(1)}
                  className="flex items-center justify-center w-8 h-8 rounded-full transition-all"
                  style={{ color: 'rgba(255,255,255,0.45)' }}
                  title="Restablecer a 100%"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>

          {/* Flechas de navegación */}
          {fotos.length > 1 && (
            <>
              <button
                onClick={e => { e.stopPropagation(); prev() }}
                className="fixed left-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-11 h-11 rounded-full transition-all"
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}
              >
                <ChevronLeft className="h-6 w-6 text-white" />
              </button>
              <button
                onClick={e => { e.stopPropagation(); next() }}
                className="fixed right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-11 h-11 rounded-full transition-all"
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}
              >
                <ChevronRight className="h-6 w-6 text-white" />
              </button>
            </>
          )}
        </div>
      )}
    </>
  )
}
