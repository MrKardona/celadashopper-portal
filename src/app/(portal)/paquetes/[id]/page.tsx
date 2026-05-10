import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Package, MapPin, DollarSign, Scale } from 'lucide-react'
import {
  ESTADO_LABELS, CATEGORIA_LABELS,
  type EstadoPaquete, type CategoriaProducto
} from '@/types'
import { fechaHoraLarga } from '@/lib/fecha'
import { FadeUp, FadeUpScroll } from '@/components/portal/AnimateIn'
import { FotoGaleria } from '@/components/portal/FotoGaleria'

const ESTADOS_ORDEN: EstadoPaquete[] = [
  'reportado', 'recibido_usa', 'en_consolidacion', 'listo_envio',
  'en_transito', 'en_colombia', 'en_bodega_local', 'en_camino_cliente', 'entregado'
]

const ESTADO_BADGE: Record<string, { bg: string; color: string; border: string }> = {
  recibido:           { bg: 'rgba(99,130,255,0.12)',  color: '#8899ff', border: 'rgba(99,130,255,0.25)' },
  reportado:          { bg: 'rgba(99,130,255,0.12)',  color: '#8899ff', border: 'rgba(99,130,255,0.25)' },
  recibido_usa:       { bg: 'rgba(99,130,255,0.12)',  color: '#8899ff', border: 'rgba(99,130,255,0.25)' },
  en_consolidacion:   { bg: 'rgba(99,130,255,0.12)',  color: '#8899ff', border: 'rgba(99,130,255,0.25)' },
  listo_envio:        { bg: 'rgba(99,130,255,0.12)',  color: '#8899ff', border: 'rgba(99,130,255,0.25)' },
  en_transito:        { bg: 'rgba(245,184,0,0.12)',   color: '#F5B800', border: 'rgba(245,184,0,0.3)'   },
  en_colombia:        { bg: 'rgba(245,184,0,0.12)',   color: '#F5B800', border: 'rgba(245,184,0,0.3)'   },
  en_bodega_local:    { bg: 'rgba(245,184,0,0.12)',   color: '#F5B800', border: 'rgba(245,184,0,0.3)'   },
  en_camino_cliente:  { bg: 'rgba(52,211,153,0.12)',  color: '#34d399', border: 'rgba(52,211,153,0.3)'  },
  entregado:          { bg: 'rgba(52,211,153,0.12)',  color: '#34d399', border: 'rgba(52,211,153,0.3)'  },
  devuelto:           { bg: 'rgba(239,68,68,0.12)',   color: '#f87171', border: 'rgba(239,68,68,0.25)'  },
  retenido:           { bg: 'rgba(245,184,0,0.12)',   color: '#F5B800', border: 'rgba(245,184,0,0.3)'   },
}

const tw = 'rgba(255,255,255,'

