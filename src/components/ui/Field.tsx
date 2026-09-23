import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Accessibility wiring a Field hands to its control. */
export interface FieldControlProps {
  id: string
  'aria-invalid': true | undefined
  'aria-required': true | undefined
  'aria-describedby': string | undefined
}

interface FieldProps {
  id: string
  label: string
  required?: boolean
  /** Helper text, replaced by `error` when there is one. */
  hint?: ReactNode
  error?: string
  /** Right-aligned extra in the label row, e.g. a character count. */
  aside?: ReactNode
  className?: string
  /** Render prop: spread `control` onto the input so label, error and hint are linked. */
  children: (control: FieldControlProps) => ReactNode
}

/** Label, control and message, wired together for screen readers. */
export function Field({ id, label, required, hint, error, aside, className, children }: FieldProps) {
  const messageId = `${id}-message`
  const message = error ?? hint

  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-label-md text-foreground">
          {label}
          {required && (
            <span className="text-danger" aria-hidden>
              {' '}
              *
            </span>
          )}
        </label>
        {aside}
      </div>
      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-required': required ? true : undefined,
        'aria-describedby': message ? messageId : undefined,
      })}
      {message && (
        <p id={messageId} className={cn('text-body-sm', error ? 'text-danger-strong' : 'text-muted-foreground')}>
          {message}
        </p>
      )}
    </div>
  )
}
