// src/app/(admin)/admin/recibir/page.tsx
import RecibirForm from './RecibirForm'
import { ScanBarcode } from 'lucide-react'

export default function RecibirPage() {
  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <ScanBarcode className="h-6 w-6 text-orange-600" />
          <h1 className="text-2xl font-bold text-gray-900">Recibir paquetes</h1>
        </div>
        <p className="text-gray-500 text-sm mt-1">
          Escanea o escribe el tracking para registrar la llegada a bodega USA
        </p>
      </div>

      <RecibirForm />
    </div>
  )
}
