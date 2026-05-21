import { Header } from '@/components/layout/header'
import { ReservationCalendar } from '@/components/calendar/reservation-calendar'

export default function CalendarPage() {
  return (
    <div className="flex flex-col min-h-full">
      <Header title="Calendrier" />
      <main className="flex-1 p-6">
        <ReservationCalendar />
      </main>
    </div>
  )
}
