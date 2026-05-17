'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2 } from 'lucide-react'

export default function EliminarDivisionButton({ subPaqueteId }: { subPaqueteId: string }) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const [cargando, setCargando] = useState(false)

  async function eliminar() {
    setCargando(true)
    try {
      await fetch(`/api/admin/paquetes/${subPaqueteId}`, { method: 'DELETE' })
      router.refresh()
    } finally {
      setCargando(false)
      setConfirmando(false)
    }
  }

  if (confirmando) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          onClick={eliminar}
          disabled={cargando}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold disabled:opacity-50"
          style={{ background: '#ef4444', color: 'white' }}
        >
          {cargando ? <Loader2 className="h-3 w-3 animate-spin" /> : '¿Eliminar?'}
        </button>
        <button
          onClick={() => setConfirmando(false)}
          className="text-[10px] px-2 py-1 rounded-lg"
          style={{ color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          No
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirmando(true)}
      title="Eliminar división"
      className="text-white/20 hover:text-red-400 transition-colors p-1 rounded"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  )
}
