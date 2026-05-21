import { Resend } from 'resend'

export const resend = new Resend(process.env.RESEND_API_KEY)

export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'noreply@jetski-arcachon.fr'
export const STAFF_EMAIL = process.env.RESEND_STAFF_EMAIL ?? 'contact@jetski-arcachon.fr'
