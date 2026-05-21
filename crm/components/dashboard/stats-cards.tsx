import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CalendarCheck, Clock, Euro, AlertTriangle } from 'lucide-react'

interface StatCard {
  label: string
  value: string | number
  sub?: string
  icon: React.ReactNode
  color: string
}

interface StatsCardsProps {
  todayTotal: number
  pending: number
  confirmed: number
  inProgress: number
  revenueToday: number
}

export function StatsCards({ todayTotal, pending, confirmed, inProgress, revenueToday }: StatsCardsProps) {
  const cards: StatCard[] = [
    {
      label: "Réservations aujourd'hui",
      value: todayTotal,
      sub: `${inProgress} en cours`,
      icon: <CalendarCheck className="h-5 w-5" />,
      color: 'text-blue-600',
    },
    {
      label: 'En attente de traitement',
      value: pending,
      sub: pending > 0 ? '⚠ À traiter rapidement' : 'Aucune en attente',
      icon: <Clock className="h-5 w-5" />,
      color: pending > 0 ? 'text-yellow-600' : 'text-slate-500',
    },
    {
      label: 'Confirmées',
      value: confirmed,
      sub: 'Clients attendus',
      icon: <CalendarCheck className="h-5 w-5" />,
      color: 'text-green-600',
    },
    {
      label: "CA du jour",
      value: `${revenueToday.toFixed(0)} €`,
      sub: 'Réservations terminées',
      icon: <Euro className="h-5 w-5" />,
      color: 'text-orange-600',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map(card => (
        <Card key={card.label} className="kpi-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
            <span className={card.color}>{card.icon}</span>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{card.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
