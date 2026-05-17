'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

const OPCIONES = [10, 50, 100]

function LimitSelectorInner({ actual }: { actual: number }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function cambiar(n: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('limite', String(n))
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs mr-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Mostrar</span>
      {OPCIONES.map(n => (
        <button
          key={n}
          onClick={() => cambiar(n)}
          className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-all"
          style={n === actual
            ? { background: 'rgba(245,184,0,0.15)', color: '#F5B800', border: '1px solid rgba(245,184,0,0.3)' }
            : { color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

export default function LimitSelector({ actual }: { actual: number }) {
  return (
    <Suspense>
      <LimitSelectorInner actual={actual} />
    </Suspense>
  )
}
