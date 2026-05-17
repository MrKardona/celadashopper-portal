'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Plus, X, Search, Loader2, CheckCircle2, AlertCircle, User, Phone, Bike } from 'lucide-react'

const tw = 'rgba(255,255,255,'

interface PerfilPreview {
  id: string
  nombre_completo: string
  email: string
  whatsapp: string | null
  telefono: string | null
  rol: string
}

type Step = 'input' | 'preview' | 'success'

export default function NuevoDomiciliarioModal() {
  const router = useRouter()
  const [open, setOpen]         = useState(false)
  const [mounted, setMounted]   = useState(false)
  const [email, setEmail]       = useState('')
  const [step, setStep]         = useState<Step>('input')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [perfil, setPerfil]     = useState<PerfilPreview | null>(null)
  const inputRef                = useRef<HTMLInputElement>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (open && step === 'input') setTimeout(() => inputRef.current?.focus(), 80)
  }, [open, step])

  useEffect(() => {
    if (!open) return
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [open])

  function handleClose() {
    setOpen(false)
    setEmail('')
    setStep('input')
    setError(null)
    setPerfil(null)
  }

  async function buscar(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    setPerfil(null)

    try {
      const res = await fetch(`/api/admin/domiciliarios/asignar-rol?email=${encodeURIComponent(email.trim())}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al buscar'); return }
      setPerfil(data.perfil)
      setStep('preview')
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  async function confirmar() {
    if (!perfil) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/domiciliarios/asignar-rol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: perfil.email }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al asignar rol'); return }
      setPerfil(data.perfil)
      setStep('success')
      router.refresh()
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const ROL_LABELS: Record<string, string> = {
    cliente: 'Cliente',
    admin: 'Administrador',
    agente_usa: 'Agente USA',
    domiciliario: 'Domiciliario',
  }

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 space-y-5"
        style={{
          background: 'rgba(12,12,24,0.98)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(99,102,241,0.15)' }}>
              <Bike className="h-4 w-4" style={{ color: '#818cf8' }} />
            </div>
            <div>
              <p className="font-bold text-white text-sm leading-none">Nuevo domiciliario</p>
              <p className="text-xs mt-0.5" style={{ color: `${tw}0.35)` }}>
                {step === 'input'   ? 'Busca por correo electrónico'  :
                 step === 'preview' ? 'Confirmar asignación de rol'   :
                 'Domiciliario asignado'}
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-lg transition-colors"
            style={{ color: `${tw}0.35)` }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step: buscar */}
        {step === 'input' && (
          <form onSubmit={buscar} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: `${tw}0.5)` }}>
                Correo electrónico del usuario
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: `${tw}0.3)` }} />
                <input
                  ref={inputRef}
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(null) }}
                  placeholder="correo@ejemplo.com"
                  className="w-full pl-9 pr-4 py-3 rounded-xl text-sm text-white placeholder-white/25 outline-none"
                  style={{
                    background: `${tw}0.05)`,
                    border: `1px solid ${tw}0.1)`,
                    fontFamily: 'inherit',
                  }}
                />
              </div>
              <p className="text-xs mt-1.5" style={{ color: `${tw}0.3)` }}>
                El usuario debe estar registrado en el casillero.
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#f87171' }} />
                <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.25)' }}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {loading ? 'Buscando...' : 'Buscar usuario'}
            </button>
          </form>
        )}

        {/* Step: preview */}
        {step === 'preview' && perfil && (
          <div className="space-y-4">
            {/* Tarjeta del perfil */}
            <div className="rounded-xl p-4 space-y-3"
              style={{ background: `${tw}0.04)`, border: `1px solid ${tw}0.09)` }}>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                  style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
                  {perfil.nombre_completo?.charAt(0).toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white truncate">{perfil.nombre_completo}</p>
                  <p className="text-xs truncate" style={{ color: `${tw}0.45)` }}>{perfil.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {(perfil.whatsapp || perfil.telefono) && (
                  <div className="flex items-center gap-1.5" style={{ color: `${tw}0.5)` }}>
                    <Phone className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{perfil.whatsapp ?? perfil.telefono}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5" style={{ color: `${tw}0.5)` }}>
                  <User className="h-3 w-3 flex-shrink-0" />
                  <span>Rol actual: <span className="text-white font-medium">{ROL_LABELS[perfil.rol] ?? perfil.rol}</span></span>
                </div>
              </div>
            </div>

            {/* Cambio de rol a aplicar */}
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <Bike className="h-4 w-4 flex-shrink-0" style={{ color: '#818cf8' }} />
              <p className="text-sm" style={{ color: `${tw}0.7)` }}>
                Se asignará el rol <span className="font-bold text-white">Domiciliario</span> a este usuario.
                {perfil.rol !== 'cliente' && perfil.rol !== 'domiciliario' && (
                  <span className="text-yellow-400 block text-xs mt-0.5">
                    ⚠️ Perderá su rol actual de {ROL_LABELS[perfil.rol] ?? perfil.rol}.
                  </span>
                )}
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#f87171' }} />
                <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { setStep('input'); setError(null) }}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{ border: `1px solid ${tw}0.1)`, color: `${tw}0.5)` }}>
                Cambiar correo
              </button>
              <button
                onClick={confirmar}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bike className="h-4 w-4" />}
                {loading ? 'Asignando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        )}

        {/* Step: éxito */}
        {step === 'success' && perfil && (
          <div className="space-y-4">
            <div className="flex flex-col items-center text-center py-4 gap-3">
              <div className="h-14 w-14 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(52,211,153,0.12)', border: '2px solid rgba(52,211,153,0.3)' }}>
                <CheckCircle2 className="h-7 w-7" style={{ color: '#34d399' }} />
              </div>
              <div>
                <p className="font-bold text-white">{perfil.nombre_completo}</p>
                <p className="text-sm mt-0.5" style={{ color: '#34d399' }}>
                  Ahora es domiciliario
                </p>
                <p className="text-xs mt-1" style={{ color: `${tw}0.35)` }}>
                  Puede iniciar sesión y ver sus entregas asignadas.
                </p>
              </div>
            </div>

            <button
              onClick={handleClose}
              className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}>
              Listo
            </button>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
        style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.25)' }}>
        <Plus className="h-4 w-4" />
        Nuevo domiciliario
      </button>

      {mounted && open && createPortal(modal, document.body)}
    </>
  )
}
