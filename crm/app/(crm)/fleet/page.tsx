import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { FleetClient } from '@/components/fleet/fleet-client'
import type { JetSki } from '@/types'

export const revalidate = 0

export default async function FleetPage() {
  const supabase = createClient()
  const { data } = await supabase.from('jet_skis').select('*').order('name')
  const jetSkis  = (data ?? []) as JetSki[]

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Flotte" />
      <main className="flex-1 p-6">
        {/*
          FleetClient owns all create/edit/delete state.
          The server page only does the initial fetch — no function props cross the boundary.
        */}
        <FleetClient initialJetSkis={jetSkis} />
      </main>
    </div>
  )
}
