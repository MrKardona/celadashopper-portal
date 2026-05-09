'use client'

import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Package, LayoutDashboard, PlusCircle, LogOut, User, ShieldCheck } from 'lucide-react'
import Image from 'next/image'
import type { Perfil } from '@/types'

export default function NavPortal({ perfil }: { perfil: Perfil | null }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const dashboardHref = perfil?.rol === 'admin' ? '/dashboard?as=client' : '/dashboard'

  const navItems = [
    { href: dashboardHref, label: 'Mi Panel', icon: LayoutDashboard },
    { href: '/reportar', label: 'Reportar', icon: PlusCircle },
    { href: '/paquetes', label: 'Paquetes', icon: Package },
    { href: '/perfil', label: 'Perfil', icon: User },
  ]

  return (
    <header className="glass-nav sticky top-0 z-50">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="flex items-center justify-between h-16">

          {/* Logo — vuelve al inicio (redirige según sesión) */}
          <a href="/" className="flex items-center gap-2 shrink-0">
            <Image
              src="/celada-logo-new.png"
              alt="Celada Personal Shopper"
              width={120}
              height={44}
              priority
              style={{ objectFit: 'contain' }}
            />
          </a>

          {/* Nav escritorio */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(({ href, label, icon: Icon }) => (
              <a
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                  pathname === href.split('?')[0] ? 'nav-item-active' : 'nav-item'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </a>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {perfil?.rol === 'admin' && (
              <a
                href="/admin"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: 'rgba(245,184,0,0.1)',
                  border: '1px solid rgba(245,184,0,0.25)',
                  color: '#F5B800',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(245,184,0,0.18)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(245,184,0,0.1)')}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Panel Admin
              </a>
            )}
            {perfil?.numero_casilla && (
              <div
                className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                style={{
                  background: 'rgba(245,184,0,0.12)',
                  border: '1px solid rgba(245,184,0,0.25)',
                  color: '#F5B800',
                }}
              >
                <span style={{ opacity: 0.6 }}>Casilla</span>
                <span>{perfil.numero_casilla}</span>
              </div>
            )}
            {perfil?.nombre_completo && (
              <span className="hidden sm:block text-sm font-medium truncate max-w-[120px]" style={{ color: 'rgba(255,255,255,0.6)' }}>
                {perfil.nombre_completo.split(' ')[0]}
              </span>
            )}
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="flex items-center justify-center w-8 h-8 rounded-lg transition-all"
              style={{ color: 'rgba(255,255,255,0.4)' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#F5B800')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Nav móvil */}
        <nav className="md:hidden flex gap-1 pb-3 overflow-x-auto">
          {navItems.map(({ href, label, icon: Icon }) => (
            <a
              key={href}
              href={href}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                pathname === href.split('?')[0] ? 'nav-item-active' : 'nav-item'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </a>
          ))}
          {perfil?.rol === 'admin' && (
            <a
              href="/admin"
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all"
              style={{ background: 'rgba(245,184,0,0.1)', border: '1px solid rgba(245,184,0,0.2)', color: '#F5B800' }}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Admin
            </a>
          )}
        </nav>
      </div>
    </header>
  )
}
