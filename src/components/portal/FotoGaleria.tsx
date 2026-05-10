'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

interface Foto {
  id: string
  url: string
  descripcion?: string | null
}

export function FotoGaleria({ fotos }: { fotos: Foto[] }) {
  const [idx, setIdx] = useState<number | null>(null)

  const close = useCallback(() => setIdx(null), [])
  const prev = useCallback(() => setIdx(i => (i !== null ? (i - 1 + fotos.length) % fotos.length : null)), [fotos.length])
  const next = useCallback(() => setIdx(i => (i !== null ? (i + 1) % fotos.length : null)), [fotos.length])

  useEffect(() => {
    if (idx === null) return
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [idx, close, prev, next])

  // Bloquear scroll cuando el lightbox está abierto
  useEffect(() => {
    if (idx !== null) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [idx])

  const tw = 'rgba(255,255,255,'

  return (
    <>
      {/* Grid de fotos */}
      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {fotos.map((foto, i) => (
          <button
            key={foto.id}
            onClick={() => setIdx(i)}
            className="text-left group"
          >
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
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)' }}
          onClick={close}
        >
          {/* Contenedor central — detiene propagación para no cerrar al tocar la imagen */}
          <div
            className="relative flex flex-col items-center max-w-3xl w-full px-4"
            onClick={e => e.stopPropagation()}
          >
            {/* Botón cerrar */}
            <button
              onClick={close}
              className="absolute -top-12 right-4 flex items-center justify-center w-10 h-10 rounded-full transition-all"
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)' }}
            >
              <X className="h-5 w-5 text-white" />
            </button>

            {/* Imagen */}
            <img
              src={fotos[idx].url}
              alt={fotos[idx].descripcion ?? 'Foto del paquete'}
              className="max-h-[75vh] max-w-full object-contain rounded-2xl"
              style={{ border: '1px solid rgba(255,255,255,0.1)' }}
            />

            {/* Descripción */}
            {fotos[idx].descripcion && (
              <p className="mt-3 text-sm capitalize" style={{ color: `${tw}0.55)` }}>
                {fotos[idx].descripcion}
              </p>
            )}

            {/* Contador */}
            {fotos.length > 1 && (
              <p className="mt-1 text-xs font-mono" style={{ color: `${tw}0.3)` }}>
                {idx + 1} / {fotos.length}
              </p>
            )}
          </div>

          {/* Flechas de navegación — fuera del contenedor central para no bloquear el cierre */}
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
