'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Package, CheckCircle, AlertCircle, AlertTriangle, MapPin } from 'lucide-react'
import Link from 'next/link'
import { CATEGORIA_LABELS, ESTADO_LABELS, type CategoriaProducto, type BodegaDestino, type EstadoPaquete } from '@/types'

const TIENDAS_USA = [
  'Amazon', 'Nike', 'Adidas', 'Shein', 'Sephora',
  'Fashion Nova', 'Apple Store', 'Best Buy', 'Target', 'Walmart',
]

const BODEGAS: { value: BodegaDestino; label: string }[] = [
  { value: 'medellin',    label: 'Medellín' },
  { value: 'bogota',      label: 'Bogotá' },
  { value: 'barranquilla', label: 'Barranquilla (celulares)' },
]

type DuplicadoPropio = { tipo: 'propio'; tracking_casilla: string; descripcion: string; estado: string }
type DuplicadoOtro   = { tipo: 'otro' }
type Duplicado = DuplicadoPropio | DuplicadoOtro | null

const tw = 'rgba(255,255,255,'

function GlassLabel({ children, htmlFor, required }: { children: React.ReactNode; htmlFor?: string; required?: boolean }) {
  return (
    <label
      htmlFor={htmlFor}
      className="flex items-center gap-1 text-sm font-medium mb-1.5"
      style={{ color: required ? `${tw}0.88)` : `${tw}0.7)` }}
    >
      {required && (
        <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#F5B800' }} />
      )}
      {children}
    </label>
  )
}

function GlassInput(props: React.InputHTMLAttributes<HTMLInputElement> & { hasError?: boolean }) {
  const { hasError, className = '', ...rest } = props
  return (
    <input
      {...rest}
      className={`glass-input w-full px-4 py-3 text-sm outline-none ${className}`}
      style={hasError
        ? { borderColor: 'rgba(245,184,0,0.5)' }
        : rest.required
          ? { borderColor: 'rgba(245,184,0,0.28)' }
          : {}}
    />
  )
}

function GlassTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = '', ...rest } = props
  return (
    <textarea
      {...rest}
      className={`glass-input w-full px-4 py-3 text-sm outline-none resize-none ${className}`}
    />
  )
}

function GlassSelect(props: React.SelectHTMLAttributes<HTMLSelectElement> & { placeholder?: string }) {
  const { placeholder, children, className = '', required, ...rest } = props
  return (
    <select
      {...rest}
      required={required}
      className={`glass-input select w-full px-4 py-3 text-sm outline-none ${className}`}
      style={required ? { borderColor: 'rgba(245,184,0,0.28)' } : {}}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {children}
    </select>
  )
}

