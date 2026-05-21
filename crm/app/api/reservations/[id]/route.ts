import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('reservations')
    .select('*, jet_ski:jet_skis(*), client:clients(*)')
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const body = await request.json()

  const { data: existing } = await supabase
    .from('reservations')
    .select('status')
    .eq('id', params.id)
    .single()

  const { data, error } = await supabase
    .from('reservations')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select('*, jet_ski:jet_skis(*), client:clients(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Log status change
  if (body.status && existing?.status !== body.status) {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('reservation_logs').insert({
      reservation_id:   params.id,
      changed_by:       user?.id,
      changed_by_email: user?.email,
      old_status:       existing?.status,
      new_status:       body.status,
    })
  }

  return NextResponse.json(data)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { error } = await supabase.from('reservations').delete().eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
