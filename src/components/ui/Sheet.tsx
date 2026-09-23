import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'
import { Button } from './Button'

export const Sheet = DialogPrimitive.Root
export const SheetTrigger = DialogPrimitive.Trigger
export const SheetClose = DialogPrimitive.Close

// Each side sets the offset that the slide-in / slide-out keyframes travel.
const sides = {
  right: 'inset-y-0 right-0 w-full max-w-md [--slide-x:100%]',
  left: 'inset-y-0 left-0 w-full max-w-md [--slide-x:-100%]',
  bottom: 'inset-x-0 bottom-0 max-h-[85dvh] rounded-t-xl [--slide-y:100%]',
  top: 'inset-x-0 top-0 max-h-[85dvh] rounded-b-xl [--slide-y:-100%]',
}

export interface SheetContentProps extends ComponentProps<typeof DialogPrimitive.Content> {
  /** Edge the panel docks to. The spec swaps the right drawer for a bottom sheet below 1024px. */
  side?: keyof typeof sides
}

/**
 * Edge-docked panel (Radix Dialog) over the frosted scrim. Always include a
 * SheetTitle, plus a SheetDescription (or pass `aria-describedby={undefined}`).
 */
export function SheetContent({ className, children, side = 'right', ...props }: SheetContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-overlay data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
      <DialogPrimitive.Content
        className={cn(
          'fixed z-50 flex flex-col bg-surface text-foreground shadow-overlay outline-hidden',
          'data-[state=closed]:animate-slide-out data-[state=open]:animate-slide-in',
          sides[side],
          className,
        )}
        {...props}
      >
        {children}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <kbd className="hidden h-5 items-center rounded border border-border bg-muted px-1.5 font-mono text-mono-code text-muted-foreground sm:inline-flex">
            Esc
          </kbd>
          <DialogPrimitive.Close asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Close">
              <X />
            </Button>
          </DialogPrimitive.Close>
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export function SheetHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1 border-b border-border px-6 py-4 pr-28', className)} {...props} />
}

export function SheetBody({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('min-h-0 flex-1 overflow-y-auto px-6 py-5', className)} {...props} />
}

export function SheetFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div className={cn('flex flex-col gap-2 border-t border-border bg-background px-6 py-4', className)} {...props} />
  )
}

export function SheetTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn('text-headline-md text-foreground', className)} {...props} />
}

export function SheetDescription({ className, ...props }: ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn('text-body-md text-muted-foreground', className)} {...props} />
}