export default function ReportarPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    tienda: '',
    tracking_origen: '',
    descripcion: '',
    categoria: '' as CategoriaProducto | '',
    condicion: '' as 'nuevo' | 'usado' | '',
    cantidad: '1',
    valor_declarado: '',
    fecha_compra: '',
    fecha_estimada_llegada: '',
    bodega_destino: 'medellin' as BodegaDestino,
    notas_cliente: '',
    requiere_consolidacion: false,
    notas_consolidacion: '',
  })
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [duplicado, setDuplicado] = useState<Duplicado>(null)
  const [exito, setExito]         = useState<{ tracking: string; match?: boolean } | null>(null)

  const [tiendaOtros, setTiendaOtros] = useState(false)

  const [cotizacion, setCotizacion] = useState<{
    subtotal_envio: number; seguro: number; total: number
    metodo: string; detalle: string; requiere_peso?: boolean; peso_minimo?: number
  } | null>(null)

  useEffect(() => {
    if (!form.categoria) { setCotizacion(null); return }
    const requiereCondicion = form.categoria === 'celular' || form.categoria === 'computador'
    if (requiereCondicion && !form.condicion) { setCotizacion(null); return }

    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      try {
        const res = await fetch('/api/portal/cotizar', {
          method: 'POST', signal: ctrl.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            categoria: form.categoria, condicion: form.condicion || null,
            cantidad: form.cantidad ? parseInt(form.cantidad, 10) || 1 : 1,
            valor_declarado: form.valor_declarado ? parseFloat(form.valor_declarado) : null,
          }),
        })
        if (res.ok) setCotizacion(await res.json())
      } catch { /* ignorar abort */ }
    }, 300)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [form.categoria, form.condicion, form.cantidad, form.valor_declarado])

  const [direccionPerfil, setDireccionPerfil] = useState<{
    direccion: string | null; barrio: string | null; referencia: string | null
  } | null>(null)
  const [direccionOpcion, setDireccionOpcion] = useState<'guardada' | 'otra'>('guardada')
  const [direccionOtra, setDireccionOtra] = useState({ direccion: '', barrio: '', referencia: '' })

  useEffect(() => {
    let cancelado = false
    async function cargarPerfil() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('perfiles')
        .select('direccion, barrio, referencia').eq('id', user.id).single()
      if (cancelado) return
      if (data) {
        setDireccionPerfil(data)
        if (!data.direccion) setDireccionOpcion('otra')
      }
    }
    cargarPerfil()
    return () => { cancelado = true }
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    if (e.target.name === 'tracking_origen') setDuplicado(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setDuplicado(null)

    if (!form.categoria) { setError('Selecciona el tipo de producto'); return }

    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const direccionPayload = direccionOpcion === 'otra'
      ? {
          direccion_entrega:   direccionOtra.direccion.trim() || null,
          barrio_entrega:      direccionOtra.barrio.trim() || null,
          referencia_entrega:  direccionOtra.referencia.trim() || null,
        }
      : {
          direccion_entrega:   direccionPerfil?.direccion ?? null,
          barrio_entrega:      direccionPerfil?.barrio ?? null,
          referencia_entrega:  direccionPerfil?.referencia ?? null,
        }

    const res = await fetch('/api/portal/reportar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tienda: form.tienda, tracking_origen: form.tracking_origen || null,
        descripcion: form.descripcion, categoria: form.categoria,
        condicion: form.condicion || null,
        cantidad: form.cantidad ? parseInt(form.cantidad, 10) || 1 : 1,
        valor_declarado: form.valor_declarado ? parseFloat(form.valor_declarado) : null,
        fecha_compra: form.fecha_compra || null,
        fecha_estimada_llegada: form.fecha_estimada_llegada || null,
        bodega_destino: form.bodega_destino,
        notas_cliente: form.notas_cliente || null,
        requiere_consolidacion: form.requiere_consolidacion,
        notas_consolidacion: form.notas_consolidacion || null,
        ...direccionPayload,
      }),
    })

    setLoading(false)
    const data = await res.json() as {
      ok?: boolean; error?: string; tracking_casilla?: string
      match?: boolean; descripcion?: string; estado?: string
    }

    if (res.status === 409 && data.error === 'duplicate_own') {
      setDuplicado({ tipo: 'propio', tracking_casilla: data.tracking_casilla ?? '', descripcion: data.descripcion ?? '', estado: data.estado ?? '' })
      return
    }
    if (res.status === 409 && data.error === 'duplicate_other') {
      setDuplicado({ tipo: 'otro' })
      return
    }
    if (!res.ok || !data.ok) { setError(data.error ?? 'Error al guardar el pedido. Intenta de nuevo.'); return }

    setExito({ tracking: data.tracking_casilla ?? '', match: data.match })
  }

  /* ── Pantalla de éxito ── */
  if (exito) {
    return (
      <div className="max-w-lg mx-auto space-y-4" style={{ fontFamily: "'Outfit', sans-serif" }}>
        <div className="glass-card p-6"
          style={exito.match
            ? { borderColor: 'rgba(245,184,0,0.25)', background: 'rgba(245,184,0,0.06)' }
            : { borderColor: 'rgba(52,211,153,0.25)', background: 'rgba(52,211,153,0.06)' }}>
          <div className="flex flex-col items-center text-center gap-4">
            <CheckCircle className="h-12 w-12" style={{ color: exito.match ? '#F5B800' : '#34d399' }} />
            <div>
              {exito.match ? (
                <>
                  <h2 className="text-xl font-bold text-white">¡Tu paquete ya está aquí! 🎉</h2>
                  <p className="mt-1 text-sm" style={{ color: `${tw}0.6)` }}>
                    Encontramos tu paquete en nuestra bodega de Miami. Te enviamos una notificación por WhatsApp con los detalles.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-white">¡Pedido reportado!</h2>
                  <p className="mt-1 text-sm" style={{ color: `${tw}0.6)` }}>Tu paquete ha sido registrado exitosamente.</p>
                </>
              )}
            </div>
            <div className="w-full p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${tw}0.08)` }}>
              <p className="text-xs" style={{ color: `${tw}0.4)` }}>Número de seguimiento CeladaShopper</p>
              <p className="text-2xl font-mono font-bold mt-1" style={{ color: '#F5B800' }}>{exito.tracking}</p>
              <p className="text-xs mt-2" style={{ color: `${tw}0.3)` }}>Guarda este número para hacer seguimiento</p>
            </div>
            <div className="flex gap-3 w-full">
              <button
                className="btn-ghost flex-1 py-2.5 text-sm rounded-xl"
                onClick={() => {
                  setExito(null)
                  setTiendaOtros(false)
                  setForm({ tienda: '', tracking_origen: '', descripcion: '', categoria: '', condicion: '', cantidad: '1', valor_declarado: '', fecha_compra: '', fecha_estimada_llegada: '', bodega_destino: 'medellin', notas_cliente: '', requiere_consolidacion: false, notas_consolidacion: '' })
                }}
              >
                Reportar otro
              </button>
              <button
                className="btn-gold flex-1 py-2.5 text-sm rounded-xl font-bold"
                onClick={() => { window.location.href = '/paquetes' }}
              >
                Ver mis paquetes
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ── Formulario ── */
  return (
    <div className="max-w-2xl mx-auto space-y-5" style={{ fontFamily: "'Outfit', sans-serif" }}>

      <div>
        <h1 className="text-2xl font-bold text-white">Reportar un pedido</h1>
        <p className="mt-1 text-sm" style={{ color: `${tw}0.45)` }}>
          Registra los datos de tu compra para que la recibamos en nuestra bodega de USA.
        </p>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4" style={{ borderBottom: `1px solid ${tw}0.07)` }}>
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5" style={{ color: '#F5B800' }} />
            <h2 className="font-semibold text-white">Datos del paquete</h2>
          </div>
          <p className="text-xs mt-1 flex items-center gap-1.5" style={{ color: `${tw}0.4)` }}>
            <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#F5B800' }} />
            Los campos marcados son obligatorios
          </p>
        </div>

        <div className="p-5">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Tienda y tipo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <GlassLabel htmlFor="tienda" required>Tienda donde compraste</GlassLabel>
                <GlassSelect
                  id="tienda"
                  required={!tiendaOtros}
                  value={tiendaOtros ? 'otros' : form.tienda}
                  onChange={e => {
                    if (e.target.value === 'otros') {
                      setTiendaOtros(true)
                      setForm(p => ({ ...p, tienda: '' }))
                    } else {
                      setTiendaOtros(false)
                      setForm(p => ({ ...p, tienda: e.target.value }))
                    }
                  }}
                  placeholder="Seleccionar tienda..."
                  style={{ colorScheme: 'dark', background: 'rgba(18,18,30,0.97)' }}
                >
                  {TIENDAS_USA.map(t => <option key={t} value={t}>{t}</option>)}
                  <option value="otros">Otra tienda...</option>
                </GlassSelect>
                {tiendaOtros && (
                  <GlassInput
                    placeholder="¿Cuál tienda?"
                    value={form.tienda}
                    onChange={e => setForm(p => ({ ...p, tienda: e.target.value }))}
                    required
                    autoFocus
                  />
                )}
              </div>
              <div>
                <GlassLabel required>Tipo de producto</GlassLabel>
                <GlassSelect
                  required
                  value={form.categoria}
                  onChange={e => setForm(prev => ({ ...prev, categoria: e.target.value as CategoriaProducto, condicion: '' }))}
                  placeholder="Selecciona el tipo..."
                >
                  {Object.entries(CATEGORIA_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </GlassSelect>
              </div>
            </div>

            {/* Tarifa especial */}
            {form.categoria === 'tarifa_especial' && (
              <div className="glass-section-blue p-3">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#8899ff' }}>Tarifa especial</p>
                <p className="text-sm mt-1 leading-relaxed" style={{ color: `${tw}0.65)` }}>
                  El costo de este envío <strong className="text-white">se calcula al hacer la consolidación completa</strong>.
                  Un agente revisará el paquete y te confirmará el costo final.
                </p>
              </div>
            )}

            {/* Condición, cantidad y cotización */}
            {form.categoria && form.categoria !== 'juguetes' && form.categoria !== 'otro' && form.categoria !== 'tarifa_especial' && (
              <div className="glass-section-gold p-3 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#F5B800' }}>
                  Datos para calcular tarifa
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <GlassLabel>
                      Condición{' '}
                      {(form.categoria === 'celular' || form.categoria === 'computador')
                        ? <span style={{ color: '#f87171' }}>*</span>
                        : <span style={{ color: `${tw}0.3)`, fontWeight: 400, fontSize: '0.75rem' }}>(opcional)</span>}
                    </GlassLabel>
                    <GlassSelect
                      value={form.condicion}
                      onChange={e => setForm(prev => ({ ...prev, condicion: e.target.value as 'nuevo' | 'usado' }))}
                      placeholder="¿Es nuevo o usado?"
                    >
                      <option value="nuevo">✨ Nuevo (en caja / sin usar)</option>
                      <option value="usado">🔄 Usado</option>
                    </GlassSelect>
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <GlassLabel htmlFor="cantidad" required>
                      {form.categoria === 'calzado' ? 'Pares' : 'Cantidad de unidades'}
                    </GlassLabel>
                    <GlassInput id="cantidad" name="cantidad" type="number" min="1" placeholder="1" value={form.cantidad} onChange={handleChange} required />
                  </div>
                </div>

                {/* Pistas por categoría */}
                {form.categoria === 'celular' && form.condicion === 'usado' && (
                  <p className="text-[11px] leading-relaxed" style={{ color: `${tw}0.55)` }}>
                    💡 Celular usado: 1-4 uds = $55/u · 5-9 uds = $45/u · 10+ uds = $40/u
                  </p>
                )}
                {form.categoria === 'celular' && form.condicion === 'nuevo' && (
                  <p className="text-[11px] leading-relaxed" style={{ color: `${tw}0.55)` }}>💡 Celular nuevo: $75 por unidad</p>
                )}
                {form.categoria === 'celular' && !form.condicion && (
                  <p className="text-[11px] leading-relaxed" style={{ color: `${tw}0.55)` }}>
                    💡 Selecciona la condición para ver la tarifa exacta (nuevo $75/u · usado desde $40/u)
                  </p>
                )}
                {form.categoria === 'computador' && form.condicion === 'nuevo' && (
                  <p className="text-[11px] leading-relaxed" style={{ color: `${tw}0.55)` }}>💡 Computador nuevo: $75/u + 4% del valor declarado</p>
                )}
                {form.categoria === 'computador' && form.condicion === 'usado' && (
                  <p className="text-[11px] leading-relaxed" style={{ color: `${tw}0.55)` }}>💡 Computador usado: $55/u + 4% del valor declarado</p>
                )}
                {form.categoria === 'computador' && !form.condicion && (
                  <p className="text-[11px] leading-relaxed" style={{ color: `${tw}0.55)` }}>
                    💡 Selecciona la condición para ver la tarifa (nuevo $75/u · usado $55/u, ambos + 4% seguro)
                  </p>
                )}
                {form.categoria === 'ipad_tablet' && (
                  <p className="text-[11px] leading-relaxed" style={{ color: `${tw}0.55)` }}>
                    💡 Valor &gt; $200 → $45/u + 4% seguro · Valor ≤ $200 → $18 fijo + $2.20/lb
                  </p>
                )}
                {form.categoria === 'calzado' && (
                  <p className="text-[11px] leading-relaxed" style={{ color: `${tw}0.55)` }}>
                    💡 1 par = $20 · 2 o más pares = $17.50 cada par
                  </p>
                )}
                {['ropa_accesorios', 'cosmeticos', 'perfumeria', 'suplementos', 'libros', 'electrodomestico'].includes(form.categoria) && (
                  <p className="text-[11px] leading-relaxed" style={{ color: `${tw}0.55)` }}>
                    💡 Hasta 6 uds y valor ≤ $200: $18 fijo + $2.20/lb · 7+ uds o valor &gt; $200: $6.50/lb (mín 5 lb)
                  </p>
                )}

                {/* Cotización */}
                {cotizacion && cotizacion.metodo !== 'sin_tarifa' && (
                  <div className="p-3 rounded-xl mt-2" style={{ background: 'rgba(0,0,0,0.25)', border: '2px solid rgba(245,184,0,0.35)' }}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#F5B800' }}>
                          {cotizacion.requiere_peso ? 'Costo estimado mínimo' : 'Costo estimado'}
                        </p>
                        <p className="text-2xl font-bold text-white">
                          {cotizacion.requiere_peso ? 'desde ' : ''}
                          <span style={{ color: '#F5B800' }}>${cotizacion.total.toFixed(2)}</span>
                          <span className="text-xs font-normal ml-1" style={{ color: `${tw}0.4)` }}>USD</span>
                        </p>
                      </div>
                      {!cotizacion.requiere_peso && (
                        <div className="text-right text-[11px]" style={{ color: `${tw}0.5)` }}>
                          <p>Envío: ${cotizacion.subtotal_envio.toFixed(2)}</p>
                          {cotizacion.seguro > 0 && <p>Seguro: ${cotizacion.seguro.toFixed(2)}</p>}
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] mt-1 leading-relaxed" style={{ color: `${tw}0.4)` }}>
                      {cotizacion.detalle}
                      {!cotizacion.requiere_peso && '. Costo final lo confirma el agente al recibir.'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Descripción */}
            <div>
              <GlassLabel htmlFor="descripcion" required>Descripción del producto</GlassLabel>
              <GlassInput
                id="descripcion" name="descripcion"
                placeholder="Ej: Zapatillas Nike Air Max talla 10, color negro"
                value={form.descripcion} onChange={handleChange} required
              />
            </div>

            {/* Tracking y valor */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <GlassLabel htmlFor="tracking_origen">
                  Tracking del courier{' '}
                  <span style={{ color: `${tw}0.3)`, fontWeight: 400 }}>(opcional)</span>
                </GlassLabel>
                <GlassInput
                  id="tracking_origen" name="tracking_origen"
                  placeholder="1Z999AA10123456784"
                  value={form.tracking_origen} onChange={handleChange}
                  hasError={!!duplicado}
                />
                <p className="text-xs mt-1" style={{ color: `${tw}0.35)` }}>UPS, FedEx, USPS, Amazon...</p>
              </div>
              <div>
                <GlassLabel htmlFor="valor_declarado">
                  Valor declarado (USD){' '}
                  <span style={{ color: `${tw}0.3)`, fontWeight: 400 }}>(opcional)</span>
                </GlassLabel>
                <GlassInput
                  id="valor_declarado" name="valor_declarado"
                  type="number" min="0" step="0.01" placeholder="0.00"
                  value={form.valor_declarado} onChange={handleChange}
                />
              </div>
            </div>

            {/* Duplicado propio */}
            {duplicado?.tipo === 'propio' && (
              <div className="glass-section-amber p-4 space-y-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: '#F5B800' }} />
                  <div>
                    <p className="text-sm font-semibold text-white">¡Este tracking ya está en tu cuenta!</p>
                    <p className="text-xs mt-1 leading-relaxed" style={{ color: `${tw}0.6)` }}>
                      Ya registraste este número de tracking anteriormente:
                    </p>
                    <div className="mt-2 p-3 rounded-lg" style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${tw}0.08)` }}>
                      <p className="text-xs" style={{ color: `${tw}0.4)` }}>Número CeladaShopper</p>
                      <p className="font-mono font-bold" style={{ color: '#F5B800' }}>{duplicado.tracking_casilla}</p>
                      <p className="text-xs mt-0.5 text-white">{duplicado.descripcion}</p>
                      <p className="text-xs mt-0.5" style={{ color: `${tw}0.4)` }}>
                        Estado: {ESTADO_LABELS[duplicado.estado as EstadoPaquete] ?? duplicado.estado}
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-gold w-full py-2.5 text-sm rounded-xl font-bold"
                  onClick={() => { window.location.href = '/paquetes' }}
                >
                  Ver mis paquetes
                </button>
              </div>
            )}

            {/* Duplicado otro */}
            {duplicado?.tipo === 'otro' && (
              <div className="glass-section-red p-4">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: '#f87171' }} />
                  <div>
                    <p className="text-sm font-semibold text-white">Tracking ya registrado</p>
                    <p className="text-xs mt-1 leading-relaxed" style={{ color: `${tw}0.6)` }}>
                      Este número de tracking ya fue ingresado por otro cliente. Si crees que hay un error, comunícate con nosotros por WhatsApp.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Fechas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <GlassLabel htmlFor="fecha_compra">Fecha de compra</GlassLabel>
                <GlassInput id="fecha_compra" name="fecha_compra" type="date" value={form.fecha_compra} onChange={handleChange} />
              </div>
              <div>
                <GlassLabel htmlFor="fecha_estimada_llegada">Llegada estimada a USA</GlassLabel>
                <GlassInput id="fecha_estimada_llegada" name="fecha_estimada_llegada" type="date" value={form.fecha_estimada_llegada} onChange={handleChange} />
              </div>
            </div>

            {/* Bodega destino */}
            <div>
              <GlassLabel required>Ciudad de entrega</GlassLabel>
              <GlassSelect
                required
                value={form.bodega_destino}
                onChange={e => setForm(prev => ({ ...prev, bodega_destino: e.target.value as BodegaDestino }))}
              >
                {BODEGAS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </GlassSelect>
              {form.categoria === 'celular' && form.bodega_destino !== 'barranquilla' && (
                <p className="text-xs mt-1 flex items-center gap-1" style={{ color: '#F5B800' }}>
                  <AlertCircle className="h-3 w-3" />
                  Los celulares normalmente llegan a Barranquilla. ¿Confirmas Medellín?
                </p>
              )}
            </div>

            {/* Dirección de entrega */}
            <div className="space-y-2">
              <GlassLabel required>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" style={{ color: '#F5B800' }} />
                  Dirección de entrega
                </span>
              </GlassLabel>
              <GlassSelect
                value={direccionOpcion}
                onChange={e => setDireccionOpcion(e.target.value as 'guardada' | 'otra')}
              >
                {direccionPerfil?.direccion && <option value="guardada">📍 Mi dirección guardada</option>}
                <option value="otra">✏️ Otra dirección (puntual)</option>
              </GlassSelect>

              {direccionOpcion === 'guardada' && direccionPerfil?.direccion && (
                <div className="p-3 rounded-xl text-sm glass-section-gold">
                  <p className="text-white">{direccionPerfil.direccion}</p>
                  {(direccionPerfil.barrio || direccionPerfil.referencia) && (
                    <p className="text-xs mt-1" style={{ color: `${tw}0.5)` }}>
                      {direccionPerfil.barrio && <span>Barrio: {direccionPerfil.barrio}</span>}
                      {direccionPerfil.barrio && direccionPerfil.referencia && <span> · </span>}
                      {direccionPerfil.referencia && <span>{direccionPerfil.referencia}</span>}
                    </p>
                  )}
                  <Link href="/perfil" className="inline-block mt-2 text-[11px] font-medium hover:underline" style={{ color: '#F5B800' }}>
                    Cambiar dirección guardada en mi perfil →
                  </Link>
                </div>
              )}

              {direccionOpcion === 'guardada' && !direccionPerfil?.direccion && (
                <div className="glass-section-amber p-3 text-xs" style={{ color: `${tw}0.7)` }}>
                  Aún no has registrado una dirección en tu perfil.{' '}
                  <Link href="/perfil" className="font-semibold underline" style={{ color: '#F5B800' }}>Agregarla</Link>{' '}
                  o usa la opción &quot;Otra dirección&quot; para este paquete.
                </div>
              )}

              {direccionOpcion === 'otra' && (
                <div className="space-y-2 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${tw}0.08)` }}>
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: `${tw}0.6)` }}>Dirección *</label>
                    <GlassTextarea
                      placeholder="Calle 10 #45-20, Apto 502, Torre B" rows={2}
                      value={direccionOtra.direccion}
                      onChange={e => setDireccionOtra(p => ({ ...p, direccion: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium mb-1 block" style={{ color: `${tw}0.6)` }}>Barrio</label>
                      <GlassInput placeholder="Poblado" value={direccionOtra.barrio}
                        onChange={e => setDireccionOtra(p => ({ ...p, barrio: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1 block" style={{ color: `${tw}0.6)` }}>Referencia</label>
                      <GlassInput placeholder="Cerca al parque" value={direccionOtra.referencia}
                        onChange={e => setDireccionOtra(p => ({ ...p, referencia: e.target.value }))} />
                    </div>
                  </div>
                  <p className="text-[11px]" style={{ color: `${tw}0.35)` }}>
                    Esta dirección se usará solo para este paquete. Tu dirección del perfil no cambia.
                  </p>
                </div>
              )}
            </div>

            {/* Consolidación */}
            <div className="glass-section-blue p-3 space-y-2">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.requiere_consolidacion}
                  onChange={e => setForm(p => ({ ...p, requiere_consolidacion: e.target.checked }))}
                  className="h-4 w-4 mt-0.5 rounded"
                  style={{ accentColor: '#8899ff' }}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">📦 Necesito consolidar este paquete con otros</p>
                  <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: `${tw}0.55)` }}>
                    Marca esta opción si vas a enviar más paquetes y quieres que esperemos a tener todos antes de despacharlos juntos.
                  </p>
                </div>
              </label>
              {form.requiere_consolidacion && (
                <GlassTextarea
                  name="notas_consolidacion"
                  placeholder="Opcional: dinos cuántos paquetes esperas, por cuánto tiempo, etc."
                  value={form.notas_consolidacion}
                  onChange={handleChange}
                  rows={2}
                  className="text-xs"
                />
              )}
            </div>

            {/* Notas */}
            <div>
              <GlassLabel htmlFor="notas_cliente">
                Notas adicionales{' '}
                <span style={{ color: `${tw}0.3)`, fontWeight: 400 }}>(opcional)</span>
              </GlassLabel>
              <GlassTextarea
                id="notas_cliente" name="notas_cliente"
                placeholder="Instrucciones especiales, observaciones del producto..."
                value={form.notas_cliente} onChange={handleChange} rows={3}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 glass-section-red px-3 py-2.5 text-sm" style={{ color: '#f87171' }}>
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {!duplicado && (
              <button
                type="submit"
                className="btn-gold w-full flex items-center justify-center gap-2 py-3 text-sm rounded-xl font-bold"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    Guardando...
                  </>
                ) : 'Reportar pedido'}
              </button>
            )}

            {duplicado?.tipo === 'otro' && (
              <button
                type="button"
                className="btn-ghost w-full py-3 text-sm rounded-xl"
                onClick={() => { setDuplicado(null); setForm(prev => ({ ...prev, tracking_origen: '' })) }}
              >
                Registrar sin número de tracking
              </button>
            )}

          </form>
        </div>
      </div>

      {/* Cómo funciona */}
      <div className="glass-section-blue p-4">
        <div className="flex gap-3">
          <div className="mt-0.5">ℹ️</div>
          <div className="text-sm" style={{ color: `${tw}0.7)` }}>
            <p className="font-medium mb-1 text-white">¿Cómo funciona?</p>
            <ol className="space-y-1 list-decimal list-inside" style={{ color: `${tw}0.6)` }}>
              <li>Reportas tu pedido aquí con los datos de tu compra</li>
              <li>Tu paquete llega a nuestra bodega en USA</li>
              <li>Te enviamos fotos por WhatsApp cuando llegue</li>
              <li>Lo despachamos a Colombia en 8-12 días hábiles</li>
              <li>Te avisamos cuando esté listo para recoger o entrega</li>
            </ol>
          </div>
        </div>
      </div>

    </div>
  )
}
