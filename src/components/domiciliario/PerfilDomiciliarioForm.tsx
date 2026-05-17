'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, CheckCircle2 } from 'lucide-react'

interface Perfil {
  nombre_completo: string
  whatsapp: string
  telefono: string
  ciudad: string
  direccion: string
  barrio: string
  referencia: string
}

const tw = 'rgba(255,255,255,'

const inputStyle = {
  background: `${tw}0.05)`,
  border: `1px solid ${tw}0.1)`,
  borderRadius: '0.75rem',
  color: 'white',
  outline: 'none',
  width: '100%',
  padding: '0.625rem 0.875rem',
  fontSize: '0.875rem',
  fontFamily: 'inherit',
} as const

const labelStyle = {
  fontSize: '0.75rem',
  color: `${tw}0.45)`,
  display: 'block',
  marginBottom: '0.375rem',
  fontWeight: 500,
} as const

export default function PerfilDomiciliarioForm({ perfil }: { perfil: Perfil }) {
  const router = useRouter()
  const [form, setForm] = useState<Perfil>(perfil)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(key: keyof Perfil, value: string) {
    setForm(f => ({ ...f, [key]: value }))
    setSaved(false)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSaved(false)

    try {
      const res = await fetch('/api/portal/perfil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Error al guardar')
      }
      setSaved(true)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      <div className="glass-card p-4 space-y-4">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: `${tw}0.25)` }}>
          Datos personales
        </p>

        <div>
          <label style={labelStyle}>Nombre completo</label>
          <input
            style={inputStyle}
            value={form.nombre_completo}
            onChange={e => set('nombre_completo', e.target.value)}
            placeholder="Tu nombre"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label style={labelStyle}>WhatsApp</label>
            <input
              style={inputStyle}
              value={form.whatsapp}
              onChange={e => set('whatsapp', e.target.value)}
              placeholder="+57 300..."
              type="tel"
            />
          </div>
          <div>
            <label style={labelStyle}>Teléfono</label>
            <input
              style={inputStyle}
              value={form.telefono}
              onChange={e => set('telefono', e.target.value)}
              placeholder="+57 300..."
              type="tel"
            />
          </div>
        </div>
      </div>

      <div className="glass-card p-4 space-y-4">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: `${tw}0.25)` }}>
          Dirección
        </p>

        <div>
          <label style={labelStyle}>Ciudad</label>
          <input
            style={inputStyle}
            value={form.ciudad}
            onChange={e => set('ciudad', e.target.value)}
            placeholder="Medellín"
          />
        </div>

        <div>
          <label style={labelStyle}>Dirección</label>
          <input
            style={inputStyle}
            value={form.direccion}
            onChange={e => set('direccion', e.target.value)}
            placeholder="Calle 50 # 42-10"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label style={labelStyle}>Barrio</label>
            <input
              style={inputStyle}
              value={form.barrio}
              onChange={e => set('barrio', e.target.value)}
              placeholder="El Poblado"
            />
          </div>
          <div>
            <label style={labelStyle}>Referencia</label>
            <input
              style={inputStyle}
              value={form.referencia}
              onChange={e => set('referencia', e.target.value)}
              placeholder="Apto 301"
            />
          </div>
        </div>
      </div>

      {error && (
        <p className="text-xs px-3 py-2 rounded-xl text-center"
          style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-60"
        style={{
          background: saved
            ? 'rgba(52,211,153,0.15)'
            : 'rgba(129,140,248,0.15)',
          color: saved ? '#34d399' : '#818cf8',
          border: `1px solid ${saved ? 'rgba(52,211,153,0.3)' : 'rgba(129,140,248,0.3)'}`,
        }}
      >
        {saved ? (
          <>
            <CheckCircle2 className="h-4 w-4" />
            Guardado
          </>
        ) : loading ? (
          'Guardando...'
        ) : (
          <>
            <Save className="h-4 w-4" />
            Guardar cambios
          </>
        )}
      </button>
    </form>
  )
}
