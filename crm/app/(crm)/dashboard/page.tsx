import Link from 'next/link'
import { Plus, BanIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { StatsCards } from '@/components/dashboard/stats-cards'
import { Alerts } from '@/components/dashboard/alerts'
import { WeatherWidget } from '@/components/dashboard/weather-widget'
import { StatusBadge } from '@/components/reservations/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatTime } from '@/lib/utils'
import type { Reservation, JetSki } from '@/types'
import { subHours } from 'date-fns'

export const revalidate = 0

export default async function DashboardPage() {
  const supabase = createClient()
  const today      = new Date().toISOString().split('T')[0]
  const twoHoursAgo = subHours(new Date(), 2).toISOString()

  // Réservations du jour avec jointures
  const { data: todayReservations } = await supabase
    .from('reservations')
    .select('*, jet_ski:jet_skis(*), client:clients(*)')
    .eq('date', today)
    .order('slot_time')

  const reservations = (todayReservations ?? []) as (Reservation & { jet_ski: JetSki })[]

  const pending    = reservations.filter(r => r.status === 'pending').length
  const confirmed  = reservations.filter(r => r.status === 'confirmed').length
  const inProgress = reservations.filter(r => r.status === 'in_progress').length
  const revenue    = reservations
    .filter(r => r.status === 'completed')
    .reduce((sum, r) => sum + (r.price_total ?? 0), 0)

  // Alertes : en attente depuis +2h
  const { data: staleData } = await supabase
    .from('reservations')
    .select('*, jet_ski:jet_skis(*), client:clients(*)')
    .eq('status', 'pending')
    .lt('created_at', twoHoursAgo)
  const stalePending = (staleData ?? []) as Reservation[]

  // Statut de la flotte (including booking_enabled)
  const { data: jetSkis } = await supabase.from('jet_skis').select('*').eq('status', 'active')
  const activeJetSkis = (jetSkis ?? []) as JetSki[]
  const occupiedIds   = new Set(
    reservations.filter(r => r.status === 'in_progress').map(r => r.jet_ski_id)
  )

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Tableau de bord" />

      <main className="flex-1 p-6 space-y-6">
        <StatsCards
          todayTotal={reservations.length}
          pending={pending}
          confirmed={confirmed}
          inProgress={inProgress}
          revenueToday={revenue}
        />

        {stalePending.length > 0 && <Alerts stalePending={stalePending} />}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Planning du jour */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Planning du jour</CardTitle>
                <Button asChild size="sm" variant="accent">
                  <Link href="/reservations/new"><Plus className="h-3 w-3 mr-1" />Nouvelle</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {reservations.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Aucune réservation aujourd&apos;hui.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {reservations.map(r => (
                      <Link
                        key={r.id}
                        href={`/reservations/${r.id}`}
                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-slate-50 hover:shadow-sm transition-all duration-150"
                      >
                        <div
                          className="w-1 self-stretch rounded-full shrink-0"
                          style={{ backgroundColor: r.jet_ski?.color ?? '#94a3b8' }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {r.client?.first_name} {r.client?.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatTime(r.slot_time)} · {r.duration_hours}h · {r.jet_ski?.name}
                          </p>
                        </div>
                        <StatusBadge status={r.status} />
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right column: Flotte + Météo */}
          <div className="space-y-4">
            {/* Statut de la flotte */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Flotte</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {activeJetSkis.map(js => {
                  const occupied = occupiedIds.has(js.id)
                  const blocked  = !js.booking_enabled
                  return (
                    <div key={js.id} className="flex items-center gap-3">
                      <div
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: js.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{js.name}</p>
                        <p className="text-xs text-muted-foreground">{js.model}</p>
                      </div>
                      {blocked ? (
                        <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                          <BanIcon className="h-3 w-3" />
                          Bloqué
                        </span>
                      ) : (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          occupied
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {occupied ? 'En mer' : 'Disponible'}
                        </span>
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            {/* Météo */}
            <WeatherWidget />
          </div>
        </div>
      </main>
    </div>
  )
}
