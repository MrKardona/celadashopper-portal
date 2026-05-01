'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Package, ArrowLeft, Mail, CheckCircle } from 'lucide-react'

export default function RecuperarPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/api/auth/callback?next=/nueva-contrasena`,
    })

    setLoading(false)

    if (err) {
      // No revelar si el correo existe o no — siempre mostrar éxito (seguridad)
      console.error('[recuperar]', err.message)
    }

    // Siempre mostrar pantalla de éxito aunque el email no exista
    setEnviado(true)
  }

  if (enviado) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-orange-50 to-white">
        <div className="w-full max-w-md space-y-6">
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 text-orange-600">
              <Package className="h-8 w-8" />
              <span className="text-2xl font-bold">CeladaShopper</span>
            </div>
          </div>

          <Card>
            <CardContent className="pt-8 pb-6">
              <div className="flex flex-col items-center text-center gap-4">
                <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="h-7 w-7 text-green-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Revisa tu correo</h2>
                  <p className="text-gray-500 text-sm mt-2 leading-relaxed">
                    Si <span className="font-medium text-gray-700">{email}</span> está registrado,
                    recibirás un enlace para restablecer tu contraseña en los próximos minutos.
                  </p>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 w-full text-left space-y-1">
                  <p className="text-xs font-semibold text-blue-700">¿No ves el correo?</p>
                  <ul className="text-xs text-blue-600 space-y-0.5 list-disc list-inside">
                    <li>Revisa tu carpeta de spam o correo no deseado</li>
                    <li>El enlace expira en 1 hora</li>
                    <li>Asegúrate de usar el correo con el que te registraste</li>
                  </ul>
                </div>
                <div className="flex flex-col gap-2 w-full pt-2">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => { setEnviado(false); setEmail('') }}
                  >
                    Intentar con otro correo
                  </Button>
                  <Link
                    href="/login"
                    className="text-center text-sm text-orange-600 hover:underline font-medium"
                  >
                    Volver al inicio de sesión
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
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
                <CardDescription>Te enviaremos un enlace a tu correo</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
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
                {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
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
