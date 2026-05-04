'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Package, Lock, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react'

function nivelSeguridad(pwd: string): { nivel: number; label: string; color: string } {
  if (pwd.length === 0) return { nivel: 0, label: '', color: '' }
  let score = 0
  if (pwd.length >= 8) score++
  if (pwd.length >= 12) score++
  if (/[A-Z]/.test(pwd)) score++
  if (/[0-9]/.test(pwd)) score++
  if (/[^A-Za-z0-9]/.test(pwd)) score++

  if (score <= 1) return { nivel: 1, label: 'Muy débil', color: 'bg-red-500' }
  if (score === 2) return { nivel: 2, label: 'Débil', color: 'bg-orange-400' }
  if (score === 3) return { nivel: 3, label: 'Regular', color: 'bg-yellow-400' }
  if (score === 4) return { nivel: 4, label: 'Fuerte', color: 'bg-lime-500' }
  return { nivel: 5, label: 'Muy fuerte', color: 'bg-green-600' }
}

export default function NuevaContrasenaPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [mostrarPwd, setMostrarPwd] = useState(false)
  const [mostrarConfirm, setMostrarConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [listo, setListo] = useState(false)
  const [sesionValida, setSesionValida] = useState<boolean | null>(null)

  // Verificar que hay sesión activa o procesar ?code= del link de recuperación
  useEffect(() => {
    const supabase = createClient()

    async function procesar() {
      if (typeof window === 'undefined') return

      const url = new URL(window.location.href)

      // 1. Si hay error explícito en URL → enlace inválido
      const err = url.searchParams.get('error') || url.searchParams.get('error_code')
      if (err) {
        console.warn('[nueva-contrasena] error en URL:', err)
        setSesionValida(false)
        return
      }

      // 2. Si hay ?code=... → intercambiar por sesión usando code_verifier de localStorage
      const code = url.searchParams.get('code')
      if (code) {
        const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code)
        // Limpiar el code de la URL para evitar reintentos al refrescar
        url.searchParams.delete('code')
        window.history.replaceState({}, '', url.toString())

        if (exchangeErr) {
          console.error('[nueva-contrasena] exchangeCodeForSession falló:', exchangeErr.message)
          setSesionValida(false)
          return
        }
        setSesionValida(true)
        return
      }

      // 3. Sin ?code, verificar si ya hay sesión (puede haber llegado vía OTP)
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setSesionValida(true)
        return
      }

      // 4. Escuchar PASSWORD_RECOVERY como fallback (algunos flujos lo emiten)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') {
          setSesionValida(true)
        }
      })

      // 5. Timeout: si en 4s no llegó nada, marcar como inválido
      const timeout = setTimeout(async () => {
        const { data: { session: s } } = await supabase.auth.getSession()
        setSesionValida(!!s)
      }, 4000)

      return () => {
        subscription.unsubscribe()
        clearTimeout(timeout)
      }
    }

    procesar()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    if (password !== confirmar) {
      setError('Las contraseñas no coinciden')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (err) {
      console.error('[nueva-contrasena] updateUser falló:', err.message, err.code)
      const msg = err.message.toLowerCase()
      const code = (err as { code?: string }).code

      // Errores específicos con mensaje claro al usuario
      if (code === 'same_password' || msg.includes('different from the old')) {
        setError('La nueva contraseña debe ser diferente a tu contraseña actual. Elige una distinta.')
      } else if (code === 'weak_password' || msg.includes('weak')) {
        setError('La contraseña es muy débil. Usa al menos 8 caracteres con letras y números.')
      } else if (msg.includes('expired') || msg.includes('not authenticated') || msg.includes('jwt') || msg.includes('session')) {
        setError('Tu sesión expiró. Solicita un nuevo código de recuperación.')
      } else {
        // Mensaje real de Supabase si no coincide ningún caso conocido
        setError(`No se pudo actualizar la contraseña: ${err.message}`)
      }
      return
    }

    setListo(true)
    // Redirigir al dashboard después de 2 segundos
    setTimeout(() => router.push('/dashboard'), 2000)
  }

  const seguridad = nivelSeguridad(password)
  const coinciden = confirmar.length > 0 && password === confirmar

  // Sesión inválida — enlace expirado o directo
  if (sesionValida === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-orange-50 to-white">
        <div className="w-full max-w-md space-y-6">
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 text-orange-600">
              <Package className="h-8 w-8" />
              <span className="text-2xl font-bold">CeladaShopper</span>
            </div>
          </div>
          <Card className="border-red-200">
            <CardContent className="pt-8 pb-6">
              <div className="flex flex-col items-center text-center gap-4">
                <div className="h-14 w-14 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertCircle className="h-7 w-7 text-red-500" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Enlace inválido o expirado</h2>
                  <p className="text-gray-500 text-sm mt-2">
                    Este enlace de recuperación ya no es válido. Los enlaces expiran después de 1 hora.
                  </p>
                </div>
                <Button
                  className="w-full bg-orange-600 hover:bg-orange-700"
                  onClick={() => router.push('/recuperar')}
                >
                  Solicitar nuevo enlace
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Contraseña actualizada con éxito
  if (listo) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-orange-50 to-white">
        <div className="w-full max-w-md space-y-6">
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 text-orange-600">
              <Package className="h-8 w-8" />
              <span className="text-2xl font-bold">CeladaShopper</span>
            </div>
          </div>
          <Card className="border-green-200">
            <CardContent className="pt-8 pb-6">
              <div className="flex flex-col items-center text-center gap-4">
                <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="h-7 w-7 text-green-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">¡Contraseña actualizada!</h2>
                  <p className="text-gray-500 text-sm mt-2">
                    Tu contraseña fue cambiada exitosamente. Redirigiendo a tu cuenta...
                  </p>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-green-500 h-1.5 rounded-full animate-[grow_2s_linear_forwards]" style={{ width: '100%', animationFillMode: 'forwards' }} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Cargando — verificando sesión
  if (sesionValida === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-white">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <div className="h-8 w-8 rounded-full border-4 border-orange-200 border-t-orange-500 animate-spin" />
          <p className="text-sm">Verificando enlace...</p>
        </div>
      </div>
    )
  }

  // Formulario principal
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
                <Lock className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <CardTitle>Nueva contraseña</CardTitle>
                <CardDescription>Elige una contraseña segura para tu cuenta</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Nueva contraseña */}
              <div className="space-y-2">
                <Label htmlFor="password">Nueva contraseña</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={mostrarPwd ? 'text' : 'password'}
                    placeholder="Mínimo 8 caracteres"
                    autoComplete="new-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoFocus
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={mostrarPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {mostrarPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Indicador de seguridad */}
                {password.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex gap-1 h-1.5">
                      {[1, 2, 3, 4, 5].map(i => (
                        <div
                          key={i}
                          className={`flex-1 rounded-full transition-colors duration-300 ${
                            i <= seguridad.nivel ? seguridad.color : 'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                    <p className={`text-xs font-medium ${
                      seguridad.nivel <= 2 ? 'text-red-500' :
                      seguridad.nivel === 3 ? 'text-yellow-600' : 'text-green-600'
                    }`}>
                      {seguridad.label}
                    </p>
                  </div>
                )}
              </div>

              {/* Confirmar contraseña */}
              <div className="space-y-2">
                <Label htmlFor="confirmar">Confirmar contraseña</Label>
                <div className="relative">
                  <Input
                    id="confirmar"
                    type={mostrarConfirm ? 'text' : 'password'}
                    placeholder="Repite tu nueva contraseña"
                    autoComplete="new-password"
                    value={confirmar}
                    onChange={e => setConfirmar(e.target.value)}
                    required
                    className={`pr-10 ${
                      confirmar.length > 0
                        ? coinciden
                          ? 'border-green-400 focus-visible:ring-green-400/30'
                          : 'border-red-400 focus-visible:ring-red-400/30'
                        : ''
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarConfirm(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={mostrarConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {mostrarConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirmar.length > 0 && (
                  <p className={`text-xs flex items-center gap-1 ${coinciden ? 'text-green-600' : 'text-red-500'}`}>
                    {coinciden
                      ? <><CheckCircle className="h-3 w-3" /> Las contraseñas coinciden</>
                      : <><AlertCircle className="h-3 w-3" /> Las contraseñas no coinciden</>
                    }
                  </p>
                )}
              </div>

              {/* Tips de seguridad */}
              <div className="bg-gray-50 rounded-lg px-4 py-3 text-xs text-gray-500 space-y-1">
                <p className="font-medium text-gray-600">Recomendaciones:</p>
                <ul className="space-y-0.5 list-disc list-inside">
                  <li className={password.length >= 8 ? 'text-green-600' : ''}>Al menos 8 caracteres</li>
                  <li className={/[A-Z]/.test(password) ? 'text-green-600' : ''}>Una letra mayúscula</li>
                  <li className={/[0-9]/.test(password) ? 'text-green-600' : ''}>Un número</li>
                  <li className={/[^A-Za-z0-9]/.test(password) ? 'text-green-600' : ''}>Un símbolo (!, @, #...)</li>
                </ul>
              </div>

              {error && (
                <p role="alert" aria-live="polite" className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="w-full bg-orange-600 hover:bg-orange-700 h-11"
                disabled={loading || password.length < 8 || !coinciden}
                aria-busy={loading}
              >
                {loading ? 'Guardando...' : 'Guardar nueva contraseña'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
