'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Package, AlertCircle, KeyRound, MailCheck, CheckCircle2 } from 'lucide-react'

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
    direccion: '',
    barrio: '',
    referencia: '',
    password: '',
    confirm: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [cuentaExiste, setCuentaExiste] = useState(false)
  const [registroExitoso, setRegistroExitoso] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
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
        // Pasamos TODOS los datos en metadata para que el trigger
        // handle_new_user los persista en perfiles. No podemos hacer
        // UPDATE después del signUp porque cuando email confirmation
        // está activo no hay sesión inmediata y RLS bloquea la escritura.
        data: {
          nombre_completo: form.nombre_completo,
          telefono: form.telefono.trim(),
          whatsapp: (form.whatsapp || form.telefono).trim(),
          ciudad: form.ciudad.trim(),
          direccion: form.direccion.trim(),
          barrio: form.barrio.trim(),
          referencia: form.referencia.trim(),
        },
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

    // El trigger handle_new_user ya guardó todos los datos del perfil al
    // leer raw_user_meta_data. No necesitamos UPDATE adicional aquí.
    // (Antes intentábamos un UPDATE pero fallaba silenciosamente por RLS
    // cuando email confirmation está activo y no hay sesión inmediata.)

    // Cerrar la sesión que creó el signUp (Supabase auto-loguea, pero queremos
    // que el usuario verifique su email antes de entrar al portal).
    await supabase.auth.signOut()

    setRegistroExitoso(true)
    setLoading(false)

    // Redirigir al login después de 6 segundos para que lea el mensaje
    setTimeout(() => {
      router.push('/login?registrado=1')
    }, 6000)
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

        {registroExitoso ? (
          <Card>
            <CardContent className="pt-6 pb-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="h-9 w-9 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">¡Cuenta creada exitosamente!</h3>
                  <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                    Te enviamos un correo de verificación a{' '}
                    <strong className="text-gray-900 break-all">{form.email}</strong>.
                  </p>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-left w-full">
                  <div className="flex items-start gap-2">
                    <MailCheck className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold text-orange-900">Verifica tu correo</p>
                      <p className="text-xs text-orange-800 mt-1 leading-relaxed">
                        Abre el correo de CeladaShopper y haz click en el botón de
                        confirmación. Después podrás iniciar sesión.
                      </p>
                      <p className="text-[11px] text-orange-700 mt-2">
                        ¿No lo ves? Revisa tu carpeta de <strong>spam</strong> o correo no deseado.
                      </p>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-400">
                  Te llevaremos al inicio de sesión en unos segundos…
                </p>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center w-full bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold py-2.5 rounded-md transition-colors"
                >
                  Ir al inicio de sesión ahora
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
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

              {/* Dirección de entrega */}
              <div className="pt-3 border-t border-gray-100 space-y-3">
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  Dirección de entrega
                </p>
                <p className="text-[11px] text-gray-500 -mt-2">
                  Donde quieres recibir tus paquetes en Colombia. Puedes editarlo después.
                </p>

                <div className="space-y-2">
                  <Label htmlFor="direccion">Dirección</Label>
                  <textarea
                    id="direccion"
                    name="direccion"
                    placeholder="Calle 10 #45-20, Apto 502, Torre B"
                    rows={2}
                    value={form.direccion}
                    onChange={handleChange}
                    className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-1 resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="barrio">Barrio</Label>
                    <Input
                      id="barrio"
                      name="barrio"
                      placeholder="Poblado"
                      value={form.barrio}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="referencia">Referencia</Label>
                    <Input
                      id="referencia"
                      name="referencia"
                      placeholder="Cerca al parque"
                      value={form.referencia}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-3 border-t border-gray-100">
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
        )}
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
