'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import frLocale from '@fullcalendar/core/locales/fr'
import type { EventClickArg, EventDropArg, EventInput } from '@fullcalendar/core'
import type { DateClickArg } from '@fullcalendar/interaction'
import { createClient } from '@/lib/supabase/client'
import { slotEndTime, STATUS_EVENT_COLOR, STATUS_EVENT_BORDER, hexRgba, formatTime } from '@/lib/utils'
import { STATUS_LABELS, type Reservation, type JetSki, type ReservationStatus } from '@/types'
import { ReservationDetailClient } from '@/components/reservations/reservation-detail-client'
import { ReservationForm } from '@/components/reservations/reservation-form'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { StatusBadge } from '@/components/reservations/status-badge'
import { ExternalLink, Save } from 'lucide-react'
import type { ReservationWithJoins } from '@/components/reservations/reservation-detail'

// Statuses that should appear dimmed in the calendar
const DIMMED = new Set<ReservationStatus>(['completed', 'cancelled', 'no_show'])

function reservationToEvent(r: ReservationWithJoins): EventInput {
  const endTime = slotEndTime(r.slot_time, Number(r.duration_hours))
  const hex     = STATUS_EVENT_COLOR[r.status]  ?? '#94A3B8'
  const border  = STATUS_EVENT_BORDER[r.status] ?? '#64748B'
  const isDimmed = DIMMED.has(r.status)

  return {
    id:              r.id,
    title:           `${r.client?.first_name ?? ''} ${r.client?.last_name ?? ''}`,
    start:           `${r.date}T${r.slot_time}`,
    end:             `${r.date}T${endTime}`,
    backgroundColor: isDimmed ? hexRgba(hex, 0.45) : hex,
    borderColor:     isDimmed ? hexRgba(border, 0.55) : border,
    textColor:       isDimmed ? '#64748B' : '#ffffff',
    extendedProps:   { reservation: r },
  }
}

