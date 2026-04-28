'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Package, CheckCircle, AlertCircle } from 'lucide-react'
import { CATEGORIA_LABELS, type CategoriaProducto, type BodegaDestino } from '@/types'

const BODEGAS: { value: BodegaDestino; label: string }[] = [
  { value: 'medellin', label: 'Medellín' },
  { value: 'bogota', label: 'Bogotá' },
  { value: 'barranquilla', label: 'Barranquilla (celulares)' },
]

export default function ReportarPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    tienda: '',
    tracking_origen: '',
    descripcion: '',
    categoria: '' as CategoriaProducto | '',
    valor_declarado: '',
    fecha_compra: '',
    fecha_estimada_llegada: '',
    bodega_destino: 'medellin' as BodegaDestino,
    notas_cliente: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState<{ tracking: string } | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.categoria) {
      setError('Selecciona el tipo de producto')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    const { data, error: err } = await supabase.from('paquetes').insert({
      cliente_id: user.id,
      tienda: form.tienda,
      tracking_origen: form.tracking_origen || null,
      descripcion: form.descripcion,
      categoria: form.categoria,
      valor_declarado: form.valor_declarado ? parseFloat(form.valor_declarado) : null,
      fecha_compra: form.fecha_compra || null,
      fecha_estimada_llegada: form.fecha_estimada_llegada || null,
      bodega_destino: form.bodega_destino,
      notas_cliente: form.notas_cliente || null,
    }).select('tracking_casilla').single()

    setLoading(false)

    if (err) {
      setError('Error al guardar el pedido. Intenta de nuevo.')
      return
    }

    // Disparar notificaciones (WhatsApp + email) en background — no bloquear UX
    fetch('/api/notificaciones/registro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tracking_casilla: data.tracking_casilla }),
    }).catch(() => {/* Silencioso — la notificación es best-effort */})

    setExito({ tracking: data.tracking_casilla })
  }

  if (exito) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center gap-4">
              <CheckCircle className="h-12 w-12 text-green-600" />
              <div>
                <h2 className="text-xl font-bold text-green-800">¡Pedido reportado!</h2>
                <p className="text-green-700 mt-1">Tu paquete ha sido registrado exitosamente.</p>
              </div>
              <div className="bg-white rounded-lg p-4 w-full border border-green-200">
                <p className="text-sm text-gray-500">Número de seguimiento CeladaShopper</p>
                <p className="text-2xl font-mono font-bold text-orange-600 mt-1">{exito.tracking}</p>
                <p className="text-xs text-gray-400 mt-2">Guarda este número para hacer seguimiento</p>
              </div>
              <div className="flex gap-3 w-full">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setExito(null)
                    setForm({
                      tienda: '', tracking_origen: '', descripcion: '',
                      categoria: '', valor_declarado: '', fecha_compra: '',
                      fecha_estimada_llegada: '', bodega_destino: 'medellin', notas_cliente: '',
                    })
                  }}
                >
                  Reportar otro
                </Button>
                <Button
                  className="flex-1 bg-orange-600 hover:bg-orange-700"
                  onClick={() => router.push('/paquetes')}
                >
                  Ver mis paquetes
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reportar un pedido</h1>
        <p className="text-gray-500 mt-1">
          Registra los datos de tu compra para que la recibamos en nuestra bodega de USA.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-orange-600" />
            Datos del paquete
          </CardTitle>
          <CardDescription>
            Completa la información de tu compra. Los campos con * son obligatorios.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Tienda y tipo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tienda">Tienda donde compraste *</Label>
                <Input
                  id="tienda"
                  name="tienda"
                  placeholder="Amazon, Nike, Shein..."
                  value={form.tienda}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de producto *</Label>
                <Select
                  value={form.categoria}
                  onValueChange={val => setForm(prev => ({ ...prev, categoria: val as CategoriaProducto }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona el tipo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORIA_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Descripcion */}
            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción del producto *</Label>
              <Input
                id="descripcion"
                name="descripcion"
                placeholder="Ej: Zapatillas Nike Air Max talla 10, color negro"
                value={form.descripcion}
                onChange={handleChange}
                required
              />
            </div>

            {/* Tracking y valor */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tracking_origen">
                  Tracking del courier
                  <span className="text-gray-400 font-normal ml-1">(opcional)</span>
                </Label>
                <Input
                  id="tracking_origen"
                  name="tracking_origen"
                  placeholder="1Z999AA10123456784"
                  value={form.tracking_origen}
                  onChange={handleChange}
                />
                <p className="text-xs text-gray-400">UPS, FedEx, USPS, Amazon...</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="valor_declarado">
                  Valor declarado (USD)
                  <span className="text-gray-400 font-normal ml-1">(opcional)</span>
                </Label>
                <Input
                  id="valor_declarado"
                  name="valor_declarado"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.valor_declarado}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Fechas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fecha_compra">Fecha de compra</Label>
                <Input
                  id="fecha_compra"
                  name="fecha_compra"
                  type="date"
                  value={form.fecha_compra}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fecha_estimada_llegada">Llegada estimada a USA</Label>
                <Input
                  id="fecha_estimada_llegada"
                  name="fecha_estimada_llegada"
                  type="date"
                  value={form.fecha_estimada_llegada}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Bodega destino */}
            <div className="space-y-2">
              <Label>Ciudad de entrega *</Label>
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
              {form.categoria === 'celular' && form.bodega_destino !== 'barranquilla' && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Los celulares normalmente llegan a Barranquilla. ¿Confirmas Medellín?
                </p>
              )}
            </div>

            {/* Notas */}
            <div className="space-y-2">
              <Label htmlFor="notas_cliente">
                Notas adicionales
                <span className="text-gray-400 font-normal ml-1">(opcional)</span>
              </Label>
              <Textarea
                id="notas_cliente"
                name="notas_cliente"
                placeholder="Instrucciones especiales, observaciones del producto..."
                value={form.notas_cliente}
                onChange={handleChange}
                rows={3}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-md">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-orange-600 hover:bg-orange-700 h-11 text-base"
              disabled={loading}
            >
              {loading ? 'Guardando...' : 'Reportar pedido'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <div className="text-blue-600 mt-0.5">ℹ️</div>
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">¿Cómo funciona?</p>
              <ol className="space-y-1 text-blue-700 list-decimal list-inside">
                <li>Reportas tu pedido aquí con los datos de tu compra</li>
                <li>Tu paquete llega a nuestra bodega en USA</li>
                <li>Te enviamos fotos por WhatsApp cuando llegue</li>
                <li>Lo despachamos a Colombia en 8-12 días hábiles</li>
                <li>Te avisamos cuando esté listo para recoger o entrega</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
