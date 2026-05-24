import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { searchParams } = new URL(request.url)

  // ── Block disabled models (booking_enabled = false) ──────────
  const { data: disabledJs } = await supabase
    .from('jet_skis')
    .select('id')
    .eq('booking_enabled', false)
  const disabledIds = (disabledJs ?? []).map(j => j.id as string)

  let query = supabase
    .from('availabilities')
    .select('*, jet_ski:jet_skis(*)')
    .eq('is_blocked', false)
    .order('date')
    .order('slot_time')

  // Exclude slots that belong to a booking-disabled jet ski
  if (disabledIds.length > 0) {
    query = query.not('jet_ski_id', 'in', `(${disabledIds.join(',')})`)
  }

  const date     = searchParams.get('date')
  const jetSkiId = searchParams.get('jet_ski_id')
  const from     = searchParams.get('from')
  const to       = searchParams.get('to')

  if (date)     query = query.eq('date', date)
  if (jetSkiId) query = query.eq('jet_ski_id', jetSkiId)
  if (from)     query = query.gte('date', from)
  if (to)       query = query.lte('date', to)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from('availabilities')
    .upsert(body, { onConflict: 'jet_ski_id,date,slot_time' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
