'use client'

import { useEffect, useState } from 'react'
import { Search, X, UserCheck, Loader2, CheckCircle, AlertCircle, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ClienteResult {
  id: string
  nombre_completo: string
  email: string
  numero_casilla: string | null
  whatsapp: string | null
  telefono: string | null
  ciudad: string | null
}

interface Props {
  paqueteId: string
  trackingCasilla: string
  descripcion: string
  clienteActual?: { nombre: string; casilla: string | null } | null
  // Variante visual: 'primary' para sin asignar (naranja), 'subtle' para reasignar
  variante?: 'primary' | 'subtle'
}

export default function AsignarClienteButton({
  paqueteId, trackingCasilla, descripcion, clienteActual, variante = 'primary',
}: Props) {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <Button
        type="button"
        variant={variante === 'primary' ? 'default' : 'outline'}
        className={variante === 'primary'
          ? 'w-full bg-orange-600 hover:bg-orange-700 text-white gap-2'
          : 'w-full gap-2 text-xs'}
        onClick={() => setAbierto(true)}
        size={variante === 'subtle' ? 'sm' : undefined}
      >
        <UserCheck className="h-4 w-4" />
        {clienteActual ? 'Reasignar a otro cliente' : 'Asignar a un cliente'}
      </Button>

      {abierto && (
        <ModalAsignar
          paqueteId={paqueteId}
          trackingCasilla={trackingCasilla}
          descripcion={descripcion}
          clienteActual={clienteActual}
          onClose={() => setAbierto(false)}
        />
      )}
    </>
  )
}

