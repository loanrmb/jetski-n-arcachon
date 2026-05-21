import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { searchParams } = new URL(request.url)

  let query = supabase
    .from('reservations')
    .select('*, jet_ski:jet_skis(*), client:clients(*)')
    .order('date')
    .order('slot_time')

  const date   = searchParams.get('date')
  const status = searchParams.get('status')
  if (date)   query = query.eq('date', date)
  if (status) query = query.eq('status', status)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from('reservations')
    .insert(body)
    .select('*, jet_ski:jet_skis(*), client:clients(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
