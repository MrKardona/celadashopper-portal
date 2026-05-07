'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Pencil, Trash2, X, Save, Loader2, AlertCircle,
  CheckCircle, Power, PowerOff,
} from 'lucide-react'
import { CATEGORIA_LABELS, type CategoriaProducto } from '@/types'

const tw = 'rgba(255,255,255,'

export interface TarifaRango {
  id: string
  categoria: string
  condicion: 'nuevo' | 'usado' | null
  min_unidades: number
  max_unidades: number | null
  precio_por_unidad: string | number
  cargo_fijo: string | number
  tarifa_por_libra: string | number
  peso_minimo_facturable: string | number | null
  seguro_porcentaje: string | number
  valor_min: string | number | null
  valor_max: string | number | null
  prioridad: number
  notas: string | null
  activo: boolean
}

interface Props {
  tarifas: TarifaRango[]
}

function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0
  return typeof v === 'string' ? parseFloat(v) : v
}

function describir(t: TarifaRango): string {
  const partes: string[] = []
  if (t.cargo_fijo && num(t.cargo_fijo) > 0) partes.push(`$${num(t.cargo_fijo).toFixed(2)} fijo`)
  if (num(t.precio_por_unidad) > 0) partes.push(`$${num(t.precio_por_unidad).toFixed(2)}/u`)
  if (num(t.tarifa_por_libra) > 0) {
    let s = `$${num(t.tarifa_por_libra).toFixed(2)}/lb`
    if (t.peso_minimo_facturable) s += ` (mín ${num(t.peso_minimo_facturable)} lb)`
    partes.push(s)
  }
  if (num(t.seguro_porcentaje) > 0) partes.push(`+${num(t.seguro_porcentaje)}% seguro`)
  return partes.join(' + ') || '—'
}

function condiciones(t: TarifaRango): string {
  const parts: string[] = []
  parts.push(t.max_unidades ? `${t.min_unidades}-${t.max_unidades} uds` : `${t.min_unidades}+ uds`)
  if (t.condicion) parts.push(t.condicion)
  if (t.valor_min !== null && t.valor_max !== null) parts.push(`valor $${num(t.valor_min)}-$${num(t.valor_max)}`)
  else if (t.valor_min !== null) parts.push(`valor > $${num(t.valor_min)}`)
  else if (t.valor_max !== null) parts.push(`valor ≤ $${num(t.valor_max)}`)
  return parts.join(' · ')
}

