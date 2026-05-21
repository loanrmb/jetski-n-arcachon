import { cn, statusColor } from '@/lib/utils'
import { STATUS_LABELS, type ReservationStatus } from '@/types'

interface StatusBadgeProps {
  status: ReservationStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold', statusColor(status), className)}>
      {STATUS_LABELS[status]}
    </span>
  )
}
