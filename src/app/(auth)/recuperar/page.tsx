'use client'

import { Suspense, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Mail, Send, AlertCircle, ShieldCheck } from 'lucide-react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

const ease = [0.25, 0.46, 0.45, 0.94] as const
const tw = 'rgba(255,255,255,'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 22 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, delay, ease },
})

function RecuperarForm() {
  const router = useRouter()
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const emailLimpio = email.trim().toLowerCase()
    const supabase = createClient()

    const { error: err } = await supabase.auth.resetPasswordForEmail(emailLimpio, {
      redirectTo: `${window.location.origin}/nueva-contrasena`,
    })

    setLoading(false)

    if (err) {
      const msg = err.message.toLowerCase()
      if (msg.includes('rate limit') || msg.includes('only request this after') || msg.includes('seconds')) {
        const seg = err.message.match(/(\d+)\s*seconds?/i)?.[1] ?? '60'
        setError(`Por seguridad debes esperar ${seg} segundos antes de pedir otro código.`)
        return
      }
      setError('No se pudo enviar el código. Intenta de nuevo.')
      return
    }

    // Redirigir a la pantalla de ingreso de código
    router.push(`/recuperar/codigo?email=${encodeURIComponent(emailLimpio)}`)
  }

  return (
    <div className="portal-bg min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="aurora-blob aurora-blob-1" />
      <div className="aurora-blob aurora-blob-2" />
      <div className="aurora-blob aurora-blob-3" />
      <div className="portal-orb-gold" />
      <div className="portal-orb-blue" />

      <div className="relative z-10 w-full max-w-md space-y-8">

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
          className="flex justify-center"
        >
          <a href="/" aria-label="Inicio">
            <Image
              src="/celada-logo-new.png"
              alt="Celada Personal Shopper"
              width={200}
              height={72}
              priority
              style={{ objectFit: 'contain' }}
            />
          </a>
        </motion.div>

        {/* Card */}
        <motion.div {...fadeUp(0.2)} className="glass-card p-8 space-y-6">

          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="mt-0.5 p-2 rounded-xl flex-shrink-0"
              style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)' }}>
              <ShieldCheck className="h-5 w-5" style={{ color: '#a5b4fc' }} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Recuperar contraseña</h1>
              <p className="text-sm mt-1" style={{ color: `${tw}0.45)` }}>
                Te enviaremos un código numérico a tu correo para que puedas crear una nueva contraseña.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium" style={{ color: `${tw}0.7)` }}>
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: `${tw}0.3)` }} />
                <input
                  id="email"
                  type="email"
                  placeholder="admin@celadashopper.com"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="glass-input w-full pl-10 pr-4 py-3 text-sm outline-none"
                />
              </div>
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
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'rgba(99,102,241,0.9)', color: 'white' }}
            >
              {loading
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Enviando código...</>
                : <><Send className="h-4 w-4" /> Enviar código de recuperación</>}
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
