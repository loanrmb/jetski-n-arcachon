import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { StatusBadge } from '@/components/reservations/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, formatTime } from '@/lib/utils'
import { DURATION_LABELS, SOURCE_LABELS, type Reservation, type JetSki, type Client } from '@/types'
import { Eye, Plus } from 'lucide-react'

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

  const { data } = await query.limit(200)
  const reservations = (data ?? []) as (Reservation & { jet_ski: JetSki; client: Client })[]

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

        {/* Tableau */}
        <div className="rounded-lg border bg-white overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Créneau</TableHead>
                <TableHead>Jet ski</TableHead>
                <TableHead>Durée</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Prix</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-12">
                    Aucune réservation trouvée.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(r => (
                  <TableRow key={r.id} className="transition-colors duration-100 hover:bg-slate-50/80">
                    <TableCell>
                      <p className="font-medium text-sm">{r.client?.first_name} {r.client?.last_name}</p>
                      <p className="text-xs text-muted-foreground">{r.client?.email}</p>
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(r.date)}</TableCell>
                    <TableCell className="text-sm">{formatTime(r.slot_time)}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5 text-sm">
                        {r.jet_ski && (
                          <span className="h-2 w-2 rounded-full inline-block shrink-0" style={{ backgroundColor: r.jet_ski.color }} />
                        )}
                        {r.jet_ski?.name}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{DURATION_LABELS[r.duration_hours]}</TableCell>
                    <TableCell className="text-sm">{SOURCE_LABELS[r.source]}</TableCell>
                    <TableCell className="text-sm font-medium">{r.price_total ? `${r.price_total} €` : '—'}</TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="icon">
                        <Link href={`/reservations/${r.id}`}><Eye className="h-4 w-4" /></Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  )
}
