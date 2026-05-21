import { Resend } from 'resend'

// Lazy singleton — instantiated on first use at runtime, not at build time.
// This prevents "Missing API key" errors during `next build` when env vars
// are not available in the build environment.
let _resend: Resend | null = null

export function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY
    if (!key) throw new Error('RESEND_API_KEY is not set')
    _resend = new Resend(key)
  }
  return _resend
}

export const FROM_EMAIL  = process.env.RESEND_FROM_EMAIL  ?? 'noreply@jetski-arcachon.fr'
export const STAFF_EMAIL = process.env.RESEND_STAFF_EMAIL ?? 'contact@jetski-arcachon.fr'
