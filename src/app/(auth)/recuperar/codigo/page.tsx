'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { KeyRound, CheckCircle, AlertCircle, RotateCcw } from 'lucide-react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

const ease = [0.25, 0.46, 0.45, 0.94] as const
const tw = 'rgba(255,255,255,'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 22 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, delay, ease },
})

function CodigoForm() {
  const router      = useRouter()
  const searchParams = useSearchParams()

  const [email, setEmail]       = useState('')
  const [codigo, setCodigo]     = useState('')
  const [loading, setLoading]   = useState(false)
  const [reenviando, setReenviando] = useState(false)
  const [error, setError]       = useState('')
  const [reenvioOk, setReenvioOk] = useState(false)

  useEffect(() => {
    const e = searchParams.get('email')
    if (e) setEmail(e)
  }, [searchParams])

  async function handleVerificar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const codigoLimpio = codigo.replace(/\D/g, '')
    if (codigoLimpio.length < 6) {
      setError('El código debe tener al menos 6 dígitos.')
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
      const msg = err.message.toLowerCase()
      if (msg.includes('expired') || msg.includes('invalid') || msg.includes('not found')) {
        setError('El código no es válido o ya expiró. Solicita uno nuevo.')
      } else {
        setError('No se pudo verificar el código. Intenta de nuevo.')
      }
      return
    }

    router.push('/nueva-contrasena')
  }

  async function handleReenviar() {
    if (!email.trim()) return
    setReenviando(true)
    setReenvioOk(false)
    setError('')

    const supabase = createClient()
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/nueva-contrasena`,
    })
    setReenviando(false)

    if (err) {
      const msg = err.message.toLowerCase()
      const seg = err.message.match(/(\d+)\s*seconds?/i)?.[1] ?? '60'
      if (msg.includes('rate limit') || msg.includes('only request this after')) {
        setError(`Espera ${seg} segundos antes de pedir otro código.`)
        return
      }
    }
    setReenvioOk(true)
    setTimeout(() => setReenvioOk(false), 5000)
  }

  // Formatea el código con un espacio en el centro para facilitar lectura
  function formatearCodigo(val: string) {
    const digits = val.replace(/\D/g, '').slice(0, 8)
    if (digits.length > 4) return digits.slice(0, 4) + ' ' + digits.slice(4)
    return digits
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
              <KeyRound className="h-5 w-5" style={{ color: '#a5b4fc' }} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Ingresa el código</h1>
              <p className="text-sm mt-1" style={{ color: `${tw}0.45)` }}>
                Enviamos un código numérico a{' '}
                <strong className="text-white">{email || 'tu correo'}</strong>. Cópialo aquí.
              </p>
            </div>
          </div>

          <form onSubmit={handleVerificar} className="space-y-5">

            {/* Input grande para el código */}
            <div className="space-y-2">
              <label htmlFor="codigo" className="text-sm font-medium" style={{ color: `${tw}0.7)` }}>
                Código de 8 dígitos
              </label>
              <input
                id="codigo"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="0000 0000"
                value={formatearCodigo(codigo)}
                onChange={e => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 8))}
                required
                autoFocus
                className="glass-input w-full px-4 py-4 text-center text-3xl font-mono tracking-[0.5em] outline-none"
                style={{ letterSpacing: '0.45em' }}
              />
              <p className="text-xs text-center" style={{ color: `${tw}0.3)` }}>
                Revisa tu bandeja de entrada y carpeta de spam
              </p>
            </div>

            {error && (
              <p role="alert" className="text-sm px-3 py-2 rounded-lg flex items-center gap-2"
                style={{ color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
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
              disabled={loading || codigo.length < 6}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm rounded-xl font-bold disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'rgba(99,102,241,0.9)', color: 'white' }}
            >
              {loading
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Verificando...</>
                : <><KeyRound className="h-4 w-4" /> Verificar código</>}
            </motion.button>
          </form>

          {/* Reenviar */}
          <div className="flex flex-col items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleReenviar}
              disabled={reenviando}
              className="flex items-center gap-1.5 text-xs hover:underline disabled:opacity-40"
              style={{ color: `${tw}0.4)` }}
            >
              <RotateCcw className={`h-3 w-3 ${reenviando ? 'animate-spin' : ''}`} />
              {reenviando ? 'Reenviando...' : '¿No llegó el código? Reenviar'}
            </button>

            <button
              onClick={() => router.push('/login')}
              className="text-xs hover:underline transition-colors"
              style={{ color: `${tw}0.25)` }}
            >
              ← Volver al login
            </button>
          </div>

        </motion.div>
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
