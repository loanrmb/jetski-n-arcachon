import type { Reservation } from '@/types'
import { formatDate, formatTime } from '@/lib/utils'

function base(content: string) {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font-family:sans-serif;background:#f8fafc;margin:0;padding:0}
  .container{max-width:600px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.1)}
  .header{background:#0F172A;padding:24px 32px;color:#fff}
  .header h1{margin:0;font-size:20px;font-weight:700}
  .header p{margin:4px 0 0;color:#94a3b8;font-size:14px}
  .body{padding:32px}
  .detail{background:#f1f5f9;border-radius:6px;padding:16px;margin:16px 0}
  .detail table{width:100%;border-collapse:collapse}
  .detail td{padding:6px 0;font-size:14px}
  .detail td:first-child{color:#64748b;width:160px}
  .cta{display:inline-block;background:#f97316;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0}
  .footer{background:#f8fafc;padding:16px 32px;text-align:center;color:#94a3b8;font-size:12px}
</style></head><body>
<div class="container">
  <div class="header">
    <h1>🏄 Jetski Arcachon</h1>
    <p>Jetée Thiers, Port d'Arcachon — 33120</p>
  </div>
  <div class="body">${content}</div>
  <div class="footer">Jetski Arcachon • contact@jetski-arcachon.fr • +33 5 56 00 00 00</div>
</div></body></html>`
}

function detail(r: Partial<Reservation>) {
  return `<div class="detail"><table>
    <tr><td>Date</td><td><strong>${r.date ? formatDate(r.date) : ''}</strong></td></tr>
    <tr><td>Créneau</td><td><strong>${r.slot_time ? formatTime(r.slot_time) : ''}</strong></td></tr>
    <tr><td>Durée</td><td><strong>${r.duration_hours}h${r.duration_hours === 4 ? ' (demi-journée)' : ''}</strong></td></tr>
    <tr><td>Modèle</td><td><strong>${(r as any).jet_ski?.name ?? '—'}</strong></td></tr>
    <tr><td>Personnes</td><td><strong>${r.nb_persons}</strong></td></tr>
  </table></div>`
}

export function emailDemandeRecue(r: Partial<Reservation> & { client_first_name: string }): string {
  return base(`
    <p>Bonjour <strong>${r.client_first_name}</strong>,</p>
    <p>Nous avons bien reçu votre demande de réservation. Notre équipe la traite dans les <strong>2 heures</strong> et vous envoie une confirmation.</p>
    ${detail(r)}
    <p>Des questions ? Contactez-nous à <a href="mailto:contact@jetski-arcachon.fr">contact@jetski-arcachon.fr</a>.</p>
  `)
}

export function emailConfirmation(r: Partial<Reservation> & { client_first_name: string }): string {
  return base(`
    <p>Bonjour <strong>${r.client_first_name}</strong>,</p>
    <p>🎉 Votre réservation est <strong>confirmée</strong> !</p>
    ${detail(r)}
    <h3>Ce qu'il faut apporter</h3>
    <ul>
      <li>Permis côtier ou carte mer (obligatoire)</li>
      <li>Caution de <strong>2 000 €</strong> (chèque ou espèces)</li>
      <li>Maillot de bain, serviette</li>
    </ul>
    <h3>Rendez-vous</h3>
    <p>Jetée Thiers, Port d'Arcachon, 33120<br>
    Présentez-vous <strong>15 minutes avant</strong> votre créneau.</p>
  `)
}

export function emailRappel(r: Partial<Reservation> & { client_first_name: string }): string {
  return base(`
    <p>Bonjour <strong>${r.client_first_name}</strong>,</p>
    <p>Rappel : votre sortie jet ski est <strong>demain</strong> !</p>
    ${detail(r)}
    <p>Rendez-vous Jetée Thiers, Port d'Arcachon. N'oubliez pas votre permis côtier et la caution (2 000 €).</p>
  `)
}

export function emailAnnulation(r: Partial<Reservation> & { client_first_name: string }): string {
  return base(`
    <p>Bonjour <strong>${r.client_first_name}</strong>,</p>
    <p>Votre réservation du <strong>${r.date ? formatDate(r.date) : ''} à ${r.slot_time ? formatTime(r.slot_time) : ''}</strong> a été annulée.</p>
    <p>Si vous souhaitez réserver une autre date, rendez-vous sur notre site ou contactez-nous.</p>
  `)
}

export function emailNouvelleDemandeStaff(r: Partial<Reservation> & { client_name: string; client_email: string }): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return base(`
    <p>Nouvelle demande de réservation reçue depuis le site.</p>
    <p><strong>Client :</strong> ${(r as any).client_name} — ${(r as any).client_email}</p>
    ${detail(r)}
    <a class="cta" href="${appUrl}/reservations/${r.id}">Traiter la réservation</a>
  `)
}
