import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/**
 * Shared styling for single-line form controls (Input, SelectTrigger): 36px, white,
 * zinc-200 hairline, 6px radius, 13px text, and a crisp 1px slate-900 focus ring.
 */
export const fieldStyles =
  'flex h-9 w-full min-w-0 rounded-md border border-border bg-surface px-3 text-body-md text-foreground transition-[border-color,box-shadow] placeholder:text-placeholder hover:border-border-strong focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 aria-invalid:border-danger aria-invalid:focus-visible:ring-danger'

export function Input({ className, type = 'text', ...props }: ComponentProps<'input'>) {
  return <input type={type} className={cn(fieldStyles, className)} {...props} />
}
