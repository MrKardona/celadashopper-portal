'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Users, Pencil, X, Save, Loader2, AlertCircle, CheckCircle, MapPin, Trash2 } from 'lucide-react'

const tw = 'rgba(255,255,255,'

export interface ClienteRow {
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
  activo: boolean
  created_at: string
}

interface Props {
  clientes: ClienteRow[]
  paquetesMap: Record<string, { total: number; activos: number }>
}

const inputClass = 'glass-input w-full px-3 py-2.5 rounded-xl text-sm'
const labelClass = 'text-xs font-medium block mb-1'
const labelStyle = { color: `${tw}0.6)` }

export default function ClientesTabla({ clientes, paquetesMap }: Props) {
  const [editando, setEditando] = useState<ClienteRow | null>(null)
  const [eliminando, setEliminando] = useState<{ cliente: ClienteRow; paquetesActivos: number } | null>(null)

  if (clientes.length === 0) {
    return (
      <div className="glass-card p-12 text-center">
        <Users className="h-10 w-10 mx-auto mb-2 opacity-20 text-white" />
        <p style={{ color: `${tw}0.4)` }}>No hay clientes con esos filtros</p>
      </div>
    )
  }

  return (
    <>
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: `${tw}0.03)`, borderBottom: `1px solid ${tw}0.07)` }}>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: `${tw}0.35)` }}>Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide hidden md:table-cell" style={{ color: `${tw}0.35)` }}>Contacto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide hidden lg:table-cell" style={{ color: `${tw}0.35)` }}>Ciudad</th>
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: `${tw}0.35)` }}>Paquetes</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide hidden lg:table-cell" style={{ color: `${tw}0.35)` }}>Desde</th>
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: `${tw}0.35)` }}>Estado</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: `${tw}0.35)` }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c, i) => {
                const stats = paquetesMap[c.id] ?? { total: 0, activos: 0 }
                return (
                  <tr
                    key={c.id}
                    style={{
                      borderTop: i > 0 ? `1px solid ${tw}0.05)` : undefined,
                      opacity: c.activo ? 1 : 0.55,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = `${tw}0.03)`)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{c.nombre_completo}</p>
                      <p className="text-xs font-mono" style={{ color: '#F5B800' }}>{c.numero_casilla}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="space-y-0.5">
                        <p className="text-xs truncate max-w-[180px]" style={{ color: `${tw}0.5)` }}>{c.email}</p>
                        {(c.whatsapp ?? c.telefono) && (
                          <a
                            href={`https://wa.me/${(c.whatsapp ?? c.telefono)?.replace(/\D/g, '')}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-xs hover:underline"
                            style={{ color: '#34d399' }}
                          >
                            {c.whatsapp ?? c.telefono}
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs capitalize" style={{ color: `${tw}0.45)` }}>{c.ciudad ?? '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <Link
                        href={`/admin/paquetes?q=${encodeURIComponent(c.nombre_completo)}`}
                        className="inline-flex items-center gap-1 hover:underline"
                      >
                        <span className="font-bold text-white">{stats.activos}</span>
                        <span className="text-xs" style={{ color: `${tw}0.35)` }}>/ {stats.total}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs" style={{ color: `${tw}0.35)` }}>
                      {new Date(c.created_at).toLocaleDateString('es-CO')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                        style={c.activo
                          ? { background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }
                          : { background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
                      >
                        {c.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditando(c)}
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors"
                          style={{ color: '#F5B800' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(245,184,0,0.1)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setEliminando({ cliente: c, paquetesActivos: stats.activos })}
                          aria-label="Eliminar cliente"
                          className="inline-flex items-center text-xs p-1.5 rounded-lg transition-colors"
                          style={{ color: `${tw}0.3)` }}
                          onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)' }}
                          onMouseLeave={e => { e.currentTarget.style.color = `${tw}0.3)`; e.currentTarget.style.background = 'transparent' }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editando && (
        <EditarClienteModal
          cliente={editando}
          onClose={() => setEditando(null)}
        />
      )}
      {eliminando && (
        <EliminarClienteModal
          cliente={eliminando.cliente}
          paquetesActivos={eliminando.paquetesActivos}
          onClose={() => setEliminando(null)}
        />
      )}
    </>
  )
}

// ─── Modal de eliminación ───────────────────────────────────────────────────
function EliminarClienteModal({
  cliente,
  paquetesActivos,
  onClose,
}: {
  cliente: ClienteRow
  paquetesActivos: number
  onClose: () => void
}) {
  const [confirmTexto, setConfirmTexto] = useState('')
  const [eliminando, setEliminando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [requiereForce, setRequiereForce] = useState(paquetesActivos > 0)

  const tieneActivos = paquetesActivos > 0
  const textoEsperado = 'ELIMINAR'
  const puedeConfirmar = confirmTexto === textoEsperado

  async function eliminar() {
    if (!puedeConfirmar) return
    setEliminando(true)
    setMensaje(null)

    const url = requiereForce
      ? `/api/admin/clientes/${cliente.id}?force=1`
      : `/api/admin/clientes/${cliente.id}`

    const res = await fetch(url, { method: 'DELETE' })
    const data = await res.json() as {
      ok?: boolean
      error?: string
      mensaje?: string
      paquetes_activos?: number
      paquetes_desasignados?: number
    }

    if (res.status === 409 && data.error === 'paquetes_activos') {
      setEliminando(false)
      setRequiereForce(true)
      setMensaje({
        tipo: 'error',
        texto: data.mensaje ?? 'El cliente tiene paquetes activos. Confirma para eliminarlo de todos modos.',
      })
      return
    }

    if (!res.ok || !data.ok) {
      setEliminando(false)
      setMensaje({ tipo: 'error', texto: data.error ?? 'No se pudo eliminar' })
      return
    }

    setMensaje({
      tipo: 'ok',
      texto: data.paquetes_desasignados
        ? `Cliente eliminado. ${data.paquetes_desasignados} paquete${data.paquetes_desasignados > 1 ? 's' : ''} liberado${data.paquetes_desasignados > 1 ? 's' : ''}.`
        : 'Cliente eliminado.',
    })
    setTimeout(() => { window.location.reload() }, 900)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={() => !eliminando && onClose()}
    >
      <div
        className="glass-card max-w-md w-full overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: `1px solid ${tw}0.07)` }}>
          <div className="h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(239,68,68,0.12)' }}>
            <Trash2 className="h-4 w-4" style={{ color: '#f87171' }} />
          </div>
          <div>
            <h3 className="font-bold text-white">Eliminar cliente</h3>
            <p className="text-xs mt-0.5" style={{ color: `${tw}0.4)` }}>Esta acción no se puede deshacer</p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm" style={{ color: `${tw}0.7)` }}>
            Vas a eliminar la cuenta de{' '}
            <strong className="text-white">{cliente.nombre_completo}</strong>{' '}
            (<span className="break-all" style={{ color: `${tw}0.5)` }}>{cliente.email}</span>).
          </p>

          {tieneActivos && (
            <div className="rounded-xl p-3 space-y-1" style={{ background: 'rgba(245,184,0,0.08)', border: '1px solid rgba(245,184,0,0.2)' }}>
              <p className="text-sm font-semibold flex items-center gap-1" style={{ color: '#F5B800' }}>
                <AlertCircle className="h-4 w-4" />
                Tiene {paquetesActivos} paquete{paquetesActivos > 1 ? 's' : ''} en proceso
              </p>
              <p className="text-xs leading-relaxed" style={{ color: `${tw}0.6)` }}>
                Los paquetes no se borrarán — quedarán como &quot;sin asignar&quot; en el sistema y un admin podrá reasignarlos manualmente. Lo que se borra es la cuenta y el acceso al portal.
              </p>
            </div>
          )}

          <div className="rounded-xl p-3 text-xs leading-relaxed" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', color: `${tw}0.65)` }}>
            La cuenta de auth y el perfil del cliente se borrarán definitivamente. El cliente ya no podrá iniciar sesión ni recuperar su contraseña.
          </div>

          <div>
            <label className={`${labelClass}`} style={labelStyle}>
              Para confirmar, escribe <strong className="font-mono" style={{ color: '#f87171' }}>ELIMINAR</strong> abajo:
            </label>
            <input
              type="text"
              value={confirmTexto}
              onChange={e => setConfirmTexto(e.target.value.toUpperCase())}
              placeholder="ELIMINAR"
              autoComplete="off"
              className={`${inputClass} font-mono`}
            />
          </div>

          {mensaje && (
            <div
              className="flex items-start gap-2 text-sm p-3 rounded-xl"
              style={mensaje.tipo === 'ok'
                ? { background: 'rgba(52,211,153,0.08)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }
                : { background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
              role="alert"
            >
              {mensaje.tipo === 'ok'
                ? <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />}
              <span>{mensaje.texto}</span>
            </div>
          )}
        </div>

        <div className="flex gap-2 p-5" style={{ borderTop: `1px solid ${tw}0.07)` }}>
          <button
            type="button"
            onClick={onClose}
            disabled={eliminando}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            style={{ border: `1px solid ${tw}0.12)`, color: `${tw}0.7)` }}
            onMouseEnter={e => (e.currentTarget.style.background = `${tw}0.05)`)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={eliminar}
            disabled={eliminando || !puedeConfirmar}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-40"
            style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}
          >
            {eliminando
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Eliminando...</>
              : <><Trash2 className="h-4 w-4" /> Eliminar</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal de edición ────────────────────────────────────────────────────────
function EditarClienteModal({ cliente, onClose }: { cliente: ClienteRow; onClose: () => void }) {
  const [form, setForm] = useState({
    nombre_completo: cliente.nombre_completo,
    email: cliente.email,
    telefono: cliente.telefono ?? '',
    whatsapp: cliente.whatsapp ?? '',
    ciudad: cliente.ciudad ?? '',
    direccion: cliente.direccion ?? '',
    barrio: cliente.barrio ?? '',
    referencia: cliente.referencia ?? '',
    numero_casilla: cliente.numero_casilla,
    activo: cliente.activo,
  })
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const target = e.target as HTMLInputElement
    const { name, value, type, checked } = target
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
    setMensaje(null)
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setMensaje(null)

    const res = await fetch(`/api/admin/clientes/${cliente.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json() as { ok?: boolean; error?: string }

    if (!res.ok || !data.ok) {
      setGuardando(false)
      setMensaje({ tipo: 'error', texto: data.error ?? 'No se pudo guardar' })
      return
    }

    setMensaje({ tipo: 'ok', texto: 'Cliente actualizado. Refrescando...' })
    setTimeout(() => { window.location.reload() }, 700)
  }

  const modalBg = {
    background: 'rgba(10,10,25,0.85)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '1rem',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={() => !guardando && onClose()}
    >
      <div
        className="max-w-lg w-full max-h-[90vh] overflow-y-auto"
        style={modalBg}
        onClick={e => e.stopPropagation()}
      >
        <form onSubmit={guardar}>
          <div
            className="flex items-center justify-between px-5 py-4 sticky top-0"
            style={{ background: 'rgba(10,10,25,0.9)', borderBottom: `1px solid ${tw}0.08)` }}
          >
            <div>
              <h3 className="font-bold text-white">Editar cliente</h3>
              <p className="text-xs mt-0.5 truncate" style={{ color: `${tw}0.4)` }}>{cliente.email}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={guardando}
              className="disabled:opacity-50 transition-colors p-1 rounded-lg"
              style={{ color: `${tw}0.4)` }}
              onMouseEnter={e => (e.currentTarget.style.color = 'white')}
              onMouseLeave={e => (e.currentTarget.style.color = `${tw}0.4)`)}
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {/* Nombre */}
            <div>
              <label className={labelClass} style={labelStyle}>Nombre completo *</label>
              <input type="text" name="nombre_completo" value={form.nombre_completo} onChange={handleChange} required className={inputClass} />
            </div>

            {/* Casillero */}
            <div>
              <label className={labelClass} style={labelStyle}>Número de casillero *</label>
              <input type="text" name="numero_casilla" value={form.numero_casilla} onChange={handleChange} required className={`${inputClass} font-mono`} />
              <p className="text-[11px] mt-1" style={{ color: `${tw}0.35)` }}>
                Cambiar el casillero puede afectar paquetes ya asignados a este cliente
              </p>
            </div>

            {/* Teléfono */}
            <div>
              <label className={labelClass} style={labelStyle}>Teléfono</label>
              <input type="tel" name="telefono" value={form.telefono} onChange={handleChange} placeholder="3001234567" className={inputClass} />
            </div>

            {/* WhatsApp */}
            <div>
              <label className={labelClass} style={labelStyle}>
                WhatsApp <span style={{ color: `${tw}0.35)`, fontWeight: 400 }}>(donde llegan las notificaciones)</span>
              </label>
              <input type="tel" name="whatsapp" value={form.whatsapp} onChange={handleChange} placeholder="3001234567" className={inputClass} />
              <p className="text-[11px] mt-1" style={{ color: `${tw}0.35)` }}>Sin prefijo se asume +57 (Colombia)</p>
            </div>

            {/* Ciudad */}
            <div>
              <label className={labelClass} style={labelStyle}>Ciudad</label>
              <input type="text" name="ciudad" value={form.ciudad} onChange={handleChange} placeholder="Medellín" className={inputClass} />
            </div>

            {/* Dirección */}
            <div className="pt-3 space-y-3" style={{ borderTop: `1px solid ${tw}0.07)` }}>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" style={{ color: '#F5B800' }} />
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: `${tw}0.6)` }}>Dirección de entrega</p>
              </div>

              <div>
                <label className={labelClass} style={labelStyle}>Dirección</label>
                <textarea
                  name="direccion"
                  value={form.direccion}
                  onChange={handleChange}
                  placeholder="Calle 10 #45-20, Apto 502, Torre B"
                  rows={2}
                  className={inputClass}
                  style={{ resize: 'none' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelClass} style={labelStyle}>Barrio</label>
                  <input type="text" name="barrio" value={form.barrio} onChange={handleChange} placeholder="Poblado" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass} style={labelStyle}>Referencia</label>
                  <input type="text" name="referencia" value={form.referencia} onChange={handleChange} placeholder="Cerca al parque" className={inputClass} />
                </div>
              </div>
            </div>

            {/* Activo toggle */}
            <div
              className="flex items-center justify-between rounded-xl px-3 py-2.5"
              style={{ background: `${tw}0.04)`, border: `1px solid ${tw}0.08)` }}
            >
              <div>
                <p className="text-sm font-medium text-white">Cliente activo</p>
                <p className="text-[11px]" style={{ color: `${tw}0.4)` }}>Inactivos no pueden iniciar sesión</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" name="activo" checked={form.activo} onChange={handleChange} className="sr-only peer" />
                <div className="w-11 h-6 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all" style={{ background: form.activo ? 'rgba(52,211,153,0.8)' : 'rgba(255,255,255,0.15)' }}></div>
              </label>
            </div>

            {/* Email */}
            <div>
              <label className={labelClass} style={labelStyle}>Correo electrónico</label>
              <input type="email" name="email" value={form.email} onChange={handleChange} required className={inputClass} />
              <p className="text-[11px] mt-1 leading-relaxed" style={{ color: '#fbbf24' }}>
                ⚠️ Cambiar el correo afecta el inicio de sesión del cliente. El nuevo correo quedará confirmado automáticamente.
              </p>
            </div>

            {mensaje && (
              <div
                className="flex items-start gap-2 text-sm p-3 rounded-xl"
                style={mensaje.tipo === 'ok'
                  ? { background: 'rgba(52,211,153,0.08)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }
                  : { background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
                role="alert"
              >
                {mensaje.tipo === 'ok'
                  ? <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />}
                <span>{mensaje.texto}</span>
              </div>
            )}
          </div>

          <div
            className="flex gap-2 p-5 sticky bottom-0"
            style={{ background: 'rgba(10,10,25,0.9)', borderTop: `1px solid ${tw}0.08)` }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={guardando}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
              style={{ border: `1px solid ${tw}0.12)`, color: `${tw}0.7)` }}
              onMouseEnter={e => (e.currentTarget.style.background = `${tw}0.05)`)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="btn-gold flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {guardando
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</>
                : <><Save className="h-4 w-4" /> Guardar cambios</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
