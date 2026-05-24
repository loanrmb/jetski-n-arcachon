import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import { Eye, Star } from 'lucide-react'
import type { Client } from '@/types'

export const revalidate = 0

export default async function ClientsPage() {
  const supabase = createClient()

  // Fetch clients + total reservation count
  const [{ data: clientData }, { data: completedData }] = await Promise.all([
    supabase
      .from('clients')
      .select('*, reservations:reservations(count)')
      .order('created_at', { ascending: false })
      .limit(500),
    // Separate query: client_id of all completed reservations (for fidèle badge)
    supabase
      .from('reservations')
      .select('client_id')
      .eq('status', 'completed'),
  ])

  type ClientRow = Client & { reservations: { count: number }[] }
  const clients = (clientData ?? []) as ClientRow[]

  // Count completed reservations per client
  const completedByClient: Record<string, number> = {}
  for (const r of completedData ?? []) {
    if (r.client_id) {
      completedByClient[r.client_id] = (completedByClient[r.client_id] ?? 0) + 1
    }
  }

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Clients" />
      <main className="flex-1 p-6">
        <div className="rounded-lg border bg-white overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Réservations</TableHead>
                <TableHead>Inscrit le</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                    Aucun client enregistré.
                  </TableCell>
                </TableRow>
              ) : (
                clients.map(c => {
                  const totalCount     = c.reservations?.[0]?.count ?? 0
                  const completedCount = completedByClient[c.id] ?? 0
                  const isFidele       = completedCount >= 2
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-2">
                          {isFidele && (
                            <Star
                              className="h-3.5 w-3.5 text-amber-500 fill-amber-400 shrink-0"
                              aria-label="Client fidèle"
                            />
                          )}
                          {c.first_name} {c.last_name}
                          {isFidele && (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[11px] py-0">
                              Fidèle
                            </Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.email}</TableCell>
                      <TableCell className="text-sm">{c.phone ?? '—'}</TableCell>
                      <TableCell className="text-sm">{totalCount}</TableCell>
                      <TableCell className="text-sm">{formatDate(c.created_at)}</TableCell>
                      <TableCell>
                        <Button asChild variant="ghost" size="icon">
                          <Link href={`/clients/${c.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  )
}
