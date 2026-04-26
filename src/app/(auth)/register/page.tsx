'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Package } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    nombre_completo: '',
    email: '',
    telefono: '',
    whatsapp: '',
    ciudad: '',
    password: '',
    confirm: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirm) {
      setError('Las contraseñas no coinciden')
      return
    }

    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          nombre_completo: form.nombre_completo,
        },
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Actualizar datos adicionales del perfil
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('perfiles').update({
        telefono: form.telefono,
        whatsapp: form.whatsapp || form.telefono,
        ciudad: form.ciudad,
      }).eq('id', user.id)
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-orange-50 to-white">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 text-orange-600">
            <Package className="h-8 w-8" />
            <span className="text-2xl font-bold">CeladaShopper</span>
          </div>
          <p className="text-sm text-gray-500">Crea tu cuenta de casillero</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Crear cuenta</CardTitle>
            <CardDescription>Completa tus datos para empezar a importar</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nombre_completo">Nombre completo *</Label>
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
                <Label htmlFor="email">Correo electrónico *</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="telefono">Teléfono</Label>
                  <Input
                    id="telefono"
                    name="telefono"
                    placeholder="3001234567"
                    value={form.telefono}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp">WhatsApp</Label>
                  <Input
                    id="whatsapp"
                    name="whatsapp"
                    placeholder="3001234567"
                    value={form.whatsapp}
                    onChange={handleChange}
                  />
                </div>
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
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña *</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={form.password}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirmar contraseña *</Label>
                <Input
                  id="confirm"
                  name="confirm"
                  type="password"
                  placeholder="Repite la contraseña"
                  value={form.confirm}
                  onChange={handleChange}
                  required
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700" disabled={loading}>
                {loading ? 'Creando cuenta...' : 'Crear cuenta'}
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-gray-600">
              ¿Ya tienes cuenta?{' '}
              <Link href="/login" className="text-orange-600 font-medium hover:underline">
                Inicia sesión
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
