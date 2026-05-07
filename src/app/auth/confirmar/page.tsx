'use client'

import { Suspense, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Package } from 'lucide-react'
import type { User } from '@supabase/supabase-js'

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
      // El callback ya hizo el intercambio server-side y estableció la sesión.
      // Solo necesitamos verificar el usuario y redirigir según su rol.
      supabase.auth.getUser().then(({ data, error }) => {
        if (error || !data.user) {
          router.replace('/login?error=auth')
          return
        }
        redirectByUser(data.user)
      })
      return
    }

    // Fallback: el callback no pudo hacer el intercambio server-side.
    // Intentamos browser-side (funciona si el usuario está en el mismo browser).
    supabase.auth.exchangeCodeForSession(code).then(async ({ data, error }) => {
      if (error || !data.session) {
        router.replace('/login?error=auth')
        return
      }
      redirectByUser(data.session.user)
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
