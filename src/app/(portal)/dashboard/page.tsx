export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  Package, PlusCircle, Truck, CheckCircle, Clock,
  MessageCircle, MapPin, ChevronRight,
} from 'lucide-react'
import { ESTADO_LABELS, ESTADO_COLORES, type EstadoPaquete } from '@/types'
import { FadeUp, FadeUpScroll, StaggerGrid, StaggerGridScroll, StaggerItem, StaggerItemMount } from '@/components/portal/AnimateIn'

/* ── Badge de estado ── */
function EstadoBadge({ estado }: { estado: EstadoPaquete }) {
  const colores: Record<string, { bg: string; color: string; border: string }> = {
    recibido:           { bg: 'rgba(99,130,255,0.12)',  color: '#8899ff', border: 'rgba(99,130,255,0.25)' },
    en_transito:        { bg: 'rgba(245,184,0,0.12)',   color: '#F5B800', border: 'rgba(245,184,0,0.3)'   },
    en_colombia:        { bg: 'rgba(245,184,0,0.12)',   color: '#F5B800', border: 'rgba(245,184,0,0.3)'   },
    en_bodega_local:    { bg: 'rgba(245,184,0,0.12)',   color: '#F5B800', border: 'rgba(245,184,0,0.3)'   },
    en_camino_cliente:  { bg: 'rgba(52,211,153,0.12)',  color: '#34d399', border: 'rgba(52,211,153,0.3)'  },
    entregado:          { bg: 'rgba(52,211,153,0.12)',  color: '#34d399', border: 'rgba(52,211,153,0.3)'  },
    devuelto:           { bg: 'rgba(239,68,68,0.12)',   color: '#f87171', border: 'rgba(239,68,68,0.25)'  },
  }
  const c = colores[estado] ?? { bg: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: 'rgba(255,255,255,0.12)' }
  return (
    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
      style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {ESTADO_LABELS[estado] ?? estado}
    </span>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: perfil } = await supabase
    .from('perfiles').select('*').eq('id', user!.id).single()

  const { data: paquetes } = await supabase
    .from('paquetes').select('*').eq('cliente_id', user!.id)
    .is('paquete_origen_id', null)   // excluir divisiones
    .order('created_at', { ascending: false }).limit(5)

  const { data: todos } = await supabase
    .from('paquetes').select('estado').eq('cliente_id', user!.id)
    .is('paquete_origen_id', null)   // excluir divisiones de los contadores

  const stats = {
    total:       todos?.length ?? 0,
    activos:     todos?.filter(p => !['entregado','devuelto'].includes(p.estado)).length ?? 0,
    en_transito: todos?.filter(p => ['en_transito','en_colombia','en_bodega_local','en_camino_cliente'].includes(p.estado)).length ?? 0,
    entregados:  todos?.filter(p => p.estado === 'entregado').length ?? 0,
  }

  const nombre = perfil?.nombre_completo && perfil.nombre_completo !== perfil.email
    ? perfil.nombre_completo.split(' ')[0]
    : null

  const tw = 'rgba(255,255,255,'

  return (
    <div className="space-y-6" style={{ fontFamily: "'Outfit', sans-serif" }}>

      {/* ── Bienvenida ── */}
      <FadeUp delay={0}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">
              Hola{nombre ? `, ${nombre}` : ''} <span aria-hidden>👋</span>
            </h1>
            <p style={{ color: `${tw}0.5)` }} className="mt-1 text-sm">
              {perfil?.numero_casilla
                ? <>Tu casillero es: <span className="font-bold" style={{ color: '#F5B800' }}>{perfil.numero_casilla}</span></>
                : 'Bienvenido a CeladaShopper'}
            </p>
          </div>
          <Link
            href="/reportar"
            className="btn-gold inline-flex items-center gap-2 px-5 py-2.5 text-sm rounded-xl font-bold"
          >
            <PlusCircle className="h-4 w-4" />
            Reportar pedido
          </Link>
        </div>
      </FadeUp>

      {/* ── Alertas ── */}
      {!perfil?.whatsapp && (
        <FadeUp delay={0.08}>
          <div className="glass-card p-4 flex items-start gap-3"
            style={{ borderColor: 'rgba(245,184,0,0.2)', background: 'rgba(245,184,0,0.05)' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(245,184,0,0.15)' }}>
              <MessageCircle className="h-4 w-4" style={{ color: '#F5B800' }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Agrega tu WhatsApp para notificaciones</p>
              <p className="text-xs mt-0.5 leading-relaxed" style={{ color: `${tw}0.5)` }}>
                Te avisamos cuando tu paquete llegue a Miami, esté en tránsito y listo para entrega.
              </p>
              <Link href="/perfil" className="text-xs font-semibold mt-1.5 inline-block" style={{ color: '#F5B800' }}>
                Agregar WhatsApp →
              </Link>
            </div>
          </div>
        </FadeUp>
      )}

      {!perfil?.direccion && (
        <FadeUp delay={0.12}>
          <div className="glass-card p-4 flex items-start gap-3"
            style={{ borderColor: 'rgba(99,130,255,0.2)', background: 'rgba(99,130,255,0.05)' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(99,130,255,0.15)' }}>
              <MapPin className="h-4 w-4" style={{ color: '#8899ff' }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Agrega tu dirección de entrega</p>
              <p className="text-xs mt-0.5 leading-relaxed" style={{ color: `${tw}0.5)` }}>
                Necesitamos saber dónde entregarte tus paquetes en Colombia.
              </p>
              <Link href="/perfil" className="text-xs font-semibold mt-1.5 inline-block" style={{ color: '#8899ff' }}>
                Completar dirección →
              </Link>
            </div>
          </div>
        </FadeUp>
      )}

      {/* ── Stats ── */}
      <StaggerGrid className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total',       value: stats.total,       icon: Package,     iconClass: 'stat-icon-white', iconColor: `${tw}0.7)` },
          { label: 'En proceso',  value: stats.activos,     icon: Clock,       iconClass: 'stat-icon-blue',  iconColor: '#8899ff'   },
          { label: 'En tránsito', value: stats.en_transito, icon: Truck,       iconClass: 'stat-icon-gold',  iconColor: '#F5B800'   },
          { label: 'Entregados',  value: stats.entregados,  icon: CheckCircle, iconClass: 'stat-icon-green', iconColor: '#34d399'   },
        ].map(({ label, value, icon: Icon, iconClass, iconColor }, i) => (
          <StaggerItemMount key={label} index={i}>
            <div className="glass-card p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconClass}`}>
                <Icon className="h-5 w-5" style={{ color: iconColor }} />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-xs" style={{ color: `${tw}0.45)` }}>{label}</p>
              </div>
            </div>
          </StaggerItemMount>
        ))}
      </StaggerGrid>

      {/* ── Paquetes recientes ── */}
      <FadeUpScroll delay={0}>
        <div className="glass-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <h2 className="font-semibold text-white">Paquetes recientes</h2>
            <Link href="/paquetes" className="text-xs font-semibold" style={{ color: '#F5B800' }}>Ver todos →</Link>
          </div>
          {!paquetes || paquetes.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-10 w-10 mx-auto mb-3" style={{ color: `${tw}0.2)` }} />
              <p className="text-sm" style={{ color: `${tw}0.4)` }}>No tienes paquetes reportados aún</p>
              <Link href="/reportar" className="btn-gold inline-flex items-center gap-2 px-4 py-2 text-sm rounded-xl mt-4">
                <PlusCircle className="h-4 w-4" /> Reportar primer pedido
              </Link>
            </div>
          ) : (
            <StaggerGridScroll>
              {paquetes.map((paquete, i) => (
                <StaggerItem key={paquete.id} index={i}>
                  <Link
                    href={`/paquetes/${paquete.id}`}
                    className="flex items-center justify-between px-5 py-3.5 transition-all group"
                    style={{
                      borderBottom: i < paquetes.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate group-hover:text-yellow-300 transition-colors">
                        {paquete.descripcion}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs" style={{ color: `${tw}0.4)` }}>{paquete.tienda}</span>
                        {paquete.tracking_origen && (
                          <>
                            <span style={{ color: `${tw}0.2)` }}>·</span>
                            <span className="text-xs font-mono" style={{ color: `${tw}0.35)` }}>{paquete.tracking_origen}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      <EstadoBadge estado={paquete.estado as EstadoPaquete} />
                      <ChevronRight className="h-3.5 w-3.5" style={{ color: `${tw}0.2)` }} />
                    </div>
                  </Link>
                </StaggerItem>
              ))}
            </StaggerGridScroll>
          )}
        </div>
      </FadeUpScroll>

      {/* ── Dirección bodega USA ── */}
      <FadeUpScroll delay={0.05}>
        <div className="glass-card-gold overflow-hidden">
          <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(245,184,0,0.12)' }}>
            <h2 className="font-semibold text-white flex items-center gap-2">
              <span>📦</span> Tu dirección en USA
            </h2>
            <p className="text-xs mt-0.5" style={{ color: `${tw}0.45)` }}>
              Copia estos datos al hacer compras en tiendas americanas.
            </p>
          </div>

          {!perfil?.numero_casilla && (
            <div className="mx-5 mt-4 px-4 py-3 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(245,184,0,0.08)', border: '1px solid rgba(245,184,0,0.2)', color: '#F5B800' }}>
              ⏳ Tu casillero está siendo asignado. Te avisamos cuando esté listo.
            </div>
          )}

          <div className="divide-y mx-5 my-4 rounded-xl overflow-hidden"
            style={{ border: '1px solid rgba(245,184,0,0.15)' }}>
            {[
              { label: '👤 Nombre / Recipient', value: `Diego Celada${perfil?.numero_casilla ? ` ${perfil.numero_casilla}` : ''}`, note: 'Tu nombre + número de casillero' },
              { label: '🏠 Dirección / Address', value: '8164 NW 108th Pl', note: 'Bodega en Miami' },
              { label: '🏙️ Ciudad / City, State, ZIP', value: 'Doral, FL 33178', note: 'Ciudad: Doral · Estado: FL · ZIP: 33178' },
              { label: '🌎 País / Country', value: 'United States', note: '' },
              { label: '📞 Teléfono / Phone', value: '+1 (786) 000-0000', note: '' },
            ].map(({ label, value, note }) => (
              <div key={label} className="px-4 py-3" style={{ background: 'rgba(0,0,0,0.2)' }}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: `${tw}0.35)` }}>{label}</p>
                <p className="font-bold font-mono" style={{ color: '#F5B800' }}>{value}</p>
                {note && <p className="text-xs mt-0.5" style={{ color: `${tw}0.35)` }}>{note}</p>}
              </div>
            ))}
          </div>

          <div className="mx-5 mb-5 p-4 rounded-xl space-y-2 text-sm"
            style={{ background: 'rgba(245,184,0,0.05)', border: '1px solid rgba(245,184,0,0.12)' }}>
            <p className="font-bold text-white">⚠️ ¿Cómo usar esta dirección?</p>
            {[
              <>En el campo <strong style={{ color: '#F5B800' }}>Nombre / Recipient</strong>: <span className="font-mono">Diego Celada {perfil?.numero_casilla ?? '[casillero]'}</span></>,
              'Copia dirección, ciudad, estado y ZIP exactamente como aparecen arriba.',
              <>Después de comprar, <strong style={{ color: '#F5B800' }}>repórtanos el pedido</strong> para rastrearlo.</>,
            ].map((text, i) => (
              <div key={i} className="flex gap-2 items-start">
                <span className="w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: '#F5B800', color: '#000' }}>{i + 1}</span>
                <p style={{ color: `${tw}0.7)` }}>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </FadeUpScroll>

    </div>
  )
}
