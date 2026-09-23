import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'
import { fieldStyles } from './Input'

/** Multi-line field with the same hairline, focus ring and invalid state as Input. */
export function Textarea({ className, rows = 3, ...props }: ComponentProps<'textarea'>) {
  return <textarea rows={rows} className={cn(fieldStyles, 'h-auto min-h-20 resize-y py-2', className)} {...props} />
}
