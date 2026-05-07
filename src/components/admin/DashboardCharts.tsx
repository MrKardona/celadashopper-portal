'use client'

import {
  PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer,
} from 'recharts'
import { PieChart as PieIcon, BarChart3 } from 'lucide-react'

interface DatoDonut { nombre: string; valor: number; color: string }
interface DatoBarra { fecha: string; count: number }
interface Props { datosDonut: DatoDonut[]; datosBarras: DatoBarra[] }
interface TooltipPayload<T> { payload: T; value: number; color?: string }

const tw = 'rgba(255,255,255,'

function CustomTooltipDonut({ active, payload }: { active?: boolean; payload?: TooltipPayload<DatoDonut>[] }) {
  if (!active || !payload?.length) return null
  const dato = payload[0].payload
  return (
    <div className="glass-card px-3 py-2 text-sm shadow-xl">
      <p className="font-semibold" style={{ color: dato.color }}>{dato.nombre}</p>
      <p className="text-xs mt-0.5" style={{ color: `${tw}0.6)` }}>
        <span className="font-bold text-white">{dato.valor}</span> paquete{dato.valor !== 1 ? 's' : ''}
      </p>
    </div>
  )
}

function CustomTooltipBarras({ active, payload, label }: {
  active?: boolean; payload?: TooltipPayload<DatoBarra>[]; label?: string
}) {
  if (!active || !payload?.length) return null
  const valor = payload[0].value
  return (
    <div className="glass-card px-3 py-2 text-sm shadow-xl">
      <p className="font-semibold text-white">Día {label}</p>
      <p className="text-xs mt-0.5" style={{ color: `${tw}0.6)` }}>
        <span className="font-bold" style={{ color: '#F5B800' }}>{valor}</span> paquete{valor !== 1 ? 's' : ''} recibido{valor !== 1 ? 's' : ''}
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
      {/* Donut */}
      <div className="glass-card p-5 lg:col-span-1">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
          <PieIcon className="h-4 w-4" style={{ color: '#F5B800' }} />
          Distribución actual
        </h3>
        {totalDonut === 0 ? (
          <div className="text-center py-12 text-sm" style={{ color: `${tw}0.35)` }}>Sin datos para mostrar</div>
        ) : (
          <div className="relative">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={datosDonut} dataKey="valor" nameKey="nombre" cx="50%" cy="50%" innerRadius={55} outerRadius={88} paddingAngle={2} strokeWidth={0}>
                  {datosDonut.map((d) => <Cell key={d.nombre} fill={d.color} />)}
                </Pie>
                <Tooltip content={<CustomTooltipDonut />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-bold text-white">{totalDonut}</span>
              <span className="text-[11px] uppercase tracking-wide" style={{ color: `${tw}0.4)` }}>paquetes</span>
            </div>
            <div className="mt-3 space-y-1.5">
              {datosDonut.map(d => (
                <div key={d.nombre} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: d.color }} />
                    <span style={{ color: `${tw}0.65)` }}>{d.nombre}</span>
                  </span>
                  <span className="font-semibold text-white">
                    {d.valor} <span style={{ color: `${tw}0.35)` }} className="font-normal">({Math.round((d.valor / totalDonut) * 100)}%)</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Barras */}
      <div className="glass-card p-5 lg:col-span-2">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <BarChart3 className="h-4 w-4" style={{ color: '#F5B800' }} />
            Recepciones en USA — últimos 14 días
          </h3>
          <span className="text-xs" style={{ color: `${tw}0.4)` }}>
            {totalRecepciones14d} total · ~{promedioDiario.toFixed(1)}/día
          </span>
        </div>
        {totalRecepciones14d === 0 ? (
          <div className="text-center py-12 text-sm" style={{ color: `${tw}0.35)` }}>Sin recepciones en los últimos 14 días</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={datosBarras} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.35)' }} axisLine={{ stroke: 'rgba(255,255,255,0.08)' }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.35)' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltipBarras />} cursor={{ fill: 'rgba(245,184,0,0.06)' }} />
              <Bar dataKey="count" fill="#F5B800" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
