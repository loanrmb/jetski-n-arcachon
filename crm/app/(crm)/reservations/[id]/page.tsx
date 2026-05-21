import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { ReservationDetailClient } from '@/components/reservations/reservation-detail-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateTime } from '@/lib/utils'
import { STATUS_LABELS, type Reservation, type JetSki, type Client, type ReservationLog, type ReservationStatus } from '@/types'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const revalidate = 0

export default async function ReservationDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  // Parallel fetch — no waterfall
  const [{ data }, { data: logs }] = await Promise.all([
    supabase
      .from('reservations')
      .select('*, jet_ski:jet_skis(*), client:clients(*)')
      .eq('id', params.id)
      .single(),
    supabase
      .from('reservation_logs')
      .select('*')
      .eq('reservation_id', params.id)
      .order('created_at', { ascending: false }),
  ])

  if (!data) notFound()

  const reservation = data as Reservation & { jet_ski: JetSki; client: Client }
  const auditLogs   = (logs ?? []) as ReservationLog[]

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Réservation" />
      <main className="flex-1 p-6 space-y-6 max-w-3xl">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/reservations"><ArrowLeft className="h-4 w-4 mr-1" />Retour</Link>
        </Button>

        {/*
          ReservationDetailClient is a Client Component — it owns onUpdate/onClose
          via useRouter so no function props cross the RSC boundary.
        */}
        <Card>
          <CardContent className="pt-6">
            <ReservationDetailClient reservation={reservation} />
          </CardContent>
        </Card>

        {auditLogs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historique des modifications</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Ancien statut</TableHead>
                    <TableHead>Nouveau statut</TableHead>
                    <TableHead>Par</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">{formatDateTime(log.created_at)}</TableCell>
                      <TableCell className="text-sm">{log.old_status ? STATUS_LABELS[log.old_status as ReservationStatus] : '—'}</TableCell>
                      <TableCell className="text-sm">{log.new_status ? STATUS_LABELS[log.new_status as ReservationStatus] : '—'}</TableCell>
                      <TableCell className="text-sm">{log.changed_by_email ?? 'Système'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
