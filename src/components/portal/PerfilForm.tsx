'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle, AlertCircle, MessageCircle } from 'lucide-react'

interface Props {
  email: string
  nombreCompleto: string
  telefono: string
  whatsapp: string
  ciudad: string
}

export default function PerfilForm({ email, nombreCompleto, telefono, whatsapp, ciudad }: Props) {
  const [form, setForm] = useState({
    nombre_completo: nombreCompleto,
    telefono,
    whatsapp,
    ciudad,
  })
  const [usarMismoNumero, setUsarMismoNumero] = useState(telefono === whatsapp && !!telefono)
  const [loading, setLoading] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
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
    if (checked) {
      setForm(prev => ({ ...prev, whatsapp: prev.telefono }))
    }
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
      <div className="space-y-2">
        <Label htmlFor="email">Correo electrónico</Label>
        <Input id="email" type="email" value={email} disabled className="bg-gray-50 text-gray-500" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="nombre_completo">Nombre completo</Label>
        <Input
          id="nombre_completo"
          name="nombre_completo"
          placeholder="Juan García"
          value={form.nombre_completo}
          onChange={handleChange}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="telefono">Teléfono</Label>
        <Input
          id="telefono"
          name="telefono"
          type="tel"
          placeholder="3001234567"
          value={form.telefono}
          onChange={handleChange}
        />
        <p className="text-xs text-gray-400">Te agregaremos +57 (Colombia) si no incluyes prefijo internacional</p>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <input
          id="mismoNumero"
          type="checkbox"
          checked={usarMismoNumero}
          onChange={e => toggleMismoNumero(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
        />
        <label htmlFor="mismoNumero" className="text-gray-700 cursor-pointer">
          Mi WhatsApp es el mismo que mi teléfono
        </label>
      </div>

      <div className="space-y-2">
        <Label htmlFor="whatsapp" className="flex items-center gap-1.5">
          <MessageCircle className="h-3.5 w-3.5 text-green-600" />
          WhatsApp
        </Label>
        <Input
          id="whatsapp"
          name="whatsapp"
          type="tel"
          placeholder="3001234567"
          value={form.whatsapp}
          onChange={handleChange}
          disabled={usarMismoNumero}
          className={usarMismoNumero ? 'bg-gray-50' : ''}
        />
        <p className="text-xs text-gray-400">
          Las notificaciones de tus paquetes llegan a este número.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ciudad">Ciudad</Label>
        <Input
          id="ciudad"
          name="ciudad"
          placeholder="Medellín"
          value={form.ciudad}
          onChange={handleChange}
        />
      </div>

      {mensaje && (
        <div
          className={`flex items-center gap-2 text-sm px-3 py-2 rounded-md ${
            mensaje.tipo === 'ok'
              ? 'text-green-700 bg-green-50 border border-green-200'
              : 'text-red-600 bg-red-50 border border-red-200'
          }`}
          role="alert"
        >
          {mensaje.tipo === 'ok'
            ? <CheckCircle className="h-4 w-4 flex-shrink-0" />
            : <AlertCircle className="h-4 w-4 flex-shrink-0" />}
          {mensaje.texto}
        </div>
      )}

      <Button
        type="submit"
        className="w-full bg-orange-600 hover:bg-orange-700"
        disabled={loading}
        aria-busy={loading}
      >
        {loading ? 'Guardando...' : 'Guardar cambios'}
      </Button>
    </form>
  )
}
