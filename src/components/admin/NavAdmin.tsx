'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, Package, Users, DollarSign,
  LogOut, ShieldCheck, Menu, X, ScanBarcode, MapPin, Box, CheckCircle2,
} from 'lucide-react'
import { useState } from 'react'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  exact: boolean
  badgeKey?: string
}

const NAV_SECTIONS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'Flujo',
    items: [
      { href: '/admin',                 label: 'Dashboard',          icon: LayoutDashboard, exact: true  },
      { href: '/admin/recibir',         label: 'Recibir en USA',     icon: ScanBarcode,     exact: false },
      { href: '/admin/cajas',           label: 'Cajas USA',          icon: Box,             exact: false },
      { href: '/admin/recibir-colombia',label: 'Recibir Colombia',   icon: MapPin,          exact: false },
      { href: '/admin/listos-entrega',  label: 'Listos entrega',     icon: CheckCircle2,    exact: false, badgeKey: 'listosEntrega' },
    ],
  },
  {
    label: 'Gestión',
    items: [
      { href: '/admin/paquetes',  label: 'Paquetes', icon: Package,    exact: false },
      { href: '/admin/clientes',  label: 'Clientes', icon: Users,      exact: false },
      { href: '/admin/tarifas',   label: 'Tarifas',  icon: DollarSign, exact: false },
    ],
  },
]

const tw = 'rgba(255,255,255,'

export default function NavAdmin({
  nombreAdmin,
  badges = {},
}: {
  nombreAdmin: string
  badges?: Record<string, number>
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function isActive(item: Pick<NavItem, 'href' | 'exact'>) {
    if (item.exact) return pathname === item.href
    return pathname === item.href || pathname.startsWith(item.href + '/')
  }

  const NavLinks = () => (
    <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
      {NAV_SECTIONS.map(section => (
        <div key={section.label}>
          <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest select-none"
            style={{ color: `${tw}0.18)` }}>
            {section.label}
          </p>
          <div className="space-y-0.5">
            {section.items.map(({ href, label, icon: Icon, exact, badgeKey }) => {
              const active = isActive({ href, exact })
              const badge = badgeKey ? (badges[badgeKey] ?? 0) : 0
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={[
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all border',
                    active
                      ? 'border-[rgba(245,184,0,0.22)] bg-[rgba(245,184,0,0.1)] text-[#F5B800]'
                      : 'border-transparent text-white/55 hover:text-white/90 hover:bg-white/[0.06]',
                  ].join(' ')}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1 truncate">{label}</span>
                  {badge > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none tabular-nums"
                      style={{ background: 'rgba(245,184,0,0.2)', color: '#F5B800' }}>
                      {badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2.5 px-4 h-16 flex-shrink-0"
        style={{ borderBottom: `1px solid ${tw}0.07)` }}>
        <ShieldCheck className="h-6 w-6 flex-shrink-0" style={{ color: '#F5B800' }} />
        <div>
          <p className="text-white font-bold text-sm leading-none">CeladaShopper</p>
          <p className="text-xs mt-0.5 font-medium" style={{ color: '#F5B800', opacity: 0.75 }}>Panel Admin</p>
        </div>
      </div>

      <NavLinks />

      <div className="px-3 py-4 space-y-1.5 flex-shrink-0" style={{ borderTop: `1px solid ${tw}0.07)` }}>
        <Link
          href="/dashboard?as=client"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition-all text-white/35 hover:text-white/70 hover:bg-white/[0.06]"
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
            title="Cerrar sesión"
            className="p-1.5 rounded-lg transition-colors text-white/35 hover:text-white/80 hover:bg-white/[0.06]"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )

  const sidebarStyle = {
    background: 'rgba(8,8,20,0.7)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderRight: `1px solid ${tw}0.07)`,
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 flex-shrink-0" style={sidebarStyle}>
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 h-14 flex items-center px-4 gap-3" style={sidebarStyle}>
        <button onClick={() => setOpen(!open)} className="text-white/70">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <ShieldCheck className="h-5 w-5" style={{ color: '#F5B800' }} />
        <span className="text-white font-bold text-sm">Admin</span>
        {(badges.listosEntrega ?? 0) > 0 && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none"
            style={{ background: 'rgba(245,184,0,0.2)', color: '#F5B800' }}>
            {badges.listosEntrega}
          </span>
        )}
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-20" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <aside
            className="absolute left-0 top-0 bottom-0 w-56 flex flex-col"
            style={sidebarStyle}
            onClick={e => e.stopPropagation()}
          >
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Mobile spacer */}
      <div className="lg:hidden h-14 flex-shrink-0" />
    </>
  )
}
