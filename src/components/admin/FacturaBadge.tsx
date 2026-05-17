interface Props {
  facturaId: string | null
  facturaPagada: boolean | null
  costoServicio: number | null
  size?: 'sm' | 'xs'
}

export default function FacturaBadge({ facturaId, facturaPagada, costoServicio, size = 'sm' }: Props) {
  const cls = size === 'xs'
    ? 'inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap'
    : 'inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap'

  if (facturaId && facturaPagada) {
    return (
      <span className={cls} style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}>
        ✅ Pagada
      </span>
    )
  }

  if (facturaId && !facturaPagada) {
    return (
      <span className={cls} style={{ background: 'rgba(99,130,255,0.12)', color: '#8899ff', border: '1px solid rgba(99,130,255,0.25)' }}>
        📄 Facturada
      </span>
    )
  }

  if (!facturaId && costoServicio && costoServicio > 0) {
    return (
      <span className={cls} style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
        ⚠️ Sin factura
      </span>
    )
  }

  return (
    <span className={cls} style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.08)' }}>
      — Sin costo
    </span>
  )
}
