'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle, AlertCircle, Save, MessageSquare, Loader2, Calculator } from 'lucide-react'
import type { EstadoPaquete, BodegaDestino } from '@/types'
import { ESTADO_LABELS } from '@/types'

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
  categoria: string
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

  // Ref para debounce
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Recalcular cuando cambian peso, condicion o cantidad
  useEffect(() => {
    const peso = parseFloat(form.peso_libras)
    if (!form.peso_libras || isNaN(peso) || peso <= 0) {
      setCalculo(null)
      setErrorCalculo('')
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setCalculando(true)
      setErrorCalculo('')
      try {
        const res = await fetch('/api/admin/calcular-costo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            categoria,
            condicion: form.condicion || null,
            cantidad: parseInt(form.cantidad, 10) || 1,
            peso_libras: peso,
            valor_declarado: valorDeclarado ?? null,
          }),
        })
        const data = await res.json() as Calculo & { error?: string }
        if (!res.ok) {
          setErrorCalculo(data.error ?? 'No se pudo calcular')
          setCalculo(null)
        } else {
          setCalculo(data)
          // Auto-rellenar costo si el admin no lo había tocado manualmente
          // (solo si el costo actual coincide con lo que estaba antes o está vacío)
          setForm(prev => ({
            ...prev,
            costo_servicio: data.total.toFixed(2),
            tarifa_aplicada: prev.tarifa_aplicada,
          }))
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
          peso_libras: form.peso_libras ? parseFloat(form.peso_libras) : null,
          // Enviar peso_facturable calculado con peso_minimo aplicado
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
        <div className="space-y-2">
          <Label>Estado del paquete</Label>
          <Select
            value={form.estado}
            onValueChange={val => setForm(prev => ({ ...prev, estado: val as EstadoPaquete }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ESTADOS.map(e => (
                <SelectItem key={e} value={e}>{ESTADO_LABELS[e]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Ciudad de entrega</Label>
          <Select
            value={form.bodega_destino}
            onValueChange={val => setForm(prev => ({ ...prev, bodega_destino: val as BodegaDestino }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BODEGAS.map(b => (
                <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Condición y cantidad */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="condicion">Condición</Label>
          <select
            id="condicion"
            value={form.condicion}
            onChange={e => setForm(prev => ({ ...prev, condicion: e.target.value as '' | 'nuevo' | 'usado' }))}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="">Sin especificar</option>
            <option value="nuevo">Nuevo</option>
            <option value="usado">Usado</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cantidad">Cantidad (uds)</Label>
          <Input
            id="cantidad"
            type="number"
            min="1"
            step="1"
            value={form.cantidad}
            onChange={e => setForm(prev => ({ ...prev, cantidad: e.target.value }))}
          />
        </div>
      </div>

      {/* Peso */}
      <div className="space-y-2">
        <Label htmlFor="peso">Peso real (libras)</Label>
        <Input
          id="peso"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          value={form.peso_libras}
          onChange={e => setForm(prev => ({ ...prev, peso_libras: e.target.value }))}
        />
        {calculo?.peso_facturable !== null && calculo?.peso_facturable !== undefined &&
          calculo.peso_facturable !== parseFloat(form.peso_libras) && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
            ⚖️ Peso facturable: <strong>{calculo.peso_facturable} lb</strong> (mínimo de la regla aplicado)
          </p>
        )}
      </div>

      {/* Cálculo automático */}
      {calculando && (
        <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Calculando tarifa...
        </div>
      )}

      {errorCalculo && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          ⚠️ {errorCalculo}
        </div>
      )}

      {calculo && !calculando && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 text-xs space-y-1.5">
          <p className="font-semibold text-orange-900 flex items-center gap-1.5">
            <Calculator className="h-3.5 w-3.5" />
            Desglose calculado automáticamente
          </p>
          <p className="text-orange-700 font-mono">{calculo.detalle}</p>
          <div className="border-t border-orange-200 pt-1.5 mt-1.5 space-y-0.5">
            <div className="flex justify-between text-orange-700">
              <span>Envío</span>
              <span className="font-mono font-semibold">${calculo.subtotal_envio.toFixed(2)}</span>
            </div>
            {calculo.seguro > 0 && (
              <div className="flex justify-between text-orange-700">
                <span>Seguro</span>
                <span className="font-mono font-semibold">+${calculo.seguro.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-orange-900 border-t border-orange-200 pt-1 mt-0.5">
              <span>Total</span>
              <span className="font-mono">${calculo.total.toFixed(2)}</span>
            </div>
          </div>
          {calculo.metodo === 'estimado_pendiente_peso' && (
            <p className="text-amber-700 italic">
              ⚠️ Estimado mínimo — el costo exacto depende del peso real
            </p>
          )}
          {calculo.metodo === 'sin_tarifa' && (
            <p className="text-red-700 italic">
              ⚠️ Sin tarifa configurada para esta categoría — revisa el panel de tarifas
            </p>
          )}
        </div>
      )}

      {/* Costo total (editable, auto-rellena desde calculo) */}
      <div className="space-y-2">
        <Label htmlFor="costo">Costo total a cobrar (USD)</Label>
        <Input
          id="costo"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          value={form.costo_servicio}
          onChange={e => setForm(prev => ({ ...prev, costo_servicio: e.target.value }))}
          className="font-semibold text-green-700"
        />
        <p className="text-[11px] text-gray-400">
          Se calcula automáticamente al ingresar el peso. Puedes ajustarlo manualmente si es necesario.
        </p>
      </div>

      {/* Tracking USACO */}
      <div className="space-y-2">
        <Label htmlFor="tracking_usaco">Tracking USACO</Label>
        <Input
          id="tracking_usaco"
          placeholder="Tracking del courier de despacho..."
          value={form.tracking_usaco}
          onChange={e => setForm(prev => ({ ...prev, tracking_usaco: e.target.value }))}
        />
      </div>

      {/* Notas */}
      <div className="space-y-2">
        <Label htmlFor="notas">Notas al cliente</Label>
        <Textarea
          id="notas"
          placeholder="Instrucciones especiales o notas para el cliente..."
          value={form.notas_cliente}
          onChange={e => setForm(prev => ({ ...prev, notas_cliente: e.target.value }))}
          rows={2}
        />
      </div>

      {/* Notificar */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={form.notificar}
          onChange={e => setForm(prev => ({ ...prev, notificar: e.target.checked }))}
          className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
        />
        <span className="text-sm text-gray-700 flex items-center gap-1">
          <MessageSquare className="h-3.5 w-3.5 text-green-600" />
          Notificar al cliente por WhatsApp al guardar
        </span>
      </label>

      {/* Resultado */}
      {resultado && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
          resultado.ok
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {resultado.ok
            ? <CheckCircle className="h-4 w-4 flex-shrink-0" />
            : <AlertCircle className="h-4 w-4 flex-shrink-0" />
          }
          {resultado.msg}
        </div>
      )}

      <Button
        type="submit"
        disabled={loading}
        className="w-full bg-orange-600 hover:bg-orange-700 h-11"
      >
        <Save className="h-4 w-4 mr-2" />
        {loading ? 'Guardando...' : 'Guardar cambios'}
      </Button>
    </form>
  )
}
