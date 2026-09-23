import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

const tones = {
  neutral: 'border-neutral-border bg-neutral-subtle text-neutral-strong',
  success: 'border-success-border bg-success-subtle text-success',
}

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: ReactNode
  action?: ReactNode
  tone?: keyof typeof tones
  className?: string
}

/** Explains why a list is empty and, where it helps, what to do next. */
export function EmptyState({ icon: Icon, title, description, action, tone = 'neutral', className }: EmptyStateProps) {
  return (
    <div className={cn('flex animate-fade-in flex-col items-center gap-2 px-6 py-10 text-center', className)}>
      <span className={cn('mb-1 flex size-10 items-center justify-center rounded-full border', tones[tone])}>
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="text-body-lg font-medium text-foreground">{title}</p>
      {description && <p className="max-w-sm text-body-md text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
