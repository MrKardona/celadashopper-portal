'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, ShieldCheck } from 'lucide-react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

const ease = [0.25, 0.46, 0.45, 0.94] as const
const tw = 'rgba(255,255,255,'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 22 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, delay, ease },
})

function nivelSeguridad(pwd: string): { nivel: number; label: string; colorBar: string; colorText: string } {
  if (pwd.length === 0) return { nivel: 0, label: '', colorBar: '', colorText: '' }
  let score = 0
  if (pwd.length >= 8) score++
  if (pwd.length >= 12) score++
  if (/[A-Z]/.test(pwd)) score++
  if (/[0-9]/.test(pwd)) score++
  if (/[^A-Za-z0-9]/.test(pwd)) score++

  if (score <= 1) return { nivel: 1, label: 'Muy débil',   colorBar: '#f87171', colorText: '#f87171' }
  if (score === 2) return { nivel: 2, label: 'Débil',       colorBar: '#fb923c', colorText: '#fb923c' }
  if (score === 3) return { nivel: 3, label: 'Regular',     colorBar: '#F5B800', colorText: '#F5B800' }
  if (score === 4) return { nivel: 4, label: 'Fuerte',      colorBar: '#4ade80', colorText: '#4ade80' }
  return               { nivel: 5, label: 'Muy fuerte',  colorBar: '#34d399', colorText: '#34d399' }
}

