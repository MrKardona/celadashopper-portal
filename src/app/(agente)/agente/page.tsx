import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AgentePanel from '@/components/agente/AgentePanel'

export default async function AgentePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (!perfil || !['agente_usa', 'admin'].includes(perfil.rol)) {
    redirect('/dashboard')
  }

  const { data: paquetes } = await supabase
    .from('paquetes')
    .select('*, perfiles(nombre_completo, numero_casilla, whatsapp)')
    .in('estado', ['reportado', 'recibido_usa', 'en_consolidacion', 'listo_envio'])
    .order('created_at', { ascending: true })

  const { data: tarifas } = await supabase
    .from('categorias_tarifas')
    .select('*')
    .eq('activo', true)

  return <AgentePanel paquetes={paquetes ?? []} tarifas={tarifas ?? []} agenteId={user.id} />
}
