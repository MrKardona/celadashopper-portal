export const dynamic = 'force-dynamic'

import { ArrowLeft, TableProperties } from 'lucide-react'
import Link from 'next/link'
import PlanillaTable from '@/components/admin/PlanillaTable'

const tw = 'rgba(255,255,255,'

export default function PlanillaDomiciliariosPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 flex-wrap">
        <Link
          href="/admin/domiciliarios"
          className="flex items-center gap-1.5 text-xs mt-1 transition-opacity hover:opacity-70 flex-shrink-0"
          style={{ color: `${tw}0.4)` }}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Domiciliarios
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <TableProperties className="h-5 w-5 flex-shrink-0" style={{ color: '#34d399' }} />
            Planilla de domicilios
          </h1>
          <p className="text-sm mt-0.5" style={{ color: `${tw}0.4)` }}>
            Asigna el valor de cada entrega — se guarda automáticamente
          </p>
        </div>
      </div>

      <PlanillaTable />
    </div>
  )
}
