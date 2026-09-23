import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

const tones = {
  primary: { icon: 'text-foreground', bar: 'bg-primary' },
  success: { icon: 'text-success', bar: 'bg-success' },
  warning: { icon: 'text-warning', bar: 'bg-warning' },
  danger: { icon: 'text-danger', bar: 'bg-danger' },
}

interface StatCardProps {
  label: string
  value: number | string
  unit?: string
  detail?: ReactNode
  icon: LucideIcon
  tone?: keyof typeof tones
  /** 0–1: fills the bar along the bottom edge. */
  progress?: number
  /** Tints the card rose, for counts that need action. */
  alert?: boolean
}

/** Dashboard metric: mono caption, large figure, one line of context and a share bar. */
export function StatCard({ label, value, unit, detail, icon: Icon, tone = 'primary', progress, alert = false }: StatCardProps) {
  const share = Math.round(Math.min(1, Math.max(0, progress ?? 0)) * 100)

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border bg-surface p-4 transition-colors',
        alert ? 'border-danger-border bg-danger-subtle/40' : 'border-border hover:border-border-strong',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className={cn('eyebrow', alert && 'text-danger-strong')}>{label}</p>
        <Icon className={cn('size-4', tones[tone].icon)} aria-hidden />
      </div>
      <p className="flex items-baseline gap-1.5">
        <span className={cn('text-headline-xl tabular-nums', alert ? 'text-danger' : 'text-foreground')}>{value}</span>
        {unit && <span className="text-body-md text-muted-foreground">{unit}</span>}
      </p>
      {detail && <p className="min-h-4.5 text-body-sm text-muted-foreground">{detail}</p>}
      {progress !== undefined && (
        <div className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className={cn('h-full rounded-full transition-[width] duration-500', tones[tone].bar)} style={{ width: `${share}%` }} />
        </div>
      )}
    </div>
  )
}