export function ReservationCalendar() {
  const [reservations, setReservations] = useState<ReservationWithJoins[]>([])
  const [selectedRes, setSelectedRes]   = useState<ReservationWithJoins | null>(null)
  const [showDetail, setShowDetail]     = useState(false)
  const [showForm, setShowForm]         = useState(false)
  const [showQuickNote, setShowQuickNote] = useState(false)
  const [quickNoteText, setQuickNoteText] = useState('')
  const [savingNote, setSavingNote]     = useState(false)
  const [newSlot, setNewSlot]           = useState<{ date: string; time: string } | null>(null)
  const [loading, setLoading]           = useState(true)
  const calendarRef = useRef<FullCalendar>(null)
  const supabase    = createClient()

  const fetchReservations = useCallback(async () => {
    const { data, error } = await supabase
      .from('reservations')
      .select('*, jet_ski:jet_skis(*), client:clients(*)')
      .order('date')

    if (!error) setReservations((data ?? []) as ReservationWithJoins[])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchReservations()

    const channel = supabase
      .channel('reservations-calendar')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, fetchReservations)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchReservations])

  // ── Event click → quick note popover ─────────────────────────
  function handleEventClick(info: EventClickArg) {
    const r = info.event.extendedProps.reservation as ReservationWithJoins
    setSelectedRes(r)
    setQuickNoteText(r.internal_note ?? '')
    setShowQuickNote(true)
  }

  function openFullDetail() {
    setShowQuickNote(false)
    setShowDetail(true)
  }

  async function saveQuickNote() {
    if (!selectedRes) return
    setSavingNote(true)
    const { error } = await supabase
      .from('reservations')
      .update({ internal_note: quickNoteText, updated_at: new Date().toISOString() })
      .eq('id', selectedRes.id)

    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Note sauvegardée', variant: 'success' })
      fetchReservations()
    }
    setSavingNote(false)
  }

  function handleDateClick(info: DateClickArg) {
    const hour    = info.date.getHours()
    const slots   = ['09:00', '11:00', '14:00', '16:00']
    const nearest = slots.reduce((prev, curr) => {
      const [h] = curr.split(':').map(Number)
      return Math.abs(h - hour) < Math.abs(Number(prev.split(':')[0]) - hour) ? curr : prev
    }, slots[0])

    setNewSlot({ date: info.dateStr.split('T')[0], time: nearest })
    setShowForm(true)
  }

  async function handleEventDrop(info: EventDropArg) {
    const r       = info.event.extendedProps.reservation as ReservationWithJoins
    const newDate = info.event.startStr.split('T')[0]
    const newTime = info.event.startStr.split('T')[1]?.slice(0, 5) ?? r.slot_time

    const { error } = await supabase
      .from('reservations')
      .update({ date: newDate, slot_time: newTime, updated_at: new Date().toISOString() })
      .eq('id', r.id)

    if (error) {
      info.revert()
      toast({ title: 'Erreur', description: 'Impossible de déplacer la réservation.', variant: 'destructive' })
    } else {
      toast({ title: 'Réservation déplacée', variant: 'success' })
      fetchReservations()
    }
  }

  function handleDetailUpdate() {
    fetchReservations()
  }

  const events = reservations.map(reservationToEvent)

  return (
    <>
      {/* ── Legend ── */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 mb-4 text-xs text-slate-600">
        {(Object.entries(STATUS_EVENT_COLOR) as [ReservationStatus, string][]).map(([status, color]) => (
          <span key={status} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />
            {STATUS_LABELS[status]}
          </span>
        ))}
        <span className="ml-4 text-slate-400">|</span>
        {[
          { label: 'GTI SE 130', color: '#3B82F6' },
          { label: 'GTX 230',    color: '#10B981' },
          { label: 'RXT-X 300',  color: '#EF4444' },
        ].map(({ label, color }) => (
          <span key={label} className="flex items-center gap-1 text-slate-400">
            <span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: color }} />
            {label}
          </span>
        ))}
      </div>

      {/* ── Calendar ── */}
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            <div className="flex gap-3 mb-6">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-40 ml-auto" />
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded" />
            ))}
          </div>
        ) : (
          <div className="p-4">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="timeGridWeek"
              locale={frLocale}
              headerToolbar={{
                left:   'prev,next today',
                center: 'title',
                right:  'dayGridMonth,timeGridWeek,timeGridDay',
              }}
              buttonText={{
                today: "Aujourd'hui",
                month: 'Mois',
                week:  'Semaine',
                day:   'Jour',
              }}
              slotMinTime="09:00:00"
              slotMaxTime="21:00:00"
              slotDuration="01:00:00"
              allDaySlot={false}
              events={events}
              eventClick={handleEventClick}
              dateClick={handleDateClick}
              editable={true}
              eventDrop={handleEventDrop}
              eventContent={renderEventContent}
              height="auto"
              expandRows={true}
              nowIndicator={true}
              businessHours={{
                daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
                startTime: '09:00',
                endTime:   '20:00',
              }}
            />
          </div>
        )}
      </div>

      {/* ── Quick note popover (compact dialog) ── */}
      <Dialog open={showQuickNote} onOpenChange={open => {
        setShowQuickNote(open)
        if (!open) { setSelectedRes(null); setQuickNoteText('') }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              {selectedRes?.jet_ski && (
                <span
                  className="h-2.5 w-2.5 rounded-full inline-block shrink-0"
                  style={{ backgroundColor: selectedRes.jet_ski.color }}
                />
              )}
              {selectedRes?.client?.first_name} {selectedRes?.client?.last_name}
            </DialogTitle>
          </DialogHeader>

          {selectedRes && (
            <div className="space-y-3">
              {/* Quick info */}
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <StatusBadge status={selectedRes.status} />
                <span>·</span>
                <span>{formatTime(selectedRes.slot_time)}</span>
                <span>·</span>
                <span>{selectedRes.jet_ski?.name ?? '—'}</span>
              </div>

              {/* Quick note */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-600">Note rapide</p>
                <Textarea
                  rows={3}
                  value={quickNoteText}
                  onChange={e => setQuickNoteText(e.target.value)}
                  placeholder="Note interne staff…"
                  className="text-sm resize-none"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="accent"
                  disabled={savingNote}
                  onClick={saveQuickNote}
                  className="gap-1.5"
                >
                  <Save className="h-3.5 w-3.5" />
                  {savingNote ? 'Sauvegarde…' : 'Sauvegarder'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={openFullDetail}
                  className="gap-1.5 text-muted-foreground"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Ouvrir la fiche complète
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Full reservation detail modal ── */}
      <Dialog open={showDetail} onOpenChange={open => {
        setShowDetail(open)
        if (!open) setSelectedRes(null)
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedRes?.jet_ski && (
                <span
                  className="h-3 w-3 rounded-full inline-block"
                  style={{ backgroundColor: selectedRes.jet_ski.color }}
                />
              )}
              {selectedRes?.client?.first_name} {selectedRes?.client?.last_name}
              {selectedRes?.jet_ski && (
                <span className="text-muted-foreground font-normal text-sm ml-1">
                  — {selectedRes.jet_ski.name}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedRes && (
            <ReservationDetailClient
              reservation={selectedRes}
              onUpdate={handleDetailUpdate}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ── New reservation modal ── */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvelle réservation</DialogTitle>
          </DialogHeader>
          <ReservationForm
            defaultDate={newSlot?.date}
            defaultSlot={newSlot?.time}
            onSuccess={() => { fetchReservations(); setShowForm(false) }}
            onCancel={() => setShowForm(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

function renderEventContent(eventInfo: { event: { extendedProps: { reservation: ReservationWithJoins } } }) {
  const r = eventInfo.event.extendedProps.reservation
  return (
    <div className="px-1 py-0.5 overflow-hidden leading-tight text-[11px]">
      <p className="font-semibold truncate">
        {r.client?.first_name} {r.client?.last_name}
      </p>
      <p className="opacity-90 flex items-center gap-1 truncate">
        {r.jet_ski && (
          <span
            className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
            style={{ backgroundColor: r.jet_ski.color }}
          />
        )}
        {r.jet_ski?.name}
      </p>
    </div>
  )
}
