export const dynamic = 'force-dynamic'

// src/app/(admin)/admin/recibir/page.tsx
import RecibirForm from './RecibirForm'
import { ScanBarcode } from 'lucide-react'

export default function RecibirPage() {
  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <ScanBarcode className="h-6 w-6" style={{ color: '#F5B800' }} />
          <h1 className="text-2xl font-bold text-white">Recibir paquetes</h1>
        </div>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
          Escanea o escribe el tracking para registrar la llegada a bodega USA
        </p>
      </div>

      <RecibirForm />
    </div>
  )
}
