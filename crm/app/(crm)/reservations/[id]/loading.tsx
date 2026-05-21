import { Skeleton } from '@/components/ui/skeleton'

export default function ReservationDetailLoading() {
  return (
    <div className="flex flex-col min-h-full">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-9 w-44" />
      </div>
      <main className="flex-1 p-6 space-y-6 max-w-3xl">
        <Skeleton className="h-8 w-20" />
        <div className="rounded-lg border bg-white p-6 space-y-5">
          {/* Status buttons */}
          <div className="flex gap-2">
            <Skeleton className="h-7 w-24 rounded-full" />
            <Skeleton className="h-7 w-28 rounded-full" />
          </div>
          <Skeleton className="h-px w-full" />
          {/* Client info */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-36" />
          </div>
          <Skeleton className="h-px w-full" />
          {/* Detail grid */}
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
