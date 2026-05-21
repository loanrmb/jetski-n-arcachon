export type JetSkiStatus = 'active' | 'maintenance' | 'out_of_service'
export type ReservationStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
export type ReservationSource = 'online' | 'phone' | 'on_site'
export type LicenseVerified = 'yes' | 'no' | 'not_verified'
export type DurationHours = 1 | 2 | 4

export interface JetSki {
  id: string
  name: string
  model: string
  power_hp: number
  max_speed_kmh: number
  capacity: number
  price_1h: number
  price_2h: number
  price_4h: number
  status: JetSkiStatus
  image_url?: string
  color: string
  created_at: string
  updated_at: string
}

export interface Client {
  id: string
  first_name: string
  last_name: string
  email: string
  phone?: string
  internal_note?: string
  created_at: string
  updated_at: string
}

export interface Reservation {
  id: string
  jet_ski_id: string
  client_id: string
  date: string
  slot_time: string
  duration_hours: DurationHours
  status: ReservationStatus
  source: ReservationSource
  nb_persons: number
  license_verified: LicenseVerified
  client_message?: string
  internal_note?: string
  fuel_note?: string
  caution_collected: boolean
  price_total?: number
  created_at: string
  updated_at: string
  jet_ski?: JetSki
  client?: Client
}

export interface Availability {
  id: string
  jet_ski_id: string
  date: string
  slot_time: string
  is_blocked: boolean
  blocked_reason?: string
  reservation_id?: string
  created_at: string
  updated_at: string
}

export interface ReservationLog {
  id: string
  reservation_id: string
  changed_by: string
  changed_by_email: string
  old_status?: string
  new_status?: string
  note?: string
  created_at: string
}

export interface MaintenanceLog {
  id: string
  jet_ski_id: string
  date: string
  description: string
  performed_by?: string
  cost?: number
  created_at: string
}

export const STATUS_LABELS: Record<ReservationStatus, string> = {
  pending:     'En attente',
  confirmed:   'Confirmée',
  in_progress: 'En cours',
  completed:   'Terminée',
  cancelled:   'Annulée',
  no_show:     'No-show',
}

export const SOURCE_LABELS: Record<ReservationSource, string> = {
  online:  'En ligne',
  phone:   'Téléphone',
  on_site: 'Sur place',
}

export const JETSKI_STATUS_LABELS: Record<JetSkiStatus, string> = {
  active:          'Actif',
  maintenance:     'En maintenance',
  out_of_service:  'Hors service',
}

export const LICENSE_LABELS: Record<LicenseVerified, string> = {
  yes:          'Oui',
  no:           'Non',
  not_verified: 'Non vérifié',
}

export const SLOT_TIMES = ['09:00', '11:00', '14:00', '16:00'] as const

export const DURATION_LABELS: Record<number, string> = {
  1: '1 heure',
  2: '2 heures',
  4: 'Demi-journée (4h)',
}
