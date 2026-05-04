'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Package, ArrowLeft, Mail, AlertCircle } from 'lucide-react'

function RecuperarForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [errorEnlace, setErrorEnlace] = useState(false)

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

    const supabase = createClient()
    // Apuntamos directamente a /nueva-contrasena. El SDK PKCE del browser
    // detecta el ?code=... en URL e intercambia automáticamente.
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/nueva-contrasena`,
    })

    setLoading(false)

    if (err) {
      console.error('[recuperar]', err.message)

      // Detectar rate limit y mostrar mensaje específico
      const msg = err.message.toLowerCase()
      if (msg.includes('rate limit') || msg.includes('only request this after') || msg.includes('seconds')) {
        const segundos = err.message.match(/(\d+)\s*seconds?/i)?.[1] ?? '60'
        setError(`Por seguridad, debes esperar ${segundos} segundos antes de solicitar otro código. Intenta de nuevo en un momento.`)
        return
      }
      // Otros errores no críticos: no revelar si el correo existe (seguridad)
    }

    // Redirigir a la página del código (en vez de mostrar mensaje "revisa tu correo")
    // El cliente ingresa el código de 6 dígitos del email allí.
    // Esto resuelve el problema de Outlook/Gmail que consumen tokens al hacer preview.
    router.push(`/recuperar/codigo?email=${encodeURIComponent(email.trim())}`)
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
                <CardDescription>Te enviaremos un código de 6 dígitos a tu correo</CardDescription>
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
                💡 Te enviaremos un <strong>código de 6 dígitos</strong> que copias e ingresas en la siguiente pantalla.
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
