export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Package, PlusCircle, Truck, CheckCircle, Clock, AlertTriangle, MessageCircle, MapPin,
} from 'lucide-react'
import { ESTADO_LABELS, ESTADO_COLORES, CATEGORIA_LABELS, type EstadoPaquete } from '@/types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('*')
    .eq('id', user!.id)
    .single()

  const { data: paquetes } = await supabase
    .from('paquetes')
    .select('*')
    .eq('cliente_id', user!.id)
    .order('created_at', { ascending: false })
    .limit(5)

  const { data: todos } = await supabase
    .from('paquetes')
    .select('estado')
    .eq('cliente_id', user!.id)

  const stats = {
    total: todos?.length ?? 0,
    activos: todos?.filter(p => !['entregado', 'devuelto'].includes(p.estado)).length ?? 0,
    en_transito: todos?.filter(p => ['en_transito', 'en_colombia', 'en_bodega_local', 'en_camino_cliente'].includes(p.estado)).length ?? 0,
    entregados: todos?.filter(p => p.estado === 'entregado').length ?? 0,
  }

  // Nombre a mostrar: primer nombre real, o fallback
  const nombre = perfil?.nombre_completo && perfil.nombre_completo !== perfil.email
    ? perfil.nombre_completo.split(' ')[0]
    : null

  return (
    <div className="space-y-6">
      {/* Bienvenida */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Hola{nombre ? `, ${nombre}` : ''} <span aria-hidden="true">👋</span>
          </h1>
          <p className="text-gray-500">
            {perfil?.numero_casilla
              ? <>Tu casillero es: <span className="font-semibold text-orange-600">{perfil.numero_casilla}</span></>
              : <span className="text-sm">Bienvenido a CeladaShopper</span>
            }
          </p>
        </div>
        <Link
          href="/reportar"
          className={buttonVariants({ variant: 'default' }) + ' bg-orange-600 hover:bg-orange-700 gap-2'}
        >
          <PlusCircle className="h-4 w-4" />
          Reportar pedido
        </Link>
      </div>

      {/* Aviso: WhatsApp faltante o incompleto */}
      {!perfil?.whatsapp && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <MessageCircle className="h-5 w-5 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800">
                Configura tu WhatsApp para recibir notificaciones
              </p>
              <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                Te avisaremos por WhatsApp cuando tu paquete llegue a Miami, vaya en tránsito y esté listo para entrega.
              </p>
              <Link
                href="/perfil"
                className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 hover:text-amber-900 mt-2"
              >
                Agregar mi WhatsApp →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Aviso: dirección de entrega faltante */}
      {!perfil?.direccion && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
              <MapPin className="h-5 w-5 text-orange-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-orange-800">
                Agrega tu dirección de entrega
              </p>
              <p className="text-xs text-orange-700 mt-1 leading-relaxed">
                Necesitamos saber dónde entregarte tus paquetes en Colombia. Sin dirección no podemos coordinar la entrega final.
              </p>
              <Link
                href="/perfil"
                className="inline-flex items-center gap-1 text-xs font-semibold text-orange-800 hover:text-orange-900 mt-2"
              >
                Completar mi dirección →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Estadisticas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Package className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold" aria-label={`${stats.total} paquetes en total`}>{stats.total}</p>
                <p className="text-xs text-gray-500">Total paquetes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold" aria-label={`${stats.activos} paquetes en proceso`}>{stats.activos}</p>
                <p className="text-xs text-gray-500">En proceso</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Truck className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold" aria-label={`${stats.en_transito} paquetes en tránsito`}>{stats.en_transito}</p>
                <p className="text-xs text-gray-500">En tránsito</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold" aria-label={`${stats.entregados} paquetes entregados`}>{stats.entregados}</p>
                <p className="text-xs text-gray-500">Entregados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Paquetes recientes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Paquetes recientes</CardTitle>
          <Link href="/paquetes" className="text-sm text-orange-600 hover:underline">
            Ver todos
          </Link>
        </CardHeader>
        <CardContent>
          {!paquetes || paquetes.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No tienes paquetes reportados aún</p>
              <Link
                href="/reportar"
                className={buttonVariants({ variant: 'outline' }) + ' mt-3 gap-2'}
              >
                <PlusCircle className="h-4 w-4" />
                Reportar tu primer pedido
              </Link>
            </div>
          ) : (
            <div className="divide-y">
              {paquetes.map(paquete => (
                <Link
                  key={paquete.id}
                  href={`/paquetes/${paquete.id}`}
                  className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-2 px-2 rounded-md transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{paquete.descripcion}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500">{paquete.tienda}</span>
                      <span className="text-gray-300">•</span>
                      <span className="text-xs text-gray-400 font-mono">{paquete.tracking_casilla}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Badge className={`text-xs ${ESTADO_COLORES[paquete.estado as EstadoPaquete]}`}>
                      {ESTADO_LABELS[paquete.estado as EstadoPaquete]}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Direccion bodega USA */}
      <Card className="bg-orange-50 border-orange-200">
        <CardHeader>
          <CardTitle className="text-base text-orange-800">📦 Tu dirección en USA para hacer compras</CardTitle>
          <p className="text-xs text-orange-700 mt-1">Copia estos datos exactamente como aparecen cuando te pidan la dirección de envío en la tienda.</p>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Aviso sin casillero */}
          {!perfil?.numero_casilla && (
            <div className="bg-amber-100 border border-amber-300 rounded-lg p-3 text-sm text-amber-800 font-medium">
              ⏳ Tu número de casillero está siendo asignado. No hagas compras aún — te avisamos cuando esté listo.
            </div>
          )}

          {/* Tarjeta de dirección campo por campo */}
          <div className="bg-white rounded-xl border-2 border-orange-300 divide-y divide-orange-100 overflow-hidden text-sm">

            {/* Nombre */}
            <div className="p-3 space-y-0.5">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                👤 Nombre / <span className="italic">Name / Recipient</span>
              </p>
              <p className="font-bold text-orange-900 font-mono text-base">
                Diego Celada{perfil?.numero_casilla && <span className="text-orange-600"> {perfil.numero_casilla}</span>}
              </p>
              <p className="text-[11px] text-gray-400">Tu nombre + tu número de casillero. Así te identificamos cuando llega el paquete.</p>
            </div>

            {/* Dirección */}
            <div className="p-3 space-y-0.5">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                🏠 Dirección / <span className="italic">Address / Street</span>
              </p>
              <p className="font-bold text-orange-900 font-mono text-base">8164 NW 108th Pl</p>
              <p className="text-[11px] text-gray-400">La calle de nuestra bodega en Miami. Escríbela tal cual.</p>
            </div>

            {/* Ciudad */}
            <div className="p-3 space-y-0.5">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                🏙️ Ciudad / <span className="italic">City, State, ZIP</span>
              </p>
              <p className="font-bold text-orange-900 font-mono text-base">Doral, FL 33178</p>
              <p className="text-[11px] text-gray-400">Ciudad: Doral · Estado: FL (Florida) · Código postal: 33178</p>
            </div>

            {/* País */}
            <div className="p-3 space-y-0.5">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                🌎 País / <span className="italic">Country</span>
              </p>
              <p className="font-bold text-orange-900 font-mono text-base">United States</p>
              <p className="text-[11px] text-gray-400">Estados Unidos. Algunas tiendas piden seleccionarlo de una lista.</p>
            </div>

            {/* Teléfono */}
            <div className="p-3 space-y-0.5">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                📞 Teléfono / <span className="italic">Phone</span>
              </p>
              <p className="font-bold text-orange-900 font-mono text-base">+1 (786) 000-0000</p>
              <p className="text-[11px] text-gray-400">Úsalo si la tienda exige un número. Es el teléfono de nuestra bodega.</p>
            </div>
          </div>

          {/* Instrucciones simples */}
          <div className="bg-orange-100/70 border border-orange-200 rounded-xl p-4 space-y-3 text-sm text-orange-900">
            <p className="font-bold">⚠️ Importante: ¿cómo llenar el formulario de envío en la tienda?</p>
            <div className="space-y-2">
              <div className="flex gap-2">
                <span className="bg-orange-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</span>
                <p>En el campo <strong>Nombre / Recipient / Name</strong>, escribe esto exactamente:</p>
              </div>
              <p className="font-mono bg-white border border-orange-200 rounded-lg px-3 py-2 ml-7 text-orange-800 font-bold">
                Diego Celada {perfil?.numero_casilla ?? '[tu casillero]'}
              </p>
              <div className="flex gap-2">
                <span className="bg-orange-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</span>
                <p>Copia la dirección, ciudad, estado y ZIP <strong>exactamente como aparecen arriba</strong>. No cambies nada.</p>
              </div>
              <div className="flex gap-2">
                <span className="bg-orange-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</span>
                <p>Después de hacer la compra, <strong>repórtanos el pedido</strong> desde el menú para que lo tengamos en el radar.</p>
              </div>
            </div>
          </div>

          {/* Si la tienda no deja poner el número */}
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-xs text-amber-900 space-y-1.5">
            <p className="font-semibold">💡 ¿La tienda no te deja poner tu número de casillero?</p>
            <p className="leading-relaxed">No hay problema. Escribe solo tu nombre completo tal como está registrado aquí:</p>
            {perfil?.nombre_completo && (
              <p className="font-mono bg-white border border-amber-200 rounded px-2 py-1.5 font-bold text-amber-900">
                {perfil.nombre_completo}
              </p>
            )}
            <p className="text-amber-700">Lo identificamos igual cuando llega a la bodega.</p>
          </div>

        </CardContent>
      </Card>
    </div>
  )
}
