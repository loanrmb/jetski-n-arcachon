import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getResend, FROM_EMAIL } from '@/lib/resend'
import { emailRappelJ1, emailRappelH3 } from '@/lib/email-templates'
import type { Reservation, JetSki, Client } from '@/types'

// Vercel Cron: runs every hour at :00  →  "0 * * * *" in vercel.json
// Secured by CRON_SECRET set in Vercel env vars
export const maxDuration = 30

export async function GET(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────
  const secret = request.headers.get('authorization')?.replace('Bearer ', '')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date()

  // ── J-1 Reminder ─────────────────────────────────────────────
  // Send to confirmed reservations for tomorrow that haven't received J-1 yet
  const tomorrow = new Date(now)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  const { data: j1Data } = await supabase
    .from('reservations')
    .select('*, client:clients(*), jet_ski:jet_skis(*)')
    .eq('status', 'confirmed')
    .eq('date', tomorrowStr)
    .is('reminder_j1_sent', null)

  const j1Reservations = (j1Data ?? []) as (Reservation & { client: Client; jet_ski: JetSki })[]

  // ── H-3 Reminder ─────────────────────────────────────────────
  // Business operates in Europe/Paris = UTC+2 in summer (CEST, May–October)
  // At each cron tick, we look for slots starting in ~3 hours from now in Paris time
  const PARIS_OFFSET_MS = 2 * 60 * 60 * 1000 // UTC+2 CEST
  const nowParis = new Date(now.getTime() + PARIS_OFFSET_MS)
  const h3TargetParis = new Date(nowParis.getTime() + 3 * 60 * 60 * 1000)

  // Date and slot_time are stored as Paris local time values
  const h3DateStr = h3TargetParis.toISOString().split('T')[0]
  const h3Hour    = h3TargetParis.getUTCHours() // already shifted to Paris
  const h3SlotStr = `${String(h3Hour).padStart(2, '0')}:00:00`

  const { data: h3Data } = await supabase
    .from('reservations')
    .select('*, client:clients(*), jet_ski:jet_skis(*)')
    .eq('status', 'confirmed')
    .eq('date', h3DateStr)
    .eq('slot_time', h3SlotStr)
    .is('reminder_h3_sent', null)

  const h3Reservations = (h3Data ?? []) as (Reservation & { client: Client; jet_ski: JetSki })[]

  const resend   = getResend()
  let j1Count = 0, h3Count = 0
  const errors: string[] = []

  // ── Send J-1 emails ──────────────────────────────────────────
  for (const r of j1Reservations) {
    if (!r.client?.email) continue
    try {
      await resend.emails.send({
        from:    FROM_EMAIL,
        to:      r.client.email,
        subject: 'Rappel : votre location de jet ski demain',
        html:    emailRappelJ1({ ...r, client_first_name: r.client.first_name }),
      })
      await supabase
        .from('reservations')
        .update({ reminder_j1_sent: new Date().toISOString() })
        .eq('id', r.id)
      j1Count++
    } catch (err: any) {
      errors.push(`J-1 ${r.id}: ${err.message}`)
    }
  }

  // ── Send H-3 emails ──────────────────────────────────────────
  for (const r of h3Reservations) {
    if (!r.client?.email) continue
    try {
      await resend.emails.send({
        from:    FROM_EMAIL,
        to:      r.client.email,
        subject: "C'est pour dans 3h — votre jet ski vous attend !",
        html:    emailRappelH3({ ...r, client_first_name: r.client.first_name }),
      })
      await supabase
        .from('reservations')
        .update({ reminder_h3_sent: new Date().toISOString() })
        .eq('id', r.id)
      h3Count++
    } catch (err: any) {
      errors.push(`H-3 ${r.id}: ${err.message}`)
    }
  }

  return NextResponse.json({
    ok:      true,
    j1_sent: j1Count,
    h3_sent: h3Count,
    errors:  errors.length ? errors : undefined,
  })
}
