'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, Package, Users, DollarSign,
  LogOut, ShieldCheck, Menu, X
} from 'lucide-react'
import { useState } from 'react'

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/paquetes', label: 'Paquetes', icon: Package, exact: false },
  { href: '/admin/clientes', label: 'Clientes', icon: Users, exact: false },
  { href: '/admin/tarifas', label: 'Tarifas', icon: DollarSign, exact: false },
]

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
    return item.exact ? pathname === item.href : pathname.startsWith(item.href)
  }

  const NavLinks = () => (
    <nav className="flex-1 px-3 py-4 space-y-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => (
        <Link
          key={href}
          href={href}
          onClick={() => setOpen(false)}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            isActive({ href, exact })
              ? 'bg-orange-600 text-white'
              : 'text-slate-300 hover:bg-slate-700 hover:text-white'
          }`}
        >
          <Icon className="h-4 w-4 flex-shrink-0" />
          {label}
        </Link>
      ))}
    </nav>
  )

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 h-16 border-b border-slate-700">
        <ShieldCheck className="h-6 w-6 text-orange-500" />
        <div>
          <p className="text-white font-bold text-sm leading-none">CeladaShopper</p>
          <p className="text-orange-400 text-xs mt-0.5">Panel Admin</p>
        </div>
      </div>

      <NavLinks />

      {/* Footer */}
      <div className="px-3 py-4 border-t border-slate-700 space-y-2">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
        >
          Ver portal cliente
        </Link>
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">{nombreAdmin}</p>
            <p className="text-slate-400 text-xs">Administrador</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-slate-400 hover:text-white transition-colors p-1"
            title="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 bg-slate-800 flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-slate-800 h-14 flex items-center px-4 gap-3">
        <button onClick={() => setOpen(!open)} className="text-white">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <ShieldCheck className="h-5 w-5 text-orange-500" />
        <span className="text-white font-bold text-sm">Admin</span>
      </div>

      {/* Mobile drawer overlay */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-20" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <aside
            className="absolute left-0 top-0 bottom-0 w-56 bg-slate-800"
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
