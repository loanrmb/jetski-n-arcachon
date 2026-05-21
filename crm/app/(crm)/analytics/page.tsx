import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { AnalyticsDashboard } from './analytics-client'
import type { Reservation, JetSki } from '@/types'

export const revalidate = 0

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string }
}) {
  const supabase = createClient()

  const today    = new Date().toISOString().split('T')[0]
  const from     = searchParams.from ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  const to       = searchParams.to   ?? today

  const { data } = await supabase
    .from('reservations')
    .select('*, jet_ski:jet_skis(*)')
    .gte('date', from)
    .lte('date', to)
    .not('status', 'in', '(cancelled,no_show)')
    .order('date')

  const { data: jetSkisData } = await supabase.from('jet_skis').select('*')

  const reservations = (data ?? []) as (Reservation & { jet_ski: JetSki })[]
  const jetSkis      = (jetSkisData ?? []) as JetSki[]

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Analytiques" />
      <main className="flex-1 p-6">
        <AnalyticsDashboard reservations={reservations} jetSkis={jetSkis} from={from} to={to} />
      </main>
    </div>
  )
}
