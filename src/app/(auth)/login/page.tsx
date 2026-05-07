'use client'

import { Suspense, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { MailCheck, Send } from 'lucide-react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { enviarMagicLink } from './actions'

const ease = [0.25, 0.46, 0.45, 0.94] as const

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 22 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, delay, ease },
})

const fadeDown = (delay = 0) => ({
  initial: { opacity: 0, y: -16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease },
})

function LoginForm() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const submitting = useRef(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting.current) return
    submitting.current = true
    setLoading(true)
    setError('')

    // Usamos Server Action para que el code_verifier de PKCE se guarde
    // como cookie HTTP server-side — más confiable en apps de email móvil.
    const { error } = await enviarMagicLink(email)

    if (error) {
      setError(error)
      setLoading(false)
      submitting.current = false
      return
    }

    setEnviado(true)
    setLoading(false)
    submitting.current = false
  }

  const tw = 'rgba(255,255,255,'
  const authError = searchParams.get('error')

  if (enviado) {
    return (
      <motion.div
        {...fadeUp(0)}
        className="text-center space-y-5 py-4"
      >
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 18, delay: 0.1 }}
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mx-auto"
          style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.25)' }}
        >
          <MailCheck className="h-8 w-8" style={{ color: '#34d399' }} />
        </motion.div>
        <div>
          <p className="text-xl font-bold text-white">¡Revisa tu correo!</p>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: `${tw}0.55)` }}>
            Enviamos un link de acceso a{' '}
            <strong className="text-white">{email}</strong>.
            <br />Haz clic en el link para entrar al portal.
          </p>
        </div>
        <p className="text-xs" style={{ color: `${tw}0.35)` }}>
          ¿No lo ves? Revisa la carpeta de spam o{' '}
          <button
            onClick={() => { setEnviado(false); submitting.current = false }}
            className="font-semibold hover:underline"
            style={{ color: '#F5B800' }}
          >
            solicita uno nuevo
          </button>
        </p>
      </motion.div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {authError && (
        <motion.div {...fadeUp(0)} className="px-4 py-3 rounded-xl text-sm"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
          El link expiró o no es válido. Solicita uno nuevo.
        </motion.div>
      )}

      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium" style={{ color: `${tw}0.7)` }}>
          Correo electrónico
        </label>
        <input
          id="email"
          type="email"
          placeholder="tu@email.com"
          autoComplete="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="glass-input w-full px-4 py-3 text-sm outline-none"
        />
      </div>

      {error && (
        <p role="alert" aria-live="polite" className="text-sm" style={{ color: '#f87171' }}>{error}</p>
      )}

      <motion.button
        type="submit"
        disabled={loading}
        whileHover={{ scale: 1.02, boxShadow: '0 0 28px rgba(245,184,0,0.4)' }}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.15 }}
        className="btn-gold w-full flex items-center justify-center gap-2 px-4 py-3 text-sm rounded-xl font-bold"
      >
        {loading ? (
          <>
            <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            Enviando...
          </>
        ) : (
          <>
            <Send className="h-4 w-4" />
            Enviar link de acceso
          </>
        )}
      </motion.button>

      <p className="text-xs text-center" style={{ color: `${tw}0.3)` }}>
        Te enviaremos un link al correo · Sin contraseña
      </p>
    </form>
  )
}

export default function LoginPage() {
  const tw = 'rgba(255,255,255,'

  return (
    <div className="portal-bg min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="portal-orb-gold" />
      <div className="portal-orb-blue" />

      <div className="relative z-10 w-full max-w-md space-y-8">

        {/* Logo */}
        <motion.div {...fadeDown(0.1)} className="flex flex-col items-center gap-3">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.05, ease }}
          >
            <Image
              src="/celada-logo.svg"
              alt="Celada Personal Shopper"
              width={180}
              height={52}
              priority
            />
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-sm"
            style={{ color: `${tw}0.4)` }}
          >
            Portal de clientes
          </motion.p>
        </motion.div>

        {/* Card glass */}
        <motion.div {...fadeUp(0.25)} className="glass-card p-8 space-y-6">
          <div>
            <h1 className="text-xl font-bold text-white">Iniciar sesión</h1>
            <p className="text-sm mt-1" style={{ color: `${tw}0.45)` }}>
              Ingresa tu correo y te enviamos un link de acceso instantáneo
            </p>
          </div>

          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </motion.div>

        {/* Info badges */}
        <motion.div
          {...fadeUp(0.45)}
          className="flex items-center justify-center gap-6 text-xs"
          style={{ color: `${tw}0.3)` }}
        >
          {['Sin contraseña', 'Link seguro', 'Acceso instantáneo'].map((t, i) => (
            <span key={t} className="flex items-center gap-1.5">
              {i > 0 && <span style={{ color: `${tw}0.15)` }}>·</span>}
              <span style={{ color: '#F5B800', opacity: 0.7 }}>✓</span>
              {t}
            </span>
          ))}
        </motion.div>

      </div>
    </div>
  )
}
