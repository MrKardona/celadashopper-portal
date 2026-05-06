'use client'

// Gestión de tarifas escalonadas (tarifas_rangos): listar, editar, crear, eliminar.
// Agrupa por categoría y muestra cada regla con sus condiciones y componentes
// de costo. La edición se hace en modal.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Pencil, Trash2, X, Save, Loader2, AlertCircle,
  CheckCircle, Power, PowerOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CATEGORIA_LABELS, type CategoriaProducto } from '@/types'

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

// Resumen legible de una regla
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

export default function TarifasRangosManager({ tarifas }: Props) {
  const [editando, setEditando] = useState<TarifaRango | null>(null)
  const [creando, setCreando] = useState(false)

  // Agrupar por categoría
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
          <h2 className="text-lg font-bold text-gray-900">Tarifas escalonadas</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Reglas con filtros (condición, cantidad, valor) y componentes de costo combinables.
          </p>
        </div>
        <Button
          onClick={() => setCreando(true)}
          className="bg-orange-600 hover:bg-orange-700 text-white gap-2"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          Nueva tarifa
        </Button>
      </div>

      {categoriasOrdenadas.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400 text-sm">
          No hay tarifas escalonadas. Crea la primera con el botón de arriba.
        </div>
      ) : (
        <div className="space-y-4">
          {categoriasOrdenadas.map(cat => {
            const label = CATEGORIA_LABELS[cat as CategoriaProducto] ?? cat
            const reglas = grupos[cat].sort((a, b) => a.prioridad - b.prioridad)
            return (
              <div key={cat} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                  <p className="font-semibold text-gray-900">{label}</p>
                  <p className="text-[11px] text-gray-500">{reglas.length} regla{reglas.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="divide-y divide-gray-50">
                  {reglas.map(t => (
                    <div key={t.id} className={`px-5 py-3 flex items-start gap-3 ${!t.activo ? 'opacity-50 bg-gray-50' : ''}`}>
                      <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded font-mono mt-0.5">
                        P{t.prioridad}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{describir(t)}</p>
                        <p className="text-xs text-gray-500">{condiciones(t)}</p>
                        {t.notas && <p className="text-[11px] text-gray-400 italic mt-1">{t.notas}</p>}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => setEditando(t)}
                          className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"
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

      {editando && (
        <ModalTarifa
          tarifa={editando}
          onClose={() => setEditando(null)}
        />
      )}
      {creando && (
        <ModalTarifa
          tarifa={null}
          onClose={() => setCreando(false)}
        />
      )}
    </div>
  )
}

// ─── Modal de edición/creación ──────────────────────────────────────────────
function ModalTarifa({
  tarifa,
  onClose,
}: {
  tarifa: TarifaRango | null
  onClose: () => void
}) {
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

    const url = isCreate
      ? '/api/admin/tarifas/rangos'
      : `/api/admin/tarifas/rangos/${tarifa!.id}`
    const method = isCreate ? 'POST' : 'PATCH'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json() as { ok?: boolean; error?: string }
    setGuardando(false)
    if (!res.ok || !data.ok) {
      setError(data.error ?? 'Error al guardar')
      return
    }
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
    if (!res.ok || !data.ok) {
      setError(data.error ?? 'Error al eliminar')
      return
    }
    router.refresh()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !guardando && !eliminando && onClose()}>
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-100 sticky top-0 bg-white flex items-center justify-between">
          <h3 className="font-bold text-gray-900">{isCreate ? 'Nueva tarifa escalonada' : 'Editar tarifa'}</h3>
          <button onClick={onClose} disabled={guardando} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Categoría y condición */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Categoría *</Label>
              <select
                value={form.categoria}
                onChange={e => setF('categoria', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                {Object.entries(CATEGORIA_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Condición</Label>
              <select
                value={form.condicion}
                onChange={e => setF('condicion', e.target.value as '' | 'nuevo' | 'usado')}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Cualquiera</option>
                <option value="nuevo">Solo nuevo</option>
                <option value="usado">Solo usado</option>
              </select>
            </div>
          </div>

          {/* Rango de unidades */}
          <div>
            <Label className="text-xs">Rango de unidades</Label>
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="number" min="1"
                placeholder="Mín 1"
                value={form.min_unidades}
                onChange={e => setF('min_unidades', e.target.value)}
              />
              <Input
                type="number" min="1"
                placeholder="Sin máx"
                value={form.max_unidades}
                onChange={e => setF('max_unidades', e.target.value)}
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Deja máx vacío para &quot;sin límite superior&quot;</p>
          </div>

          {/* Filtro por valor declarado */}
          <div>
            <Label className="text-xs">Filtro por valor declarado (USD)</Label>
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="number" step="0.01" min="0"
                placeholder="Sin mín"
                value={form.valor_min}
                onChange={e => setF('valor_min', e.target.value)}
              />
              <Input
                type="number" step="0.01" min="0"
                placeholder="Sin máx"
                value={form.valor_max}
                onChange={e => setF('valor_max', e.target.value)}
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Para diferenciar tarifa por rango de valor (ej. ≤$200 vs &gt;$200)</p>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 space-y-3">
            <p className="text-[11px] font-semibold text-orange-900 uppercase tracking-wide">Componentes de costo</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Cargo fijo (USD)</Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={form.cargo_fijo}
                  onChange={e => setF('cargo_fijo', e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Precio por unidad (USD)</Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={form.precio_por_unidad}
                  onChange={e => setF('precio_por_unidad', e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Tarifa por libra (USD/lb)</Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={form.tarifa_por_libra}
                  onChange={e => setF('tarifa_por_libra', e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Peso mín. facturable (lb)</Label>
                <Input
                  type="number" step="0.1" min="0"
                  placeholder="Sin mínimo"
                  value={form.peso_minimo_facturable}
                  onChange={e => setF('peso_minimo_facturable', e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Seguro (% sobre valor declarado)</Label>
                <Input
                  type="number" step="0.01" min="0" max="100"
                  value={form.seguro_porcentaje}
                  onChange={e => setF('seguro_porcentaje', e.target.value)}
                />
              </div>
            </div>
            <p className="text-[10px] text-orange-700">
              Total = cargo fijo + (precio × cantidad) + (tarifa/lb × peso) + seguro
            </p>
          </div>

          {/* Prioridad y activo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Prioridad</Label>
              <Input
                type="number" min="0"
                value={form.prioridad}
                onChange={e => setF('prioridad', e.target.value)}
              />
              <p className="text-[10px] text-gray-400 mt-0.5">Menor número = más prioritaria</p>
            </div>
            <div>
              <Label className="text-xs">Estado</Label>
              <button
                type="button"
                onClick={() => setF('activo', !form.activo)}
                className={`w-full mt-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors ${form.activo ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 bg-gray-50 text-gray-500'}`}
              >
                {form.activo ? <Power className="h-3.5 w-3.5" /> : <PowerOff className="h-3.5 w-3.5" />}
                {form.activo ? 'Activa' : 'Inactiva'}
              </button>
            </div>
          </div>

          {/* Notas */}
          <div>
            <Label className="text-xs">Notas (descripción interna)</Label>
            <textarea
              value={form.notas}
              onChange={e => setF('notas', e.target.value)}
              rows={2}
              placeholder="Ej: Comercial por volumen — aplica en envíos masivos"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex gap-2 p-5 border-t border-gray-100 sticky bottom-0 bg-white">
          {!isCreate && (
            confirmDelete ? (
              <div className="flex-1 flex gap-2">
                <Button
                  type="button" variant="outline"
                  className="flex-1"
                  onClick={() => setConfirmDelete(false)}
                  disabled={eliminando}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={eliminar}
                  disabled={eliminando}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white gap-1"
                >
                  {eliminando
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Eliminando...</>
                    : <><Trash2 className="h-4 w-4" /> Confirmar</>}
                </Button>
              </div>
            ) : (
              <>
                <Button
                  type="button" variant="outline"
                  onClick={() => setConfirmDelete(true)}
                  disabled={guardando}
                  className="text-red-600 border-red-200 hover:bg-red-50 gap-1"
                >
                  <Trash2 className="h-4 w-4" />
                  Eliminar
                </Button>
                <Button type="button" variant="outline" onClick={onClose} disabled={guardando} className="flex-1">
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={guardar}
                  disabled={guardando}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white gap-1"
                >
                  {guardando
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</>
                    : <><Save className="h-4 w-4" /> Guardar</>}
                </Button>
              </>
            )
          )}
          {isCreate && (
            <>
              <Button type="button" variant="outline" onClick={onClose} disabled={guardando} className="flex-1">
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={guardar}
                disabled={guardando}
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white gap-1"
              >
                {guardando
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Creando...</>
                  : <><CheckCircle className="h-4 w-4" /> Crear tarifa</>}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
