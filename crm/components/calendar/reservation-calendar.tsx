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
import { slotEndTime, STATUS_BADGE, hexRgba } from '@/lib/utils'
import { STATUS_LABELS, type ReservationStatus } from '@/types'
import { ReservationDetailClient } from '@/components/reservations/reservation-detail-client'
import { ReservationForm } from '@/components/reservations/reservation-form'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import type { ReservationWithJoins } from '@/components/reservations/reservation-detail'

// Statuses that appear dimmed (greyed out) in the calendar
const DIMMED = new Set<ReservationStatus>(['completed', 'cancelled', 'no_show'])

// Jet ski models — used for filter tabs and legend
const JET_SKI_MODELS = [
  { name: 'GTI SE 130', color: '#3B82F6' },
  { name: 'GTX 230',    color: '#10B981' },
  { name: 'RXT-X 300',  color: '#EF4444' },
]

function reservationToEvent(r: ReservationWithJoins): EventInput {
  const endTime  = slotEndTime(r.slot_time, Number(r.duration_hours))
  const hex      = r.jet_ski?.color ?? '#94A3B8'
  const isDimmed = DIMMED.has(r.status)

  return {
    id:              r.id,
    title:           `${r.client?.first_name ?? ''} ${r.client?.last_name ?? ''}`,
    start:           `${r.date}T${r.slot_time}`,
    end:             `${r.date}T${endTime}`,
    backgroundColor: isDimmed ? hexRgba(hex, 0.40) : hex,
    borderColor:     isDimmed ? hexRgba(hex, 0.50) : hex,
    textColor:       isDimmed ? '#64748B' : '#ffffff',
    extendedProps:   { reservation: r },
  }
}

export function ReservationCalendar() {
  const [reservations, setReservations] = useState<ReservationWithJoins[]>([])
  const [selectedRes, setSelectedRes]   = useState<ReservationWithJoins | null>(null)
  const [showDetail, setShowDetail]     = useState(false)
  const [showForm, setShowForm]         = useState(false)
  const [filterModel, setFilterModel]   = useState<string | null>(null)
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

  // ── Event click → open full detail directly ───────────────────
  function handleEventClick(info: EventClickArg) {
    const r = info.event.extendedProps.reservation as ReservationWithJoins
    setSelectedRes(r)
    setShowDetail(true)
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

  const events = (filterModel
    ? reservations.filter(r => r.jet_ski?.name === filterModel)
    : reservations
  ).map(reservationToEvent)

  return (
    <>
      {/* ── Status legend ── */}
      <div className="flex flex-wrap gap-x-3 gap-y-2 mb-3 text-xs">
        {(Object.entries(STATUS_BADGE) as [ReservationStatus, string][]).map(([status, cls]) => (
          <span
            key={status}
            className={`inline-flex items-center rounded px-1.5 py-0.5 border font-medium ${cls}`}
          >
            {STATUS_LABELS[status]}
          </span>
        ))}
      </div>

      {/* ── Model filter tabs ── */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setFilterModel(null)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            filterModel === null
              ? 'bg-slate-800 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Tous
        </button>
        {JET_SKI_MODELS.map(({ name, color }) => (
          <button
            key={name}
            onClick={() => setFilterModel(filterModel === name ? null : name)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filterModel === name
                ? 'text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
            style={filterModel === name ? { backgroundColor: color } : undefined}
          >
            <span
              className="inline-block h-2 w-2 rounded-full shrink-0"
              style={{
                backgroundColor: filterModel === name ? 'rgba(255,255,255,0.75)' : color,
              }}
            />
            {name}
          </button>
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
                  className="h-3 w-3 rounded-full inline-block shrink-0"
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
  const r      = eventInfo.event.extendedProps.reservation
  const badgeCls = STATUS_BADGE[r.status] ?? 'bg-slate-100 text-slate-600 border-slate-300'
  const label    = STATUS_LABELS[r.status] ?? r.status

  return (
    <div className="px-1 py-0.5 overflow-hidden leading-tight text-[11px] space-y-0.5">
      {/* Line 1: model color dot + model short name */}
      <p className="font-semibold truncate flex items-center gap-1">
        {r.jet_ski && (
          <span
            className="inline-block h-1.5 w-1.5 rounded-full shrink-0 ring-1 ring-white/40"
            style={{ backgroundColor: r.jet_ski.color }}
          />
        )}
        <span className="truncate">{r.jet_ski?.name ?? '—'}</span>
      </p>
      {/* Line 2: client first name */}
      <p className="truncate">{r.client?.first_name ?? ''}</p>
      {/* Line 3: status badge pill */}
      <span className={`inline-flex items-center rounded px-1 py-px text-[10px] font-medium border ${badgeCls}`}>
        {label}
      </span>
    </div>
  )
}
