'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, X, Loader2, CheckCircle, AlertCircle, Send } from 'lucide-react'

const CIUDADES = [
  'Medellín',
  'Bogotá',
  'Barranquilla',
  'Cali',
  'Cartagena',
  'Bucaramanga',
  'Pereira',
  'Manizales',
  'Santa Marta',
  'Cúcuta',
  'Ibagué',
  'Villavicencio',
  'Montería',
  'Pasto',
  'Armenia',
  'Neiva',
  'Otra',
]

export default function NuevoClienteModal() {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<{ ok: boolean; msg: string; casilla?: string } | null>(null)

  const [form, setForm] = useState({
    nombre_completo: '',
    email: '',
    whatsapp: '',
    ciudad: '',
    numero_casilla: '',
    enviar_link: true,
  })

  function reset() {
    setForm({ nombre_completo: '', email: '', whatsapp: '', ciudad: '', numero_casilla: '', enviar_link: true })
    setResultado(null)
  }

  function cerrar() {
    setAbierto(false)
    setTimeout(reset, 300)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setResultado(null)

    try {
      const res = await fetch('/api/admin/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre_completo: form.nombre_completo,
          email: form.email,
          whatsapp: form.whatsapp || null,
          ciudad: form.ciudad || null,
          numero_casilla: form.numero_casilla || null,
          enviar_link: form.enviar_link,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setResultado({ ok: false, msg: data.error ?? 'Error al crear el cliente' })
      } else {
        setResultado({
          ok: true,
          casilla: data.numero_casilla,
          msg: data.link_enviado
            ? `✅ Cliente creado · Casilla ${data.numero_casilla} · Link de acceso enviado al correo`
            : `✅ Cliente creado · Casilla ${data.numero_casilla}`,
        })
        router.refresh()
      }
    } catch {
      setResultado({ ok: false, msg: 'Error de conexión' })
    } finally {
      setLoading(false)
    }
  }

  const inp = 'w-full px-3 py-2 text-sm bg-white/[0.06] border border-white/[0.12] rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-orange-400/60 focus:bg-white/[0.08] transition-all'
  const lbl = 'block text-xs font-medium mb-1 text-white/60'

  return (
    <>
      {/* Botón de abrir */}
      <button
        onClick={() => setAbierto(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
        style={{ background: 'rgba(245,184,0,0.15)', border: '1px solid rgba(245,184,0,0.35)', color: '#F5B800' }}
      >
        <UserPlus className="h-4 w-4" />
        Nuevo cliente
      </button>

      {/* Overlay */}
      {abierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) cerrar() }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 space-y-5 relative"
            style={{ background: 'rgba(18,18,30,0.97)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Nuevo cliente</h2>
                <p className="text-xs mt-0.5 text-white/45">El número de casilla se asigna automáticamente</p>
              </div>
              <button onClick={cerrar} className="p-1.5 rounded-lg hover:bg-white/[0.07] transition-all">
                <X className="h-4 w-4 text-white/50" />
              </button>
            </div>

            {resultado ? (
              /* Estado resultado */
              <div className="space-y-4">
                <div
                  className="flex items-start gap-3 p-4 rounded-xl text-sm"
                  style={resultado.ok
                    ? { background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', color: '#34d399' }
                    : { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}
                >
                  {resultado.ok
                    ? <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />}
                  <span>{resultado.msg}</span>
                </div>
                <div className="flex gap-2">
                  {resultado.ok && (
                    <button
                      onClick={() => { reset() }}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                      style={{ background: 'rgba(245,184,0,0.15)', border: '1px solid rgba(245,184,0,0.35)', color: '#F5B800' }}
                    >
                      + Crear otro
                    </button>
                  )}
                  <button
                    onClick={cerrar}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white/70 transition-all"
                    style={{ border: '1px solid rgba(255,255,255,0.12)' }}
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            ) : (
              /* Formulario */
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className={lbl}>Nombre completo *</label>
                    <input
                      className={inp}
                      placeholder="Ej. María García López"
                      value={form.nombre_completo}
                      onChange={e => setForm(p => ({ ...p, nombre_completo: e.target.value }))}
                      required
                    />
                  </div>

                  <div>
                    <label className={lbl}>Correo electrónico *</label>
                    <input
                      type="email"
                      className={inp}
                      placeholder="cliente@email.com"
                      value={form.email}
                      onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={lbl}>WhatsApp</label>
                      <input
                        type="tel"
                        className={inp}
                        placeholder="+57 300 000 0000"
                        value={form.whatsapp}
                        onChange={e => setForm(p => ({ ...p, whatsapp: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className={lbl}>Ciudad</label>
                      <select
                        className={inp + ' cursor-pointer'}
                        value={form.ciudad}
                        onChange={e => setForm(p => ({ ...p, ciudad: e.target.value }))}
                      >
                        <option value="">Seleccionar...</option>
                        {CIUDADES.map(c => (
                          <option key={c} value={c.toLowerCase()}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className={lbl}>
                      Número de casilla{' '}
                      <span className="text-white/30 font-normal">(dejar vacío para asignar automáticamente)</span>
                    </label>
                    <input
                      className={inp}
                      placeholder="Auto-asignado"
                      value={form.numero_casilla}
                      onChange={e => setForm(p => ({ ...p, numero_casilla: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Opción enviar link */}
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl transition-all hover:bg-white/[0.04]"
                  style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                  <input
                    type="checkbox"
                    checked={form.enviar_link}
                    onChange={e => setForm(p => ({ ...p, enviar_link: e.target.checked }))}
                    className="h-4 w-4 rounded accent-orange-500"
                  />
                  <div>
                    <p className="text-sm text-white flex items-center gap-1.5">
                      <Send className="h-3.5 w-3.5 text-orange-400" />
                      Enviar link de acceso al correo
                    </p>
                    <p className="text-[11px] text-white/35 mt-0.5">
                      El cliente recibirá un magic link para entrar al portal
                    </p>
                  </div>
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                  style={{ background: 'rgba(245,184,0,0.9)', color: '#000' }}
                >
                  {loading
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Creando cliente...</>
                    : <><UserPlus className="h-4 w-4" /> Crear cliente</>}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