export default function NuevaContrasenaPage() {
  const router = useRouter()
  const [password, setPassword]       = useState('')
  const [confirmar, setConfirmar]     = useState('')
  const [showPwd, setShowPwd]         = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [listo, setListo]             = useState(false)
  const [sesionValida, setSesionValida] = useState<boolean | null>(null)

  // Verificar que hay sesión activa (el callback ya intercambió el code)
  useEffect(() => {
    const supabase = createClient()

    async function procesar() {
      if (typeof window === 'undefined') return

      const url = new URL(window.location.href)

      // Error explícito en URL → enlace inválido
      if (url.searchParams.get('error') || url.searchParams.get('error_code')) {
        setSesionValida(false)
        return
      }

      // Si hay ?code=... → intercambiar por sesión (fallback, normalmente lo hace el callback)
      const code = url.searchParams.get('code')
      if (code) {
        const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code)
        url.searchParams.delete('code')
        window.history.replaceState({}, '', url.toString())
        setSesionValida(!exchangeErr)
        return
      }

      // Sin code → verificar sesión existente
      const { data: { session } } = await supabase.auth.getSession()
      if (session) { setSesionValida(true); return }

      // Fallback: esperar evento PASSWORD_RECOVERY
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') setSesionValida(true)
      })

      const timeout = setTimeout(async () => {
        const { data: { session: s } } = await supabase.auth.getSession()
        setSesionValida(!!s)
      }, 4000)

      return () => { subscription.unsubscribe(); clearTimeout(timeout) }
    }

    procesar()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return }
    if (password !== confirmar) { setError('Las contraseñas no coinciden.'); return }

    setLoading(true)
    const supabase = createClient()
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (err) {
      const msg  = err.message.toLowerCase()
      const code = (err as { code?: string }).code
      if (code === 'same_password' || msg.includes('different from the old'))
        setError('La nueva contraseña debe ser diferente a la actual.')
      else if (code === 'weak_password' || msg.includes('weak'))
        setError('La contraseña es muy débil. Usa letras, números y símbolos.')
      else if (msg.includes('expired') || msg.includes('not authenticated') || msg.includes('session'))
        setError('La sesión expiró. Solicita un nuevo enlace de recuperación.')
      else
        setError(`No se pudo actualizar: ${err.message}`)
      return
    }

    setListo(true)
    setTimeout(() => router.push('/admin'), 1800)
  }

  const seguridad = nivelSeguridad(password)
  const coinciden = confirmar.length > 0 && password === confirmar

  // ── Pantalla de carga ──────────────────────────────────────────────────────
  if (sesionValida === null) {
    return (
      <div className="portal-bg min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3" style={{ color: `${tw}0.4)` }}>
          <div className="h-8 w-8 rounded-full border-2 border-t-white animate-spin"
            style={{ borderColor: `${tw}0.15)`, borderTopColor: 'white' }} />
          <p className="text-sm">Verificando enlace...</p>
        </div>
      </div>
    )
  }

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <div className="portal-bg min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="aurora-blob aurora-blob-1" />
      <div className="aurora-blob aurora-blob-2" />
      <div className="aurora-blob aurora-blob-3" />
      <div className="portal-orb-gold" />
      <div className="portal-orb-blue" />
      <div className="relative z-10 w-full max-w-md space-y-8">
        <motion.div
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
          className="flex justify-center"
        >
          <Image src="/celada-logo-new.png" alt="Celada Personal Shopper" width={200} height={72} priority style={{ objectFit: 'contain' }} />
        </motion.div>
        {children}
      </div>
    </div>
  )

  // ── Enlace inválido / expirado ─────────────────────────────────────────────
  if (sesionValida === false) {
    return (
      <Wrapper>
        <motion.div {...fadeUp(0.2)} className="glass-card p-8 text-center space-y-5">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mx-auto"
            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
            <AlertCircle className="h-8 w-8" style={{ color: '#f87171' }} />
          </div>
          <div>
            <p className="text-xl font-bold text-white">Enlace inválido o expirado</p>
            <p className="text-sm mt-2 leading-relaxed" style={{ color: `${tw}0.5)` }}>
              Este enlace de recuperación ya no es válido. Los enlaces expiran después de 1 hora.
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => router.push('/login')}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm rounded-xl font-bold"
            style={{ background: 'rgba(99,102,241,0.9)', color: 'white' }}
          >
            Solicitar nuevo enlace
          </motion.button>
        </motion.div>
      </Wrapper>
    )
  }

  // ── Éxito ──────────────────────────────────────────────────────────────────
  if (listo) {
    return (
      <Wrapper>
        <motion.div {...fadeUp(0.2)} className="glass-card p-8 text-center space-y-5">
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 18 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mx-auto"
            style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)' }}
          >
            <CheckCircle className="h-8 w-8" style={{ color: '#34d399' }} />
          </motion.div>
          <div>
            <p className="text-xl font-bold text-white">¡Contraseña actualizada!</p>
            <p className="text-sm mt-2" style={{ color: `${tw}0.5)` }}>
              Redirigiendo al panel de administración...
            </p>
          </div>
        </motion.div>
      </Wrapper>
    )
  }

  // ── Formulario principal ───────────────────────────────────────────────────
  return (
    <Wrapper>
      <motion.div {...fadeUp(0.2)} className="glass-card p-8 space-y-6">

        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="mt-0.5 p-2 rounded-xl flex-shrink-0"
            style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)' }}>
            <ShieldCheck className="h-5 w-5" style={{ color: '#a5b4fc' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Nueva contraseña</h1>
            <p className="text-sm mt-1" style={{ color: `${tw}0.45)` }}>
              Elige una contraseña segura para tu cuenta de administrador.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Nueva contraseña */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium" style={{ color: `${tw}0.7)` }}>
              Nueva contraseña
            </label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoFocus
                className="glass-input w-full px-4 py-3 pr-11 text-sm outline-none"
              />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5"
                style={{ color: `${tw}0.35)` }}>
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Indicador de fuerza */}
            {password.length > 0 && (
              <div className="space-y-1 pt-0.5">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="h-1 flex-1 rounded-full transition-all duration-300"
                      style={{ background: i <= seguridad.nivel ? seguridad.colorBar : `${tw}0.1)` }} />
                  ))}
                </div>
                <p className="text-xs font-medium" style={{ color: seguridad.colorText }}>
                  {seguridad.label}
                </p>
              </div>
            )}
          </div>

          {/* Confirmar contraseña */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium" style={{ color: `${tw}0.7)` }}>
              Confirmar contraseña
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                placeholder="Repite la contraseña"
                autoComplete="new-password"
                value={confirmar}
                onChange={e => setConfirmar(e.target.value)}
                required
                className="glass-input w-full px-4 py-3 pr-11 text-sm outline-none"
              />
              <button type="button" onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5"
                style={{ color: `${tw}0.35)` }}>
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmar.length > 0 && (
              <p className="text-xs flex items-center gap-1"
                style={{ color: coinciden ? '#34d399' : '#f87171' }}>
                {coinciden
                  ? <><CheckCircle className="h-3 w-3" /> Las contraseñas coinciden</>
                  : <><AlertCircle className="h-3 w-3" /> Las contraseñas no coinciden</>}
              </p>
            )}
          </div>

          {/* Recomendaciones */}
          <div className="px-3 py-2.5 rounded-xl text-xs space-y-1"
            style={{ background: `${tw}0.04)`, border: `1px solid ${tw}0.08)` }}>
            <p className="font-medium" style={{ color: `${tw}0.55)` }}>Recomendaciones:</p>
            <ul className="space-y-0.5 list-disc list-inside" style={{ color: `${tw}0.4)` }}>
              {[
                [password.length >= 8,          'Al menos 8 caracteres'],
                [/[A-Z]/.test(password),         'Una letra mayúscula'],
                [/[0-9]/.test(password),         'Un número'],
                [/[^A-Za-z0-9]/.test(password),  'Un símbolo (!, @, #...)'],
              ].map(([ok, label], i) => (
                <li key={i} style={{ color: ok ? '#34d399' : undefined }}>{label as string}</li>
              ))}
            </ul>
          </div>

          {error && (
            <p role="alert" className="text-sm px-3 py-2 rounded-lg flex items-center gap-2"
              style={{ color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </p>
          )}

          <motion.button
            type="submit"
            disabled={loading || password.length < 8 || !coinciden}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'rgba(99,102,241,0.9)', color: 'white' }}
          >
            {loading
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Guardando...</>
              : <><Lock className="h-4 w-4" /> Guardar nueva contraseña</>}
          </motion.button>
        </form>

        <button
          onClick={() => router.push('/login')}
          className="w-full text-xs text-center hover:underline transition-colors"
          style={{ color: `${tw}0.3)` }}
        >
          ← Volver al login
        </button>
      </motion.div>
    </Wrapper>
  )
}
