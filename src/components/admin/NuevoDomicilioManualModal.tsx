'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, MapPin, Loader2, CheckCircle2, User, Wrench, Package, Phone, FileText } from 'lucide-react'
import { useRouter } from 'next/navigation'

const tw = 'rgba(255,255,255,'

const TIPOS = [
  {
    value:   'personal'  as const,
    label:   'Personal',
    icon:    User,
    color:   '#818cf8',
    glow:    'rgba(129,140,248,',
    grad:    'linear-gradient(135deg,rgba(129,140,248,0.22) 0%,rgba(99,102,241,0.12) 100%)',
  },
  {
    value:   'servicios' as const,
    label:   'Servicios',
    icon:    Wrench,
    color:   '#f59e0b',
    glow:    'rgba(245,158,11,',
    grad:    'linear-gradient(135deg,rgba(245,158,11,0.22) 0%,rgba(217,119,6,0.12) 100%)',
  },
  {
    value:   'productos' as const,
    label:   'Productos',
    icon:    Package,
    color:   '#34d399',
    glow:    'rgba(52,211,153,',
    grad:    'linear-gradient(135deg,rgba(52,211,153,0.22) 0%,rgba(16,185,129,0.12) 100%)',
  },
]

interface Props {
  domiciliarioId: string
  domiciliarioNombre: string
}

export default function NuevoDomicilioManualModal({ domiciliarioId, domiciliarioNombre }: Props) {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium transition-all w-full"
        style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', color: '#34d399' }}
      >
        <MapPin className="h-3.5 w-3.5" />
        Agregar domicilio manual
      </button>
      {abierto && createPortal(
        <Modal
          domiciliarioId={domiciliarioId}
          domiciliarioNombre={domiciliarioNombre}
          onClose={() => setAbierto(false)}
        />,
        document.body
      )}
    </>
  )
}

function Field({
  label, optional, children,
}: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-semibold"
        style={{ color: `${tw}0.5)` }}>
        {label}
        {optional
          ? <span className="font-normal text-[10px]" style={{ color: `${tw}0.22)` }}>opcional</span>
          : <span style={{ color: '#f87171' }}>*</span>}
      </label>
      {children}
    </div>
  )
}

