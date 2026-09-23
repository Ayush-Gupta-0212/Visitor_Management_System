import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

const variants = {
  neutral: { pill: 'border-neutral-border bg-neutral-subtle text-neutral-strong', dot: 'bg-neutral-dot' },
  success: { pill: 'border-success-border bg-success-subtle text-success-strong', dot: 'bg-success-dot' },
  warning: { pill: 'border-warning-border bg-warning-subtle text-warning-strong', dot: 'bg-warning-dot' },
  danger: { pill: 'border-danger-border bg-danger-subtle text-danger-strong', dot: 'bg-danger-dot' },
}

export type BadgeVariant = keyof typeof variants

export interface BadgeProps extends ComponentProps<'span'> {
  variant?: BadgeVariant
  /** `pill` for statuses; `tag` (4px corners) for categories and labels. */
  shape?: 'pill' | 'tag'
  /** Leading 5px indicator dot; on by default for pills. */
  dot?: boolean
  /** Pulse the dot for live alerts such as overstays. */
  pulse?: boolean
}

/**
 * Status pill: 22px tall, fully rounded, 11px medium text.
 * Checked-in → success, Expected → warning, Overstay → danger + pulse, Checked-out → neutral.
 */
export function Badge({
  className,
  variant = 'neutral',
  shape = 'pill',
  dot = shape === 'pill',
  pulse = false,
  children,
  ...props
}: BadgeProps) {
  const styles = variants[variant]

  return (
    <span
      className={cn(
        'inline-flex h-5.5 shrink-0 items-center gap-1.5 border px-2 text-label-sm whitespace-nowrap',
        shape === 'pill' ? 'rounded-full' : 'rounded',
        styles.pill,
        className,
      )}
      {...props}
    >
      {dot && (
        <span aria-hidden className="relative flex size-1.25">
          {pulse && <span className={cn('absolute inset-0 animate-ping rounded-full opacity-75', styles.dot)} />}
          <span className={cn('relative size-1.25 rounded-full', styles.dot)} />
        </span>
      )}
      {children}
    </span>
  )
}
