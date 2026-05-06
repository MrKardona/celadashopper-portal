'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Package, CheckCircle, AlertCircle, AlertTriangle, MapPin } from 'lucide-react'
import Link from 'next/link'
import { CATEGORIA_LABELS, ESTADO_LABELS, type CategoriaProducto, type BodegaDestino, type EstadoPaquete } from '@/types'

const BODEGAS: { value: BodegaDestino; label: string }[] = [
  { value: 'medellin', label: 'Medellín' },
  { value: 'bogota', label: 'Bogotá' },
  { value: 'barranquilla', label: 'Barranquilla (celulares)' },
]

type DuplicadoPropio = {
  tipo: 'propio'
  tracking_casilla: string
  descripcion: string
  estado: string
}
type DuplicadoOtro = { tipo: 'otro' }
type Duplicado = DuplicadoPropio | DuplicadoOtro | null

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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [duplicado, setDuplicado] = useState<Duplicado>(null)
  const [exito, setExito] = useState<{ tracking: string; match?: boolean } | null>(null)

  // Cotización estimada (se calcula cuando el cliente cambia categoría/condición/cantidad/valor)
  const [cotizacion, setCotizacion] = useState<{
    subtotal_envio: number
    seguro: number
    total: number
    metodo: string
    detalle: string
    requiere_peso?: boolean
    peso_minimo?: number
  } | null>(null)

  useEffect(() => {
    if (!form.categoria) { setCotizacion(null); return }
    // Para celular y computador necesitamos condición
    const requiereCondicion = form.categoria === 'celular' || form.categoria === 'computador'
    if (requiereCondicion && !form.condicion) { setCotizacion(null); return }

    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      try {
        const res = await fetch('/api/portal/cotizar', {
          method: 'POST',
          signal: ctrl.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            categoria: form.categoria,
            condicion: form.condicion || null,
            cantidad: form.cantidad ? parseInt(form.cantidad, 10) || 1 : 1,
            valor_declarado: form.valor_declarado ? parseFloat(form.valor_declarado) : null,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          setCotizacion(data)
        }
      } catch { /* ignorar abort */ }
    }, 300)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [form.categoria, form.condicion, form.cantidad, form.valor_declarado])

  // Dirección de entrega: cliente puede usar la guardada en su perfil u otra puntual.
  const [direccionPerfil, setDireccionPerfil] = useState<{
    direccion: string | null
    barrio: string | null
    referencia: string | null
  } | null>(null)
  const [direccionOpcion, setDireccionOpcion] = useState<'guardada' | 'otra'>('guardada')
  const [direccionOtra, setDireccionOtra] = useState({ direccion: '', barrio: '', referencia: '' })

  useEffect(() => {
    let cancelado = false
    async function cargarPerfil() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('perfiles')
        .select('direccion, barrio, referencia')
        .eq('id', user.id)
        .single()
      if (cancelado) return
      if (data) {
        setDireccionPerfil(data)
        // Si el cliente no tiene dirección guardada, ofrecer "otra" por defecto
        if (!data.direccion) setDireccionOpcion('otra')
      }
    }
    cargarPerfil()
    return () => { cancelado = true }
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    // Limpiar alertas de duplicado si cambia el tracking
    if (e.target.name === 'tracking_origen') setDuplicado(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setDuplicado(null)

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

    // Determinar la dirección que se enviará con el paquete.
    // - Si elige "guardada" y el perfil tiene dirección, copiamos esos campos.
    // - Si elige "otra", usamos lo que escribió.
    // Snapshotear la dirección al paquete asegura que cambios futuros del perfil
    // no afecten paquetes ya reportados.
    const direccionPayload =
      direccionOpcion === 'otra'
        ? {
            direccion_entrega: direccionOtra.direccion.trim() || null,
            barrio_entrega: direccionOtra.barrio.trim() || null,
            referencia_entrega: direccionOtra.referencia.trim() || null,
          }
        : {
            direccion_entrega: direccionPerfil?.direccion ?? null,
            barrio_entrega: direccionPerfil?.barrio ?? null,
            referencia_entrega: direccionPerfil?.referencia ?? null,
          }

    const res = await fetch('/api/portal/reportar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tienda: form.tienda,
        tracking_origen: form.tracking_origen || null,
        descripcion: form.descripcion,
        categoria: form.categoria,
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
      ok?: boolean
      error?: string
      tracking_casilla?: string
      match?: boolean
      descripcion?: string
      estado?: string
    }

    // ── Tracking duplicado: ya lo tienes tú ─────────────────────────────────
    if (res.status === 409 && data.error === 'duplicate_own') {
      setDuplicado({
        tipo: 'propio',
        tracking_casilla: data.tracking_casilla ?? '',
        descripcion: data.descripcion ?? '',
        estado: data.estado ?? '',
      })
      return
    }

    // ── Tracking duplicado: lo tiene otro cliente ────────────────────────────
    if (res.status === 409 && data.error === 'duplicate_other') {
      setDuplicado({ tipo: 'otro' })
      return
    }

    if (!res.ok || !data.ok) {
      setError(data.error ?? 'Error al guardar el pedido. Intenta de nuevo.')
      return
    }

    setExito({ tracking: data.tracking_casilla ?? '', match: data.match })
  }

  // ── Pantalla de éxito ──────────────────────────────────────────────────────
  if (exito) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <Card className={exito.match ? 'border-orange-300 bg-orange-50' : 'border-green-200 bg-green-50'}>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center gap-4">
              <CheckCircle className={`h-12 w-12 ${exito.match ? 'text-orange-500' : 'text-green-600'}`} />
              <div>
                {exito.match ? (
                  <>
                    <h2 className="text-xl font-bold text-orange-800">¡Tu paquete ya está aquí! 🎉</h2>
                    <p className="text-orange-700 mt-1">
                      Encontramos tu paquete en nuestra bodega de Miami. Te enviamos una notificación por WhatsApp con los detalles.
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="text-xl font-bold text-green-800">¡Pedido reportado!</h2>
                    <p className="text-green-700 mt-1">Tu paquete ha sido registrado exitosamente.</p>
                  </>
                )}
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
                      categoria: '', condicion: '', cantidad: '1',
                      valor_declarado: '', fecha_compra: '',
                      fecha_estimada_llegada: '', bodega_destino: 'medellin', notas_cliente: '',
                      requiere_consolidacion: false, notas_consolidacion: '',
                    })
                  }}
                >
                  Reportar otro
                </Button>
                <Button
                  className="flex-1 bg-orange-600 hover:bg-orange-700"
                  onClick={() => { window.location.href = '/paquetes' }}
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

  // ── Formulario principal ───────────────────────────────────────────────────
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

            {/* Aviso especial: tarifa se calcula al consolidar */}
            {form.categoria === 'tarifa_especial' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-900 uppercase tracking-wide">
                  Tarifa especial
                </p>
                <p className="text-sm text-blue-800 mt-1 leading-relaxed">
                  El costo de este envío <strong>se calcula al hacer la consolidación completa</strong>.
                  Un agente revisará el paquete y te confirmará el costo final.
                </p>
              </div>
            )}

            {/* Condición, cantidad y cotización (no aplica para tarifa especial, juguetes ni otro) */}
            {form.categoria && form.categoria !== 'juguetes' && form.categoria !== 'otro' && form.categoria !== 'tarifa_especial' && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 space-y-3">
                <p className="text-xs font-semibold text-orange-900 uppercase tracking-wide">
                  Datos para calcular tarifa
                </p>

                <div className="grid grid-cols-2 gap-3">
                  {/* Condición solo para celular y computador */}
                  {(form.categoria === 'celular' || form.categoria === 'computador') && (
                    <div className="space-y-2 col-span-2 sm:col-span-1">
                      <Label>Condición *</Label>
                      <Select
                        value={form.condicion}
                        onValueChange={val => setForm(prev => ({ ...prev, condicion: val as 'nuevo' | 'usado' }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Nuevo o usado..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nuevo">Nuevo (en caja)</SelectItem>
                          <SelectItem value="usado">Usado (sin caja)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2 col-span-2 sm:col-span-1">
                    <Label htmlFor="cantidad">
                      {form.categoria === 'calzado' ? 'Pares' : 'Cantidad de unidades'} *
                    </Label>
                    <Input
                      id="cantidad"
                      name="cantidad"
                      type="number"
                      min="1"
                      placeholder="1"
                      value={form.cantidad}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                {/* Pista contextual por categoría */}
                {form.categoria === 'celular' && form.condicion === 'usado' && (
                  <p className="text-[11px] text-orange-800 leading-relaxed">
                    💡 Tarifas por cantidad: 1-4 uds = $55/u · 5-9 uds = $45/u · +10 uds = $40/u
                  </p>
                )}
                {form.categoria === 'celular' && form.condicion === 'nuevo' && (
                  <p className="text-[11px] text-orange-800 leading-relaxed">💡 Celular nuevo: $75 por unidad</p>
                )}
                {form.categoria === 'computador' && form.condicion && (
                  <p className="text-[11px] text-orange-800 leading-relaxed">
                    💡 {form.condicion === 'usado' ? '$55' : '$75'} por unidad + 4% del valor declarado
                  </p>
                )}
                {form.categoria === 'ipad_tablet' && (
                  <p className="text-[11px] text-orange-800 leading-relaxed">
                    💡 Si valor &gt; $200 → $45/u + 4% seguro · Si vale ≤ $200 → $18 fijo + $2.20/lb
                  </p>
                )}
                {form.categoria === 'calzado' && (
                  <p className="text-[11px] text-orange-800 leading-relaxed">
                    💡 1 par = $20 · 2 o más pares = $17.50 cada par
                  </p>
                )}
                {['ropa_accesorios', 'cosmeticos', 'suplementos', 'libros', 'electrodomestico'].includes(form.categoria) && (
                  <p className="text-[11px] text-orange-800 leading-relaxed">
                    💡 Hasta 6 uds y valor ≤ $200: $18 fijo + $2.20/lb · 7+ uds o valor &gt; $200: $6.50/lb (mín 5 lb)
                  </p>
                )}

                {/* Cotización */}
                {cotizacion && cotizacion.metodo !== 'sin_tarifa' && (
                  <div className="bg-white border-2 border-orange-300 rounded-lg p-3 mt-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] text-orange-700 uppercase font-bold tracking-wide">
                          {cotizacion.requiere_peso ? 'Costo estimado mínimo' : 'Costo estimado'}
                        </p>
                        <p className="text-2xl font-bold text-orange-700">
                          {cotizacion.requiere_peso ? 'desde ' : ''}
                          ${cotizacion.total.toFixed(2)}{' '}
                          <span className="text-xs font-normal text-gray-500">USD</span>
                        </p>
                      </div>
                      {!cotizacion.requiere_peso && (
                        <div className="text-right text-[11px] text-gray-600">
                          <p>Envío: ${cotizacion.subtotal_envio.toFixed(2)}</p>
                          {cotizacion.seguro > 0 && <p>Seguro: ${cotizacion.seguro.toFixed(2)}</p>}
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">
                      {cotizacion.detalle}
                      {!cotizacion.requiere_peso && '. Costo final lo confirma el agente al recibir.'}
                    </p>
                  </div>
                )}
              </div>
            )}

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
                  className={duplicado ? 'border-amber-400 focus-visible:ring-amber-400/30' : ''}
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

            {/* ── Alerta: tracking ya registrado por este usuario ── */}
            {duplicado?.tipo === 'propio' && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">
                      ¡Este tracking ya está en tu cuenta!
                    </p>
                    <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                      Ya registraste este número de tracking anteriormente:
                    </p>
                    <div className="mt-2 bg-white rounded-lg px-3 py-2 border border-amber-200">
                      <p className="text-xs text-gray-500">Número CeladaShopper</p>
                      <p className="font-mono font-bold text-orange-600">{duplicado.tracking_casilla}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{duplicado.descripcion}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Estado: {ESTADO_LABELS[duplicado.estado as EstadoPaquete] ?? duplicado.estado}
                      </p>
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={() => { window.location.href = '/paquetes' }}
                >
                  Ver mis paquetes
                </Button>
              </div>
            )}

            {/* ── Alerta: tracking registrado por otro cliente ── */}
            {duplicado?.tipo === 'otro' && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-800">
                      Tracking ya registrado
                    </p>
                    <p className="text-xs text-red-700 mt-1 leading-relaxed">
                      Este número de tracking ya fue ingresado por otro cliente. Si crees que hay un error, comunícate con nosotros por WhatsApp.
                    </p>
                  </div>
                </div>
              </div>
            )}

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

            {/* Dirección de entrega (cascada: guardada / otra) */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-orange-600" />
                Dirección de entrega *
              </Label>
              <Select
                value={direccionOpcion}
                onValueChange={val => setDireccionOpcion(val as 'guardada' | 'otra')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {direccionPerfil?.direccion && (
                    <SelectItem value="guardada">
                      📍 Mi dirección guardada
                    </SelectItem>
                  )}
                  <SelectItem value="otra">
                    ✏️ Otra dirección (puntual)
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Mostrar la dirección guardada como tarjeta de info */}
              {direccionOpcion === 'guardada' && direccionPerfil?.direccion && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm">
                  <p className="text-gray-900">{direccionPerfil.direccion}</p>
                  {(direccionPerfil.barrio || direccionPerfil.referencia) && (
                    <p className="text-xs text-gray-600 mt-1">
                      {direccionPerfil.barrio && <span>Barrio: {direccionPerfil.barrio}</span>}
                      {direccionPerfil.barrio && direccionPerfil.referencia && <span> · </span>}
                      {direccionPerfil.referencia && <span>{direccionPerfil.referencia}</span>}
                    </p>
                  )}
                  <Link
                    href="/perfil"
                    className="inline-block mt-2 text-[11px] text-orange-700 font-medium hover:underline"
                  >
                    Cambiar dirección guardada en mi perfil →
                  </Link>
                </div>
              )}

              {/* Si NO hay dirección guardada, avisar */}
              {direccionOpcion === 'guardada' && !direccionPerfil?.direccion && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                  Aún no has registrado una dirección en tu perfil.{' '}
                  <Link href="/perfil" className="font-semibold underline">Agregarla</Link>{' '}
                  o usa la opción &quot;Otra dirección&quot; para este paquete.
                </div>
              )}

              {/* Si elige "otra", mostrar inputs */}
              {direccionOpcion === 'otra' && (
                <div className="space-y-2 bg-white border border-gray-200 rounded-lg p-3">
                  <div>
                    <Label htmlFor="direccion_otra" className="text-xs">Dirección *</Label>
                    <Textarea
                      id="direccion_otra"
                      placeholder="Calle 10 #45-20, Apto 502, Torre B"
                      rows={2}
                      value={direccionOtra.direccion}
                      onChange={e => setDireccionOtra(p => ({ ...p, direccion: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="barrio_otra" className="text-xs">Barrio</Label>
                      <Input
                        id="barrio_otra"
                        placeholder="Poblado"
                        value={direccionOtra.barrio}
                        onChange={e => setDireccionOtra(p => ({ ...p, barrio: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="referencia_otra" className="text-xs">Referencia</Label>
                      <Input
                        id="referencia_otra"
                        placeholder="Cerca al parque"
                        value={direccionOtra.referencia}
                        onChange={e => setDireccionOtra(p => ({ ...p, referencia: e.target.value }))}
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    Esta dirección se usará solo para este paquete. Tu dirección del perfil no cambia.
                  </p>
                </div>
              )}
            </div>

            {/* Consolidación */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.requiere_consolidacion}
                  onChange={e => setForm(p => ({ ...p, requiere_consolidacion: e.target.checked }))}
                  className="h-4 w-4 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900">
                    📦 Necesito consolidar este paquete con otros
                  </p>
                  <p className="text-[11px] text-blue-700 mt-0.5 leading-relaxed">
                    Marca esta opción si vas a enviar más paquetes y quieres que esperemos a tener
                    todos antes de despacharlos juntos a Colombia. Si no, lo despachamos en cuanto llegue.
                  </p>
                </div>
              </label>
              {form.requiere_consolidacion && (
                <Textarea
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

            {/* No mostrar el botón si hay un duplicado propio (ya tiene el paquete) */}
            {!duplicado && (
              <Button
                type="submit"
                className="w-full bg-orange-600 hover:bg-orange-700 h-11 text-base"
                disabled={loading}
              >
                {loading ? 'Guardando...' : 'Reportar pedido'}
              </Button>
            )}

            {/* Con duplicado de otro cliente, permitir continuar sin tracking */}
            {duplicado?.tipo === 'otro' && (
              <Button
                type="button"
                variant="outline"
                className="w-full h-11"
                onClick={() => {
                  setDuplicado(null)
                  setForm(prev => ({ ...prev, tracking_origen: '' }))
                }}
              >
                Registrar sin número de tracking
              </Button>
            )}

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
