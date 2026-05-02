'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Users, Pencil, X, Save, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export interface ClienteRow {
  id: string
  nombre_completo: string
  numero_casilla: string
  email: string
  whatsapp: string | null
  telefono: string | null
  ciudad: string | null
  activo: boolean
  created_at: string
}

interface Props {
  clientes: ClienteRow[]
  paquetesMap: Record<string, { total: number; activos: number }>
}

export default function ClientesTabla({ clientes, paquetesMap }: Props) {
  const [editando, setEditando] = useState<ClienteRow | null>(null)

  if (clientes.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="text-center py-12 text-gray-400">
          <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
          No hay clientes con esos filtros
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Contacto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Ciudad</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Paquetes</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Desde</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {clientes.map(c => {
                const stats = paquetesMap[c.id] ?? { total: 0, activos: 0 }
                return (
                  <tr key={c.id} className={`hover:bg-orange-50/40 transition-colors ${!c.activo ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{c.nombre_completo}</p>
                        <p className="text-xs text-orange-600 font-mono">{c.numero_casilla}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="space-y-0.5">
                        <p className="text-gray-600 text-xs truncate max-w-[180px]">{c.email}</p>
                        {(c.whatsapp ?? c.telefono) && (
                          <a
                            href={`https://wa.me/${(c.whatsapp ?? c.telefono)?.replace(/\D/g, '')}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-green-600 text-xs hover:underline"
                          >
                            {c.whatsapp ?? c.telefono}
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-gray-500 capitalize">{c.ciudad ?? '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <Link
                        href={`/admin/paquetes?q=${encodeURIComponent(c.nombre_completo)}`}
                        className="inline-flex items-center gap-1 hover:underline"
                      >
                        <span className="font-bold text-gray-900">{stats.activos}</span>
                        <span className="text-gray-400 text-xs">/ {stats.total}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-gray-400 text-xs">
                      {new Date(c.created_at).toLocaleDateString('es-CO')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="outline" className={c.activo ? 'border-green-200 text-green-700' : 'border-red-200 text-red-600'}>
                        {c.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setEditando(c)}
                        className="inline-flex items-center gap-1 text-xs text-orange-600 hover:bg-orange-50 px-2 py-1 rounded transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </button>
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
    </>
  )
}

// ─── Modal de edición ────────────────────────────────────────────────────────
function EditarClienteModal({ cliente, onClose }: { cliente: ClienteRow; onClose: () => void }) {
  const [form, setForm] = useState({
    nombre_completo: cliente.nombre_completo,
    telefono: cliente.telefono ?? '',
    whatsapp: cliente.whatsapp ?? '',
    ciudad: cliente.ciudad ?? '',
    numero_casilla: cliente.numero_casilla,
    activo: cliente.activo,
  })
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value, type, checked } = e.target
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => !guardando && onClose()}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <form onSubmit={guardar}>
          <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white">
            <div>
              <h3 className="font-bold text-gray-900">Editar cliente</h3>
              <p className="text-xs text-gray-500 mt-0.5 truncate">{cliente.email}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={guardando}
              className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {/* Nombre */}
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Nombre completo *</label>
              <input
                type="text"
                name="nombre_completo"
                value={form.nombre_completo}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {/* Casilla */}
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Número de casilla *</label>
              <input
                type="text"
                name="numero_casilla"
                value={form.numero_casilla}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Cambiar la casilla puede afectar paquetes ya asignados a este cliente
              </p>
            </div>

            {/* Teléfono */}
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Teléfono</label>
              <input
                type="tel"
                name="telefono"
                value={form.telefono}
                onChange={handleChange}
                placeholder="3001234567"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {/* WhatsApp */}
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">
                WhatsApp <span className="text-gray-400 font-normal">(donde llegan las notificaciones)</span>
              </label>
              <input
                type="tel"
                name="whatsapp"
                value={form.whatsapp}
                onChange={handleChange}
                placeholder="3001234567"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <p className="text-[11px] text-gray-400 mt-1">Sin prefijo se asume +57 (Colombia)</p>
            </div>

            {/* Ciudad */}
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Ciudad</label>
              <input
                type="text"
                name="ciudad"
                value={form.ciudad}
                onChange={handleChange}
                placeholder="Medellín"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {/* Activo */}
            <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200">
              <div>
                <p className="text-sm font-medium text-gray-900">Cliente activo</p>
                <p className="text-[11px] text-gray-500">Inactivos no pueden iniciar sesión</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="activo"
                  checked={form.activo}
                  onChange={handleChange}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
              </label>
            </div>

            {/* Email (read-only) */}
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Correo electrónico (no editable)</label>
              <input
                type="email"
                value={cliente.email}
                disabled
                className="w-full px-3 py-2 text-sm bg-gray-50 text-gray-500 border border-gray-200 rounded-lg"
              />
            </div>

            {mensaje && (
              <div
                className={`flex items-start gap-2 text-sm p-3 rounded-md border ${
                  mensaje.tipo === 'ok'
                    ? 'bg-green-50 border-green-200 text-green-700'
                    : 'bg-red-50 border-red-200 text-red-600'
                }`}
                role="alert"
              >
                {mensaje.tipo === 'ok'
                  ? <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />}
                <span>{mensaje.texto}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2 p-5 border-t border-gray-100 sticky bottom-0 bg-white">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={guardando}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-orange-600 hover:bg-orange-700 text-white gap-2"
              disabled={guardando}
            >
              {guardando
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</>
                : <><Save className="h-4 w-4" /> Guardar cambios</>}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