const inputClass = 'glass-input w-full px-3 py-2 text-sm rounded-xl focus:outline-none'
const labelStyle = { color: `${tw}0.6)`, fontSize: '0.7rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }

export default function TarifasRangosManager({ tarifas }: Props) {
  const [editando, setEditando] = useState<TarifaRango | null>(null)
  const [creando, setCreando] = useState(false)

  const grupos = tarifas.reduce((acc, t) => {
    if (!acc[t.categoria]) acc[t.categoria] = []
    acc[t.categoria].push(t)
    return acc
  }, {} as Record<string, TarifaRango[]>)

  const categoriasOrdenadas = Object.keys(grupos).sort()

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Tarifas escalonadas</h2>
          <p className="text-xs mt-0.5" style={{ color: `${tw}0.4)` }}>
            Reglas con filtros (condición, cantidad, valor) y componentes de costo combinables.
          </p>
        </div>
        <button
          onClick={() => setCreando(true)}
          className="btn-gold flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold"
        >
          <Plus className="h-4 w-4" />
          Nueva tarifa
        </button>
      </div>

      {categoriasOrdenadas.length === 0 ? (
        <div className="glass-card p-8 text-center text-sm" style={{ color: `${tw}0.35)` }}>
          No hay tarifas escalonadas. Crea la primera con el botón de arriba.
        </div>
      ) : (
        <div className="space-y-4">
          {categoriasOrdenadas.map(cat => {
            const label = CATEGORIA_LABELS[cat as CategoriaProducto] ?? cat
            const reglas = grupos[cat].sort((a, b) => a.prioridad - b.prioridad)
            return (
              <div key={cat} className="glass-card overflow-hidden">
                <div className="px-5 py-3" style={{ background: `${tw}0.03)`, borderBottom: `1px solid ${tw}0.07)` }}>
                  <p className="font-semibold text-white">{label}</p>
                  <p className="text-[11px]" style={{ color: `${tw}0.4)` }}>{reglas.length} regla{reglas.length !== 1 ? 's' : ''}</p>
                </div>
                <div>
                  {reglas.map((t, i) => (
                    <div
                      key={t.id}
                      className="px-5 py-3 flex items-start gap-3 transition-colors"
                      style={{
                        borderTop: i > 0 ? `1px solid ${tw}0.05)` : undefined,
                        opacity: t.activo ? 1 : 0.45,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = `${tw}0.03)`)}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded font-mono mt-0.5"
                        style={{ background: 'rgba(245,184,0,0.12)', color: '#F5B800', border: '1px solid rgba(245,184,0,0.25)' }}>
                        P{t.prioridad}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">{describir(t)}</p>
                        <p className="text-xs" style={{ color: `${tw}0.45)` }}>{condiciones(t)}</p>
                        {t.notas && <p className="text-[11px] italic mt-1" style={{ color: `${tw}0.3)` }}>{t.notas}</p>}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => setEditando(t)}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: `${tw}0.3)` }}
                          onMouseEnter={e => {
                            e.currentTarget.style.color = '#F5B800'
                            e.currentTarget.style.background = 'rgba(245,184,0,0.08)'
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.color = `${tw}0.3)`
                            e.currentTarget.style.background = 'transparent'
                          }}
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {editando && <ModalTarifa tarifa={editando} onClose={() => setEditando(null)} />}
      {creando && <ModalTarifa tarifa={null} onClose={() => setCreando(false)} />}
    </div>
  )
}

function ModalTarifa({ tarifa, onClose }: { tarifa: TarifaRango | null; onClose: () => void }) {
  const router = useRouter()
  const isCreate = tarifa === null
  const [form, setForm] = useState({
    categoria: tarifa?.categoria ?? 'celular',
    condicion: tarifa?.condicion ?? '' as '' | 'nuevo' | 'usado',
    min_unidades: tarifa ? String(tarifa.min_unidades) : '1',
    max_unidades: tarifa?.max_unidades !== null && tarifa?.max_unidades !== undefined ? String(tarifa.max_unidades) : '',
    precio_por_unidad: tarifa ? String(num(tarifa.precio_por_unidad)) : '0',
    cargo_fijo: tarifa ? String(num(tarifa.cargo_fijo)) : '0',
    tarifa_por_libra: tarifa ? String(num(tarifa.tarifa_por_libra)) : '0',
    peso_minimo_facturable: tarifa?.peso_minimo_facturable !== null && tarifa?.peso_minimo_facturable !== undefined ? String(num(tarifa.peso_minimo_facturable)) : '',
    seguro_porcentaje: tarifa ? String(num(tarifa.seguro_porcentaje)) : '0',
    valor_min: tarifa?.valor_min !== null && tarifa?.valor_min !== undefined ? String(num(tarifa.valor_min)) : '',
    valor_max: tarifa?.valor_max !== null && tarifa?.valor_max !== undefined ? String(num(tarifa.valor_max)) : '',
    prioridad: tarifa ? String(tarifa.prioridad) : '100',
    notas: tarifa?.notas ?? '',
    activo: tarifa?.activo ?? true,
  })
  const [guardando, setGuardando] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  function setF<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  async function guardar() {
    setGuardando(true)
    setError('')
    const payload = {
      categoria: form.categoria,
      condicion: form.condicion || null,
      min_unidades: parseInt(form.min_unidades, 10) || 1,
      max_unidades: form.max_unidades ? parseInt(form.max_unidades, 10) : null,
      precio_por_unidad: parseFloat(form.precio_por_unidad) || 0,
      cargo_fijo: parseFloat(form.cargo_fijo) || 0,
      tarifa_por_libra: parseFloat(form.tarifa_por_libra) || 0,
      peso_minimo_facturable: form.peso_minimo_facturable ? parseFloat(form.peso_minimo_facturable) : null,
      seguro_porcentaje: parseFloat(form.seguro_porcentaje) || 0,
      valor_min: form.valor_min ? parseFloat(form.valor_min) : null,
      valor_max: form.valor_max ? parseFloat(form.valor_max) : null,
      prioridad: parseInt(form.prioridad, 10) || 100,
      notas: form.notas.trim() || null,
      activo: form.activo,
    }
    const url = isCreate ? '/api/admin/tarifas/rangos' : `/api/admin/tarifas/rangos/${tarifa!.id}`
    const method = isCreate ? 'POST' : 'PATCH'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json() as { ok?: boolean; error?: string }
    setGuardando(false)
    if (!res.ok || !data.ok) { setError(data.error ?? 'Error al guardar'); return }
    router.refresh()
    onClose()
  }

  async function eliminar() {
    if (!tarifa) return
    setEliminando(true)
    setError('')
    const res = await fetch(`/api/admin/tarifas/rangos/${tarifa.id}`, { method: 'DELETE' })
    const data = await res.json() as { ok?: boolean; error?: string }
    setEliminando(false)
    if (!res.ok || !data.ok) { setError(data.error ?? 'Error al eliminar'); return }
    router.refresh()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={() => !guardando && !eliminando && onClose()}
    >
      <div
        className="max-w-lg w-full max-h-[90vh] overflow-y-auto flex flex-col"
        style={{
          background: 'rgba(10,10,25,0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: `1px solid ${tw}0.1)`,
          borderRadius: '1rem',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 flex items-center justify-between sticky top-0 z-10"
          style={{ background: 'rgba(10,10,25,0.97)', borderBottom: `1px solid ${tw}0.08)`, borderRadius: '1rem 1rem 0 0' }}>
          <h3 className="font-bold text-white">{isCreate ? 'Nueva tarifa escalonada' : 'Editar tarifa'}</h3>
          <button
            onClick={onClose}
            disabled={guardando}
            className="disabled:opacity-50 p-1 rounded-lg transition-colors"
            style={{ color: `${tw}0.4)` }}
            onMouseEnter={e => (e.currentTarget.style.color = 'white')}
            onMouseLeave={e => (e.currentTarget.style.color = `${tw}0.4)`)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Categoría y condición */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Categoría *</label>
              <select
                value={form.categoria}
                onChange={e => setF('categoria', e.target.value)}
                className={inputClass}
              >
                {Object.entries(CATEGORIA_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Condición</label>
              <select
                value={form.condicion}
                onChange={e => setF('condicion', e.target.value as '' | 'nuevo' | 'usado')}
                className={inputClass}
              >
                <option value="">Cualquiera</option>
                <option value="nuevo">Solo nuevo</option>
                <option value="usado">Solo usado</option>
              </select>
            </div>
          </div>

          {/* Rango de unidades */}
          <div>
            <label style={labelStyle}>Rango de unidades</label>
            <div className="grid grid-cols-2 gap-3">
              <input type="number" min="1" placeholder="Mín 1"
                value={form.min_unidades} onChange={e => setF('min_unidades', e.target.value)}
                className={inputClass} />
              <input type="number" min="1" placeholder="Sin máx"
                value={form.max_unidades} onChange={e => setF('max_unidades', e.target.value)}
                className={inputClass} />
            </div>
            <p className="text-[10px] mt-1" style={{ color: `${tw}0.3)` }}>Deja máx vacío para &quot;sin límite superior&quot;</p>
          </div>

          {/* Filtro por valor declarado */}
          <div>
            <label style={labelStyle}>Filtro por valor declarado (USD)</label>
            <div className="grid grid-cols-2 gap-3">
              <input type="number" step="0.01" min="0" placeholder="Sin mín"
                value={form.valor_min} onChange={e => setF('valor_min', e.target.value)}
                className={inputClass} />
              <input type="number" step="0.01" min="0" placeholder="Sin máx"
                value={form.valor_max} onChange={e => setF('valor_max', e.target.value)}
                className={inputClass} />
            </div>
            <p className="text-[10px] mt-1" style={{ color: `${tw}0.3)` }}>Para diferenciar tarifa por rango de valor (ej. ≤$200 vs &gt;$200)</p>
          </div>

          {/* Componentes de costo */}
          <div className="rounded-xl p-4 space-y-3"
            style={{ background: 'rgba(245,184,0,0.05)', border: '1px solid rgba(245,184,0,0.18)' }}>
            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#F5B800' }}>Componentes de costo</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>Cargo fijo (USD)</label>
                <input type="number" step="0.01" min="0"
                  value={form.cargo_fijo} onChange={e => setF('cargo_fijo', e.target.value)}
                  className={inputClass} />
              </div>
              <div>
                <label style={labelStyle}>Precio por unidad (USD)</label>
                <input type="number" step="0.01" min="0"
                  value={form.precio_por_unidad} onChange={e => setF('precio_por_unidad', e.target.value)}
                  className={inputClass} />
              </div>
              <div>
                <label style={labelStyle}>Tarifa por libra (USD/lb)</label>
                <input type="number" step="0.01" min="0"
                  value={form.tarifa_por_libra} onChange={e => setF('tarifa_por_libra', e.target.value)}
                  className={inputClass} />
              </div>
              <div>
                <label style={labelStyle}>Peso mín. facturable (lb)</label>
                <input type="number" step="0.1" min="0" placeholder="Sin mínimo"
                  value={form.peso_minimo_facturable} onChange={e => setF('peso_minimo_facturable', e.target.value)}
                  className={inputClass} />
              </div>
              <div className="col-span-2">
                <label style={labelStyle}>Seguro (% sobre valor declarado)</label>
                <input type="number" step="0.01" min="0" max="100"
                  value={form.seguro_porcentaje} onChange={e => setF('seguro_porcentaje', e.target.value)}
                  className={inputClass} />
              </div>
            </div>
            <p className="text-[10px]" style={{ color: 'rgba(245,184,0,0.6)' }}>
              Total = cargo fijo + (precio × cantidad) + (tarifa/lb × peso) + seguro
            </p>
          </div>

          {/* Prioridad y activo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Prioridad</label>
              <input type="number" min="0"
                value={form.prioridad} onChange={e => setF('prioridad', e.target.value)}
                className={inputClass} />
              <p className="text-[10px] mt-0.5" style={{ color: `${tw}0.3)` }}>Menor número = más prioritaria</p>
            </div>
            <div>
              <label style={labelStyle}>Estado</label>
              <button
                type="button"
                onClick={() => setF('activo', !form.activo)}
                className="w-full mt-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm rounded-xl transition-colors"
                style={form.activo
                  ? { background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }
                  : { background: `${tw}0.04)`, color: `${tw}0.4)`, border: `1px solid ${tw}0.1)` }}
              >
                {form.activo ? <Power className="h-3.5 w-3.5" /> : <PowerOff className="h-3.5 w-3.5" />}
                {form.activo ? 'Activa' : 'Inactiva'}
              </button>
            </div>
          </div>

          {/* Notas */}
          <div>
            <label style={labelStyle}>Notas (descripción interna)</label>
            <textarea
              value={form.notas}
              onChange={e => setF('notas', e.target.value)}
              rows={2}
              placeholder="Ej: Comercial por volumen — aplica en envíos masivos"
              className={`${inputClass}`}
              style={{ resize: 'none' }}
            />
          </div>

          {error && (
            <div className="rounded-xl p-3 text-sm flex items-start gap-2"
              style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-5 sticky bottom-0 z-10"
          style={{ background: 'rgba(10,10,25,0.97)', borderTop: `1px solid ${tw}0.08)`, borderRadius: '0 0 1rem 1rem' }}>
          {!isCreate && (
            confirmDelete ? (
              <div className="flex-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  disabled={eliminando}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
                  style={{ border: `1px solid ${tw}0.12)`, color: `${tw}0.65)` }}
                  onMouseEnter={e => (e.currentTarget.style.background = `${tw}0.05)`)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={eliminar}
                  disabled={eliminando}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1 disabled:opacity-40 transition-colors"
                  style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.12)')}
                >
                  {eliminando
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Eliminando...</>
                    : <><Trash2 className="h-4 w-4" /> Confirmar</>}
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  disabled={guardando}
                  className="px-3 py-2.5 rounded-xl text-sm font-medium flex items-center gap-1 disabled:opacity-50 transition-colors"
                  style={{ color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.06)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <Trash2 className="h-4 w-4" /> Eliminar
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={guardando}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
                  style={{ border: `1px solid ${tw}0.12)`, color: `${tw}0.65)` }}
                  onMouseEnter={e => (e.currentTarget.style.background = `${tw}0.05)`)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={guardar}
                  disabled={guardando}
                  className="btn-gold flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  {guardando
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</>
                    : <><Save className="h-4 w-4" /> Guardar</>}
                </button>
              </>
            )
          )}
          {isCreate && (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={guardando}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
                style={{ border: `1px solid ${tw}0.12)`, color: `${tw}0.65)` }}
                onMouseEnter={e => (e.currentTarget.style.background = `${tw}0.05)`)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardar}
                disabled={guardando}
                className="btn-gold flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1 disabled:opacity-50"
              >
                {guardando
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Creando...</>
                  : <><CheckCircle className="h-4 w-4" /> Crear tarifa</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
