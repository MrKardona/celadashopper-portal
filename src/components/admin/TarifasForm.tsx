'use client'

import { useState } from 'react'
import { CheckCircle, AlertCircle, Edit2, Save, X } from 'lucide-react'

interface Tarifa {
  id: string
  categoria: string
  nombre_display: string
  tarifa_por_libra: number
  precio_fijo: number | null
  tarifa_tipo: string
  seguro_porcentaje: number
  descripcion: string | null
  activo: boolean
  costo_envio_libra: number | null
  costo_envio_fijo: number | null
  zoho_item_id: string | null
}

export default function TarifasForm({ tarifas }: { tarifas: Tarifa[] }) {
  const [editando, setEditando] = useState<string | null>(null)
  const [valores, setValores] = useState<Record<string, {
    tarifa_por_libra: string
    precio_fijo: string
    tarifa_tipo: string
    seguro_porcentaje: string
    descripcion: string
    costo_envio_libra: string
    costo_envio_fijo: string
  }>>({})
  const [guardando, setGuardando] = useState<string | null>(null)
  const [resultado, setResultado] = useState<{ id: string; ok: boolean; msg: string } | null>(null)

  function iniciarEdicion(t: Tarifa) {
    setEditando(t.id)
    setValores(prev => ({
      ...prev,
      [t.id]: {
        tarifa_por_libra: t.tarifa_por_libra.toString(),
        precio_fijo: t.precio_fijo?.toString() ?? '',
        tarifa_tipo: t.tarifa_tipo,
        seguro_porcentaje: t.seguro_porcentaje.toString(),
        descripcion: t.descripcion ?? '',
        costo_envio_libra: t.costo_envio_libra?.toString() ?? '',
        costo_envio_fijo: t.costo_envio_fijo?.toString() ?? '',
      },
    }))
  }

  async function guardar(t: Tarifa) {
    setGuardando(t.id)
    const v = valores[t.id]
    try {
      const res = await fetch(`/api/admin/tarifas/${t.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tarifa_por_libra: parseFloat(v.tarifa_por_libra) || 0,
          precio_fijo: v.precio_fijo ? parseFloat(v.precio_fijo) : null,
          tarifa_tipo: v.tarifa_tipo,
          seguro_porcentaje: parseFloat(v.seguro_porcentaje) || 0,
          descripcion: v.descripcion || null,
          costo_envio_libra: v.costo_envio_libra ? parseFloat(v.costo_envio_libra) : null,
          costo_envio_fijo: v.costo_envio_fijo ? parseFloat(v.costo_envio_fijo) : null,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setResultado({ id: t.id, ok: true, msg: 'Guardado ✅' })
        setEditando(null)
        // Actualizar valor local visualmente
        t.tarifa_por_libra = parseFloat(v.tarifa_por_libra) || 0
        t.precio_fijo = v.precio_fijo ? parseFloat(v.precio_fijo) : null
        t.tarifa_tipo = v.tarifa_tipo
        t.descripcion = v.descripcion || null
      } else {
        setResultado({ id: t.id, ok: false, msg: data.error ?? 'Error al guardar' })
      }
    } catch {
      setResultado({ id: t.id, ok: false, msg: 'Error de conexión' })
    } finally {
      setGuardando(null)
      setTimeout(() => setResultado(null), 3000)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Categoría</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tarifa/lb</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Precio fijo</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Seguro</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-red-400 uppercase tracking-wide">Costo/lb</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-red-400 uppercase tracking-wide">Costo fijo</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Descripción</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {tarifas.map(t => {
              const enEdicion = editando === t.id
              const v = valores[t.id]
              const res = resultado?.id === t.id ? resultado : null
              return (
                <tr key={t.id} className={`transition-colors ${enEdicion ? 'bg-orange-50' : 'hover:bg-gray-50'}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">{t.nombre_display}</td>
                  <td className="px-4 py-3">
                    {enEdicion ? (
                      <select
                        value={v.tarifa_tipo}
                        onChange={e => setValores(prev => ({ ...prev, [t.id]: { ...prev[t.id], tarifa_tipo: e.target.value } }))}
                        className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500 w-32"
                      >
                        <option value="por_libra">Por libra</option>
                        <option value="fijo_por_unidad">Fijo/unidad</option>
                        <option value="especial">Especial</option>
                      </select>
                    ) : (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        t.tarifa_tipo === 'fijo_por_unidad'
                          ? 'bg-blue-100 text-blue-700'
                          : t.tarifa_tipo === 'especial'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-gray-100 text-gray-600'
                      }`}>
                        {t.tarifa_tipo === 'fijo_por_unidad' ? 'Fijo' : t.tarifa_tipo === 'por_libra' ? 'Por lb' : 'Especial'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {enEdicion ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={v.tarifa_por_libra}
                        onChange={e => setValores(prev => ({ ...prev, [t.id]: { ...prev[t.id], tarifa_por_libra: e.target.value } }))}
                        className="border border-gray-200 rounded px-2 py-1 text-sm w-20 focus:outline-none focus:ring-1 focus:ring-orange-500"
                      />
                    ) : (
                      <span className="font-mono font-semibold text-gray-700">${t.tarifa_por_libra}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {enEdicion ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={v.precio_fijo}
                        placeholder="—"
                        onChange={e => setValores(prev => ({ ...prev, [t.id]: { ...prev[t.id], precio_fijo: e.target.value } }))}
                        className="border border-gray-200 rounded px-2 py-1 text-sm w-20 focus:outline-none focus:ring-1 focus:ring-orange-500"
                      />
                    ) : (
                      <span className="font-mono text-gray-700">
                        {t.precio_fijo != null ? `$${t.precio_fijo}` : '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {enEdicion ? (
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="100"
                        value={v.seguro_porcentaje}
                        onChange={e => setValores(prev => ({ ...prev, [t.id]: { ...prev[t.id], seguro_porcentaje: e.target.value } }))}
                        className="border border-gray-200 rounded px-2 py-1 text-sm w-16 focus:outline-none focus:ring-1 focus:ring-orange-500"
                      />
                    ) : (
                      <span className={`text-sm font-medium ${t.seguro_porcentaje > 0 ? 'text-blue-700' : 'text-gray-300'}`}>
                        {t.seguro_porcentaje > 0 ? `${t.seguro_porcentaje}%` : '—'}
                      </span>
                    )}
                  </td>
                  {/* Costo/lb nuestro */}
                  <td className="px-4 py-3">
                    {enEdicion ? (
                      <input
                        type="number" step="0.01" min="0"
                        value={v.costo_envio_libra}
                        placeholder="—"
                        onChange={e => setValores(prev => ({ ...prev, [t.id]: { ...prev[t.id], costo_envio_libra: e.target.value } }))}
                        className="border border-red-200 rounded px-2 py-1 text-sm w-20 focus:outline-none focus:ring-1 focus:ring-red-400"
                      />
                    ) : (
                      <span className={`font-mono text-sm font-semibold ${t.costo_envio_libra ? 'text-red-600' : 'text-gray-300'}`}>
                        {t.costo_envio_libra != null ? `$${t.costo_envio_libra}` : '—'}
                      </span>
                    )}
                  </td>
                  {/* Costo fijo nuestro */}
                  <td className="px-4 py-3">
                    {enEdicion ? (
                      <input
                        type="number" step="0.01" min="0"
                        value={v.costo_envio_fijo}
                        placeholder="—"
                        onChange={e => setValores(prev => ({ ...prev, [t.id]: { ...prev[t.id], costo_envio_fijo: e.target.value } }))}
                        className="border border-red-200 rounded px-2 py-1 text-sm w-20 focus:outline-none focus:ring-1 focus:ring-red-400"
                      />
                    ) : (
                      <span className={`font-mono text-sm font-semibold ${t.costo_envio_fijo ? 'text-red-600' : 'text-gray-300'}`}>
                        {t.costo_envio_fijo != null ? `$${t.costo_envio_fijo}` : '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell max-w-[220px]">
                    {enEdicion ? (
                      <input
                        type="text"
                        value={v.descripcion}
                        onChange={e => setValores(prev => ({ ...prev, [t.id]: { ...prev[t.id], descripcion: e.target.value } }))}
                        className="border border-gray-200 rounded px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-orange-500"
                      />
                    ) : (
                      <span className="text-xs text-gray-500 truncate block">{t.descripcion ?? '—'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {res && (
                      <span className={`text-xs mr-2 ${res.ok ? 'text-green-600' : 'text-red-600'}`}>
                        {res.ok
                          ? <CheckCircle className="h-3.5 w-3.5 inline" />
                          : <AlertCircle className="h-3.5 w-3.5 inline" />
                        }
                      </span>
                    )}
                    {enEdicion ? (
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => guardar(t)}
                          disabled={guardando === t.id}
                          className="flex items-center gap-1 px-2 py-1 bg-orange-600 text-white rounded text-xs hover:bg-orange-700 disabled:opacity-50 transition-colors"
                        >
                          <Save className="h-3 w-3" />
                          {guardando === t.id ? '...' : 'Guardar'}
                        </button>
                        <button
                          onClick={() => setEditando(null)}
                          className="p-1 text-gray-400 hover:text-gray-700 rounded transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => iniciarEdicion(t)}
                        className="p-1.5 text-gray-400 hover:text-orange-600 rounded hover:bg-orange-50 transition-colors"
                        title="Editar tarifa"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
