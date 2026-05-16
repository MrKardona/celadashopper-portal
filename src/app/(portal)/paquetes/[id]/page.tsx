import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ChevronLeft, ChevronRight, Package, MapPin, DollarSign, Scale } from 'lucide-react'
import {
  ESTADO_LABELS, CATEGORIA_LABELS,
  type EstadoPaquete, type CategoriaProducto
} from '@/types'
import { fechaHoraLarga } from '@/lib/fecha'
import { FadeUp, FadeUpScroll } from '@/components/portal/AnimateIn'
import { FotoGaleria } from '@/components/portal/FotoGaleria'
import { TrackingTimeline } from '@/components/paquetes/TrackingTimeline'

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

// Mismos mapeos que paquetes/page.tsx — para sincronizar el badge con el tracker
const PASO_ESTADOS: Record<string, number> = {
  reportado:         0,
  recibido_usa:      1,
  retenido:          1,
  en_consolidacion:  2,
  listo_envio:       2,
  en_transito:       4,
  en_colombia:       6,
  llego_colombia:    6,
  en_bodega_local:   7,
  listo_entrega:     7,
  en_camino_cliente: 7,
  entregado:         8,
  devuelto:          8,
}
const USACO_A_PASO: Record<string, number> = {
  GuiaCreadaColaborador: 3,
  TransitoInternacional: 4,
  ProcesoDeAduana:       5,
  BodegaDestino:         6,
  EnRuta:                7,
  'En ruta transito':    7,
  EnTransportadora:      7,
  EntregaFallida:        7,
  Entregado:             8,
}
const PASO_BADGE: Record<number, { bg: string; color: string; border: string }> = {
  0: { bg: 'rgba(99,130,255,0.12)',  color: '#8899ff', border: 'rgba(99,130,255,0.25)' },
  1: { bg: 'rgba(99,130,255,0.12)',  color: '#8899ff', border: 'rgba(99,130,255,0.25)' },
  2: { bg: 'rgba(99,130,255,0.12)',  color: '#8899ff', border: 'rgba(99,130,255,0.25)' },
  3: { bg: 'rgba(245,184,0,0.12)',   color: '#F5B800', border: 'rgba(245,184,0,0.3)'   },
  4: { bg: 'rgba(245,184,0,0.12)',   color: '#F5B800', border: 'rgba(245,184,0,0.3)'   },
  5: { bg: 'rgba(245,184,0,0.12)',   color: '#F5B800', border: 'rgba(245,184,0,0.3)'   },
  6: { bg: 'rgba(245,184,0,0.12)',   color: '#F5B800', border: 'rgba(245,184,0,0.3)'   },
  7: { bg: 'rgba(52,211,153,0.12)',  color: '#34d399', border: 'rgba(52,211,153,0.3)'  },
  8: { bg: 'rgba(52,211,153,0.12)',  color: '#34d399', border: 'rgba(52,211,153,0.3)'  },
}

const tw = 'rgba(255,255,255,'

