'use client'

import { Suspense, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { MailCheck, Send, Lock, ShieldCheck, UserPlus, ArrowLeft, Package } from 'lucide-react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { enviarMagicLink, iniciarSesionAdmin } from './actions'

const ease = [0.25, 0.46, 0.45, 0.94] as const

// Componente ruta animada USA → Colombia
function RouteAnimada({ tw }: { tw: string }) {
  return (
    <div className="flex flex-col items-center gap-2 mt-1">
      {/* Banderas + avión */}
      <div className="flex items-center gap-2">
        {/* 🇺🇸 con pulso suave */}
        <motion.span
          className="text-2xl leading-none select-none"
          animate={{ scale: [1, 1.12, 1], filter: ['drop-shadow(0 0 0px transparent)', 'drop-shadow(0 0 6px rgba(255,255,255,0.25))', 'drop-shadow(0 0 0px transparent)'] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >🇺🇸</motion.span>

        {/* Pista + avión animado */}
        <div className="relative w-28 h-5 flex-shrink-0">
          {/* Línea de pista */}
          <div
            className="absolute top-1/2 left-0 right-0 -mt-px h-px"
            style={{ background: `linear-gradient(90deg, transparent, ${tw}0.22), transparent)` }}
          />
          {/* Puntos de pista */}
          {[20, 40, 60].map(pos => (
            <motion.div
              key={pos}
              className="absolute top-1/2 -mt-px w-0.5 h-0.5 rounded-full"
              style={{ left: pos, background: `${tw}0.15)` }}
              animate={{ opacity: [0.15, 0.5, 0.15] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: pos / 100, ease: 'easeInOut' }}
            />
          ))}
          {/* Avión volando */}
          <motion.span
            className="absolute text-xs select-none"
            style={{ top: '50%', marginTop: -7, left: -4 }}
            animate={{
              x: [0, 56, 112],
              y: [0, -6, 0],
            }}
            transition={{
              duration: 2.2,
              ease: 'easeInOut',
              repeat: Infinity,
              repeatDelay: 0.7,
              times: [0, 0.5, 1],
            }}
          >📦</motion.span>
        </div>

        {/* 🇨🇴 con pulso offset */}
        <motion.span
          className="text-2xl leading-none select-none"
          animate={{ scale: [1, 1.12, 1], filter: ['drop-shadow(0 0 0px transparent)', 'drop-shadow(0 0 6px rgba(255,220,60,0.3))', 'drop-shadow(0 0 0px transparent)'] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
        >🇨🇴</motion.span>
      </div>

      {/* Tagline */}
      <motion.p
        className="text-xs font-medium uppercase"
        style={{ color: `${tw}0.32)`, letterSpacing: '0.18em' }}
        animate={{ opacity: [0.32, 0.55, 0.32] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        Servicio internacional de casillero
      </motion.p>
    </div>
  )
}

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
  const router = useRouter()
  const tw = 'rgba(255,255,255,'
  const authError = searchParams.get('error')

  // Modo: 'cliente' (magic link) | 'admin' (contraseña)
  const [modo, setModo] = useState<'cliente' | 'admin'>('cliente')

  // Estado magic link
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)

  // Estado admin
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPass, setAdminPass] = useState('')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const submitting = useRef(false)

  // Estado registro inline
  const [modoRegistro, setModoRegistro] = useState(false)
  const [formReg, setFormReg] = useState({ nombre: '', whatsapp: '', ciudad: '' })
  const [registrando, setRegistrando] = useState(false)
  const [registrado, setRegistrado] = useState<{ numero_casilla: string; nombre_completo: string } | null>(null)

  // ── Enviar magic link (clientes) ──────────────────────────────────────────
  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    if (submitting.current) return
    submitting.current = true
    setLoading(true); setError('')
    try {
      const { error } = await enviarMagicLink(email)
      if (error) {
        // Cualquier error que indique que el usuario no está registrado → mostrar formulario
        const esNoRegistrado =
          error.includes('no tiene una cuenta') ||
          error.includes('Puedes crear una') ||
          error.includes('not registered') ||
          error.includes('user not found') ||
          error.includes('No user found')
        if (esNoRegistrado) {
          setModoRegistro(true)
          setFormReg({ nombre: '', whatsapp: '', ciudad: '' })
        } else {
          setError(error)
        }
        return
      }
      setEnviado(true)
    } catch {
      setError('No se pudo conectar. Verifica tu conexión e intenta de nuevo.')
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  // ── Registrar cliente nuevo ───────────────────────────────────────────────
  async function handleRegistro(e: React.FormEvent) {
    e.preventDefault()
    if (!formReg.nombre.trim()) return
    setRegistrando(true); setError('')
    try {
      const res = await fetch('/api/auth/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre_completo: formReg.nombre.trim(),
          email,
          whatsapp: formReg.whatsapp.trim() || undefined,
          ciudad: formReg.ciudad.trim() || undefined,
        }),
      })
      const data = await res.json() as {
        ok?: boolean; error?: string; ya_existe?: boolean
        numero_casilla?: string; nombre_completo?: string
      }
      if (res.status === 409 && data.ya_existe) {
        // Ya tiene cuenta — mostrar pantalla de "revisa tu correo"
        setModoRegistro(false)
        setEnviado(true)
        return
      }
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Error al crear la cuenta. Intenta de nuevo.')
        return
      }
      setRegistrado({ numero_casilla: data.numero_casilla!, nombre_completo: data.nombre_completo! })
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setRegistrando(false)
    }
  }

  // ── Login con contraseña (admins) ─────────────────────────────────────────
  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault()
    if (submitting.current) return
    submitting.current = true
    setLoading(true); setError('')
    const { error } = await iniciarSesionAdmin(adminEmail, adminPass)
    if (error) { setError(error); setLoading(false); submitting.current = false; return }
    router.push('/admin')
  }

  // ── Pantalla: cuenta creada ───────────────────────────────────────────────
  if (registrado) {
    return (
      <motion.div {...fadeUp(0)} className="space-y-5 py-2">
        <div className="text-center space-y-3">
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 18, delay: 0.1 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mx-auto"
            style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.25)' }}
          >
            <Package className="h-8 w-8" style={{ color: '#34d399' }} />
          </motion.div>
          <div>
            <p className="text-xl font-bold text-white">¡Bienvenido a Celada!</p>
            <p className="text-sm mt-1 leading-relaxed" style={{ color: `${tw}0.5)` }}>
              Tu casillero está listo,{' '}
              <strong className="text-white">{registrado.nombre_completo.split(' ')[0]}</strong>.
            </p>
          </div>
          <div className="inline-flex flex-col items-center gap-1 px-5 py-3 rounded-2xl"
            style={{ background: 'rgba(245,184,0,0.1)', border: '1px solid rgba(245,184,0,0.25)' }}>
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'rgba(245,184,0,0.6)' }}>Tu casillero</span>
            <span className="font-mono text-3xl font-bold" style={{ color: '#F5B800' }}>{registrado.numero_casilla}</span>
          </div>
        </div>
        <div className="rounded-xl px-4 py-3 text-sm text-center"
          style={{ background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.2)', color: 'rgba(52,211,153,0.8)' }}>
          Enviamos un link de acceso a <strong style={{ color: '#34d399' }}>{email}</strong>.<br />
          <span style={{ color: 'rgba(255,255,255,0.45)' }}>Ábrelo para entrar al portal.</span>
        </div>
        <p className="text-xs text-center" style={{ color: `${tw}0.3)` }}>
          ¿No lo ves? Revisa la carpeta de spam o{' '}
          <button
            onClick={() => { setRegistrado(null); setModoRegistro(false); setEnviado(false) }}
            className="font-semibold hover:underline" style={{ color: '#F5B800' }}>
            solicita el link de nuevo
          </button>
        </p>
      </motion.div>
    )
  }

  // ── Pantalla "revisa tu correo" ───────────────────────────────────────────
  if (enviado) {
    return (
      <motion.div {...fadeUp(0)} className="text-center space-y-5 py-4">
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
          <button onClick={() => { setEnviado(false); submitting.current = false }}
            className="font-semibold hover:underline" style={{ color: '#F5B800' }}>
            solicita uno nuevo
          </button>
        </p>
      </motion.div>
    )
  }

  // ── Formulario admin (contraseña) ─────────────────────────────────────────
  if (modo === 'admin') {
    return (
      <div className="space-y-4">
        {/* Header modo admin */}
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs"
          style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
          <ShieldCheck className="h-4 w-4 flex-shrink-0" style={{ color: '#a5b4fc' }} />
          <p style={{ color: 'rgba(255,255,255,0.6)' }}>
            Acceso de <strong style={{ color: '#a5b4fc' }}>administrador</strong> — se requiere contraseña
          </p>
        </div>

        <form onSubmit={handleAdminLogin} className="space-y-3">
          {authError && (
            <div className="px-4 py-3 rounded-xl text-sm"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
              Sesión expirada. Inicia sesión nuevamente.
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="admin-email" className="text-sm font-medium" style={{ color: `${tw}0.7)` }}>
              Correo
            </label>
            <input
              id="admin-email"
              type="email"
              placeholder="admin@celadashopper.com"
              autoComplete="email"
              value={adminEmail}
              onChange={e => setAdminEmail(e.target.value)}
              required
              autoFocus
              className="glass-input w-full px-4 py-3 text-sm outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="admin-pass" className="text-sm font-medium" style={{ color: `${tw}0.7)` }}>
                Contraseña
              </label>
              <a
                href="/recuperar"
                className="text-xs hover:underline transition-colors"
                style={{ color: '#a5b4fc' }}
              >
                ¿Olvidaste tu contraseña?
              </a>
            </div>
            <input
              id="admin-pass"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              value={adminPass}
              onChange={e => setAdminPass(e.target.value)}
              required
              className="glass-input w-full px-4 py-3 text-sm outline-none"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm px-3 py-2 rounded-lg"
              style={{ color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </p>
          )}

          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm rounded-xl font-bold"
            style={{ background: 'rgba(99,102,241,0.9)', color: 'white' }}
          >
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Ingresando...</>
            ) : (
              <><Lock className="h-4 w-4" /> Ingresar como admin</>
            )}
          </motion.button>
        </form>

        <button
          onClick={() => { setModo('cliente'); setError('') }}
          className="w-full text-xs text-center pt-1 hover:underline transition-colors"
          style={{ color: `${tw}0.35)` }}
        >
          ← Volver al acceso de cliente
        </button>
      </div>
    )
  }

  // ── Formulario cliente (magic link) ──────────────────────────────────────
  return (
    <div className="space-y-4">
      <form onSubmit={handleMagicLink} className="space-y-4">
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

        {error && !modoRegistro && (
          <p role="alert" aria-live="polite" className="text-sm" style={{ color: '#f87171' }}>{error}</p>
        )}

        {!modoRegistro && (
          <>
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.02, boxShadow: '0 0 28px rgba(245,184,0,0.4)' }}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="btn-gold w-full flex items-center justify-center gap-2 px-4 py-3 text-sm rounded-xl font-bold"
            >
              {loading ? (
                <><div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />Enviando...</>
              ) : (
                <><Send className="h-4 w-4" />Enviar link de acceso</>
              )}
            </motion.button>

            <p className="text-xs text-center" style={{ color: `${tw}0.3)` }}>
              Te enviaremos un link al correo · Sin contraseña
            </p>

            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs"
              style={{ background: 'rgba(245,184,0,0.06)', border: '1px solid rgba(245,184,0,0.14)' }}>
              <span className="mt-px flex-shrink-0" style={{ color: '#F5B800' }}>💡</span>
              <p style={{ color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
                Abre el link <strong style={{ color: 'rgba(255,255,255,0.65)' }}>en este mismo navegador</strong>, no desde la app de correo.
              </p>
            </div>
          </>
        )}
      </form>

      {/* ── Formulario de registro (aparece cuando el correo no existe) ── */}
      {modoRegistro && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease }}
          className="space-y-4"
        >
          {/* Header */}
          <div className="rounded-xl px-4 py-3 space-y-1"
            style={{ background: 'rgba(99,130,255,0.08)', border: '1px solid rgba(99,130,255,0.2)' }}>
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 flex-shrink-0" style={{ color: '#8899ff' }} />
              <p className="text-sm font-semibold" style={{ color: '#8899ff' }}>Crea tu cuenta gratis</p>
            </div>
            <p className="text-[11px] pl-6" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Registrando: <strong style={{ color: 'rgba(255,255,255,0.65)' }}>{email}</strong>
            </p>
          </div>

          <form onSubmit={handleRegistro} className="space-y-3">
            {/* Nombre */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium" style={{ color: `${tw}0.65)` }}>
                Nombre completo <span style={{ color: '#f87171' }}>*</span>
              </label>
              <input
                type="text"
                value={formReg.nombre}
                onChange={e => setFormReg(p => ({ ...p, nombre: e.target.value }))}
                placeholder="Ej: María García López"
                required
                autoFocus
                className="glass-input w-full px-4 py-3 text-sm outline-none"
              />
            </div>

            {/* WhatsApp + Ciudad */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium" style={{ color: `${tw}0.65)` }}>WhatsApp</label>
                <input
                  type="tel"
                  value={formReg.whatsapp}
                  onChange={e => setFormReg(p => ({ ...p, whatsapp: e.target.value }))}
                  placeholder="+57 300..."
                  className="glass-input w-full px-3 py-3 text-sm outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" style={{ color: `${tw}0.65)` }}>Ciudad</label>
                <input
                  type="text"
                  value={formReg.ciudad}
                  onChange={e => setFormReg(p => ({ ...p, ciudad: e.target.value }))}
                  placeholder="Medellín"
                  className="glass-input w-full px-3 py-3 text-sm outline-none"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm" style={{ color: '#f87171' }}>{error}</p>
            )}

            <motion.button
              type="submit"
              disabled={registrando || !formReg.nombre.trim()}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm rounded-xl font-bold disabled:opacity-40"
              style={{ background: 'rgba(99,130,255,0.9)', color: 'white' }}
            >
              {registrando
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creando cuenta...</>
                : <><UserPlus className="h-4 w-4" />Crear mi cuenta y obtener casillero</>}
            </motion.button>
          </form>

          <button
            type="button"
            onClick={() => { setModoRegistro(false); setError('') }}
            className="w-full flex items-center justify-center gap-1.5 text-xs hover:underline"
            style={{ color: `${tw}0.3)` }}
          >
            <ArrowLeft className="h-3 w-3" /> Volver e intentar con otro correo
          </button>
        </motion.div>
      )}

      {/* Acceso admin — discreto al fondo */}
      <div className="pt-2 border-t" style={{ borderColor: `${tw}0.06)` }}>
        <button
          onClick={() => { setModo('admin'); setError('') }}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all"
          style={{ color: `${tw}0.28)` }}
          onMouseEnter={e => { e.currentTarget.style.color = `${tw}0.5)`; e.currentTarget.style.background = `${tw}0.03)` }}
          onMouseLeave={e => { e.currentTarget.style.color = `${tw}0.28)`; e.currentTarget.style.background = 'transparent' }}
        >
          <Lock className="h-3 w-3" />
          Acceso administrador
        </button>
      </div>
    </div>
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
            <a href="/" aria-label="Ir al inicio">
              <Image
                src="/celada-logo-new.png"
                alt="Celada Personal Shopper"
                width={220}
                height={80}
                priority
                style={{ objectFit: 'contain', cursor: 'pointer' }}
              />
            </a>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <RouteAnimada tw={tw} />
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
