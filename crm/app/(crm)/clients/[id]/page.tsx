import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { StatusBadge } from '@/components/reservations/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, formatTime } from '@/lib/utils'
import { DURATION_LABELS } from '@/types'
import { ArrowLeft, Phone, Mail, Star, Euro, CalendarDays } from 'lucide-react'
import type { Client, Reservation, JetSki } from '@/types'

export const revalidate = 0

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const [{ data: clientData }, { data: resvData }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', params.id).single(),
    supabase
      .from('reservations')
      .select('*, jet_ski:jet_skis(*)')
      .eq('client_id', params.id)
      .order('date', { ascending: false }),
  ])

  if (!clientData) notFound()

  const client       = clientData as Client
  const reservations = (resvData ?? []) as (Reservation & { jet_ski: JetSki })[]

  const completed = reservations.filter(r => r.status === 'completed')
  const revenue   = completed.reduce((sum, r) => sum + (r.price_total ?? 0), 0)
  const isFidele  = completed.length >= 2

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Fiche client" />
      <main className="flex-1 p-6 space-y-6 max-w-3xl">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/clients">
            <ArrowLeft className="h-4 w-4 mr-1" />Retour
          </Link>
        </Button>

        {/* ── Client info ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              {client.first_name} {client.last_name}
              {isFidele && (
                <>
                  <Star className="h-4 w-4 text-amber-500 fill-amber-400" />
                  <Badge className="bg-amber-100 text-amber-800 border-amber-300">Fidèle</Badge>
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-3.5 w-3.5" />{client.email}
            </p>
            {client.phone && (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-3.5 w-3.5" />{client.phone}
              </p>
            )}
            {client.internal_note && (
              <p className="text-sm bg-slate-50 rounded-lg p-3 mt-2">{client.internal_note}</p>
            )}
          </CardContent>
        </Card>

        {/* ── KPIs ── */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />Total réservations
              </p>
              <p className="text-2xl font-bold">{reservations.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />Terminées
              </p>
              <p className="text-2xl font-bold">{completed.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
                <Euro className="h-3 w-3" />CA total
              </p>
              <p className="text-2xl font-bold">{revenue.toFixed(0)} €</p>
            </CardContent>
          </Card>
        </div>

        {/* ── Reservation history ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historique des réservations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Créneau</TableHead>
                  <TableHead>Jet ski</TableHead>
                  <TableHead>Durée</TableHead>
                  <TableHead>Prix</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {reservations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Aucune réservation.
                    </TableCell>
                  </TableRow>
                ) : (
                  reservations.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">{formatDate(r.date)}</TableCell>
                      <TableCell className="text-sm">{formatTime(r.slot_time)}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5 text-sm">
                          {r.jet_ski && (
                            <span
                              className="h-2 w-2 rounded-full inline-block shrink-0"
                              style={{ backgroundColor: r.jet_ski.color }}
                            />
                          )}
                          {r.jet_ski?.name ?? '—'}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{DURATION_LABELS[r.duration_hours]}</TableCell>
                      <TableCell className="text-sm font-medium">
                        {r.price_total ? `${r.price_total} €` : '—'}
                      </TableCell>
                      <TableCell><StatusBadge status={r.status} /></TableCell>
                      <TableCell>
                        <Button asChild variant="ghost" size="icon">
                          <Link href={`/reservations/${r.id}`}>
                            <ArrowLeft className="h-4 w-4 rotate-180" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
