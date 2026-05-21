import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatTime, formatDate } from '@/lib/utils'
import type { Reservation } from '@/types'

interface AlertsProps {
  stalePending: Reservation[]
}

export function Alerts({ stalePending }: AlertsProps) {
  if (stalePending.length === 0) return null

  return (
    <Card className="border-yellow-200 bg-yellow-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-yellow-800 text-sm">
          <AlertTriangle className="h-4 w-4" />
          {stalePending.length} réservation{stalePending.length > 1 ? 's' : ''} en attente depuis plus de 2h
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {stalePending.map(r => (
            <li key={r.id} className="flex items-center justify-between gap-4 text-sm">
              <span className="text-yellow-900">
                <strong>{r.client?.first_name} {r.client?.last_name}</strong>
                {' — '}{formatDate(r.date)} à {formatTime(r.slot_time)}
                {' — '}{r.jet_ski?.name}
              </span>
              <Button asChild size="sm" variant="accent">
                <Link href={`/reservations/${r.id}`}>Traiter</Link>
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