export default async function DetallePaquetePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [paqueteRes, fotosRes, eventosRes] = await Promise.all([
    supabase.from('paquetes').select('*').eq('id', id).eq('cliente_id', user!.id).eq('visible_cliente', true).maybeSingle(),
    supabase.from('fotos_paquetes').select('*').eq('paquete_id', id).order('created_at'),
    supabase.from('eventos_paquete').select('*').eq('paquete_id', id).order('created_at', { ascending: false }),
  ])

  const paquete = paqueteRes.data
  if (!paquete) notFound()

  paquete.fotos_paquetes  = fotosRes.data ?? []
  paquete.eventos_paquete = eventosRes.data ?? []

  const estadoActualIdx = ESTADOS_ORDEN.indexOf(paquete.estado as EstadoPaquete)
  const esProblema      = ['retenido', 'devuelto'].includes(paquete.estado)
  const badge           = ESTADO_BADGE[paquete.estado] ?? { bg: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: 'rgba(255,255,255,0.12)' }

  return (
    <div className="max-w-2xl mx-auto space-y-5" style={{ fontFamily: "'Outfit', sans-serif" }}>

      {/* Header */}
      <FadeUp>
        <div className="flex items-center gap-3">
          <Link
            href="/paquetes"
            className="flex items-center justify-center w-9 h-9 rounded-xl transition-all"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <ArrowLeft className="h-4 w-4" style={{ color: `${tw}0.7)` }} />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white truncate">{paquete.descripcion}</h1>
            <p className="text-sm" style={{ color: `${tw}0.45)` }}>{paquete.tienda}</p>
          </div>
        </div>
      </FadeUp>

      {/* Estado actual */}
      <FadeUp delay={0.08}>
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold px-3 py-1.5 rounded-full"
              style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
              {ESTADO_LABELS[paquete.estado as EstadoPaquete] ?? paquete.estado}
            </span>
            <span className="text-xs font-mono" style={{ color: `${tw}0.35)` }}>{paquete.tracking_casilla}</span>
          </div>

          {!esProblema && (
            <div className="space-y-3">
              <div className="flex justify-between text-xs" style={{ color: `${tw}0.35)` }}>
                <span>Reportado</span>
                <span>En tránsito</span>
                <span>Entregado</span>
              </div>
              <div className="flex gap-1">
                {ESTADOS_ORDEN.map((estado, idx) => (
                  <div
                    key={estado}
                    className="h-2 flex-1 rounded-full transition-colors"
                    style={{
                      background: idx <= estadoActualIdx
                        ? (idx === estadoActualIdx ? '#F5B800' : 'rgba(245,184,0,0.5)')
                        : 'rgba(255,255,255,0.07)',
                    }}
                  />
                ))}
              </div>
              <div className="text-xs text-center" style={{ color: `${tw}0.35)` }}>
                Paso {estadoActualIdx + 1} de {ESTADOS_ORDEN.length}
              </div>
            </div>
          )}
        </div>
      </FadeUp>

      {/* Fotos */}
      {paquete.fotos_paquetes && paquete.fotos_paquetes.length > 0 && (
        <FadeUpScroll>
          <div className="glass-card overflow-hidden">
            <div className="px-5 py-4" style={{ borderBottom: `1px solid ${tw}0.07)` }}>
              <h2 className="font-semibold text-white">📷 Fotos del paquete</h2>
            </div>
            <FotoGaleria fotos={paquete.fotos_paquetes} />
          </div>
        </FadeUpScroll>
      )}

      {/* Información del pedido */}
      <FadeUpScroll>
        <div className="glass-card overflow-hidden">
          <div className="px-5 py-4" style={{ borderBottom: `1px solid ${tw}0.07)` }}>
            <h2 className="font-semibold text-white">Información del pedido</h2>
          </div>
          <div className="p-5 space-y-4">

            <InfoRow icon={<Package className="h-4 w-4" style={{ color: `${tw}0.4)` }} />}
              label="Categoría" value={CATEGORIA_LABELS[paquete.categoria as CategoriaProducto]} />

            {paquete.tracking_origen && (
              <InfoRow icon={<Package className="h-4 w-4" style={{ color: `${tw}0.4)` }} />}
                label="Tracking original" value={paquete.tracking_origen} mono />
            )}

            {paquete.tracking_usaco && (
              <div className="flex items-start gap-3 p-3 rounded-xl"
                style={{ background: 'rgba(245,184,0,0.07)', border: '1px solid rgba(245,184,0,0.18)' }}>
                <span className="text-base mt-0.5">🚛</span>
                <div>
                  <dt className="text-xs font-medium" style={{ color: '#F5B800' }}>Aguja de transporte · USACO</dt>
                  <dd className="text-sm font-mono font-semibold text-white mt-0.5">{paquete.tracking_usaco}</dd>
                </div>
              </div>
            )}

            <InfoRow icon={<MapPin className="h-4 w-4" style={{ color: `${tw}0.4)` }} />}
              label="Ciudad destino" value={paquete.bodega_destino} capitalize />

            {paquete.peso_libras && (
              <InfoRow icon={<Scale className="h-4 w-4" style={{ color: `${tw}0.4)` }} />}
                label="Peso" value={`${paquete.peso_libras} lbs`} />
            )}

            {paquete.valor_declarado && (
              <InfoRow icon={<DollarSign className="h-4 w-4" style={{ color: `${tw}0.4)` }} />}
                label="Valor declarado" value={`$${paquete.valor_declarado} USD`} />
            )}

            {paquete.costo_servicio && (
              <div className="flex items-start gap-3 p-4 rounded-xl"
                style={{ background: 'rgba(245,184,0,0.08)', border: '1px solid rgba(245,184,0,0.2)' }}>
                <DollarSign className="h-4 w-4 mt-0.5" style={{ color: '#F5B800' }} />
                <div>
                  <dt className="text-xs font-medium" style={{ color: '#F5B800' }}>Costo del servicio</dt>
                  <dd className="text-xl font-bold text-white">${paquete.costo_servicio.toFixed(2)} USD</dd>
                  {!paquete.factura_pagada && (
                    <dd className="text-xs mt-0.5" style={{ color: '#f87171' }}>Pendiente de pago</dd>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </FadeUpScroll>

      {/* Historial */}
      {paquete.eventos_paquete && paquete.eventos_paquete.length > 0 && (
        <FadeUpScroll delay={0.05}>
          <div className="glass-card overflow-hidden">
            <div className="px-5 py-4" style={{ borderBottom: `1px solid ${tw}0.07)` }}>
              <h2 className="font-semibold text-white">Historial de movimientos</h2>
            </div>
            <div className="p-5 space-y-3">
              {[...paquete.eventos_paquete].reverse().map((evento: any) => (
                <div key={evento.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: '#F5B800' }} />
                    <div className="w-px flex-1 mt-1" style={{ background: `${tw}0.08)` }} />
                  </div>
                  <div className="pb-3">
                    <p className="text-sm font-medium text-white">
                      {ESTADO_LABELS[evento.estado_nuevo as EstadoPaquete]}
                    </p>
                    {evento.descripcion && (
                      <p className="text-xs mt-0.5" style={{ color: `${tw}0.5)` }}>{evento.descripcion}</p>
                    )}
                    <p className="text-xs mt-0.5" style={{ color: `${tw}0.3)` }}>
                      {fechaHoraLarga(evento.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </FadeUpScroll>
      )}

    </div>
  )
}

function InfoRow({ icon, label, value, mono, capitalize }: {
  icon: React.ReactNode
  label: string
  value: string
  mono?: boolean
  capitalize?: boolean
}) {
  const tw = 'rgba(255,255,255,'
  return (
    <div className="flex items-start gap-3">
      {icon}
      <div>
        <dt className="text-xs" style={{ color: `${tw}0.4)` }}>{label}</dt>
        <dd className={`text-sm font-medium text-white ${mono ? 'font-mono' : ''} ${capitalize ? 'capitalize' : ''}`}>
          {value}
        </dd>
      </div>
    </div>
  )
}
