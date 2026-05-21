import { Skeleton } from '@/components/ui/skeleton'

export default function ClientsLoading() {
  return (
    <div className="flex flex-col min-h-full">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-9 w-44" />
      </div>
      <main className="flex-1 p-6">
        <div className="rounded-lg border bg-white overflow-hidden">
          <div className="p-4 border-b">
            <Skeleton className="h-4 w-48" />
          </div>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex gap-4 px-4 py-3.5 border-b last:border-0">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-8 ml-auto" />
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
