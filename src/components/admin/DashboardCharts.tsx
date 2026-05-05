'use client'

// Gráficas interactivas del dashboard admin (Recharts).
// - Donut: distribución de paquetes activos por grupo (USA / tránsito / bodega CO / entregados 30d).
// - Barras: recepciones en bodega USA por día (últimos 14 días).

import {
  PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PieChart as PieIcon, BarChart3 } from 'lucide-react'

interface DatoDonut {
  nombre: string
  valor: number
  color: string
}

interface DatoBarra {
  fecha: string
  count: number
}

interface Props {
  datosDonut: DatoDonut[]
  datosBarras: DatoBarra[]
}

interface TooltipPayload<T> {
  payload: T
  value: number
  color?: string
}

function CustomTooltipDonut({ active, payload }: { active?: boolean; payload?: TooltipPayload<DatoDonut>[] }) {
  if (!active || !payload?.length) return null
  const dato = payload[0].payload
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-semibold text-gray-900" style={{ color: dato.color }}>{dato.nombre}</p>
      <p className="text-xs text-gray-600">
        <span className="font-bold text-gray-900">{dato.valor}</span> paquete{dato.valor !== 1 ? 's' : ''}
      </p>
    </div>
  )
}

function CustomTooltipBarras({ active, payload, label }: {
  active?: boolean
  payload?: TooltipPayload<DatoBarra>[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const valor = payload[0].value
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-semibold text-gray-900">Día {label}</p>
      <p className="text-xs text-gray-600">
        <span className="font-bold text-orange-600">{valor}</span> paquete{valor !== 1 ? 's' : ''} recibido{valor !== 1 ? 's' : ''}
      </p>
    </div>
  )
}

export default function DashboardCharts({ datosDonut, datosBarras }: Props) {
  const totalDonut = datosDonut.reduce((s, d) => s + d.valor, 0)
  const totalRecepciones14d = datosBarras.reduce((s, d) => s + d.count, 0)
  const promedioDiario = totalRecepciones14d / 14

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Donut: distribución actual */}
      <Card className="lg:col-span-1">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <PieIcon className="h-4 w-4 text-orange-600" />
            Distribución actual
          </CardTitle>
        </CardHeader>
        <CardContent>
          {totalDonut === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              Sin datos para mostrar
            </div>
          ) : (
            <div className="relative">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={datosDonut}
                    dataKey="valor"
                    nameKey="nombre"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {datosDonut.map((d) => (
                      <Cell key={d.nombre} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltipDonut />} />
                </PieChart>
              </ResponsiveContainer>
              {/* Total al centro del donut */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-bold text-gray-900">{totalDonut}</span>
                <span className="text-[11px] text-gray-500 uppercase tracking-wide">paquetes</span>
              </div>
              {/* Leyenda manual con colores */}
              <div className="mt-4 space-y-1">
                {datosDonut.map(d => (
                  <div key={d.nombre} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: d.color }} />
                      <span className="text-gray-700">{d.nombre}</span>
                    </span>
                    <span className="font-semibold text-gray-900">
                      {d.valor} <span className="text-gray-400 font-normal">({Math.round((d.valor / totalDonut) * 100)}%)</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Barras: recepciones por día */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-orange-600" />
              Recepciones en USA — últimos 14 días
            </span>
            <span className="text-xs text-gray-500 font-normal">
              {totalRecepciones14d} total · ~{promedioDiario.toFixed(1)}/día
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {totalRecepciones14d === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              Sin recepciones en los últimos 14 días
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={datosBarras} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis
                  dataKey="fecha"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  axisLine={{ stroke: '#e5e7eb' }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<CustomTooltipBarras />}
                  cursor={{ fill: 'rgba(249, 115, 22, 0.08)' }}
                />
                <Bar dataKey="count" fill="#ea580c" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
