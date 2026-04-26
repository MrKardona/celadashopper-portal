'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Search, ScanLine, Camera, Scale, CheckCircle,
  Package, AlertCircle, Loader2, ChevronDown, ChevronUp
} from 'lucide-react'
import {
  ESTADO_LABELS, ESTADO_COLORES, CATEGORIA_LABELS,
  type EstadoPaquete, type CategoriaProducto, type TarifaCategoria
} from '@/types'

const ESTADOS_AGENTE: EstadoPaquete[] = [
  'recibido_usa', 'en_consolidacion', 'listo_envio', 'en_transito'
]

export default function AgentePanel({
  paquetes: initialPaquetes,
  tarifas,
  agenteId,
}: {
  paquetes: any[]
  tarifas: TarifaCategoria[]
  agenteId: string
}) {
  const supabase = createClient()
  const [paquetes, setPaquetes] = useState(initialPaquetes)
  const [busqueda, setBusqueda] = useState('')
  const [paqueteActivo, setPaqueteActivo] = useState<any | null>(null)
  const [peso, setPeso] = useState('')
  const [estado, setEstado] = useState<EstadoPaquete>('recibido_usa')
  const [trackingUsaco, setTrackingUsaco] = useState('')
  const [uploading, setUploading] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const tarifaMap = Object.fromEntries(tarifas.map(t => [t.categoria, t.tarifa_por_libra]))

  const paquetesFiltrados = paquetes.filter(p => {
    const q = busqueda.toLowerCase()
    return (
      p.tracking_casilla?.toLowerCase().includes(q) ||
      p.tracking_origen?.toLowerCase().includes(q) ||
      p.perfiles?.numero_casilla?.toLowerCase().includes(q) ||
      p.perfiles?.nombre_completo?.toLowerCase().includes(q) ||
      p.descripcion?.toLowerCase().includes(q)
    )
  })

  function seleccionarPaquete(p: any) {
    setPaqueteActivo(p)
    setPeso(p.peso_libras?.toString() ?? '')
    setEstado(p.estado)
    setTrackingUsaco(p.tracking_usaco ?? '')
    setMensaje(null)
  }

  function calcularCosto(pesoLbs: number, categoria: CategoriaProducto): number {
    const tarifa = tarifaMap[categoria] ?? 0
    return pesoLbs * tarifa
  }

  async function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    if (!paqueteActivo || !e.target.files?.length) return
    setUploading(true)

    const file = e.target.files[0]
    const path = `paquetes/${paqueteActivo.id}/${Date.now()}-${file.name}`

    const { error: uploadError } = await supabase.storage
      .from('fotos-paquetes')
      .upload(path, file)

    if (uploadError) {
      setMensaje({ tipo: 'error', texto: 'Error al subir la foto' })
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('fotos-paquetes')
      .getPublicUrl(path)

    await supabase.from('fotos_paquetes').insert({
      paquete_id: paqueteActivo.id,
      url: publicUrl,
      storage_path: path,
      subida_por: agenteId,
    })

    setMensaje({ tipo: 'ok', texto: 'Foto subida. El cliente será notificado.' })
    setUploading(false)
  }

  async function handleGuardar() {
    if (!paqueteActivo) return
    setGuardando(true)
    setMensaje(null)

    const pesoNum = parseFloat(peso)
    const costoServicio = peso && !isNaN(pesoNum)
      ? calcularCosto(pesoNum, paqueteActivo.categoria)
      : undefined

    const updates: any = {
      estado,
      agente_recepcion_id: agenteId,
    }

    if (peso && !isNaN(pesoNum)) {
      updates.peso_libras = pesoNum
      updates.peso_facturable = pesoNum
      updates.tarifa_aplicada = tarifaMap[paqueteActivo.categoria] ?? 0
      updates.costo_servicio = costoServicio
    }

    if (estado === 'recibido_usa' && !paqueteActivo.fecha_recepcion_usa) {
      updates.fecha_recepcion_usa = new Date().toISOString()
    }

    if (trackingUsaco) {
      updates.tracking_usaco = trackingUsaco
    }

    const { error } = await supabase
      .from('paquetes')
      .update(updates)
      .eq('id', paqueteActivo.id)

    setGuardando(false)

    if (error) {
      setMensaje({ tipo: 'error', texto: 'Error al guardar. Intenta de nuevo.' })
      return
    }

    setPaquetes(prev => prev.map(p =>
      p.id === paqueteActivo.id ? { ...p, ...updates } : p
    ))
    setPaqueteActivo((prev: any) => ({ ...prev, ...updates }))
    setMensaje({ tipo: 'ok', texto: '¡Guardado correctamente!' })
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Buscador / escaner */}
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="pt-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                className="pl-9 bg-gray-700 border-gray-600 text-white placeholder:text-gray-400"
                placeholder="Escanea o busca: casilla, tracking, nombre..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                autoFocus
              />
            </div>
            <Button variant="outline" className="border-gray-600 text-gray-300 gap-2" onClick={() => setBusqueda('')}>
              <ScanLine className="h-4 w-4" />
              <span className="hidden sm:block">Limpiar</span>
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {paquetesFiltrados.length} paquetes • Coloca el cursor aquí y escanea el código de barras
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Lista de paquetes */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
            Paquetes pendientes ({paquetesFiltrados.length})
          </h2>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {paquetesFiltrados.map(p => (
              <Card
                key={p.id}
                className={`cursor-pointer border transition-colors ${
                  paqueteActivo?.id === p.id
                    ? 'bg-orange-900 border-orange-500'
                    : 'bg-gray-800 border-gray-700 hover:border-gray-500'
                }`}
                onClick={() => seleccionarPaquete(p)}
              >
                <CardContent className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-orange-400">{p.perfiles?.numero_casilla}</span>
                        <Badge className={`text-xs ${ESTADO_COLORES[p.estado as EstadoPaquete]}`}>
                          {ESTADO_LABELS[p.estado as EstadoPaquete]}
                        </Badge>
                      </div>
                      <p className="text-sm text-white mt-1 truncate">{p.descripcion}</p>
                      <p className="text-xs text-gray-400">{p.perfiles?.nombre_completo} • {p.tienda}</p>
                      <p className="text-xs font-mono text-gray-500 mt-0.5">{p.tracking_casilla}</p>
                    </div>
                    {p.peso_libras && (
                      <span className="text-xs text-gray-400 flex-shrink-0">{p.peso_libras} lbs</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {paquetesFiltrados.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Sin paquetes que coincidan</p>
              </div>
            )}
          </div>
        </div>

        {/* Panel de accion */}
        <div>
          {paqueteActivo ? (
            <Card className="bg-gray-800 border-gray-700 sticky top-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-white flex items-center justify-between">
                  <span className="truncate">{paqueteActivo.descripcion}</span>
                  <span className="text-orange-400 text-sm font-mono flex-shrink-0 ml-2">
                    {paqueteActivo.perfiles?.numero_casilla}
                  </span>
                </CardTitle>
                <p className="text-sm text-gray-400">{paqueteActivo.perfiles?.nombre_completo}</p>
              </CardHeader>
              <CardContent className="space-y-4">

                {/* Estado */}
                <div className="space-y-2">
                  <Label className="text-gray-300">Estado del paquete</Label>
                  <Select value={estado} onValueChange={val => setEstado(val as EstadoPaquete)}>
                    <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ESTADOS_AGENTE.map(e => (
                        <SelectItem key={e} value={e}>{ESTADO_LABELS[e]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Peso */}
                <div className="space-y-2">
                  <Label className="text-gray-300 flex items-center gap-2">
                    <Scale className="h-4 w-4" />
                    Peso en libras
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={peso}
                    onChange={e => setPeso(e.target.value)}
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                  {peso && !isNaN(parseFloat(peso)) && (
                    <p className="text-sm text-orange-400">
                      Costo estimado: $
                      {calcularCosto(parseFloat(peso), paqueteActivo.categoria).toFixed(2)} USD
                      <span className="text-gray-500 ml-1">
                        ({tarifaMap[paqueteActivo.categoria] ?? 0} x {peso} lbs)
                      </span>
                    </p>
                  )}
                </div>

                {/* Tracking USACO */}
                <div className="space-y-2">
                  <Label className="text-gray-300">Tracking USACO</Label>
                  <Input
                    placeholder="Tracking de despacho..."
                    value={trackingUsaco}
                    onChange={e => setTrackingUsaco(e.target.value)}
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>

                {/* Fotos */}
                <div className="space-y-2">
                  <Label className="text-gray-300 flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    Subir foto del paquete
                  </Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFoto}
                  />
                  <Button
                    variant="outline"
                    className="w-full border-gray-600 text-gray-300 hover:bg-gray-700 gap-2"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Subiendo...</>
                    ) : (
                      <><Camera className="h-4 w-4" /> Tomar foto / Subir imagen</>
                    )}
                  </Button>
                </div>

                {/* Mensaje */}
                {mensaje && (
                  <div className={`flex items-center gap-2 p-3 rounded-md text-sm ${
                    mensaje.tipo === 'ok' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                  }`}>
                    {mensaje.tipo === 'ok'
                      ? <CheckCircle className="h-4 w-4 flex-shrink-0" />
                      : <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    }
                    {mensaje.texto}
                  </div>
                )}

                {/* Guardar */}
                <Button
                  className="w-full bg-orange-600 hover:bg-orange-700 gap-2 h-11"
                  onClick={handleGuardar}
                  disabled={guardando}
                >
                  {guardando ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</>
                  ) : (
                    <><CheckCircle className="h-4 w-4" /> Guardar cambios</>
                  )}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-gray-600">
              <ScanLine className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">Selecciona un paquete para gestionarlo</p>
              <p className="text-xs mt-1">O escanea el código con la pistola</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
