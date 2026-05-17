'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, X, Save, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

interface ClientePerfil {
  id: string
  nombre_completo: string
  numero_casilla: string
  email: string
  whatsapp: string | null
  telefono: string | null
  ciudad: string | null
  direccion: string | null
  barrio: string | null
  referencia: string | null
}

const tw = 'rgba(255,255,255,'
const labelStyle = { color: `${tw}0.5)` }
const inputClass = 'w-full px-3 py-2 rounded-xl text-sm bg-white/[0.06] border border-white/[0.1] text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-yellow-400/50'

export default function ClienteEditInline({ perfil }: { perfil: ClientePerfil }) {
  const router = useRouter()
  const [editando, setEditando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [resultado, setResultado] = useState<{ ok: boolean; msg: string } | null>(null)

  const [form, setForm] = useState({
    nombre_completo: perfil.nombre_completo ?? '',
    email: perfil.email ?? '',
    whatsapp: perfil.whatsapp ?? '',
    telefono: perfil.telefono ?? '',
    ciudad: perfil.ciudad ?? '',
    direccion: perfil.direccion ?? '',
    barrio: perfil.barrio ?? '',
    referencia: perfil.referencia ?? '',
  })

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setResultado(null)
    try {
      const res = await fetch(`/api/admin/clientes/${perfil.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre_completo: form.nombre_completo || undefined,
          email: form.email || undefined,
          whatsapp: form.whatsapp || null,
          telefono: form.telefono || null,
          ciudad: form.ciudad || null,
          direccion: form.direccion || null,
          barrio: form.barrio || null,
          referencia: form.referencia || null,
        }),
      })
      const data = await res.json() as { ok?: boolean; error?: string; warning?: string }
      if (res.ok && data.ok) {
        const msg = data.warning ? `✅ Guardado (aviso: ${data.warning})` : '✅ Datos del cliente actualizados'
        setResultado({ ok: true, msg })
        setEditando(false)
        router.refresh()
      } else {
        setResultado({ ok: false, msg: data.error ?? 'Error al guardar' })
      }
    } catch {
      setResultado({ ok: false, msg: 'Error de conexión' })
    } finally {
      setGuardando(false)
    }
  }

  function handleCancel() {
    setForm({
      nombre_completo: perfil.nombre_completo ?? '',
      email: perfil.email ?? '',
      whatsapp: perfil.whatsapp ?? '',
      telefono: perfil.telefono ?? '',
      ciudad: perfil.ciudad ?? '',
      direccion: perfil.direccion ?? '',
      barrio: perfil.barrio ?? '',
      referencia: perfil.referencia ?? '',
    })
    setResultado(null)
    setEditando(false)
  }

  if (!editando) {
    return (
      <>
        {resultado && (
          <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl mb-2"
            style={resultado.ok
              ? { background: 'rgba(52,211,153,0.08)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }
              : { background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
            {resultado.ok ? <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" /> : <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />}
            {resultado.msg}
          </div>
        )}
        <button
          type="button"
          onClick={() => { setResultado(null); setEditando(true) }}
          className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-colors"
          style={{ background: `${tw}0.05)`, color: `${tw}0.5)`, border: `1px solid ${tw}0.1)` }}
        >
          <Pencil className="h-3 w-3" />
          Editar datos del cliente
        </button>
      </>
    )
  }

  return (
    <form onSubmit={handleSave} className="space-y-3 pt-1">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#F5B800' }}>Editar perfil del cliente</p>
        <button type="button" onClick={handleCancel} style={{ color: `${tw}0.4)` }}>
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2.5">
        <div>
          <label className="text-[11px] uppercase tracking-wide font-medium block mb-1" style={labelStyle}>Nombre completo</label>
          <input value={form.nombre_completo} onChange={set('nombre_completo')} className={inputClass} placeholder="Nombre completo" required />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wide font-medium block mb-1" style={labelStyle}>Email</label>
          <input type="email" value={form.email} onChange={set('email')} className={inputClass} placeholder="correo@ejemplo.com" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] uppercase tracking-wide font-medium block mb-1" style={labelStyle}>WhatsApp</label>
            <input value={form.whatsapp} onChange={set('whatsapp')} className={inputClass} placeholder="+573001234567" />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wide font-medium block mb-1" style={labelStyle}>Teléfono</label>
            <input value={form.telefono} onChange={set('telefono')} className={inputClass} placeholder="+573001234567" />
          </div>
        </div>

        <div className="pt-1" style={{ borderTop: `1px solid ${tw}0.06)` }}>
          <p className="text-[11px] uppercase tracking-wide font-medium mb-2" style={{ color: `${tw}0.3)` }}>Dirección de entrega</p>
          <div className="space-y-2">
            <div>
              <label className="text-[11px] uppercase tracking-wide font-medium block mb-1" style={labelStyle}>Ciudad</label>
              <input value={form.ciudad} onChange={set('ciudad')} className={inputClass} placeholder="Medellín, Bogotá..." />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wide font-medium block mb-1" style={labelStyle}>Dirección</label>
              <input value={form.direccion} onChange={set('direccion')} className={inputClass} placeholder="Calle 10 # 43A-15" />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wide font-medium block mb-1" style={labelStyle}>Barrio</label>
              <input value={form.barrio} onChange={set('barrio')} className={inputClass} placeholder="El Poblado" />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wide font-medium block mb-1" style={labelStyle}>Referencia / punto de entrega</label>
              <input value={form.referencia} onChange={set('referencia')} className={inputClass} placeholder="Edificio azul, apto 401..." />
            </div>
          </div>
        </div>
      </div>

      {resultado && !resultado.ok && (
        <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl"
          style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          {resultado.msg}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={guardando}
          className="btn-gold flex-1 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60"
        >
          {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="px-4 py-2 rounded-xl text-sm font-medium"
          style={{ color: `${tw}0.5)`, border: `1px solid ${tw}0.1)` }}
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
