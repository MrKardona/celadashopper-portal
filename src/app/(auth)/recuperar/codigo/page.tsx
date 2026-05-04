'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Package, ArrowLeft, KeyRound, AlertCircle, Loader2 } from 'lucide-react'

function CodigoForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [loading, setLoading] = useState(false)
  const [reenviando, setReenviando] = useState(false)
  const [error, setError] = useState('')
  const [reenvio, setReenvio] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  // Pre-rellenar email desde el query param si viene
  useEffect(() => {
    const e = searchParams.get('email')
    if (e) setEmail(e)
  }, [searchParams])

  async function handleVerificar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const codigoLimpio = codigo.replace(/\s/g, '')
    if (codigoLimpio.length < 6) {
      setError('El código debe tener al menos 6 dígitos')
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { error: err } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: codigoLimpio,
      type: 'recovery',
    })

    setLoading(false)

    if (err) {
      console.error('[verificar codigo]', err.message)
      const msg = err.message.toLowerCase()
      if (msg.includes('expired') || msg.includes('invalid') || msg.includes('not found')) {
        setError('El código no es válido o ya expiró. Solicita uno nuevo.')
      } else {
        setError('No se pudo verificar el código. Intenta de nuevo.')
      }
      return
    }

    // Sesión creada → ir a cambiar contraseña
    router.push('/nueva-contrasena')
  }

  async function handleReenviar() {
    if (!email.trim()) {
      setReenvio({ tipo: 'error', texto: 'Escribe tu correo electrónico para reenviar el código.' })
      return
    }
    setReenviando(true)
    setReenvio(null)

    const supabase = createClient()
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/nueva-contrasena`,
    })
    setReenviando(false)

    if (err) {
      const msg = err.message.toLowerCase()
      if (msg.includes('rate limit') || msg.includes('only request this after') || msg.includes('seconds')) {
        const segundos = err.message.match(/(\d+)\s*seconds?/i)?.[1] ?? '60'
        setReenvio({ tipo: 'error', texto: `Espera ${segundos} segundos antes de pedir otro código.` })
        return
      }
    }
    setReenvio({ tipo: 'ok', texto: 'Código reenviado. Revisa tu correo (también la carpeta de spam).' })
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
                <KeyRound className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <CardTitle>Ingresa el código</CardTitle>
                <CardDescription>Te enviamos un código de 6 dígitos a tu correo</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerificar} className="space-y-4">
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

              <div className="space-y-2">
                <Label htmlFor="codigo">Código de 6 dígitos</Label>
                <Input
                  id="codigo"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={10}
                  placeholder="123456"
                  autoComplete="one-time-code"
                  value={codigo}
                  onChange={e => setCodigo(e.target.value.replace(/[^\d\s]/g, ''))}
                  required
                  autoFocus
                  className="text-center text-2xl font-mono tracking-[0.5em]"
                />
                <p className="text-xs text-gray-400">Encuentra el código en el correo que te enviamos</p>
              </div>

              {error && (
                <div role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-md flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-orange-600 hover:bg-orange-700 h-11"
                disabled={loading || !email.trim() || codigo.replace(/\s/g, '').length < 6}
              >
                {loading
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Verificando...</>
                  : 'Verificar código'}
              </Button>
            </form>

            <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
              <button
                type="button"
                onClick={handleReenviar}
                disabled={reenviando}
                className="text-sm text-orange-600 hover:text-orange-700 font-medium disabled:opacity-50"
              >
                {reenviando ? 'Reenviando...' : '¿No recibiste el código? Reenviar'}
              </button>

              {reenvio && (
                <p className={`text-xs ${reenvio.tipo === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
                  {reenvio.texto}
                </p>
              )}

              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Volver al inicio de sesión
              </Link>
            </div>

            <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800 space-y-1">
              <p className="font-semibold">💡 Tips</p>
              <ul className="list-disc list-inside space-y-0.5 text-blue-700">
                <li>El código es válido por 1 hora</li>
                <li>Revisa tu carpeta de spam o correo no deseado</li>
                <li>Asegúrate de copiar solo los números, sin espacios</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function CodigoPage() {
  return (
    <Suspense fallback={null}>
      <CodigoForm />
    </Suspense>
  )
}
