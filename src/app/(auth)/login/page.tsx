'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Package, MailCheck, Send } from 'lucide-react'

function LoginForm() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/api/auth/callback?next=/auth/confirmar`,
      },
    })

    if (error) {
      setError('Ocurrió un error al enviar el link. Intenta de nuevo.')
      setLoading(false)
      return
    }

    setEnviado(true)
    setLoading(false)
  }

  if (enviado) {
    return (
      <div className="text-center py-4 space-y-3">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100">
          <MailCheck className="h-7 w-7 text-green-600" />
        </div>
        <div>
          <p className="font-semibold text-gray-900">¡Revisa tu correo!</p>
          <p className="text-sm text-gray-500 mt-1">
            Enviamos un link de acceso a <strong>{email}</strong>.<br />
            Haz clic en el link para entrar al portal.
          </p>
        </div>
        <p className="text-xs text-gray-400">
          ¿No lo ves? Revisa spam o{' '}
          <button onClick={() => setEnviado(false)} className="text-orange-600 hover:underline">
            intenta de nuevo
          </button>
        </p>
      </div>
    )
  }

  const authError = searchParams.get('error')

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {authError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          El link expiró o no es válido. Solicita uno nuevo.
        </div>
      )}
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
        />
      </div>
      {error && <p role="alert" aria-live="polite" className="text-sm text-red-600">{error}</p>}
      <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700" disabled={loading}>
        <Send className="h-4 w-4 mr-2" />
        {loading ? 'Enviando...' : 'Enviar link de acceso'}
      </Button>
      <p className="text-xs text-center text-gray-400">
        Te enviamos un link al correo. Sin contraseña.
      </p>
    </form>
  )
}

export default function LoginPage() {
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
            <CardTitle>Iniciar sesión</CardTitle>
            <CardDescription>Ingresa tu correo para recibir tu link de acceso</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={null}>
              <LoginForm />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
