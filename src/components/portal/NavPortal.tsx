'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Package, LayoutDashboard, PlusCircle, LogOut, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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

  const navItems = [
    { href: '/dashboard', label: 'Mi Panel', icon: LayoutDashboard },
    { href: '/reportar', label: 'Reportar Pedido', icon: PlusCircle },
    { href: '/paquetes', label: 'Mis Paquetes', icon: Package },
  ]

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2 text-orange-600 font-bold">
              <Package className="h-6 w-6" />
              <span className="hidden sm:block">CeladaShopper</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    pathname === href
                      ? 'bg-orange-50 text-orange-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {perfil?.numero_casilla && (
              <Badge variant="outline" className="hidden sm:flex border-orange-300 text-orange-700">
                Casilla: {perfil.numero_casilla}
              </Badge>
            )}
            <span className="hidden sm:block text-sm text-gray-600 truncate max-w-[150px]">
              {perfil?.nombre_completo?.split(' ')[0]}
            </span>
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Cerrar sesión">
              <LogOut className="h-4 w-4 text-gray-500" />
            </Button>
          </div>
        </div>

        {/* Nav movil */}
        <nav className="md:hidden flex gap-1 pb-2 overflow-x-auto">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                pathname === href
                  ? 'bg-orange-50 text-orange-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
