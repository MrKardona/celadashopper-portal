'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LogOut } from 'lucide-react'

export default function LogoutButton() {
  const router = useRouter()

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={logout}
      title="Cerrar sesión"
      className="p-2 rounded-xl text-white/35 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
    >
      <LogOut className="h-4 w-4" />
    </button>
  )
}
