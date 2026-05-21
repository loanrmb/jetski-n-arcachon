import { Skeleton } from '@/components/ui/skeleton'

export default function FleetLoading() {
  return (
    <div className="flex flex-col min-h-full">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-9 w-44" />
      </div>
      <main className="flex-1 p-6">
        <div className="flex justify-end mb-6">
          <Skeleton className="h-9 w-44" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-white overflow-hidden">
              <Skeleton className="h-1.5 w-full rounded-none" />
              <div className="p-6 space-y-4">
                <div className="flex justify-between">
                  <div className="space-y-1">
                    <Skeleton className="h-5 w-28" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: 3 }).map((_, j) => <Skeleton key={j} className="h-16 rounded-lg" />)}
                </div>
                <div className="space-y-1.5">
                  {Array.from({ length: 3 }).map((_, j) => <Skeleton key={j} className="h-4 w-full" />)}
                </div>
                <div className="flex gap-2 pt-1">
                  <Skeleton className="h-8 flex-1" />
                  <Skeleton className="h-8 w-10" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
