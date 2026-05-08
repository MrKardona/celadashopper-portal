'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Scissors, Plus, Trash2, Loader2, X, AlertTriangle, Sparkles } from 'lucide-react'

interface Props {
  paqueteId: string
  descripcionOrigen: string
  pesoLibrasOrigen: number | null
  cantidadOrigen?: number | null
  valorDeclaradoOrigen?: number | null
}

interface SubForm {
  descripcion: string
  peso_libras: string
  cantidad: string
  valor_declarado: string
  notas_internas: string
}

function subVacio(descripcion: string, index: number): SubForm {
  return {
    descripcion: `${descripcion} — División ${index + 1}`,
    peso_libras: '',
    cantidad: '',
    valor_declarado: '',
    notas_internas: '',
  }
}

export default function DividirPaqueteModal({ paqueteId, descripcionOrigen, pesoLibrasOrigen, cantidadOrigen, valorDeclaradoOrigen }: Props) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sugerencia, setSugerencia] = useState<string | null>(null)
  const [subs, setSubs] = useState<SubForm[]>([
    subVacio(descripcionOrigen, 1),
    subVacio(descripcionOrigen, 2),
  ])

  function sugerirDivision() {
    const total = cantidadOrigen ?? 0
    if (total <= 5) return
    const MAX_POR_PAQUETE = 5
    const numSubs = Math.ceil(total / MAX_POR_PAQUETE)
    const pesoTotal = pesoLibrasOrigen ?? 0
    const valorTotal = valorDeclaradoOrigen ?? 0
    const nuevos: SubForm[] = []
    let restantes = total
    for (let i = 0; i < numSubs; i++) {
      const unidadesEste = Math.min(MAX_POR_PAQUETE, restantes)
      const proporcion = unidadesEste / total
      const pesoEste = pesoTotal > 0 ? proporcion * pesoTotal : 0
      const valorEste = valorTotal > 0 ? proporcion * valorTotal : 0
      nuevos.push({
        descripcion: `${descripcionOrigen} — División ${i + 1}`,
        peso_libras: pesoEste > 0 ? pesoEste.toFixed(2) : '',
        cantidad: String(unidadesEste),
        valor_declarado: valorEste > 0 ? valorEste.toFixed(2) : '',
        notas_internas: '',
      })
      restantes -= unidadesEste
    }
    setSubs(nuevos)
    setSugerencia(
      `${total} unidades → ${numSubs} paquete${numSubs > 1 ? 's' : ''} de máx 5 uds` +
      (pesoTotal > 0 ? `, peso proporcional` : '') +
      (valorTotal > 0 ? `, valor declarado proporcional` : '') +
      `. Tarifa normal ($18 fijo + $2.20/lb).`
    )
  }

  function agregar() {
    setSubs(prev => [...prev, subVacio(descripcionOrigen, prev.length + 1)])
  }

  function eliminar(i: number) {
    if (subs.length <= 2) return
    setSubs(prev => prev.filter((_, idx) => idx !== i))
  }

  function actualizar(i: number, campo: keyof SubForm, valor: string) {
    setSubs(prev => prev.map((s, idx) => idx === i ? { ...s, [campo]: valor } : s))
  }

  const pesoTotal = subs.reduce((acc, s) => acc + (parseFloat(s.peso_libras) || 0), 0)
  const valorTotal = subs.reduce((acc, s) => acc + (parseFloat(s.valor_declarado) || 0), 0)
  const pesoOrigen = pesoLibrasOrigen ?? 0
  const valorOrigen = valorDeclaradoOrigen ?? 0

  async function handleGuardar() {
    setError(null)
    for (const s of subs) {
      if (!s.descripcion.trim()) {
        setError('Cada sub-paquete necesita una descripción.')
        return
      }
    }
    setGuardando(true)
    try {
      const res = await fetch(`/api/admin/paquetes/${paqueteId}/dividir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sub_paquetes: subs.map(s => ({
            descripcion: s.descripcion.trim(),
            peso_libras: s.peso_libras ? parseFloat(s.peso_libras) : null,
            cantidad: s.cantidad ? parseInt(s.cantidad) : null,
            valor_declarado: s.valor_declarado ? parseFloat(s.valor_declarado) : null,
            notas_internas: s.notas_internas.trim() || null,
          })),
        }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || data.error) {
        setError(data.error ?? 'Error al dividir el paquete')
      } else {
        setAbierto(false)
        router.refresh()
      }
    } catch {
      setError('Error de red')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <>
      {/* Botón disparador */}
      <button
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
        style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }}
      >
        <Scissors className="h-3.5 w-3.5" />
        Dividir paquete
      </button>

      {/* Modal */}
      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={e => { if (e.target === e.currentTarget) setAbierto(false) }}>
          <div className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
            style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-2">
                <Scissors className="h-4 w-4" style={{ color: '#fbbf24' }} />
                <span className="font-semibold text-sm text-white">Dividir paquete</span>
              </div>
              <button onClick={() => setAbierto(false)} className="text-white/40 hover:text-white/70">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Aviso */}
            <div className="mx-5 mt-4 rounded-xl px-3 py-2.5 flex items-start gap-2"
              style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: '#fbbf24' }} />
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
                Los sub-paquetes son <strong className="text-white/70">invisibles para el cliente</strong> y no disparan notificaciones. Solo aparecen en admin y en el armado de cajas.
              </p>
            </div>

            {/* Indicadores de origen */}
            {(pesoOrigen > 0 || valorOrigen > 0) && (
              <div className="mx-5 mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                {pesoOrigen > 0 && (
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Peso origen: <strong className="text-white/60">{pesoOrigen} lb</strong>
                    {pesoTotal > 0 && (
                      <span className="ml-2" style={{ color: pesoTotal > pesoOrigen + 0.1 ? '#f87171' : 'rgba(52,211,153,0.8)' }}>
                        → {pesoTotal.toFixed(2)} lb distribuidos
                        {pesoTotal > pesoOrigen + 0.1 && ' ⚠️'}
                      </span>
                    )}
                  </span>
                )}
                {valorOrigen > 0 && (
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Valor origen: <strong className="text-white/60">${valorOrigen.toFixed(2)}</strong>
                    {valorTotal > 0 && (
                      <span className="ml-2" style={{ color: valorTotal > valorOrigen + 0.1 ? '#f87171' : 'rgba(52,211,153,0.8)' }}>
                        → ${valorTotal.toFixed(2)} distribuidos
                        {valorTotal > valorOrigen + 0.1 && ' ⚠️'}
                      </span>
                    )}
                  </span>
                )}
              </div>
            )}

            {/* Sugerir división óptima */}
            {cantidadOrigen && cantidadOrigen > 6 && (
              <div className="mx-5 mt-3 space-y-2">
                <button
                  onClick={sugerirDivision}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all"
                  style={{ background: 'rgba(52,211,153,0.08)', color: 'rgba(52,211,153,0.85)', border: '1px solid rgba(52,211,153,0.2)' }}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Sugerir división óptima ({cantidadOrigen} uds → grupos de máx 6)
                </button>
                {sugerencia && (
                  <div className="rounded-xl px-3 py-2.5 flex items-start gap-2"
                    style={{ background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.18)' }}>
                    <span style={{ color: 'rgba(52,211,153,0.7)', fontSize: 13, lineHeight: 1 }}>✓</span>
                    <p className="text-xs" style={{ color: 'rgba(52,211,153,0.75)' }}>{sugerencia}</p>
                  </div>
                )}
              </div>
            )}

            {/* Lista de sub-paquetes */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
              {subs.map((s, i) => (
                <div key={i} className="rounded-xl p-4 space-y-3"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold" style={{ color: '#fbbf24' }}>
                      Sub-paquete {i + 1}
                    </span>
                    {subs.length > 2 && (
                      <button onClick={() => eliminar(i)} className="text-white/30 hover:text-red-400 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Descripción */}
                    <div className="col-span-2">
                      <label className="text-xs mb-1 block" style={{ color: 'rgba(255,255,255,0.4)' }}>Descripción</label>
                      <input
                        type="text"
                        value={s.descripcion}
                        onChange={e => actualizar(i, 'descripcion', e.target.value)}
                        placeholder="Ej: 5 lociones"
                        className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                      />
                    </div>

                    {/* Peso */}
                    <div>
                      <label className="text-xs mb-1 block" style={{ color: 'rgba(255,255,255,0.4)' }}>Peso (lb)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={s.peso_libras}
                        onChange={e => actualizar(i, 'peso_libras', e.target.value)}
                        placeholder="0.00"
                        className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                      />
                    </div>

                    {/* Cantidad */}
                    <div>
                      <label className="text-xs mb-1 block" style={{ color: 'rgba(255,255,255,0.4)' }}>Cantidad</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={s.cantidad}
                        onChange={e => actualizar(i, 'cantidad', e.target.value)}
                        placeholder="0"
                        className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                      />
                    </div>

                    {/* Valor declarado */}
                    <div className="col-span-2">
                      <label className="text-xs mb-1 block" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        Valor declarado (USD)
                        {valorOrigen > 0 && (
                          <span className="ml-1.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
                            — promedio sugerido: ${(valorOrigen / subs.length).toFixed(2)}
                          </span>
                        )}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={s.valor_declarado}
                        onChange={e => actualizar(i, 'valor_declarado', e.target.value)}
                        placeholder="0.00"
                        className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                      />
                    </div>

                    {/* Notas internas */}
                    <div className="col-span-2">
                      <label className="text-xs mb-1 block" style={{ color: 'rgba(255,255,255,0.4)' }}>Notas internas (opcional)</label>
                      <input
                        type="text"
                        value={s.notas_internas}
                        onChange={e => actualizar(i, 'notas_internas', e.target.value)}
                        placeholder="Ej: caja pequeña roja"
                        className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                      />
                    </div>
                  </div>
                </div>
              ))}

              {/* Agregar otro */}
              <button
                onClick={agregar}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-colors"
                style={{ background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.35)', border: '1px dashed rgba(255,255,255,0.12)' }}
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar otro sub-paquete
              </button>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 space-y-2" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              {error && (
                <p className="text-xs text-center" style={{ color: '#f87171' }}>{error}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setAbierto(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleGuardar}
                  disabled={guardando}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}
                >
                  {guardando
                    ? <><Loader2 className="h-4 w-4 animate-spin" />Dividiendo...</>
                    : <><Scissors className="h-4 w-4" />Confirmar división</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