// ─── Modal con buscador y selección ─────────────────────────────────────────
function ModalAsignar({
  paqueteId, trackingCasilla, descripcion, clienteActual, onClose,
}: {
  paqueteId: string
  trackingCasilla: string
  descripcion: string
  clienteActual?: { nombre: string; casilla: string | null } | null
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState<ClienteResult[]>([])
  const [buscando, setBuscando] = useState(false)
  const [seleccionado, setSeleccionado] = useState<ClienteResult | null>(null)
  const [notificar, setNotificar] = useState(true)
  const [asignando, setAsignando] = useState(false)
  const [resultado, setResultado] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  // Búsqueda con debounce
  useEffect(() => {
    if (seleccionado) return // si ya hay seleccionado, no buscar

    const t = setTimeout(async () => {
      setBuscando(true)
      try {
        const res = await fetch(`/api/admin/clientes/buscar?q=${encodeURIComponent(query)}`)
        const data = await res.json() as { clientes?: ClienteResult[] }
        setResultados(data.clientes ?? [])
      } catch {
        setResultados([])
      } finally {
        setBuscando(false)
      }
    }, 250)

    return () => clearTimeout(t)
  }, [query, seleccionado])

  async function asignar() {
    if (!seleccionado) return
    setAsignando(true)
    setResultado(null)

    const res = await fetch(`/api/admin/paquetes/${paqueteId}/asignar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cliente_id: seleccionado.id, notificar }),
    })
    const data = await res.json() as {
      ok?: boolean
      error?: string
      cliente?: { nombre: string }
      notificacion?: { intentada: boolean; enviada: boolean; error?: string; sin_telefono?: boolean }
    }

    if (!res.ok || !data.ok) {
      setAsignando(false)
      setResultado({ tipo: 'error', texto: data.error ?? 'No se pudo asignar' })
      return
    }

    let texto = `✅ Asignado a ${data.cliente?.nombre}.`
    if (data.notificacion?.intentada) {
      if (data.notificacion.enviada) texto += ' WhatsApp enviado.'
      else if (data.notificacion.sin_telefono) texto += ' Cliente sin teléfono — sin WhatsApp.'
      else texto += ` WhatsApp falló: ${data.notificacion.error ?? 'error desconocido'}`
    }
    setResultado({ tipo: 'ok', texto })
    setTimeout(() => { window.location.reload() }, 1200)
  }

  function cerrar() {
    if (asignando) return
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={cerrar}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900">
              {clienteActual ? 'Reasignar paquete' : 'Asignar paquete a cliente'}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5 font-mono">{trackingCasilla}</p>
            <p className="text-xs text-gray-600 truncate mt-0.5">{descripcion}</p>
            {clienteActual && (
              <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded mt-2 inline-block">
                Actualmente asignado a: <span className="font-medium">{clienteActual.nombre}</span>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={cerrar}
            disabled={asignando}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50 ml-2"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Buscador */}
        <div className="p-5 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              autoFocus
              value={seleccionado ? `${seleccionado.nombre_completo} (${seleccionado.numero_casilla ?? '—'})` : query}
              onChange={e => {
                setQuery(e.target.value)
                if (seleccionado) setSeleccionado(null)
              }}
              placeholder="Buscar cliente por nombre, email, casilla o teléfono..."
              className="w-full pl-9 pr-9 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            {seleccionado && (
              <button
                type="button"
                onClick={() => { setSeleccionado(null); setQuery('') }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                title="Limpiar selección"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Lista de resultados (oculta si ya hay seleccionado) */}
        {!seleccionado && (
          <div className="flex-1 overflow-y-auto px-2 py-2 min-h-[200px] max-h-[300px]">
            {buscando ? (
              <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Buscando...
              </div>
            ) : resultados.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-400 text-sm gap-1">
                <Search className="h-6 w-6 opacity-30" />
                {query ? 'Sin resultados' : 'Empieza a escribir para buscar'}
              </div>
            ) : (
              <ul className="space-y-1">
                {resultados.map(c => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSeleccionado(c)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-orange-50 transition-colors group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{c.nombre_completo}</p>
                          <p className="text-xs text-gray-500 truncate">{c.email}</p>
                          {(c.whatsapp ?? c.telefono) && (
                            <p className="text-xs text-green-600 mt-0.5">{c.whatsapp ?? c.telefono}</p>
                          )}
                        </div>
                        <div className="text-right ml-3">
                          <p className="text-xs font-mono text-orange-600 font-semibold">{c.numero_casilla ?? '—'}</p>
                          {c.ciudad && <p className="text-[11px] text-gray-400 capitalize">{c.ciudad}</p>}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Vista del cliente seleccionado */}
        {seleccionado && (
          <div className="p-5 border-b border-gray-100 bg-orange-50/40">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <UserCheck className="h-5 w-5 text-orange-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{seleccionado.nombre_completo}</p>
                <p className="text-xs text-gray-500">{seleccionado.email}</p>
                <div className="flex gap-3 mt-1 text-xs">
                  <span className="font-mono text-orange-600 font-semibold">{seleccionado.numero_casilla ?? '—'}</span>
                  {(seleccionado.whatsapp ?? seleccionado.telefono) && (
                    <span className="text-green-600">📱 {seleccionado.whatsapp ?? seleccionado.telefono}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Checkbox notificar */}
        {seleccionado && (
          <div className="px-5 py-3 border-b border-gray-100">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
              <input
                type="checkbox"
                checked={notificar}
                onChange={e => setNotificar(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
              />
              <MessageCircle className="h-4 w-4 text-green-600" />
              Avisar al cliente por WhatsApp que ya tiene su paquete
            </label>
          </div>
        )}

        {/* Resultado */}
        {resultado && (
          <div className={`px-5 py-3 border-t border-b ${
            resultado.tipo === 'ok'
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-600'
          } text-sm flex items-start gap-2`}>
            {resultado.tipo === 'ok'
              ? <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />}
            <span>{resultado.texto}</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex gap-2 p-5 border-t border-gray-100 mt-auto">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={cerrar}
            disabled={asignando}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="flex-1 bg-orange-600 hover:bg-orange-700 text-white gap-2"
            onClick={asignar}
            disabled={!seleccionado || asignando}
          >
            {asignando
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Asignando...</>
              : <><UserCheck className="h-4 w-4" /> Asignar paquete</>}
          </Button>
        </div>
      </div>
    </div>
  )
}
