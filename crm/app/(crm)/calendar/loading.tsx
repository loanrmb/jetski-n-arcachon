import { Skeleton } from '@/components/ui/skeleton'

export default function CalendarLoading() {
  return (
    <div className="flex flex-col min-h-full">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-9 w-44" />
      </div>
      <main className="flex-1 p-6 space-y-4">
        {/* Legend row */}
        <div className="flex gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-3 w-3 rounded-sm" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
        {/* Calendar body */}
        <Skeleton className="w-full rounded-lg" style={{ height: 620 }} />
      </main>
    </div>
  )
}
