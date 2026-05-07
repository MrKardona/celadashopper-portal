'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, AlertCircle, Save, MessageSquare, Loader2, Calculator } from 'lucide-react'
import type { EstadoPaquete, BodegaDestino, CategoriaProducto } from '@/types'
import { ESTADO_LABELS, CATEGORIA_LABELS } from '@/types'

const tw = 'rgba(255,255,255,'

const ESTADOS: EstadoPaquete[] = [
  'reportado', 'recibido_usa', 'en_consolidacion', 'listo_envio',
  'en_transito', 'en_colombia', 'en_bodega_local', 'en_camino_cliente',
  'entregado', 'retenido', 'devuelto',
]

const BODEGAS: { value: BodegaDestino; label: string }[] = [
  { value: 'medellin', label: 'Medellín' },
  { value: 'bogota', label: 'Bogotá' },
  { value: 'barranquilla', label: 'Barranquilla' },
]

interface Calculo {
  subtotal_envio: number
  seguro: number
  total: number
  metodo: string
  detalle: string
  requiere_peso?: boolean
  peso_minimo?: number
  peso_facturable: number | null
  regla_id?: string
}

interface Props {
  paqueteId: string
  estado: EstadoPaquete
  bodega: BodegaDestino
  categoria: CategoriaProducto
  pesoLibras?: number | null
  pesoFacturable?: number | null
  costoServicio?: number | null
  tarifaAplicada?: number | null
  trackingUsaco?: string | null
  notasCliente?: string | null
  valorDeclarado?: number | null
  condicion?: 'nuevo' | 'usado' | null
  cantidad?: number | null
}

const labelStyle = { color: `${tw}0.7)` }
const inputClass = 'glass-input w-full px-3 py-2.5 rounded-xl text-sm'

