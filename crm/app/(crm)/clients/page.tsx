import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import { Eye } from 'lucide-react'
import type { Client } from '@/types'

export const revalidate = 0

export default async function ClientsPage() {
  const supabase = createClient()

  const { data } = await supabase
    .from('clients')
    .select('*, reservations:reservations(count)')
    .order('created_at', { ascending: false })
    .limit(500)

  const clients = (data ?? []) as (Client & { reservations: { count: number }[] })[]

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
                clients.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.first_name} {c.last_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.email}</TableCell>
                    <TableCell className="text-sm">{c.phone ?? '—'}</TableCell>
                    <TableCell className="text-sm">{c.reservations?.[0]?.count ?? 0}</TableCell>
                    <TableCell className="text-sm">{formatDate(c.created_at)}</TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="icon">
                        <Link href={`/reservations?search=${encodeURIComponent(c.email)}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
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
