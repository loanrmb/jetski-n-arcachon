'use client'

import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { ReservationForm } from '@/components/reservations/reservation-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function NewReservationPage() {
  const router = useRouter()

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Nouvelle réservation" />
      <main className="flex-1 p-6">
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Créer une réservation manuelle</CardTitle>
          </CardHeader>
          <CardContent>
            <ReservationForm
              onSuccess={() => router.push('/reservations')}
              onCancel={() => router.back()}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
