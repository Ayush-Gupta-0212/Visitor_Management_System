import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  badge?: ReactNode
  description?: ReactNode
  actions?: ReactNode
}

/** Page title row: headline with an optional status badge, subtitle, and actions on the right. */
export function PageHeader({ title, badge, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-headline-lg md:text-headline-xl">{title}</h1>
          {badge}
        </div>
        {description && <p className="mt-1 max-w-2xl text-body-lg text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
