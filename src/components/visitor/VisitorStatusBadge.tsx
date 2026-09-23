import { Badge, type BadgeVariant } from '@/components/ui/Badge'
import { formatDuration, minutesBetween } from '@/lib/format'
import { STATUS_LABELS } from '@/lib/visitorRules'
import type { VisitorRecord, VisitorStatus } from '@/types/vms'

const STATUS_VARIANTS: Record<VisitorStatus, BadgeVariant> = {
  PENDING_APPROVAL: 'warning',
  PRE_APPROVED: 'warning',
  CHECKED_IN: 'success',
  OVERSTAY: 'danger',
  CHECKED_OUT: 'neutral',
  REJECTED: 'danger',
  EXPIRED: 'neutral',
}

interface VisitorStatusBadgeProps {
  visitor: VisitorRecord
  now: Date
  className?: string
}

/** Status pill; overstays pulse and show how long past the window the visitor has stayed. */
export function VisitorStatusBadge({ visitor, now, className }: VisitorStatusBadgeProps) {
  const overdueMinutes = visitor.status === 'OVERSTAY' ? minutesBetween(visitor.timeWindowEnd, now) : 0

  return (
    <Badge variant={STATUS_VARIANTS[visitor.status]} pulse={visitor.status === 'OVERSTAY'} className={className}>
      {STATUS_LABELS[visitor.status]}
      {overdueMinutes > 0 && <span className="font-mono tabular-nums">+{formatDuration(overdueMinutes)}</span>}
    </Badge>
  )
}
