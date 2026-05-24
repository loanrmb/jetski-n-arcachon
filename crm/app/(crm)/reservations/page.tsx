import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { StatusBadge } from '@/components/reservations/status-badge'
import { ReservationsClient } from '@/components/reservations/reservations-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus } from 'lucide-react'
import type { Reservation, JetSki, Client } from '@/types'

export const revalidate = 0

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: { status?: string; search?: string }
}) {
  const supabase = createClient()

  let query = supabase
    .from('reservations')
    .select('*, jet_ski:jet_skis(*), client:clients(*)')
    .order('date', { ascending: false })
    .order('slot_time')

  if (searchParams.status) {
    query = query.eq('status', searchParams.status)
  }

  // Fetch repeat-client IDs in parallel (clients with 2+ completed reservations)
  const [{ data }, { data: completedData }] = await Promise.all([
    query.limit(200),
    supabase.from('reservations').select('client_id').eq('status', 'completed'),
  ])

  const reservations = (data ?? []) as (Reservation & { jet_ski: JetSki; client: Client })[]

  // Count completed per client — O(n) scan
  const completedCount: Record<string, number> = {}
  for (const r of completedData ?? []) {
    if (r.client_id) {
      completedCount[r.client_id] = (completedCount[r.client_id] ?? 0) + 1
    }
  }
  const repeatClientIds = new Set(
    Object.entries(completedCount).filter(([, n]) => n >= 2).map(([id]) => id)
  )

  const filtered = searchParams.search
    ? reservations.filter(r => {
        const q = searchParams.search!.toLowerCase()
        return (
          r.client?.first_name?.toLowerCase().includes(q) ||
          r.client?.last_name?.toLowerCase().includes(q) ||
          r.client?.email?.toLowerCase().includes(q)
        )
      })
    : reservations

  const statuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Réservations" />

      <main className="flex-1 p-6 space-y-4">
        {/* Filtres */}
        <div className="flex flex-wrap gap-2 items-center">
          <Button asChild size="sm" variant={!searchParams.status ? 'default' : 'outline'}>
            <Link href="/reservations">Toutes</Link>
          </Button>
          {statuses.map(s => (
            <Button
              key={s}
              asChild
              size="sm"
              variant={searchParams.status === s ? 'default' : 'outline'}
            >
              <Link href={`/reservations?status=${s}`}>
                <StatusBadge status={s as any} className="border-0 bg-transparent p-0" />
              </Link>
            </Button>
          ))}

          <form className="ml-auto">
            <Input
              name="search"
              defaultValue={searchParams.search}
              placeholder="Rechercher un client…"
              className="w-56"
            />
          </form>

          <Button asChild variant="accent" size="sm">
            <Link href="/reservations/new"><Plus className="h-3.5 w-3.5 mr-1" />Nouvelle</Link>
          </Button>
        </div>

        {/* Table + bulk actions + CSV export */}
        <ReservationsClient
          reservations={filtered}
          repeatClientIds={repeatClientIds}
        />
      </main>
    </div>
  )
}
