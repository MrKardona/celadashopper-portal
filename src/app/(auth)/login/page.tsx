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

      {/* ── Aurora atmosphere ── */}
      <div className="aurora-blob aurora-blob-1" />
      <div className="aurora-blob aurora-blob-2" />
      <div className="aurora-blob aurora-blob-3" />

      {/* ── Orbes existentes ── */}
      <div className="portal-orb-gold" />
      <div className="portal-orb-blue" />

      {/* ── Rutas de importación ── */}
      <svg
        className="pointer-events-none fixed inset-0 w-full h-full"
        style={{ zIndex: 0, opacity: 0.15 }}
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Ruta principal USA → Colombia */}
        <path
          d="M 1260 70 Q 950 360 310 740"
          stroke="rgba(245,184,0,1)"
          strokeWidth="1.3"
          fill="none"
          strokeDasharray="7 11"
          style={{ animation: 'route-dash-1 24s linear infinite' }}
        />
        {/* Ruta secundaria */}
        <path
          d="M 1390 220 Q 1080 450 640 810"
          stroke="rgba(140,170,255,1)"
          strokeWidth="1"
          fill="none"
          strokeDasharray="4 13"
          style={{ animation: 'route-dash-2 32s linear infinite', animationDelay: '10s' }}
        />
        {/* Punto origen USA */}
        <circle cx="1260" cy="70" r="5" fill="rgba(245,184,0,0.9)" />
        <circle cx="1260" cy="70" r="10" fill="none" stroke="rgba(245,184,0,0.4)" strokeWidth="1" />
        <circle cx="1390" cy="220" r="3.5" fill="rgba(140,170,255,0.8)" />
        {/* Punto destino Colombia */}
        <circle cx="310" cy="740" r="5" fill="rgba(245,184,0,0.9)" />
        <circle cx="640" cy="810" r="3.5" fill="rgba(140,170,255,0.8)" />
      </svg>

      {/* ── Avión de carga ── */}
      <svg
        className="login-plane"
        width="96"
        height="40"
        viewBox="0 0 96 40"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Fuselaje */}
        <ellipse cx="48" cy="20" rx="38" ry="5" fill="white" />
        {/* Alas principales */}
        <path d="M 52 20 L 30 5 L 65 18 L 30 35 Z" fill="white" />
        {/* Cola horizontal */}
        <path d="M 13 20 L 4 14 L 14 18 Z" fill="white" />
        <path d="M 13 20 L 4 26 L 14 22 Z" fill="white" />
        {/* Cola vertical */}
        <path d="M 13 20 L 7 11 L 14 19" fill="white" />
        {/* Motores */}
        <ellipse cx="43" cy="13" rx="6" ry="2.2" fill="rgba(255,255,255,0.7)" />
        <ellipse cx="43" cy="27" rx="6" ry="2.2" fill="rgba(255,255,255,0.7)" />
        {/* Nariz / cabina */}
        <ellipse cx="85" cy="20" rx="4" ry="3" fill="rgba(255,255,255,0.6)" />
      </svg>

      <div className="relative z-10 w-full max-w-md space-y-8">

        {/* Logo */}
        <motion.div {...fadeDown(0.1)} className="flex flex-col items-center gap-3">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.05, ease }}
          >
            <Image
              src="/celada-logo-new.png"
              alt="Celada Personal Shopper"
              width={220}
              height={80}
              priority
              style={{ objectFit: 'contain' }}
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col items-center gap-2"
          >
            {/* Ruta USA → Colombia */}
            <div className="flex items-center gap-2">
              <span className="text-2xl leading-none">🇺🇸</span>
              <span className="flex items-center gap-0.5" style={{ color: `${tw}0.18)` }}>
                <span className="w-5 h-px block" style={{ background: `${tw}0.18)` }} />
                <span style={{ color: `${tw}0.35)`, fontSize: 13 }}>✈</span>
                <span className="w-5 h-px block" style={{ background: `${tw}0.18)` }} />
              </span>
              <span className="text-2xl leading-none">🇨🇴</span>
            </div>
            {/* Tagline */}
            <p
              className="text-xs font-medium tracking-widest uppercase"
              style={{ color: `${tw}0.35)`, letterSpacing: '0.18em' }}
            >
              Servicio internacional de casillero
            </p>
          </motion.div>
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
