import { ScanBarcode } from 'lucide-react'
import RecibirColombiaForm from '@/components/admin/RecibirColombiaForm'

export default function RecibirColombiaPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ScanBarcode className="h-6 w-6" style={{ color: '#F5B800' }} />
          Recibir paquetes en Colombia
        </h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
          Escanea el tracking USACO de la caja para ver todos los paquetes que vienen dentro
          y confirmar su recepción en bodega Colombia.
        </p>
      </div>
      <RecibirColombiaForm />
    </div>
  )
}
