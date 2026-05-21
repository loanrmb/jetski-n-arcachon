'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { STATUS_LABELS, SOURCE_LABELS, type Reservation, type JetSki, type ReservationStatus, type ReservationSource } from '@/types'
import { format, eachDayOfInterval, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

interface Props {
  reservations: (Reservation & { jet_ski: JetSki })[]
  jetSkis: JetSki[]
  from: string
  to: string
}

export function AnalyticsDashboard({ reservations, jetSkis, from, to }: Props) {
  const [fromDate, setFromDate] = useState(from)
  const [toDate, setToDate]     = useState(to)
  const router   = useRouter()
  const pathname = usePathname()

  function applyFilter() {
    router.push(`${pathname}?from=${fromDate}&to=${toDate}`)
  }

  // CA total
  const totalRevenue = reservations.reduce((s, r) => s + (r.price_total ?? 0), 0)

  // Réservations par statut
  const byStatus = Object.entries(STATUS_LABELS).map(([k, label]) => ({
    name: label,
    value: reservations.filter(r => r.status === k).length,
  })).filter(d => d.value > 0)

  // Par source
  const bySource = Object.entries(SOURCE_LABELS).map(([k, label]) => ({
    name: label,
    value: reservations.filter(r => r.source === k).length,
  })).filter(d => d.value > 0)

  // Par jet ski
  const byJetSki = jetSkis.map(js => ({
    name: js.name,
    color: js.color,
    count: reservations.filter(r => r.jet_ski_id === js.id).length,
    revenue: reservations.filter(r => r.jet_ski_id === js.id).reduce((s, r) => s + (r.price_total ?? 0), 0),
  }))

  // CA par jour
  const days = eachDayOfInterval({ start: parseISO(from), end: parseISO(to) })
  const dailyRevenue = days.map(d => {
    const dateStr = format(d, 'yyyy-MM-dd')
    const dayRevenue = reservations
      .filter(r => r.date === dateStr)
      .reduce((s, r) => s + (r.price_total ?? 0), 0)
    return { date: format(d, 'dd/MM', { locale: fr }), CA: dayRevenue }
  })

  const COLORS = ['#3B82F6', '#10B981', '#EF4444', '#F97316', '#8B5CF6', '#06B6D4']

  return (
    <div className="space-y-6">
      {/* Sélecteur de période */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <Label>Du</Label>
              <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1">
              <Label>Au</Label>
              <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-40" />
            </div>
            <div className="flex gap-2">
              {[
                { label: "Aujourd'hui", days: 0 },
                { label: '7 jours',  days: 7 },
                { label: '30 jours', days: 30 },
              ].map(({ label, days }) => (
                <Button key={label} variant="outline" size="sm" onClick={() => {
                  const end   = new Date()
                  const start = new Date()
                  start.setDate(start.getDate() - days)
                  setFromDate(start.toISOString().split('T')[0])
                  setToDate(end.toISOString().split('T')[0])
                }}>
                  {label}
                </Button>
              ))}
            </div>
            <Button variant="accent" size="sm" onClick={applyFilter}>Appliquer</Button>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'CA total',       value: `${totalRevenue.toFixed(0)} €` },
          { label: 'Réservations',   value: reservations.length },
          { label: 'Durée moyenne',  value: reservations.length > 0 ? `${(reservations.reduce((s, r) => s + r.duration_hours, 0) / reservations.length).toFixed(1)}h` : '—' },
          { label: 'CA / résa',      value: reservations.length > 0 ? `${(totalRevenue / reservations.length).toFixed(0)} €` : '—' },
        ].map(({ label, value }) => (
          <Card key={label} className="kpi-card">
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold mt-1">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CA par jour */}
        <Card>
          <CardHeader><CardTitle className="text-base">CA quotidien (€)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dailyRevenue}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [`${v} €`, 'CA']} />
                <Bar dataKey="CA" fill="#F97316" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Réservations par jet ski */}
        <Card>
          <CardHeader><CardTitle className="text-base">Réservations par modèle</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byJetSki} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
                <Tooltip />
                <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                  {byJetSki.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Sources */}
        <Card>
          <CardHeader><CardTitle className="text-base">Répartition des sources</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={bySource} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {bySource.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Statuts */}
        <Card>
          <CardHeader><CardTitle className="text-base">Statuts des réservations</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={byStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name} (${value})`}>
                  {byStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
