'use client'

import { Suspense, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import { motion } from 'framer-motion'
import type { User } from '@supabase/supabase-js'

/* ── Dots animados ── */
function AnimatedDots() {
  return (
    <span className="inline-flex gap-1 items-center ml-1">
      {[0, 1, 2].map(i => (
        <motion.span
          key={i}
          className="block w-1.5 h-1.5 rounded-full"
          style={{ background: 'rgba(245,184,0,0.85)' }}
          animate={{ opacity: [0.15, 1, 0.15], y: [0, -4, 0] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
        />
      ))}
    </span>
  )
}

/* ── Pantalla radar sonar ── */
function RadarLoader() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #07070f 0%, #0b0b1d 40%, #080c14 100%)',
        fontFamily: "'Outfit', sans-serif",
      }}
    >
      {/* Aurora blobs (mismas clases que el login) */}
      <div className="aurora-blob aurora-blob-1" />
      <div className="aurora-blob aurora-blob-2" />
      <div className="aurora-blob aurora-blob-3" />

      <div className="relative z-10 flex flex-col items-center gap-10">

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <Image
            src="/celada-logo-new.png"
            alt="Celada Personal Shopper"
            width={190}
            height={70}
            priority
            style={{ objectFit: 'contain' }}
          />
        </motion.div>

        {/* Radar sonar */}
        <motion.div
          className="relative flex items-center justify-center"
          style={{ width: 210, height: 210 }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.55, delay: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          {/* 3 anillos sonar con delay escalonado */}
          {[0, 0.7, 1.4].map((delay, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                width: 76,
                height: 76,
                border: `1.5px solid rgba(245,184,0,${0.65 - i * 0.15})`,
              }}
              animate={{ scale: [1, 2.7], opacity: [0.65 - i * 0.1, 0] }}
              transition={{ duration: 2.1, repeat: Infinity, ease: 'easeOut', delay }}
            />
          ))}

          {/* Glow de fondo */}
          <motion.div
            className="absolute rounded-full"
            style={{
              width: 140,
              height: 140,
              background: 'radial-gradient(circle, rgba(245,184,0,0.14) 0%, transparent 70%)',
            }}
            animate={{ scale: [0.85, 1.18, 0.85], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Caja central pulsante */}
          <motion.div
            className="relative z-10 flex items-center justify-center rounded-2xl"
            style={{
              width: 76,
              height: 76,
              background: 'rgba(245,184,0,0.09)',
              border: '1px solid rgba(245,184,0,0.35)',
              backdropFilter: 'blur(10px)',
            }}
            animate={{
              scale: [1, 1.08, 1],
              boxShadow: [
                '0 0 0px rgba(245,184,0,0)',
                '0 0 36px rgba(245,184,0,0.4)',
                '0 0 0px rgba(245,184,0,0)',
              ],
            }}
            transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <motion.span
              style={{ fontSize: 34, lineHeight: 1 }}
              animate={{ scale: [1, 1.13, 1] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
            >
              📦
            </motion.span>
          </motion.div>
        </motion.div>

        {/* Texto + dots */}
        <motion.div
          className="flex items-center text-sm"
          style={{ color: 'rgba(255,255,255,0.42)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55, duration: 0.4 }}
        >
          <span>Verificando acceso</span>
          <AnimatedDots />
        </motion.div>

      </div>
    </div>
  )
}

/* ── Lógica de autenticación ── */
function Confirmar() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const code = searchParams.get('code')
    const supabase = createClient()

    async function redirectByUser(user: User) {
      const { data: perfil } = await supabase
        .from('perfiles')
        .select('rol')
        .eq('id', user.id)
        .single()
      const rol = perfil?.rol ?? 'cliente'
      if (rol === 'admin') router.replace('/admin/paquetes')
      else if (rol === 'agente_usa') router.replace('/agente')
      else router.replace('/dashboard')
    }

    if (!code) {
      supabase.auth.getUser().then(({ data, error }) => {
        if (error || !data.user) { router.replace('/login?error=auth'); return }
        redirectByUser(data.user)
      })
      return
    }

    supabase.auth.exchangeCodeForSession(code).then(async ({ data, error }) => {
      if (error || !data.session) { router.replace('/login?error=auth'); return }
      redirectByUser(data.session.user)
    })
  }, [router, searchParams])

  return <RadarLoader />
}

export default function ConfirmarPage() {
  return (
    <Suspense fallback={<RadarLoader />}>
      <Confirmar />
    </Suspense>
  )
}
