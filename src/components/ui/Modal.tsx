import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'
import { Button } from './Button'

export const Modal = DialogPrimitive.Root
export const ModalTrigger = DialogPrimitive.Trigger
export const ModalClose = DialogPrimitive.Close

const sizes = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export interface ModalContentProps extends ComponentProps<typeof DialogPrimitive.Content> {
  size?: keyof typeof sizes
  /** Render the top-right close button. */
  showCloseButton?: boolean
}

/**
 * Centred dialog over the frosted scrim. Always include a ModalTitle, plus a
 * ModalDescription (or pass `aria-describedby={undefined}`); Radix warns otherwise.
 */
export function ModalContent({
  className,
  children,
  size = 'md',
  showCloseButton = true,
  ...props
}: ModalContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-overlay data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
      <DialogPrimitive.Content
        className={cn(
          'fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-surface text-foreground shadow-overlay outline-hidden',
          'data-[state=closed]:animate-pop-out data-[state=open]:animate-pop-in',
          sizes[size],
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Close" className="absolute top-5 right-5">
              <X />
            </Button>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export function ModalHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1 px-6 pt-6 pr-14 pb-4', className)} {...props} />
}

/** Scrolls when content outgrows the viewport; header and footer stay pinned. */
export function ModalBody({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('min-h-0 flex-1 overflow-y-auto px-6 pb-6', className)} {...props} />
}

export function ModalFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex items-center justify-end gap-2 border-t border-border bg-background px-6 py-4', className)}
      {...props}
    />
  )
}

export function ModalTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn('text-headline-md text-foreground', className)} {...props} />
}

export function ModalDescription({ className, ...props }: ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn('text-body-md text-muted-foreground', className)} {...props} />
}
