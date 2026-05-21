import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { ReservationStatus } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'dd/MM/yyyy', { locale: fr })
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, "dd/MM/yyyy 'à' HH'h'mm", { locale: fr })
}

export function formatTime(time: string): string {
  return time.slice(0, 5).replace(':', 'h')
}

export function slotEndTime(slotTime: string, durationHours: number): string {
  const [h, m] = slotTime.split(':').map(Number)
  const totalMin = h * 60 + m + durationHours * 60
  const endH = Math.floor(totalMin / 60)
  const endM = totalMin % 60
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
}

export function calcPrice(jetSki: { price_1h: number; price_2h: number; price_4h: number }, duration: number): number {
  if (duration === 1) return jetSki.price_1h
  if (duration === 2) return jetSki.price_2h
  return jetSki.price_4h
}

// ─── Status colour system ────────────────────────────────────────────────────
//
// One source of truth used by badges, calendar events, row highlights.
//
// pending     → amber   (waiting, needs attention)
// confirmed   → blue    (locked in)
// in_progress → emerald (on the water right now)
// completed   → slate   (done, archived feel)
// cancelled   → red     (problem / lost)
// no_show     → violet  (unusual, memorable)

/** Tailwind classes for badge/chip display */
export const STATUS_BADGE: Record<ReservationStatus, string> = {
  pending:     'bg-amber-100   text-amber-800   border-amber-300',
  confirmed:   'bg-blue-100    text-blue-800    border-blue-300',
  in_progress: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  completed:   'bg-slate-100   text-slate-600   border-slate-300',
  cancelled:   'bg-red-100     text-red-700     border-red-300',
  no_show:     'bg-violet-100  text-violet-800  border-violet-300',
}

/** Solid hex colours for FullCalendar event backgrounds */
export const STATUS_EVENT_COLOR: Record<ReservationStatus, string> = {
  pending:     '#F59E0B',  // amber-400
  confirmed:   '#3B82F6',  // blue-500
  in_progress: '#10B981',  // emerald-500
  completed:   '#94A3B8',  // slate-400
  cancelled:   '#EF4444',  // red-500
  no_show:     '#7C3AED',  // violet-600
}

/** Darker border colours for FullCalendar events */
export const STATUS_EVENT_BORDER: Record<ReservationStatus, string> = {
  pending:     '#D97706',  // amber-500
  confirmed:   '#2563EB',  // blue-600
  in_progress: '#059669',  // emerald-600
  completed:   '#64748B',  // slate-500
  cancelled:   '#DC2626',  // red-600
  no_show:     '#6D28D9',  // violet-700
}

/** Convert hex + alpha → rgba (for dimming inactive events) */
export function hexRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/** Returns the badge Tailwind class string for a given status */
export function statusColor(status: string): string {
  return STATUS_BADGE[status as ReservationStatus] ?? 'bg-slate-100 text-slate-600 border-slate-300'
}
