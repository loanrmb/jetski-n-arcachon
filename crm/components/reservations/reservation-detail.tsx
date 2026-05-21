'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatTime, statusColor } from '@/lib/utils'
import {
  STATUS_LABELS, SOURCE_LABELS, LICENSE_LABELS, DURATION_LABELS,
  type Reservation, type JetSki, type Client, type ReservationStatus,
} from '@/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { toast } from '@/components/ui/use-toast'
import { Phone, Mail, Users, Euro, FileText, ShieldCheck } from 'lucide-react'

export type ReservationWithJoins = Reservation & { jet_ski?: JetSki; client?: Client }

const NEXT_STATUS: Partial<Record<ReservationStatus, ReservationStatus[]>> = {
  pending:     ['confirmed', 'cancelled'],
  confirmed:   ['in_progress', 'cancelled', 'no_show'],
  in_progress: ['completed'],
  completed:   [],
  cancelled:   [],
  no_show:     [],
}

interface ReservationDetailProps {
  reservation: ReservationWithJoins
  onUpdate: () => void
  onClose: () => void
}

export function ReservationDetail({ reservation: r, onUpdate, onClose }: ReservationDetailProps) {
  // Optimistic status — updated instantly, reverted on error
  const [currentStatus, setCurrentStatus] = useState<ReservationStatus>(r.status)
  const [note, setNote]      = useState(r.internal_note ?? '')
  const [fuel, setFuel]      = useState(r.fuel_note ?? '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [changingStatus, setChangingStatus] = useState<ReservationStatus | null>(null)
  const supabase = createClient()

  async function changeStatus(newStatus: ReservationStatus) {
    const previousStatus = currentStatus

    // ① Instant optimistic update — UI feels immediate
    setCurrentStatus(newStatus)
    setChangingStatus(newStatus)

    const { error } = await supabase
      .from('reservations')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', r.id)

    if (error) {
      // Revert on failure
      setCurrentStatus(previousStatus)
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    } else {
      // Fire-and-forget audit log
      supabase.from('reservation_logs').insert({
        reservation_id:   r.id,
        old_status:       previousStatus,
        new_status:       newStatus,
      })
      toast({ title: 'Statut mis à jour', variant: 'success' })
      onUpdate()
    }
    setChangingStatus(null)
  }

  async function saveNotes() {
    setSavingNotes(true)
    const { error } = await supabase
      .from('reservations')
      .update({ internal_note: note, fuel_note: fuel, updated_at: new Date().toISOString() })
      .eq('id', r.id)

    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Notes sauvegardées', variant: 'success' })
    }
    setSavingNotes(false)
  }

  const nextStatuses = NEXT_STATUS[currentStatus] ?? []
  const isDestructive = (s: ReservationStatus) => s === 'cancelled' || s === 'no_show'

  return (
    <div className="space-y-5">
      {/* ── Status + transition actions ── */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold transition-colors duration-300 ${statusColor(currentStatus)}`}
        >
          {currentStatus === 'in_progress' && (
            <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          )}
          {STATUS_LABELS[currentStatus]}
        </span>

        {nextStatuses.map(ns => (
          <Button
            key={ns}
            size="sm"
            variant={isDestructive(ns) ? 'outline' : 'accent'}
            className={isDestructive(ns) ? 'text-red-600 border-red-200 hover:bg-red-50' : ''}
            onClick={() => changeStatus(ns)}
            disabled={changingStatus !== null}
          >
            {changingStatus === ns ? (
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                {STATUS_LABELS[ns]}
              </span>
            ) : (
              `→ ${STATUS_LABELS[ns]}`
            )}
          </Button>
        ))}
      </div>

      <Separator />

      {/* ── Client ── */}
      <div>
        <h3 className="text-sm font-semibold mb-3 text-slate-700">Client</h3>
        <div className="space-y-2 text-sm">
          <p className="font-medium text-base">{r.client?.first_name} {r.client?.last_name}</p>
          {r.client?.phone && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-3.5 w-3.5" />{r.client.phone}
            </p>
          )}
          {r.client?.email && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-3.5 w-3.5" />{r.client.email}
            </p>
          )}
        </div>
      </div>

      <Separator />

      {/* ── Reservation details ── */}
      <div>
        <h3 className="text-sm font-semibold mb-3 text-slate-700">Réservation</h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
          <div>
            <dt className="text-muted-foreground text-xs mb-0.5">Date</dt>
            <dd className="font-medium">{formatDate(r.date)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs mb-0.5">Créneau</dt>
            <dd className="font-medium">{formatTime(r.slot_time)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs mb-0.5">Durée</dt>
            <dd className="font-medium">{DURATION_LABELS[r.duration_hours]}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs mb-0.5">Jet ski</dt>
            <dd className="font-medium flex items-center gap-1.5">
              {r.jet_ski && (
                <span
                  className="h-2.5 w-2.5 rounded-full inline-block shrink-0"
                  style={{ backgroundColor: r.jet_ski.color }}
                />
              )}
              {r.jet_ski?.name}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs mb-0.5 flex items-center gap-1">
              <Users className="h-3 w-3" />Personnes
            </dt>
            <dd className="font-medium">{r.nb_persons}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs mb-0.5">Source</dt>
            <dd className="font-medium">{SOURCE_LABELS[r.source]}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs mb-0.5 flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />Permis côtier
            </dt>
            <dd className="font-medium">{LICENSE_LABELS[r.license_verified]}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs mb-0.5 flex items-center gap-1">
              <Euro className="h-3 w-3" />Prix
            </dt>
            <dd className="font-medium">{r.price_total ? `${r.price_total} €` : '—'}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-muted-foreground text-xs mb-0.5">Caution</dt>
            <dd className="font-medium">{r.caution_collected ? '✅ Encaissée' : '⬜ Non encaissée'}</dd>
          </div>
        </dl>
      </div>

      {r.client_message && (
        <>
          <Separator />
          <div>
            <h3 className="text-sm font-semibold mb-2 text-slate-700 flex items-center gap-2">
              <FileText className="h-4 w-4" />Message client
            </h3>
            <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">{r.client_message}</p>
          </div>
        </>
      )}

      <Separator />

      {/* ── Internal notes ── */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">Notes internes</h3>
        <div className="space-y-1">
          <Label htmlFor="int_note">Note staff</Label>
          <Textarea id="int_note" rows={2} value={note} onChange={e => setNote(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="fuel_note">Carburant</Label>
          <Textarea
            id="fuel_note"
            rows={2}
            placeholder="Litres consommés, remarques…"
            value={fuel}
            onChange={e => setFuel(e.target.value)}
          />
        </div>
        <Button size="sm" variant="outline" onClick={saveNotes} disabled={savingNotes}>
          {savingNotes ? 'Sauvegarde…' : 'Sauvegarder les notes'}
        </Button>
      </div>
    </div>
  )
}