export default async function DetallePaquetePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [paqueteRes, fotosRes, eventosRes, trackingRes] = await Promise.all([
    supabase.from('paquetes').select('*').eq('id', id).eq('cliente_id', user!.id).eq('visible_cliente', true).maybeSingle(),
    supabase.from('fotos_paquetes').select('*').eq('paquete_id', id).order('created_at'),
    supabase.from('eventos_paquete').select('*').eq('paquete_id', id).order('created_at', { ascending: false }),
    supabase.from('paquetes_tracking').select('id, evento, descripcion, fecha, fuente').eq('paquete_id', id).order('fecha'),
  ])

  const paquete = paqueteRes.data
  if (!paquete) notFound()

  const todasLasFotos     = fotosRes.data ?? []
  // Separar foto(s) de entrega del resto de fotos del paquete
  const fotosEntrega      = todasLasFotos.filter(f => (f.descripcion ?? '').toLowerCase().includes('entrega'))
  const fotosRegulares    = todasLasFotos.filter(f => !(f.descripcion ?? '').toLowerCase().includes('entrega'))
  paquete.fotos_paquetes  = fotosRegulares
  paquete.eventos_paquete = eventosRes.data ?? []
  const trackingEventos   = trackingRes.data ?? []

  // Prev / next navigation (solo paquetes del mismo cliente, visibles)
  const [prevRes, nextRes] = await Promise.all([
    supabase.from('paquetes').select('id, descripcion').eq('cliente_id', user!.id).eq('visible_cliente', true)
      .gt('created_at', paquete.created_at).order('created_at', { ascending: true }).limit(1).maybeSingle(),
    supabase.from('paquetes').select('id, descripcion').eq('cliente_id', user!.id).eq('visible_cliente', true)
      .lt('created_at', paquete.created_at).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  const prevPaquete = prevRes.data
  const nextPaquete = nextRes.data

  const esProblema = ['retenido', 'devuelto'].includes(paquete.estado)

  // Paso efectivo — igual que la lista de paquetes
  const esMedellin  = !paquete.bodega_destino || paquete.bodega_destino === 'medellin'
  const PASO_LABEL  = esMedellin
    ? ['Reportado', 'En Miami', 'Procesado', 'Guía creada', 'En tránsito', 'En aduana', 'En Colombia', 'En bodega local', 'Entregado']
    : ['Reportado', 'En Miami', 'Procesado', 'Guía creada', 'En tránsito', 'En aduana', 'En Colombia', 'En ruta', 'Entregado']
  const pasoEstado  = PASO_ESTADOS[paquete.estado as string] ?? 0
  const pasoUsaco   = paquete.estado_usaco ? (USACO_A_PASO[paquete.estado_usaco as string] ?? 0) : 0
  const paso        = Math.max(pasoEstado, pasoUsaco)

  // Badge y label sincronizados con el paso efectivo
  const badge = esProblema
    ? (ESTADO_BADGE[paquete.estado] ?? { bg: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: 'rgba(255,255,255,0.12)' })
    : (PASO_BADGE[paso] ?? { bg: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: 'rgba(255,255,255,0.12)' })
  const labelBadge = esProblema
    ? (ESTADO_LABELS[paquete.estado as EstadoPaquete] ?? paquete.estado)
    : (PASO_LABEL[paso] ?? ESTADO_LABELS[paquete.estado as EstadoPaquete] ?? paquete.estado)

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

          {/* Navegación prev/next */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {prevPaquete ? (
              <Link
                href={`/paquetes/${prevPaquete.id}`}
                title={prevPaquete.descripcion ?? 'Paquete anterior'}
                className="flex items-center justify-center w-9 h-9 rounded-xl transition-all"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <ChevronLeft className="h-4 w-4" style={{ color: `${tw}0.7)` }} />
              </Link>
            ) : (
              <span className="flex items-center justify-center w-9 h-9 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <ChevronLeft className="h-4 w-4" style={{ color: `${tw}0.2)` }} />
              </span>
            )}
            {nextPaquete ? (
              <Link
                href={`/paquetes/${nextPaquete.id}`}
                title={nextPaquete.descripcion ?? 'Paquete siguiente'}
                className="flex items-center justify-center w-9 h-9 rounded-xl transition-all"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <ChevronRight className="h-4 w-4" style={{ color: `${tw}0.7)` }} />
              </Link>
            ) : (
              <span className="flex items-center justify-center w-9 h-9 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <ChevronRight className="h-4 w-4" style={{ color: `${tw}0.2)` }} />
              </span>
            )}
          </div>
        </div>
      </FadeUp>

      {/* Estado actual — solo badge; el tracker de 9 pasos vive en Seguimiento */}
      <FadeUp delay={0.08}>
        <div className="glass-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold px-3 py-1.5 rounded-full"
              style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
              {labelBadge}
            </span>
            {paquete.tracking_origen && (
              <span className="text-xs font-mono" style={{ color: `${tw}0.35)` }}>
                {paquete.tracking_origen}
              </span>
            )}
          </div>
        </div>
      </FadeUp>

      {/* Comprobante de entrega — foto tomada por el domiciliario */}
      {fotosEntrega.length > 0 && (
        <FadeUpScroll>
          <div className="glass-card overflow-hidden" style={{ borderColor: 'rgba(52,211,153,0.22)' }}>
            <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(52,211,153,0.12)', background: 'rgba(52,211,153,0.04)' }}>
              <span className="text-base">📸</span>
              <h2 className="font-semibold" style={{ color: '#34d399' }}>Comprobante de entrega</h2>
            </div>
            <FotoGaleria fotos={fotosEntrega} />
          </div>
        </FadeUpScroll>
      )}

      {/* Fotos del paquete (empaque / contenido — tomadas en bodega USA) */}
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


            {paquete.tracking_usaco && (
              <div className="flex items-start gap-3 p-3 rounded-xl"
                style={{ background: 'rgba(245,184,0,0.07)', border: '1px solid rgba(245,184,0,0.18)' }}>
                <span className="text-base mt-0.5">✈️</span>
                <div>
                  <dt className="text-xs font-medium" style={{ color: '#F5B800' }}>Guía de envío internacional</dt>
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

      {/* Seguimiento del paquete */}
      <FadeUpScroll delay={0.05}>
        <div className="glass-card overflow-hidden">
          <div className="px-5 py-4" style={{ borderBottom: `1px solid ${tw}0.07)` }}>
            <h2 className="font-semibold text-white">📍 Seguimiento del paquete</h2>
          </div>
          <div className="p-5">
            <TrackingTimeline eventos={trackingEventos} bodegaKey={paquete.bodega_destino ?? 'medellin'} estadoUsaco={paquete.estado_usaco} pasoMinimo={paso} />
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
