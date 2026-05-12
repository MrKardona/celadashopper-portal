'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Package, ClipboardList, User } from 'lucide-react'

const TABS = [
  { href: '/domiciliario',           label: 'Pendientes', icon: Package       },
  { href: '/domiciliario/historial', label: 'Historial',  icon: ClipboardList },
  { href: '/domiciliario/perfil',    label: 'Mi perfil',  icon: User          },
]

export default function DomiciliarioNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-20 flex"
      style={{
        background: 'rgba(8,8,20,0.92)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            className="flex-1 relative flex flex-col items-center justify-center gap-1 py-3 transition-colors"
            style={{ color: active ? '#818cf8' : 'rgba(255,255,255,0.35)' }}
          >
            {active && (
              <span
                className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-0.5 rounded-full"
                style={{ background: '#818cf8' }}
              />
            )}
            <Icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
