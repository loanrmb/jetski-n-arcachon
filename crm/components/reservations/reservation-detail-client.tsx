'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'
import { ReservationDetail, type ReservationWithJoins } from './reservation-detail'
import { ReservationEditForm } from './reservation-edit-form'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface Props {
  reservation: ReservationWithJoins
  /**
   * Called after any successful update (status change, note save, edit).
   * Defaults to router.refresh() when rendered inside a server-component page.
   * Override with a client-side callback when rendered inside the calendar modal.
   */
  onUpdate?: () => void
}

export function ReservationDetailClient({ reservation, onUpdate }: Props) {
  const [editOpen, setEditOpen] = useState(false)
  const router = useRouter()

  // Allow editing even after no_show (staff may need to correct or re-confirm)
  const canEdit = !['completed', 'cancelled'].includes(reservation.status)

  function refresh() {
    onUpdate ? onUpdate() : router.refresh()
  }

  function handleEditSuccess() {
    setEditOpen(false)
    refresh()
  }

  return (
    <>
      {canEdit && (
        <div className="flex justify-end mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditOpen(true)}
            className="gap-1.5"
          >
            <Pencil className="h-3.5 w-3.5" />
            Modifier
          </Button>
        </div>
      )}

      <ReservationDetail
        reservation={reservation}
        onUpdate={refresh}
        onClose={() => router.back()}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier la réservation</DialogTitle>
          </DialogHeader>
          <ReservationEditForm
            reservation={reservation}
            onSuccess={handleEditSuccess}
            onCancel={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