function Modal({ domiciliarioId, domiciliarioNombre, onClose }: Props & { onClose: () => void }) {
  const router = useRouter()
  const [nombre,    setNombre]    = useState('')
  const [direccion, setDireccion] = useState('')
  const [telefono,  setTelefono]  = useState('')
  const [notas,     setNotas]     = useState('')
  const [tipo,      setTipo]      = useState<'personal' | 'servicios' | 'productos'>('servicios')
  const [guardando, setGuardando] = useState(false)
  const [error,     setError]     = useState('')
  const [exito,     setExito]     = useState(false)

  const tipoActivo = TIPOS.find(t => t.value === tipo)!

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape' && !guardando) onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [guardando, onClose])

  async function guardar() {
    if (!nombre.trim() || !direccion.trim()) {
      setError('Nombre y dirección son obligatorios')
      return
    }
    setGuardando(true); setError('')
    try {
      const res = await fetch('/api/admin/domicilios-manuales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domiciliario_id: domiciliarioId,
          nombre:    nombre.trim(),
          direccion: direccion.trim(),
          telefono:  telefono.trim() || null,
          notas:     notas.trim()    || null,
          tipo,
        }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) { setError(data.error ?? 'Error al guardar'); return }
      setExito(true)
      router.refresh()
      setTimeout(onClose, 1500)
    } catch {
      setError('Error de conexión')
    } finally {
      setGuardando(false)
    }
  }

  const inputBase: React.CSSProperties = {
    background: 'rgba(255,255,255,0.05)',
    border: `1px solid ${tw}0.1)`,
    color: 'white',
    borderRadius: '0.75rem',
    fontSize: '0.875rem',
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 0.15s',
  }

  const canSubmit = nombre.trim() && direccion.trim() && !guardando

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget && !guardando) onClose() }}
    >
      <div
        className="w-full max-w-sm overflow-hidden"
        style={{
          background: 'rgba(8,8,20,0.97)',
          border: `1px solid ${tw}0.1)`,
          borderRadius: '1.25rem',
          backdropFilter: 'blur(24px)',
          boxShadow: `0 32px 64px rgba(0,0,0,0.6), 0 0 0 1px ${tw}0.05)`,
        }}
      >
        {/* Barra de acento superior */}
        <div className="h-[3px]"
          style={{ background: `linear-gradient(90deg, ${tipoActivo.color} 0%, ${tipoActivo.glow}0.2) 100%)` }} />

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-5 py-4"
          style={{ borderBottom: `1px solid ${tw}0.07)` }}>
          <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
            style={{ background: `${tipoActivo.glow}0.15)`, border: `1px solid ${tipoActivo.glow}0.25)` }}>
            <MapPin className="h-4 w-4" style={{ color: tipoActivo.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white text-sm leading-tight">Domicilio manual</p>
            <p className="text-xs truncate mt-0.5 font-medium" style={{ color: `${tw}0.35)` }}>
              {domiciliarioNombre}
            </p>
          </div>
          {!guardando && (
            <button onClick={onClose}
              className="h-7 w-7 rounded-lg flex items-center justify-center transition-all hover:bg-white/[0.07]"
              style={{ color: `${tw}0.3)` }}>
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* ── Éxito ──────────────────────────────────────────────────── */}
        {exito ? (
          <div className="px-5 py-14 text-center space-y-3">
            <div className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto"
              style={{ background: `${tipoActivo.glow}0.12)`, border: `1px solid ${tipoActivo.glow}0.25)` }}>
              <CheckCircle2 className="h-8 w-8" style={{ color: tipoActivo.color }} />
            </div>
            <p className="font-bold text-white text-base">¡Domicilio agregado!</p>
            <p className="text-xs" style={{ color: `${tw}0.35)` }}>Actualizando la planilla…</p>
          </div>
        ) : (

          <div className="px-5 py-5 space-y-4">

            {/* ── Selector de tipo ──────────────────────────────────── */}
            <div className="space-y-2">
              <p className="text-xs font-semibold" style={{ color: `${tw}0.45)` }}>Tipo de domicilio</p>
              <div className="grid grid-cols-3 gap-2">
                {TIPOS.map(({ value, label, icon: Icon, color, glow, grad }) => {
                  const active = tipo === value
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setTipo(value)}
                      disabled={guardando}
                      className="flex flex-col items-center gap-2 py-3 rounded-xl text-xs font-semibold transition-all relative overflow-hidden"
                      style={{
                        background:  active ? grad : `${tw}0.03)`,
                        border:      `1.5px solid ${active ? `${glow}0.5)` : `${tw}0.08)`}`,
                        color:       active ? color : `${tw}0.3)`,
                        boxShadow:   active ? `0 0 16px ${glow}0.12)` : 'none',
                      }}
                    >
                      <div className="h-7 w-7 rounded-lg flex items-center justify-center transition-all"
                        style={{
                          background: active ? `${glow}0.2)` : `${tw}0.05)`,
                        }}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── Nombre ───────────────────────────────────────────── */}
            <Field label="Nombre">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none"
                  style={{ color: `${tw}0.25)` }} />
                <input
                  type="text"
                  value={nombre}
                  onChange={e => { setNombre(e.target.value); setError('') }}
                  onKeyDown={e => e.key === 'Enter' && guardar()}
                  placeholder="Nombre del destinatario"
                  disabled={guardando}
                  className="w-full pl-9 pr-3 py-2.5"
                  style={inputBase}
                  autoFocus
                />
              </div>
            </Field>

            {/* ── Dirección ─────────────────────────────────────────── */}
            <Field label="Dirección">
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none"
                  style={{ color: `${tw}0.25)` }} />
                <input
                  type="text"
                  value={direccion}
                  onChange={e => { setDireccion(e.target.value); setError('') }}
                  onKeyDown={e => e.key === 'Enter' && guardar()}
                  placeholder="Calle, carrera, barrio…"
                  disabled={guardando}
                  className="w-full pl-9 pr-3 py-2.5"
                  style={inputBase}
                />
              </div>
            </Field>

            {/* ── Teléfono + Notas en row ───────────────────────────── */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Teléfono" optional>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none"
                    style={{ color: `${tw}0.2)` }} />
                  <input
                    type="tel"
                    value={telefono}
                    onChange={e => setTelefono(e.target.value)}
                    placeholder="Celular"
                    disabled={guardando}
                    className="w-full pl-9 pr-3 py-2.5"
                    style={inputBase}
                  />
                </div>
              </Field>

              <Field label="Notas" optional>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 h-3.5 w-3.5 pointer-events-none"
                    style={{ color: `${tw}0.2)` }} />
                  <textarea
                    value={notas}
                    onChange={e => setNotas(e.target.value)}
                    placeholder="Referencia…"
                    rows={1}
                    disabled={guardando}
                    className="w-full pl-9 pr-3 py-2.5 resize-none"
                    style={{ ...inputBase, lineHeight: '1.5' }}
                  />
                </div>
              </Field>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 text-xs px-3 py-2.5 rounded-xl"
                style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                <span>⚠️</span>
                {error}
              </div>
            )}

            {/* ── Botones ───────────────────────────────────────────── */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={onClose}
                disabled={guardando}
                className="flex-1 py-2.5 text-sm rounded-xl font-medium transition-all disabled:opacity-50"
                style={{ border: `1px solid ${tw}0.1)`, color: `${tw}0.45)` }}
                onMouseEnter={e => (e.currentTarget.style.background = `${tw}0.05)`)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={!canSubmit}
                className="flex-1 py-2.5 text-sm rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                style={{
                  background: canSubmit ? tipoActivo.grad.replace('135deg,', '135deg,').replace('0.22)', '0.35)').replace('0.12)', '0.2)') : `${tw}0.04)`,
                  border: `1.5px solid ${canSubmit ? `${tipoActivo.glow}0.5)` : `${tw}0.08)`}`,
                  color: canSubmit ? tipoActivo.color : `${tw}0.25)`,
                  boxShadow: canSubmit ? `0 0 20px ${tipoActivo.glow}0.15)` : 'none',
                }}
              >
                {guardando
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando…</>
                  : <><CheckCircle2 className="h-4 w-4" /> Agregar</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