export default function PaqueteEditForm({
  paqueteId, estado, bodega, categoria,
  pesoLibras, costoServicio, tarifaAplicada,
  trackingUsaco, notasCliente, valorDeclarado,
  condicion: condicionInicial, cantidad: cantidadInicial,
}: Props) {
  const router = useRouter()

  const [form, setForm] = useState({
    estado,
    bodega_destino: bodega,
    categoria,
    peso_libras: pesoLibras?.toString() ?? '',
    condicion: condicionInicial ?? '' as '' | 'nuevo' | 'usado',
    cantidad: cantidadInicial?.toString() ?? '1',
    tarifa_aplicada: tarifaAplicada?.toString() ?? '',
    costo_servicio: costoServicio?.toString() ?? '',
    tracking_usaco: trackingUsaco ?? '',
    notas_cliente: notasCliente ?? '',
    notificar: true,
  })

  const [calculo, setCalculo] = useState<Calculo | null>(null)
  const [calculando, setCalculando] = useState(false)
  const [errorCalculo, setErrorCalculo] = useState('')
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<{ ok: boolean; msg: string } | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setCalculando(true)
      setErrorCalculo('')
      try {
        const pesoNum = form.peso_libras ? parseFloat(form.peso_libras) : null
        const pesoValido = pesoNum !== null && !isNaN(pesoNum) && pesoNum > 0
        const res = await fetch('/api/admin/calcular-costo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            categoria,
            condicion: form.condicion || null,
            cantidad: parseInt(form.cantidad, 10) || 1,
            peso_libras: pesoValido ? pesoNum : null,
            valor_declarado: valorDeclarado ?? null,
          }),
        })
        const data = await res.json() as Calculo & { error?: string }
        if (!res.ok) {
          setErrorCalculo(data.error ?? 'No se pudo calcular')
          setCalculo(null)
        } else {
          setCalculo(data)
          // Solo auto-rellenar costo si el precio es definitivo (no estimado pendiente de peso)
          if (!data.requiere_peso) {
            setForm(prev => ({ ...prev, costo_servicio: data.total.toFixed(2) }))
          }
        }
      } catch {
        setErrorCalculo('Error de conexión al calcular tarifa')
        setCalculo(null)
      } finally {
        setCalculando(false)
      }
    }, 500)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.peso_libras, form.condicion, form.cantidad])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setResultado(null)

    try {
      const res = await fetch(`/api/admin/paquetes/${paqueteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: form.estado,
          bodega_destino: form.bodega_destino,
          categoria: form.categoria,
          peso_libras: form.peso_libras ? parseFloat(form.peso_libras) : null,
          peso_facturable: calculo?.peso_facturable ?? (form.peso_libras ? parseFloat(form.peso_libras) : null),
          tarifa_aplicada: form.tarifa_aplicada ? parseFloat(form.tarifa_aplicada) : null,
          costo_servicio: form.costo_servicio ? parseFloat(form.costo_servicio) : null,
          tracking_usaco: form.tracking_usaco || null,
          notas_cliente: form.notas_cliente || null,
          condicion: form.condicion || null,
          cantidad: parseInt(form.cantidad, 10) || 1,
          notificar: form.notificar,
          estado_anterior: estado,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        setResultado({ ok: true, msg: data.notificado ? '✅ Guardado y cliente notificado por WhatsApp' : '✅ Cambios guardados' })
        router.refresh()
      } else {
        setResultado({ ok: false, msg: data.error ?? 'Error al guardar' })
      }
    } catch {
      setResultado({ ok: false, msg: 'Error de conexión' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Estado y bodega */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium" style={labelStyle}>Estado del paquete</label>
          <select
            value={form.estado}
            onChange={e => setForm(prev => ({ ...prev, estado: e.target.value as EstadoPaquete }))}
            className={inputClass}
          >
            {ESTADOS.map(e => (
              <option key={e} value={e}>{ESTADO_LABELS[e]}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" style={labelStyle}>Ciudad de entrega</label>
          <select
            value={form.bodega_destino}
            onChange={e => setForm(prev => ({ ...prev, bodega_destino: e.target.value as BodegaDestino }))}
            className={inputClass}
          >
            {BODEGAS.map(b => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Categoría */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium" style={labelStyle}>Categoría</label>
        <select
          value={form.categoria}
          onChange={e => setForm(prev => ({ ...prev, categoria: e.target.value as CategoriaProducto }))}
          className={inputClass}
        >
          {(Object.entries(CATEGORIA_LABELS) as [CategoriaProducto, string][]).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>

      {/* Condición y cantidad */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="condicion" className="text-sm font-medium" style={labelStyle}>Condición</label>
          <select
            id="condicion"
            value={form.condicion}
            onChange={e => setForm(prev => ({ ...prev, condicion: e.target.value as '' | 'nuevo' | 'usado' }))}
            className={inputClass}
          >
            <option value="">Sin especificar</option>
            <option value="nuevo">Nuevo</option>
            <option value="usado">Usado</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="cantidad" className="text-sm font-medium" style={labelStyle}>Cantidad (uds)</label>
          <input
            id="cantidad"
            type="number"
            min="1"
            step="1"
            value={form.cantidad}
            onChange={e => setForm(prev => ({ ...prev, cantidad: e.target.value }))}
            className={inputClass}
          />
        </div>
      </div>

      {/* Peso */}
      <div className="space-y-1.5">
        <label htmlFor="peso" className="text-sm font-medium" style={labelStyle}>Peso real (libras)</label>
        <input
          id="peso"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          value={form.peso_libras}
          onChange={e => setForm(prev => ({ ...prev, peso_libras: e.target.value }))}
          className={inputClass}
        />
        {calculo?.peso_facturable !== null && calculo?.peso_facturable !== undefined &&
          calculo.peso_facturable !== parseFloat(form.peso_libras) && (
          <p className="text-xs px-2 py-1 rounded-lg" style={{ color: '#F5B800', background: 'rgba(245,184,0,0.08)', border: '1px solid rgba(245,184,0,0.2)' }}>
            ⚖️ Peso facturable: <strong>{calculo.peso_facturable} lb</strong> (mínimo de la regla aplicado)
          </p>
        )}
      </div>

      {/* Cálculo automático */}
      {calculando && (
        <div className="flex items-center gap-2 text-xs rounded-xl px-3 py-2" style={{ color: `${tw}0.5)`, background: `${tw}0.04)`, border: `1px solid ${tw}0.08)` }}>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Calculando tarifa...
        </div>
      )}

      {errorCalculo && (
        <div className="text-xs rounded-xl px-3 py-2" style={{ color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          ⚠️ {errorCalculo}
        </div>
      )}

      {calculo && !calculando && (
        <div className="rounded-xl px-4 py-3 text-xs space-y-1.5" style={{ background: 'rgba(245,184,0,0.06)', border: '1px solid rgba(245,184,0,0.18)' }}>
          <p className="font-semibold flex items-center gap-1.5" style={{ color: '#F5B800' }}>
            <Calculator className="h-3.5 w-3.5" />
            Desglose calculado automáticamente
          </p>
          <p className="font-mono" style={{ color: `${tw}0.6)` }}>{calculo.detalle}</p>
          <div className="pt-1.5 mt-1.5 space-y-0.5" style={{ borderTop: '1px solid rgba(245,184,0,0.15)' }}>
            <div className="flex justify-between" style={{ color: `${tw}0.6)` }}>
              <span>Envío</span>
              <span className="font-mono font-semibold">${calculo.subtotal_envio.toFixed(2)}</span>
            </div>
            {calculo.seguro > 0 && (
              <div className="flex justify-between" style={{ color: `${tw}0.6)` }}>
                <span>Seguro</span>
                <span className="font-mono font-semibold">+${calculo.seguro.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold pt-1 mt-0.5" style={{ color: '#F5B800', borderTop: '1px solid rgba(245,184,0,0.15)' }}>
              <span>Total</span>
              <span className="font-mono">${calculo.total.toFixed(2)}</span>
            </div>
          </div>
          {calculo.metodo === 'estimado_pendiente_peso' && (
            <p className="italic" style={{ color: '#fbbf24' }}>
              ⚠️ Estimado mínimo — el costo exacto depende del peso real
            </p>
          )}
          {calculo.metodo === 'sin_tarifa' && (
            <p className="italic" style={{ color: '#f87171' }}>
              ⚠️ Sin tarifa configurada para esta categoría — revisa el panel de tarifas
            </p>
          )}
        </div>
      )}

      {/* Costo total */}
      <div className="space-y-1.5">
        <label htmlFor="costo" className="text-sm font-medium" style={labelStyle}>Costo total a cobrar (USD)</label>
        <input
          id="costo"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          value={form.costo_servicio}
          onChange={e => setForm(prev => ({ ...prev, costo_servicio: e.target.value }))}
          className={inputClass}
          style={{ color: '#34d399' }}
        />
        <p className="text-[11px]" style={{ color: `${tw}0.35)` }}>
          Se calcula automáticamente. Categorías de precio fijo (celular, computador, iPad, calzado) no requieren peso. Ajusta manualmente si es necesario.
        </p>
      </div>

      {/* Tracking USACO */}
      <div className="space-y-1.5">
        <label htmlFor="tracking_usaco" className="text-sm font-medium" style={labelStyle}>Tracking USACO</label>
        <input
          id="tracking_usaco"
          placeholder="Tracking del courier de despacho..."
          value={form.tracking_usaco}
          onChange={e => setForm(prev => ({ ...prev, tracking_usaco: e.target.value }))}
          className={inputClass}
        />
      </div>

      {/* Notas */}
      <div className="space-y-1.5">
        <label htmlFor="notas" className="text-sm font-medium" style={labelStyle}>Notas al cliente</label>
        <textarea
          id="notas"
          placeholder="Instrucciones especiales o notas para el cliente..."
          value={form.notas_cliente}
          onChange={e => setForm(prev => ({ ...prev, notas_cliente: e.target.value }))}
          rows={2}
          className={inputClass}
          style={{ resize: 'vertical' }}
        />
      </div>

      {/* Notificar */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={form.notificar}
          onChange={e => setForm(prev => ({ ...prev, notificar: e.target.checked }))}
          className="h-4 w-4 rounded"
          style={{ accentColor: '#F5B800' }}
        />
        <span className="text-sm flex items-center gap-1" style={{ color: `${tw}0.65)` }}>
          <MessageSquare className="h-3.5 w-3.5" style={{ color: '#34d399' }} />
          Notificar al cliente por WhatsApp al guardar
        </span>
      </label>

      {/* Resultado */}
      {resultado && (
        <div className={`flex items-center gap-2 p-3 rounded-xl text-sm`} style={
          resultado.ok
            ? { background: 'rgba(52,211,153,0.08)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }
            : { background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }
        }>
          {resultado.ok
            ? <CheckCircle className="h-4 w-4 flex-shrink-0" />
            : <AlertCircle className="h-4 w-4 flex-shrink-0" />
          }
          {resultado.msg}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="btn-gold w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {loading ? 'Guardando...' : 'Guardar cambios'}
      </button>
    </form>
  )
}
