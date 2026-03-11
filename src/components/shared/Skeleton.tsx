export function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg p-3 shadow-sm border-l-4 border-gray-200 animate-pulse">
      <div className="h-3 bg-gray-200 rounded w-20 mb-2" />
      <div className="h-6 bg-gray-200 rounded w-16 mb-1" />
      <div className="h-2.5 bg-gray-100 rounded w-24" />
    </div>
  )
}

export function SkeletonChart() {
  return (
    <div className="bg-white rounded-lg p-4 shadow-sm animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-40 mb-4" />
      <div className="h-48 bg-gray-100 rounded" />
    </div>
  )
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden animate-pulse">
      <div className="h-8 bg-gray-200" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`h-8 ${i % 2 ? 'bg-gray-50' : 'bg-white'} flex items-center px-4 gap-4`}>
          <div className="h-3 bg-gray-200 rounded w-24" />
          <div className="h-3 bg-gray-200 rounded w-16" />
          <div className="h-3 bg-gray-200 rounded w-12" />
          <div className="h-3 bg-gray-200 rounded w-12" />
        </div>
      ))}
    </div>
  )
}

export function TabSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
      <SkeletonChart />
      <SkeletonTable />
    </div>
  )
}
