'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Package, AlertCircle, KeyRound } from 'lucide-react'

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const emailInicial = searchParams.get('email') ?? ''
  const [form, setForm] = useState({
    nombre_completo: '',
    email: emailInicial,
    telefono: '',
    whatsapp: '',
    ciudad: '',
    password: '',
    confirm: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [cuentaExiste, setCuentaExiste] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    // Si el usuario cambia el email, limpiar la alerta
    if (e.target.name === 'email') setCuentaExiste(false)
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setCuentaExiste(false)

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

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        data: { nombre_completo: form.nombre_completo },
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    })

    // Detectar cuenta ya existente:
    // Supabase retorna identities vacío cuando el email ya está registrado
    const yaExiste =
      signUpError?.message?.toLowerCase().includes('already') ||
      signUpError?.message?.toLowerCase().includes('registered') ||
      (data?.user && (data.user.identities?.length === 0)) ||
      (!data?.user && !signUpError)

    if (yaExiste) {
      setCuentaExiste(true)
      setLoading(false)
      return
    }

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    // Actualizar datos adicionales del perfil
    // Usamos data.user del signUp (disponible de inmediato) y también getUser() como respaldo
    const userId = data?.user?.id
    if (userId) {
      await supabase.from('perfiles').update({
        nombre_completo: form.nombre_completo,
        telefono: form.telefono,
        whatsapp: form.whatsapp || form.telefono,
        ciudad: form.ciudad,
      }).eq('id', userId)
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

              {/* Alerta: cuenta ya existe */}
              {cuentaExiste && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-amber-800">
                        ¡Esta cuenta ya existe en nuestro sistema!
                      </p>
                      <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                        El correo <span className="font-medium">{form.email}</span> ya está
                        registrado. Si no recuerdas tu contraseña, puedes recuperarla fácilmente.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Link
                      href={`/recuperar`}
                      className="w-full inline-flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-colors"
                    >
                      <KeyRound className="h-4 w-4" />
                      Recuperar mi contraseña
                    </Link>
                    <Link
                      href="/login"
                      className="w-full inline-flex items-center justify-center text-sm text-amber-700 hover:text-amber-900 font-medium py-2 transition-colors"
                    >
                      Ya la recuerdo → Iniciar sesión
                    </Link>
                  </div>
                </div>
              )}

              {/* Error genérico */}
              {error && (
                <p role="alert" className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </p>
              )}

              {!cuentaExiste && (
                <Button
                  type="submit"
                  className="w-full bg-orange-600 hover:bg-orange-700"
                  disabled={loading}
                  aria-busy={loading}
                >
                  {loading ? 'Creando cuenta...' : 'Crear cuenta'}
                </Button>
              )}
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

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  )
}
