import { Skeleton } from '@/components/ui/skeleton'

export default function ReservationsLoading() {
  return (
    <div className="flex flex-col min-h-full">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-9 w-44" />
      </div>
      <main className="flex-1 p-6 space-y-4">
        {/* Filter row */}
        <div className="flex gap-2">
          {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-8 w-24 rounded-full" />)}
        </div>
        {/* Table */}
        <div className="rounded-lg border bg-white overflow-hidden">
          <div className="p-4 border-b">
            <Skeleton className="h-4 w-full max-w-sm" />
          </div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex gap-4 px-4 py-3.5 border-b last:border-0">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-20 rounded-full ml-auto" />
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
