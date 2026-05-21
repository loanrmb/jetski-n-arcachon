import { Skeleton } from '@/components/ui/skeleton'

export default function AnalyticsLoading() {
  return (
    <div className="flex flex-col min-h-full">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-9 w-44" />
      </div>
      <main className="flex-1 p-6 space-y-6">
        {/* Period selector */}
        <Skeleton className="h-20 rounded-lg" />
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-lg" />)}
        </div>
      </main>
    </div>
  )
}
