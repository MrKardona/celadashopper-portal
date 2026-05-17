import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import NavPortal from '@/components/portal/NavPortal'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="portal-bg">
      <div className="portal-orb-gold" />
      <div className="portal-orb-blue" />
      <div className="portal-orb-mid" />
      <div className="relative z-10 flex flex-col min-h-screen">
        <NavPortal perfil={perfil} />
        <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
          {children}
        </main>
      </div>
    </div>
  )
}
