const tw = 'rgba(255,255,255,'

export default function AdminLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-7 w-48 rounded-xl" style={{ background: `${tw}0.07)` }} />
        <div className="h-4 w-64 rounded-lg" style={{ background: `${tw}0.04)` }} />
      </div>

      {/* Stats row skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="glass-card p-4 h-24" />
        ))}
      </div>

      {/* Content skeleton */}
      <div className="glass-card p-5 space-y-3">
        <div className="h-4 w-40 rounded-lg" style={{ background: `${tw}0.07)` }} />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl" style={{ background: `${tw}0.04)` }} />
          ))}
        </div>
      </div>
    </div>
  )
}
