import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getResend, FROM_EMAIL, STAFF_EMAIL } from '@/lib/resend'
import {
  emailDemandeRecue,
  emailConfirmation,
  emailAnnulation,
  emailRappel,
  emailNouvelleDemandeStaff,
} from '@/lib/email-templates'

type EmailEvent = 'request_received' | 'confirmed' | 'cancelled' | 'reminder' | 'staff_new_request'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { event, reservation_id } = body as { event: EmailEvent; reservation_id: string }

  if (!event || !reservation_id) {
    return NextResponse.json({ error: 'event et reservation_id requis' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: r, error } = await supabase
    .from('reservations')
    .select('*, jet_ski:jet_skis(*), client:clients(*)')
    .eq('id', reservation_id)
    .single()

  if (error || !r) return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 })

  const client         = r.client as { first_name: string; last_name: string; email: string }
  const client_name    = `${client.first_name} ${client.last_name}`
  const client_email   = client.email
  const resWithClient  = { ...r, client_first_name: client.first_name, client_name, client_email }

  const resend = getResend()

  try {
    switch (event) {
      case 'request_received':
        await resend.emails.send({
          from: FROM_EMAIL,
          to: client_email,
          subject: 'Jetski Arcachon — Demande reçue',
          html: emailDemandeRecue(resWithClient),
        })
        // Notifier le staff
        await resend.emails.send({
          from: FROM_EMAIL,
          to: STAFF_EMAIL,
          subject: `Nouvelle demande — ${client_name}`,
          html: emailNouvelleDemandeStaff(resWithClient),
        })
        break

      case 'confirmed':
        await resend.emails.send({
          from: FROM_EMAIL,
          to: client_email,
          subject: '✅ Réservation confirmée — Jetski Arcachon',
          html: emailConfirmation(resWithClient),
        })
        break

      case 'cancelled':
        await resend.emails.send({
          from: FROM_EMAIL,
          to: client_email,
          subject: 'Réservation annulée — Jetski Arcachon',
          html: emailAnnulation(resWithClient),
        })
        break

      case 'reminder':
        await resend.emails.send({
          from: FROM_EMAIL,
          to: client_email,
          subject: '🏄 Rappel — Votre sortie jet ski est demain !',
          html: emailRappel(resWithClient),
        })
        break

      case 'staff_new_request':
        await resend.emails.send({
          from: FROM_EMAIL,
          to: STAFF_EMAIL,
          subject: `Nouvelle demande en ligne — ${client_name}`,
          html: emailNouvelleDemandeStaff(resWithClient),
        })
        break

      default:
        return NextResponse.json({ error: 'Événement inconnu' }, { status: 400 })
    }

    return NextResponse.json({ success: true, event, reservation_id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
