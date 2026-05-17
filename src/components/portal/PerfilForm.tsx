'use client'

import { useState } from 'react'
import { CheckCircle, AlertCircle, MessageCircle, MapPin } from 'lucide-react'

interface Props {
  email: string
  nombreCompleto: string
  telefono: string
  whatsapp: string
  ciudad: string
  direccion: string
  barrio: string
  referencia: string
}

const tw = 'rgba(255,255,255,'

function GlassLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium mb-1.5" style={{ color: `${tw}0.7)` }}>
      {children}
    </label>
  )
}

export default function PerfilForm({
  email, nombreCompleto, telefono, whatsapp, ciudad,
  direccion, barrio, referencia,
}: Props) {
  const [form, setForm] = useState({
    nombre_completo: nombreCompleto,
    telefono,
    whatsapp,
    ciudad,
    direccion,
    barrio,
    referencia,
  })
  const [usarMismoNumero, setUsarMismoNumero] = useState(telefono === whatsapp && !!telefono)
  const [loading, setLoading] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    setForm(prev => {
      const nuevo = { ...prev, [name]: value }
      if (usarMismoNumero && name === 'telefono') nuevo.whatsapp = value
      return nuevo
    })
    setMensaje(null)
  }

  function toggleMismoNumero(checked: boolean) {
    setUsarMismoNumero(checked)
    if (checked) setForm(prev => ({ ...prev, whatsapp: prev.telefono }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMensaje(null)

    const res = await fetch('/api/portal/perfil', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json() as { ok?: boolean; error?: string }

    setLoading(false)
    if (!res.ok || !data.ok) {
      setMensaje({ tipo: 'error', texto: data.error ?? 'No se pudo guardar' })
      return
    }
    setMensaje({ tipo: 'ok', texto: 'Datos actualizados correctamente' })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      <div>
        <GlassLabel>Correo electrónico</GlassLabel>
        <input
          type="email"
          value={email}
          disabled
          className="glass-input w-full px-4 py-3 text-sm outline-none opacity-50 cursor-not-allowed"
        />
      </div>

      <div>
        <GlassLabel>Nombre completo</GlassLabel>
        <input
          name="nombre_completo"
          placeholder="Juan García"
          value={form.nombre_completo}
          onChange={handleChange}
          required
          className="glass-input w-full px-4 py-3 text-sm outline-none"
        />
      </div>

      <div>
        <GlassLabel>Teléfono</GlassLabel>
        <input
          name="telefono"
          type="tel"
          placeholder="3001234567"
          value={form.telefono}
          onChange={handleChange}
          className="glass-input w-full px-4 py-3 text-sm outline-none"
        />
        <p className="text-xs mt-1" style={{ color: `${tw}0.35)` }}>
          Te agregaremos +57 (Colombia) si no incluyes prefijo internacional
        </p>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <input
          id="mismoNumero"
          type="checkbox"
          checked={usarMismoNumero}
          onChange={e => toggleMismoNumero(e.target.checked)}
          className="h-4 w-4 rounded accent-yellow-400"
          style={{ accentColor: '#F5B800' }}
        />
        <label htmlFor="mismoNumero" className="cursor-pointer" style={{ color: `${tw}0.65)` }}>
          Mi WhatsApp es el mismo que mi teléfono
        </label>
      </div>

      <div>
        <GlassLabel>
          <span className="flex items-center gap-1.5">
            <MessageCircle className="h-3.5 w-3.5" style={{ color: '#25D366' }} />
            WhatsApp
          </span>
        </GlassLabel>
        <input
          name="whatsapp"
          type="tel"
          placeholder="3001234567"
          value={form.whatsapp}
          onChange={handleChange}
          disabled={usarMismoNumero}
          className={`glass-input w-full px-4 py-3 text-sm outline-none ${usarMismoNumero ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
        <p className="text-xs mt-1" style={{ color: `${tw}0.35)` }}>
          Las notificaciones de tus paquetes llegan a este número.
        </p>
      </div>

      <div>
        <GlassLabel>Ciudad</GlassLabel>
        <input
          name="ciudad"
          placeholder="Medellín"
          value={form.ciudad}
          onChange={handleChange}
          className="glass-input w-full px-4 py-3 text-sm outline-none"
        />
      </div>

      {/* Dirección */}
      <div className="pt-4 space-y-4" style={{ borderTop: `1px solid ${tw}0.07)` }}>
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4" style={{ color: '#F5B800' }} />
          <h3 className="text-sm font-semibold text-white">Dirección de entrega</h3>
        </div>
        <p className="text-xs -mt-2" style={{ color: `${tw}0.4)` }}>
          Donde quieres recibir tus paquetes en Colombia.
        </p>

        <div>
          <GlassLabel>Dirección</GlassLabel>
          <textarea
            name="direccion"
            placeholder="Calle 10 #45-20, Apartamento 502, Torre B"
            value={form.direccion}
            onChange={handleChange}
            rows={2}
            className="glass-input w-full px-4 py-3 text-sm outline-none resize-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <GlassLabel>
              Barrio <span style={{ color: `${tw}0.3)`, fontWeight: 400 }}>(opcional)</span>
            </GlassLabel>
            <input
              name="barrio"
              placeholder="Poblado, Laureles..."
              value={form.barrio}
              onChange={handleChange}
              className="glass-input w-full px-4 py-3 text-sm outline-none"
            />
          </div>
          <div>
            <GlassLabel>
              Punto de referencia <span style={{ color: `${tw}0.3)`, fontWeight: 400 }}>(opcional)</span>
            </GlassLabel>
            <input
              name="referencia"
              placeholder="Cerca al parque, edificio azul..."
              value={form.referencia}
              onChange={handleChange}
              className="glass-input w-full px-4 py-3 text-sm outline-none"
            />
          </div>
        </div>
      </div>

      {mensaje && (
        <div
          role="alert"
          className="flex items-center gap-2 text-sm px-3 py-2.5 rounded-xl"
          style={mensaje.tipo === 'ok'
            ? { background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', color: '#34d399' }
            : { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }
          }
        >
          {mensaje.tipo === 'ok'
            ? <CheckCircle className="h-4 w-4 shrink-0" />
            : <AlertCircle className="h-4 w-4 shrink-0" />}
          {mensaje.texto}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="btn-gold w-full flex items-center justify-center gap-2 px-4 py-3 text-sm rounded-xl font-bold"
        aria-busy={loading}
      >
        {loading ? (
          <>
            <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            Guardando...
          </>
        ) : 'Guardar cambios'}
      </button>

    </form>
  )
}
