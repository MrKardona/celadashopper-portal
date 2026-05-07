'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, Package, Users, DollarSign,
  LogOut, ShieldCheck, Menu, X, ScanBarcode, MapPin, Box, CheckCircle2,
} from 'lucide-react'
import { useState } from 'react'

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/recibir', label: 'Recibir USA', icon: ScanBarcode, exact: false },
  { href: '/admin/cajas', label: 'Cajas USA', icon: Box, exact: false },
  { href: '/admin/recibir-colombia', label: 'Recibir Colombia', icon: MapPin, exact: false },
  { href: '/admin/listos-entrega', label: 'Listos para entrega', icon: CheckCircle2, exact: false },
  { href: '/admin/paquetes', label: 'Paquetes', icon: Package, exact: false },
  { href: '/admin/clientes', label: 'Clientes', icon: Users, exact: false },
  { href: '/admin/tarifas', label: 'Tarifas', icon: DollarSign, exact: false },
]

const tw = 'rgba(255,255,255,'

export default function NavAdmin({ nombreAdmin }: { nombreAdmin: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function isActive(item: { href: string; exact: boolean }) {
    if (item.exact) return pathname === item.href
    return pathname === item.href || pathname.startsWith(item.href + '/')
  }

  const NavLinks = () => (
    <nav className="flex-1 px-3 py-4 space-y-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
        const active = isActive({ href, exact })
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={active ? {
              background: 'rgba(245,184,0,0.12)',
              color: '#F5B800',
              border: '1px solid rgba(245,184,0,0.2)',
            } : {
              color: `${tw}0.55)`,
              border: '1px solid transparent',
            }}
            onMouseEnter={e => {
              if (!active) {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'
                ;(e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.9)'
              }
            }}
            onMouseLeave={e => {
              if (!active) {
                (e.currentTarget as HTMLElement).style.background = ''
                ;(e.currentTarget as HTMLElement).style.color = `${tw}0.55)`
              }
            }}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            {label}
          </Link>
        )
      })}
    </nav>
  )

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-16" style={{ borderBottom: `1px solid ${tw}0.07)` }}>
        <ShieldCheck className="h-6 w-6 flex-shrink-0" style={{ color: '#F5B800' }} />
        <div>
          <p className="text-white font-bold text-sm leading-none">CeladaShopper</p>
          <p className="text-xs mt-0.5 font-medium" style={{ color: '#F5B800', opacity: 0.8 }}>Panel Admin</p>
        </div>
      </div>

      <NavLinks />

      {/* Footer */}
      <div className="px-3 py-4 space-y-2" style={{ borderTop: `1px solid ${tw}0.07)` }}>
        <Link
          href="/dashboard"
          className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition-all"
          style={{ color: `${tw}0.35)` }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)'
            ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.color = `${tw}0.35)`
            ;(e.currentTarget as HTMLElement).style.background = ''
          }}
        >
          Ver portal cliente
        </Link>
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">{nombreAdmin}</p>
            <p className="text-xs" style={{ color: `${tw}0.35)` }}>Administrador</p>
          </div>
          <button
            onClick={handleLogout}
            className="transition-colors p-1 rounded-lg"
            style={{ color: `${tw}0.35)` }}
            title="Cerrar sesión"
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.8)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = `${tw}0.35)`}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )

  const sidebarBg = {
    background: 'rgba(8,8,20,0.7)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderRight: `1px solid ${tw}0.07)`,
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 flex-shrink-0" style={sidebarBg}>
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 h-14 flex items-center px-4 gap-3" style={sidebarBg}>
        <button onClick={() => setOpen(!open)} style={{ color: `${tw}0.7)` }}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <ShieldCheck className="h-5 w-5" style={{ color: '#F5B800' }} />
        <span className="text-white font-bold text-sm">Admin</span>
      </div>

      {/* Mobile drawer overlay */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-20" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <aside
            className="absolute left-0 top-0 bottom-0 w-56 flex flex-col"
            style={sidebarBg}
            onClick={e => e.stopPropagation()}
          >
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Mobile top spacer */}
      <div className="lg:hidden h-14 flex-shrink-0" />
    </>
  )
}
