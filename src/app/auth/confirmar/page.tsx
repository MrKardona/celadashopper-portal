'use client'

import { Suspense, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Package } from 'lucide-react'

function Confirmar() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const code = searchParams.get('code')
    if (!code) {
      router.replace('/login?error=auth')
      return
    }

    const supabase = createClient()
    supabase.auth.exchangeCodeForSession(code).then(async ({ data, error }) => {
      if (error || !data.session) {
        router.replace('/login?error=auth')
        return
      }

      const { data: perfil } = await supabase
        .from('perfiles')
        .select('rol')
        .eq('id', data.session.user.id)
        .single()

      const rol = perfil?.rol ?? 'cliente'
      if (rol === 'admin') router.replace('/admin/paquetes')
      else if (rol === 'agente_usa') router.replace('/agente')
      else router.replace('/dashboard')
    })
  }, [router, searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-white">
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2 text-orange-600 mb-6">
          <Package className="h-7 w-7" />
          <span className="text-xl font-bold">CeladaShopper</span>
        </div>
        <div className="h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-gray-500">Verificando acceso...</p>
      </div>
    </div>
  )
}

export default function ConfirmarPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <Confirmar />
    </Suspense>
  )
}
