'use client'

import { Suspense, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Send, KeyRound, CheckCircle, AlertCircle, ShieldCheck, RotateCcw, ArrowLeft } from 'lucide-react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

const ease = [0.25, 0.46, 0.45, 0.94] as const
const tw = 'rgba(255,255,255,'

const fadeUp = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -12 },
  transition: { duration: 0.4, ease },
}

// ─── Formato visual "XXXX XXXX" ───────────────────────────────────────────────
function formatCodigo(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 8)
  return d.length > 4 ? d.slice(0, 4) + ' ' + d.slice(4) : d
}

function RecuperarForm() {
  const router = useRouter()

  // Paso 1: email
  const [email, setEmail]       = useState('')
  const [enviando, setEnviando] = useState(false)
  const [errorEmail, setErrorEmail] = useState('')

  // Paso 2: código
  const [paso, setPaso]           = useState<'email' | 'codigo'>('email')
  const [codigo, setCodigo]       = useState('')
  const [verificando, setVerificando] = useState(false)
  const [reenviando, setReenviando]   = useState(false)
  const [error, setError]         = useState('')
  const [reenvioOk, setReenvioOk] = useState(false)

  // ── Paso 1: enviar email ──────────────────────────────────────────────────
  async function handleEnviarEmail(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setErrorEmail('')

    const emailLimpio = email.trim().toLowerCase()
    const supabase = createClient()

    const { error: err } = await supabase.auth.resetPasswordForEmail(emailLimpio, {
      redirectTo: `${window.location.origin}/nueva-contrasena`,
    })

    setEnviando(false)

    if (err) {
      const msg = err.message.toLowerCase()
      if (msg.includes('rate limit') || msg.includes('only request this after') || msg.includes('seconds')) {
        const seg = err.message.match(/(\d+)\s*seconds?/i)?.[1] ?? '60'
        setErrorEmail(`Espera ${seg} segundos antes de solicitar otro código.`)
        return
      }
      setErrorEmail('No se pudo enviar el código. Intenta de nuevo.')
      return
    }

    // Avanzar al paso del código
    setPaso('codigo')
  }

  // ── Paso 2: verificar código ──────────────────────────────────────────────
  async function handleVerificarCodigo(e: React.FormEvent) {
    e.preventDefault()
    setVerificando(true)
    setError('')

    const codigoLimpio = codigo.replace(/\D/g, '')
    if (codigoLimpio.length < 6) {
      setError('El código debe tener al menos 6 dígitos.')
      setVerificando(false)
      return
    }

    const supabase = createClient()
    const { error: err } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: codigoLimpio,
      type:  'recovery',
    })

    setVerificando(false)

    if (err) {
      const msg = err.message.toLowerCase()
      if (msg.includes('expired') || msg.includes('invalid') || msg.includes('not found')) {
        setError('El código no es válido o ya expiró. Solicita uno nuevo.')
      } else {
        setError('No se pudo verificar. Intenta de nuevo.')
      }
      return
    }

    // Sesión de recuperación creada → cambiar contraseña
    router.push('/nueva-contrasena')
  }

  // ── Reenviar código ───────────────────────────────────────────────────────
  async function handleReenviar() {
    setReenviando(true)
    setReenvioOk(false)
    setError('')

    const supabase = createClient()
    const { error: err } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/nueva-contrasena` }
    )
    setReenviando(false)

    if (err) {
      const msg = err.message.toLowerCase()
      if (msg.includes('rate limit') || msg.includes('only request this after')) {
        const seg = err.message.match(/(\d+)\s*seconds?/i)?.[1] ?? '60'
        setError(`Espera ${seg} segundos antes de pedir otro código.`)
        return
      }
    }
    setReenvioOk(true)
    setCodigo('')
    setTimeout(() => setReenvioOk(false), 6000)
  }

  // ─────────────────────────────────────────────────────────────────────────
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
            <Image src="/celada-logo-new.png" alt="Celada Personal Shopper"
              width={200} height={72} priority style={{ objectFit: 'contain' }} />
          </a>
        </motion.div>

        {/* ── Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.2, ease }}
          className="glass-card p-8"
        >
          <AnimatePresence mode="wait">

            {/* ══ PASO 1: Correo ══════════════════════════════════════════════ */}
            {paso === 'email' && (
              <motion.div key="email" {...fadeUp} className="space-y-6">

                {/* Header */}
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 p-2 rounded-xl flex-shrink-0"
                    style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)' }}>
                    <ShieldCheck className="h-5 w-5" style={{ color: '#a5b4fc' }} />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-white">Recuperar contraseña</h1>
                    <p className="text-sm mt-1" style={{ color: `${tw}0.45)` }}>
                      Ingresa tu correo y te enviamos un código de 8 dígitos para crear una nueva contraseña.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleEnviarEmail} className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="email" className="text-sm font-medium" style={{ color: `${tw}0.7)` }}>
                      Correo electrónico
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                        style={{ color: `${tw}0.3)` }} />
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

                  {errorEmail && (
                    <p role="alert" className="text-sm px-3 py-2 rounded-lg flex items-center gap-2"
                      style={{ color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />{errorEmail}
                    </p>
                  )}

                  <motion.button
                    type="submit"
                    disabled={enviando}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm rounded-xl font-bold disabled:opacity-50"
                    style={{ background: 'rgba(99,102,241,0.9)', color: 'white' }}
                  >
                    {enviando
                      ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Enviando...</>
                      : <><Send className="h-4 w-4" /> Enviar código</>}
                  </motion.button>
                </form>

                <button onClick={() => router.push('/login')}
                  className="w-full text-xs text-center hover:underline"
                  style={{ color: `${tw}0.3)` }}>
                  ← Volver al login
                </button>
              </motion.div>
            )}

            {/* ══ PASO 2: Código ══════════════════════════════════════════════ */}
            {paso === 'codigo' && (
              <motion.div key="codigo" {...fadeUp} className="space-y-6">

                {/* Header */}
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 p-2 rounded-xl flex-shrink-0"
                    style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)' }}>
                    <KeyRound className="h-5 w-5" style={{ color: '#a5b4fc' }} />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-white">Ingresa el código</h1>
                    <p className="text-sm mt-1" style={{ color: `${tw}0.45)` }}>
                      Enviamos un código de 8 dígitos a{' '}
                      <strong className="text-white">{email}</strong>. Cópialo aquí.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleVerificarCodigo} className="space-y-5">

                  {/* Input grande para el código */}
                  <div className="space-y-2">
                    <label htmlFor="codigo" className="text-sm font-medium" style={{ color: `${tw}0.7)` }}>
                      Código del correo
                    </label>
                    <input
                      id="codigo"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="0000 0000"
                      value={formatCodigo(codigo)}
                      onChange={e => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 8))}
                      required
                      autoFocus
                      className="glass-input w-full px-4 py-5 text-center text-3xl font-mono outline-none"
                      style={{ letterSpacing: '0.55em' }}
                    />
                    <p className="text-xs text-center" style={{ color: `${tw}0.3)` }}>
                      Revisa tu bandeja de entrada y la carpeta de spam
                    </p>
                  </div>

                  {error && (
                    <p role="alert" className="text-sm px-3 py-2 rounded-lg flex items-center gap-2"
                      style={{ color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />{error}
                    </p>
                  )}

                  {reenvioOk && (
                    <p className="text-sm px-3 py-2 rounded-lg flex items-center gap-2"
                      style={{ color: '#34d399', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
                      <CheckCircle className="h-4 w-4 flex-shrink-0" />
                      Código reenviado. Revisa tu correo.
                    </p>
                  )}

                  <motion.button
                    type="submit"
                    disabled={verificando || codigo.length < 6}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm rounded-xl font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: 'rgba(99,102,241,0.9)', color: 'white' }}
                  >
                    {verificando
                      ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Verificando...</>
                      : <><KeyRound className="h-4 w-4" /> Verificar código</>}
                  </motion.button>
                </form>

                {/* Acciones secundarias */}
                <div className="flex flex-col items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={handleReenviar}
                    disabled={reenviando}
                    className="flex items-center gap-1.5 text-xs hover:underline disabled:opacity-40 transition-colors"
                    style={{ color: `${tw}0.4)` }}
                  >
                    <RotateCcw className={`h-3 w-3 ${reenviando ? 'animate-spin' : ''}`} />
                    {reenviando ? 'Reenviando...' : '¿No llegó el código? Reenviar'}
                  </button>

                  <button
                    onClick={() => { setPaso('email'); setCodigo(''); setError('') }}
                    className="flex items-center gap-1.5 text-xs hover:underline transition-colors"
                    style={{ color: `${tw}0.25)` }}
                  >
                    <ArrowLeft className="h-3 w-3" /> Cambiar correo
                  </button>
                </div>

              </motion.div>
            )}

          </AnimatePresence>
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
