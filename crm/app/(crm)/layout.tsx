import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { PageWrapper } from '@/components/providers/page-wrapper'

export default async function CRMLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="flex min-h-screen">
      {/* Sidebar — masqué sur mobile, géré par Sheet dans le Header */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Contenu principal */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
        <PageWrapper>{children}</PageWrapper>
      </div>
    </div>
  )
}
