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
import { slotEndTime } from '@/lib/utils'
import { STATUS_LABELS, type ReservationStatus } from '@/types'
import { ReservationDetailClient } from '@/components/reservations/reservation-detail-client'
import { ReservationForm } from '@/components/reservations/reservation-form'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import type { ReservationWithJoins } from '@/components/reservations/reservation-detail'

// Block background color keyed by status — primary visual signal in the calendar
const STATUS_COLORS: Record<ReservationStatus, string> = {
  pending:     '#F59E0B',
  confirmed:   '#3B82F6',
  in_progress: '#10B981',
  completed:   '#6B7280',
  cancelled:   '#EF4444',
  no_show:     '#8B5CF6',
}

// Jet ski models — used for filter tabs and model dot colors
const JET_SKI_MODELS = [
  { name: 'GTI SE 130', color: '#3B82F6' },
  { name: 'GTX 230',    color: '#10B981' },
  { name: 'RXT-X 300',  color: '#EF4444' },
]

function reservationToEvent(r: ReservationWithJoins): EventInput {
  const endTime = slotEndTime(r.slot_time, Number(r.duration_hours))
  const color   = STATUS_COLORS[r.status] ?? '#6B7280'

  return {
    id:              r.id,
    title:           `${r.client?.first_name ?? ''} ${r.client?.last_name ?? ''}`,
    start:           `${r.date}T${r.slot_time}`,
    end:             `${r.date}T${endTime}`,
    backgroundColor: color,
    borderColor:     color,
    textColor:       '#ffffff',
    extendedProps:   { reservation: r },
  }
}

export function ReservationCalendar() {
  const [reservations, setReservations] = useState<ReservationWithJoins[]>([])
  const [selectedRes, setSelectedRes]   = useState<ReservationWithJoins | null>(null)
  const [showDetail, setShowDetail]     = useState(false)
  const [showForm, setShowForm]         = useState(false)
  const [filterModel, setFilterModel]   = useState<string | null>(null)
  const [hideCancelled, setHideCancelled] = useState(true)
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

  // ── Auto-transition confirmed → in_progress when slot time is reached ──
  useEffect(() => {
    async function autoTransition() {
      const now   = new Date()
      const today = now.toISOString().split('T')[0]
      const pad   = (n: number) => String(n).padStart(2, '0')
      const hhmm  = (d: Date)   => `${pad(d.getHours())}:${pad(d.getMinutes())}`

      const current   = hhmm(now)
      const thirtyAgo = hhmm(new Date(now.getTime() - 30 * 60 * 1000))

      const { error } = await supabase
        .from('reservations')
        .update({ status: 'in_progress', updated_at: new Date().toISOString() })
        .eq('status', 'confirmed')
        .eq('date', today)
        .lte('slot_time', current)
        .gte('slot_time', thirtyAgo)

      if (!error) fetchReservations()
    }

    autoTransition()
    const timer = setInterval(autoTransition, 5 * 60 * 1000)
    return () => clearInterval(timer)
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

  const events = reservations
    .filter(r => {
      // Fix 1: match on resolved model name (handles jet_ski_id=null online bookings)
      if (filterModel && (r.requested_jet_ski ?? r.jet_ski?.name) !== filterModel) return false
      // Fix 3: hide cancelled + no_show when toggle is on
      if (hideCancelled && (r.status === 'cancelled' || r.status === 'no_show')) return false
      return true
    })
    .map(reservationToEvent)

  return (
    <>
      {/* ── Status legend ── */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 mb-3 text-xs text-slate-600">
        {(Object.entries(STATUS_COLORS) as [ReservationStatus, string][]).map(([status, color]) => (
          <span key={status} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: color }}
            />
            {STATUS_LABELS[status]}
          </span>
        ))}
      </div>

      {/* ── Model filter tabs + hide-cancelled toggle ── */}
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

        {/* Hide cancelled/no-show toggle — right-aligned */}
        <label className="flex items-center gap-2 text-sm text-slate-500 cursor-pointer select-none ml-auto">
          <input
            type="checkbox"
            checked={hideCancelled}
            onChange={e => setHideCancelled(e.target.checked)}
            className="h-4 w-4 rounded accent-slate-700 cursor-pointer"
          />
          Masquer les annulées
        </label>
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
              onClose={() => { setShowDetail(false); setSelectedRes(null) }}
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

function renderEventContent(eventInfo: {
  event: {
    start:         Date | null
    end:           Date | null
    extendedProps: { reservation: ReservationWithJoins }
  }
}) {
  const r         = eventInfo.event.extendedProps.reservation
  const modelName = r.requested_jet_ski ?? r.jet_ski?.name ?? '—'
  const dotColor  = r.jet_ski?.color ?? '#6B7280'
  const label     = STATUS_LABELS[r.status] ?? r.status

  // Hide the status label line when the block is ≤ 60 min tall — not enough room
  const durationMins = eventInfo.event.end && eventInfo.event.start
    ? (eventInfo.event.end.getTime() - eventInfo.event.start.getTime()) / 60000
    : 60
  const isShort = durationMins <= 60

  return (
    <div className="px-1 py-0.5 overflow-hidden leading-tight text-[11px]">
      {/* Line 1: model color dot + model name */}
      <p className="flex items-center gap-1 overflow-hidden whitespace-nowrap">
        <span
          className="inline-block h-1.5 w-1.5 rounded-full shrink-0 ring-1 ring-white/40"
          style={{ backgroundColor: dotColor }}
        />
        <span className="overflow-hidden text-ellipsis whitespace-nowrap">{modelName}</span>
      </p>
      {/* Line 2: client first name — bold */}
      <p className="font-bold overflow-hidden text-ellipsis whitespace-nowrap">
        {r.client?.first_name ?? ''}
      </p>
      {/* Line 3: status label — hidden on short (1h) blocks */}
      {!isShort && (
        <p
          className="text-[10px] overflow-hidden text-ellipsis whitespace-nowrap"
          style={{ opacity: 0.75 }}
        >
          {label}
        </p>
      )}
    </div>
  )
}
