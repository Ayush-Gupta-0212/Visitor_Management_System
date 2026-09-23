import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useCountUp } from '@/hooks/useCountUp'
import { cn } from '@/lib/utils'

const tones = {
  primary: { icon: 'text-foreground bg-muted', bar: 'bg-primary' },
  success: { icon: 'text-success bg-success-subtle', bar: 'bg-success' },
  warning: { icon: 'text-warning bg-warning-subtle', bar: 'bg-warning' },
  danger: { icon: 'text-danger bg-danger-subtle', bar: 'bg-danger' },
}

interface StatCardProps {
  label: string
  value: number
  unit?: string
  detail?: ReactNode
  icon: LucideIcon
  tone?: keyof typeof tones
  /** 0–1: fills the bar along the bottom edge. */
  progress?: number
  /** Tints the card rose, for counts that need action. */
  alert?: boolean
  /** Position in its row: cards rise in one after another. */
  index?: number
}

/** Dashboard metric: mono caption, a figure that counts up, one line of context and a share bar. */
export function StatCard({ label, value, unit, detail, icon: Icon, tone = 'primary', progress, alert = false, index = 0 }: StatCardProps) {
  const shown = useCountUp(value)
  const share = Math.round(Math.min(1, Math.max(0, progress ?? 0)) * 100)

  return (
    <div
      style={{ animationDelay: `${index * 70}ms` }}
      className={cn(
        'group flex animate-rise-in flex-col gap-3 rounded-lg border bg-surface p-4 transition-[border-color,box-shadow,translate] duration-200 hover:-translate-y-0.5 hover:shadow-raised',
        alert ? 'border-danger-border bg-danger-subtle/40' : 'border-border hover:border-border-strong',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className={cn('eyebrow', alert && 'text-danger-strong')}>{label}</p>
        <span className={cn('flex size-7 items-center justify-center rounded-md transition-transform duration-300 group-hover:scale-110', tones[tone].icon)}>
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p className="flex items-baseline gap-1.5">
        <span className={cn('text-headline-xl tabular-nums', alert ? 'text-danger' : 'text-foreground')}>
          <span aria-hidden>{shown}</span>
          <span className="sr-only">{value}</span>
        </span>
        {unit && <span className="text-body-md text-muted-foreground">{unit}</span>}
      </p>
      {detail && <p className="min-h-4.5 text-body-sm text-muted-foreground">{detail}</p>}
      {progress !== undefined && (
        <div className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div
            className={cn('h-full origin-left animate-grow-x rounded-full transition-[width] duration-700', tones[tone].bar)}
            style={{ width: `${share}%`, animationDelay: `${index * 70 + 150}ms` }}
          />
        </div>
      )}
    </div>
  )
}
