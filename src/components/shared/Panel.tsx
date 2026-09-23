import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PanelProps {
  title: string
  description?: ReactNode
  actions?: ReactNode
  className?: string
  bodyClassName?: string
  children: ReactNode
}

/** White card with a hairline border and a mono caption header, the Stitch container for dashboard sections. */
export function Panel({ title, description, actions, className, bodyClassName, children }: PanelProps) {
  return (
    <section className={cn('flex flex-col overflow-hidden rounded-lg border border-border bg-surface', className)}>
      <header className="flex min-h-12 items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div className="min-w-0">
          <h2 className="eyebrow">{title}</h2>
          {description && <p className="mt-0.5 text-body-sm text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </header>
      <div className={cn('flex-1', bodyClassName)}>{children}</div>
    </section>
  )
}
