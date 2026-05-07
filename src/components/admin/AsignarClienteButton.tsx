'use client'

import { useEffect, useState } from 'react'
import { Search, X, UserCheck, Loader2, CheckCircle, AlertCircle, MessageCircle } from 'lucide-react'

const tw = 'rgba(255,255,255,'

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
  variante?: 'primary' | 'subtle'
}

export default function AsignarClienteButton({
  paqueteId, trackingCasilla, descripcion, clienteActual, variante = 'primary',
}: Props) {
  const [abierto, setAbierto] = useState(false)

  if (variante === 'primary') {
    return (
      <>
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="btn-gold w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
        >
          <UserCheck className="h-4 w-4" />
          {clienteActual ? 'Reasignar a otro cliente' : 'Asignar a un cliente'}
        </button>
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

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="w-full py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
        style={{ border: `1px solid ${tw}0.12)`, color: `${tw}0.55)` }}
        onMouseEnter={e => {
          e.currentTarget.style.background = `${tw}0.05)`
          e.currentTarget.style.color = 'white'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = `${tw}0.55)`
        }}
      >
        <UserCheck className="h-3.5 w-3.5" />
        {clienteActual ? 'Reasignar a otro cliente' : 'Asignar a un cliente'}
      </button>
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
  const [stats, setStats] = useState<{ total: number; mostrando: number } | null>(null)

  useEffect(() => {
    if (seleccionado) return
    const t = setTimeout(async () => {
      setBuscando(true)
      try {
        const res = await fetch(`/api/admin/clientes/buscar?q=${encodeURIComponent(query)}`)
        const data = await res.json() as { clientes?: ClienteResult[]; total?: number; mostrando?: number }
        setResultados(data.clientes ?? [])
        setStats({ total: data.total ?? 0, mostrando: data.mostrando ?? 0 })
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={cerrar}
    >
      <div
        className="max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col"
        style={{
          background: 'rgba(10,10,25,0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: `1px solid ${tw}0.1)`,
          borderRadius: '1rem',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5" style={{ borderBottom: `1px solid ${tw}0.08)` }}>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-white">
              {clienteActual ? 'Reasignar paquete' : 'Asignar paquete a cliente'}
            </h3>
            <p className="text-xs font-mono mt-0.5" style={{ color: `${tw}0.4)` }}>{trackingCasilla}</p>
            <p className="text-xs truncate mt-0.5" style={{ color: `${tw}0.55)` }}>{descripcion}</p>
            {clienteActual && (
              <p className="text-xs mt-2 inline-block px-2 py-1 rounded-lg"
                style={{ background: 'rgba(245,184,0,0.1)', color: '#F5B800', border: '1px solid rgba(245,184,0,0.2)' }}>
                Actualmente asignado a: <span className="font-medium">{clienteActual.nombre}</span>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={cerrar}
            disabled={asignando}
            className="disabled:opacity-50 p-1 rounded-lg ml-2 transition-colors"
            style={{ color: `${tw}0.4)` }}
            onMouseEnter={e => (e.currentTarget.style.color = 'white')}
            onMouseLeave={e => (e.currentTarget.style.color = `${tw}0.4)`)}
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Buscador */}
        <div className="p-5" style={{ borderBottom: `1px solid ${tw}0.08)` }}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
              style={{ color: `${tw}0.3)` }} />
            <input
              type="text"
              autoFocus
              value={seleccionado ? `${seleccionado.nombre_completo} (${seleccionado.numero_casilla ?? '—'})` : query}
              onChange={e => { setQuery(e.target.value); if (seleccionado) setSeleccionado(null) }}
              placeholder="Buscar cliente por nombre, email, casillero o teléfono..."
              className="glass-input w-full pl-9 pr-9 py-2.5 text-sm rounded-xl focus:outline-none"
            />
            {seleccionado && (
              <button
                type="button"
                onClick={() => { setSeleccionado(null); setQuery('') }}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: `${tw}0.35)` }}
                onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                onMouseLeave={e => (e.currentTarget.style.color = `${tw}0.35)`)}
                title="Limpiar selección"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Lista de resultados */}
        {!seleccionado && (
          <div className="flex-1 overflow-y-auto px-2 py-2 min-h-[180px] max-h-[300px]">
            {stats && (
              <div className="px-3 py-1.5 mb-1 text-[11px] rounded-lg"
                style={{ color: `${tw}0.4)`, background: `${tw}0.03)` }}>
                {query
                  ? `${stats.mostrando} resultado${stats.mostrando !== 1 ? 's' : ''} de ${stats.total} clientes`
                  : `Mostrando ${stats.mostrando} de ${stats.total} clientes — escribe para filtrar`}
              </div>
            )}

            {buscando ? (
              <div className="flex items-center justify-center h-28 text-sm gap-2"
                style={{ color: `${tw}0.4)` }}>
                <Loader2 className="h-4 w-4 animate-spin" />
                Buscando...
              </div>
            ) : resultados.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-28 text-sm gap-2"
                style={{ color: `${tw}0.3)` }}>
                <Search className="h-6 w-6 opacity-30" />
                {query ? 'Sin resultados' : 'Empieza a escribir para buscar'}
              </div>
            ) : (
              <ul className="space-y-0.5">
                {resultados.map(c => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSeleccionado(c)}
                      className="w-full text-left px-3 py-2.5 rounded-xl transition-colors"
                      style={{ color: 'white' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(245,184,0,0.06)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{c.nombre_completo}</p>
                          <p className="text-xs truncate" style={{ color: `${tw}0.4)` }}>{c.email}</p>
                          {(c.whatsapp ?? c.telefono) && (
                            <p className="text-xs mt-0.5" style={{ color: '#34d399' }}>{c.whatsapp ?? c.telefono}</p>
                          )}
                        </div>
                        <div className="text-right ml-3 flex-shrink-0">
                          <p className="text-xs font-mono font-semibold" style={{ color: '#F5B800' }}>{c.numero_casilla ?? '—'}</p>
                          {c.ciudad && <p className="text-[11px] capitalize mt-0.5" style={{ color: `${tw}0.35)` }}>{c.ciudad}</p>}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Cliente seleccionado */}
        {seleccionado && (
          <div className="p-4 mx-4 mt-4 rounded-xl"
            style={{ background: 'rgba(245,184,0,0.07)', border: '1px solid rgba(245,184,0,0.18)' }}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(245,184,0,0.15)' }}>
                <UserCheck className="h-5 w-5" style={{ color: '#F5B800' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white">{seleccionado.nombre_completo}</p>
                <p className="text-xs" style={{ color: `${tw}0.45)` }}>{seleccionado.email}</p>
                <div className="flex gap-3 mt-1 text-xs">
                  <span className="font-mono font-semibold" style={{ color: '#F5B800' }}>{seleccionado.numero_casilla ?? '—'}</span>
                  {(seleccionado.whatsapp ?? seleccionado.telefono) && (
                    <span style={{ color: '#34d399' }}>📱 {seleccionado.whatsapp ?? seleccionado.telefono}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Checkbox notificar */}
        {seleccionado && (
          <label
            className="flex items-center gap-2 cursor-pointer mx-4 mt-3 px-3 py-2.5 rounded-xl text-sm"
            style={{ background: `${tw}0.04)`, border: `1px solid ${tw}0.08)` }}
          >
            <input
              type="checkbox"
              checked={notificar}
              onChange={e => setNotificar(e.target.checked)}
              className="h-4 w-4 rounded"
              style={{ accentColor: '#34d399' }}
            />
            <MessageCircle className="h-4 w-4" style={{ color: '#34d399' }} />
            <span style={{ color: `${tw}0.7)` }}>Avisar al cliente por WhatsApp que ya tiene su paquete</span>
          </label>
        )}

        {/* Resultado */}
        {resultado && (
          <div
            className="mx-4 mt-3 px-4 py-3 rounded-xl text-sm flex items-start gap-2"
            style={resultado.tipo === 'ok'
              ? { background: 'rgba(52,211,153,0.08)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }
              : { background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            {resultado.tipo === 'ok'
              ? <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />}
            <span>{resultado.texto}</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex gap-2 p-5 mt-auto" style={{ borderTop: `1px solid ${tw}0.08)` }}>
          <button
            type="button"
            onClick={cerrar}
            disabled={asignando}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
            style={{ border: `1px solid ${tw}0.12)`, color: `${tw}0.65)` }}
            onMouseEnter={e => (e.currentTarget.style.background = `${tw}0.05)`)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={asignar}
            disabled={!seleccionado || asignando}
            className="btn-gold flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {asignando
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Asignando...</>
              : <><UserCheck className="h-4 w-4" /> Asignar paquete</>}
          </button>
        </div>
      </div>
    </div>
  )
}
