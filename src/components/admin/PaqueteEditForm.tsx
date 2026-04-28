'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle, AlertCircle, Save, MessageSquare } from 'lucide-react'
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

interface Props {
  paqueteId: string
  estado: EstadoPaquete
  bodega: BodegaDestino
  pesoLibras?: number | null
  costoServicio?: number | null
  tarifaAplicada?: number | null
  trackingUsaco?: string | null
  notasCliente?: string | null
  tarifaPorLibra: number
  precioFijo?: number | null
  tarifaTipo: string
  seguroPorcentaje: number
  valorDeclarado?: number | null
}

export default function PaqueteEditForm({
  paqueteId, estado, bodega, pesoLibras, costoServicio,
  tarifaAplicada, trackingUsaco, notasCliente,
  tarifaPorLibra, precioFijo, tarifaTipo, seguroPorcentaje, valorDeclarado,
}: Props) {
  const router = useRouter()

  const [form, setForm] = useState({
    estado,
    bodega_destino: bodega,
    peso_libras: pesoLibras?.toString() ?? '',
    tarifa_aplicada: tarifaAplicada?.toString() ?? tarifaPorLibra.toString(),
    costo_servicio: costoServicio?.toString() ?? '',
    tracking_usaco: trackingUsaco ?? '',
    notas_cliente: notasCliente ?? '',
    notificar: true,
  })

  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<{ ok: boolean; msg: string } | null>(null)

  // Seguro = valor_declarado × seguro_porcentaje%
  const seguroUSD = seguroPorcentaje > 0 && valorDeclarado
    ? parseFloat((valorDeclarado * seguroPorcentaje / 100).toFixed(2))
    : 0

  function calcularCosto(peso: string, tarifa: string): string {
    let base = 0
    const p = parseFloat(peso)
    const t = parseFloat(tarifa)
    if (!isNaN(p) && !isNaN(t) && t > 0) {
      base = p * t
    } else if (tarifaTipo === 'fijo_por_unidad' && precioFijo) {
      base = precioFijo
    } else {
      return form.costo_servicio
    }
    return (base + seguroUSD).toFixed(2)
  }

  const costoBase = (() => {
    const p = parseFloat(form.peso_libras)
    const t = parseFloat(form.tarifa_aplicada)
    if (!isNaN(p) && !isNaN(t) && t > 0) return p * t
    if (tarifaTipo === 'fijo_por_unidad' && precioFijo) return precioFijo
    return null
  })()

  function handlePesoChange(valor: string) {
    const costo = calcularCosto(valor, form.tarifa_aplicada)
    setForm(prev => ({ ...prev, peso_libras: valor, costo_servicio: costo }))
  }

  function handleTarifaChange(valor: string) {
    const costo = calcularCosto(form.peso_libras, valor)
    setForm(prev => ({ ...prev, tarifa_aplicada: valor, costo_servicio: costo }))
  }

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
          tarifa_aplicada: form.tarifa_aplicada ? parseFloat(form.tarifa_aplicada) : null,
          costo_servicio: form.costo_servicio ? parseFloat(form.costo_servicio) : null,
          tracking_usaco: form.tracking_usaco || null,
          notas_cliente: form.notas_cliente || null,
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

      {/* Peso y tarifa */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="peso">Peso (libras)</Label>
          <Input
            id="peso"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={form.peso_libras}
            onChange={e => handlePesoChange(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tarifa">Tarifa (USD/lb)</Label>
          <Input
            id="tarifa"
            type="number"
            step="0.01"
            min="0"
            placeholder={tarifaTipo === 'fijo_por_unidad' ? 'Precio fijo' : tarifaPorLibra.toString()}
            value={form.tarifa_aplicada}
            onChange={e => handleTarifaChange(e.target.value)}
          />
          {tarifaTipo === 'fijo_por_unidad' && (
            <p className="text-xs text-blue-600">Precio fijo: ${precioFijo}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="costo">Costo total (USD)</Label>
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
        </div>
      </div>

      {/* Desglose seguro */}
      {seguroPorcentaje > 0 && costoBase !== null && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs space-y-1">
          <p className="font-semibold text-blue-800">Desglose del costo total</p>
          <div className="flex justify-between text-blue-700">
            <span>Servicio de envío</span>
            <span className="font-mono">${costoBase.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-blue-700">
            <span>
              Seguro ({seguroPorcentaje}% s/ valor declarado
              {valorDeclarado ? ` $${valorDeclarado}` : ' — sin valor declarado'})
            </span>
            <span className="font-mono">+${seguroUSD.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-blue-900 border-t border-blue-200 pt-1 mt-1">
            <span>Total</span>
            <span className="font-mono">${(costoBase + seguroUSD).toFixed(2)}</span>
          </div>
          {!valorDeclarado && (
            <p className="text-amber-600 mt-1">
              ⚠️ El cliente no declaró el valor — el seguro no se puede calcular.
            </p>
          )}
        </div>
      )}

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
