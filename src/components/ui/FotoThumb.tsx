'use client'

/**
 * FotoThumb – miniatura clicable que abre un lightbox a pantalla completa.
 * Funciona tanto en componentes server como client (es un leaf client component).
 *
 * Props:
 *  url     – URL de la imagen. Si es null/undefined muestra el ícono Package.
 *  alt     – texto alternativo
 *  width   – ancho en px (default 40)
 *  height  – alto en px (default 40)
 *  radius  – border-radius en px o string CSS (default '0.5rem')
 */

import { useState, useEffect } from 'react'
import { X, Maximize2, Package } from 'lucide-react'

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
  const borderRadius = typeof radius === 'number' ? `${radius}px` : radius

  useEffect(() => {
    if (!open) return
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [open])

  if (!url) {
    return (
      <span
        className="flex-shrink-0 flex items-center justify-center"
        style={{
          width,
          height,
          borderRadius,
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

      {/* Lightbox */}
      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.93)', backdropFilter: 'blur(10px)' }}
          onClick={e => { e.stopPropagation(); setOpen(false) }}
        >
          <button
            type="button"
            className="absolute top-4 right-4 p-2 rounded-full z-10 transition-colors"
            style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
            onClick={e => { e.stopPropagation(); setOpen(false) }}
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={url}
            alt={alt}
            className="rounded-xl object-contain shadow-2xl"
            style={{ maxHeight: '88vh', maxWidth: '90vw', cursor: 'default' }}
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}
