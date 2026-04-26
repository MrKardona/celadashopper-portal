import Link from 'next/link'
import { Package, ArrowLeft } from 'lucide-react'

export default function AgenteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="h-6 w-6 text-orange-400" />
          <span className="font-bold text-orange-400">CeladaShopper</span>
          <span className="text-gray-400 text-sm">— Panel Bodega USA</span>
        </div>
        <Link href="/dashboard" className="flex items-center gap-1 text-gray-400 hover:text-white text-sm">
          <ArrowLeft className="h-4 w-4" />
          Portal cliente
        </Link>
      </header>
      <main className="p-4">{children}</main>
    </div>
  )
}
