'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Package, ArrowLeft, Mail, AlertCircle, UserPlus } from 'lucide-react'

function RecuperarForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [errorEnlace, setErrorEnlace] = useState(false)
  const [emailNoRegistrado, setEmailNoRegistrado] = useState<string | null>(null)

  // Detectar si llega del callback con error (link expirado o inválido)
  useEffect(() => {
    if (searchParams.get('error') === 'expired') {
      setErrorEnlace(true)
    }
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setEmailNoRegistrado(null)

    const emailLimpio = email.trim().toLowerCase()

    // 1. Verificar primero si el email está registrado
    try {
      const res = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailLimpio }),
      })
      const data = await res.json() as { existe?: boolean; error?: string }

      if (res.status === 429) {
        setLoading(false)
        setError(data.error ?? 'Demasiadas consultas. Espera un momento.')
        return
      }
      if (!res.ok) {
        setLoading(false)
        setError(data.error ?? 'Error al verificar el correo')
        return
      }
      if (!data.existe) {
        setLoading(false)
        setEmailNoRegistrado(emailLimpio)
        return
      }
    } catch (err) {
      setLoading(false)
      console.error('[recuperar] check-email falló:', err)
      setError('No se pudo verificar el correo. Intenta de nuevo.')
      return
    }

    // 2. Email existe → enviar código de recuperación
    const supabase = createClient()
    const { error: err } = await supabase.auth.resetPasswordForEmail(emailLimpio, {
      redirectTo: `${window.location.origin}/nueva-contrasena`,
    })

    setLoading(false)

    if (err) {
      console.error('[recuperar]', err.message)

      const msg = err.message.toLowerCase()
      if (msg.includes('rate limit') || msg.includes('only request this after') || msg.includes('seconds')) {
        const segundos = err.message.match(/(\d+)\s*seconds?/i)?.[1] ?? '60'
        setError(`Por seguridad, debes esperar ${segundos} segundos antes de solicitar otro código. Intenta de nuevo en un momento.`)
        return
      }
    }

    router.push(`/recuperar/codigo?email=${encodeURIComponent(emailLimpio)}`)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-orange-50 to-white">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 text-orange-600">
            <Package className="h-8 w-8" />
            <span className="text-2xl font-bold">CeladaShopper</span>
          </div>
          <p className="text-sm text-gray-500">Portal de clientes</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                <Mail className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <CardTitle>Recuperar contraseña</CardTitle>
                <CardDescription>Te enviaremos un código numérico a tu correo</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Aviso si llega del callback con error de enlace expirado */}
            {errorEnlace && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 mb-4 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">El enlace ya no es válido</p>
                  <p className="text-xs mt-1">
                    Los enlaces de recuperación expiran después de 1 hora o pueden haberse usado ya.
                    Solicita un nuevo código abajo.
                  </p>
                </div>
              </div>
            )}

            {/* Info: usamos código en vez de link para evitar problemas con scanners de email */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800 mb-4">
              <p className="leading-relaxed">
                💡 Te enviaremos un <strong>código numérico</strong> que copias e ingresas en la siguiente pantalla.
                Funciona con Gmail, Outlook, iCloud y cualquier proveedor de correo.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                />
                <p className="text-xs text-gray-400">
                  Ingresa el correo con el que te registraste en CeladaShopper
                </p>
              </div>

              {emailNoRegistrado && (
                <div role="alert" aria-live="polite" className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-red-900">Correo no registrado</p>
                      <p className="text-xs text-red-700 mt-1 leading-relaxed">
                        El correo <strong className="break-all">{emailNoRegistrado}</strong> no está registrado en CeladaShopper.
                        ¿Quieres crear una cuenta nueva?
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/register?email=${encodeURIComponent(emailNoRegistrado)}`}
                    className="flex items-center justify-center gap-2 w-full bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold py-2.5 rounded-md transition-colors"
                  >
                    <UserPlus className="h-4 w-4" />
                    Crear cuenta nueva
                  </Link>
                </div>
              )}

              {error && (
                <p role="alert" aria-live="polite" className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="w-full bg-orange-600 hover:bg-orange-700"
                disabled={loading}
                aria-busy={loading}
              >
                {loading ? 'Enviando código...' : 'Enviar código de recuperación'}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Volver al inicio de sesión
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function RecuperarPage() {
  return (
    <Suspense fallback={null}>
      <RecuperarForm />
    </Suspense>
  )
}
