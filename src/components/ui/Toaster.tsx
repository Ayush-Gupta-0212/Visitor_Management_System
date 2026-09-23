import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { type ToastItem, type ToastVariant, useToastStore } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Button } from './Button'

const ICONS = { success: CircleCheck, error: CircleAlert, warning: TriangleAlert, info: Info }
const ICON_TONES: Record<ToastVariant, string> = {
  success: 'text-success',
  error: 'text-danger',
  warning: 'text-warning',
  info: 'text-muted-foreground',
}
/** Matches the fade-out animation, after which the toast is removed. */
const EXIT_MS = 150

/** Renders queued toasts in the bottom-right corner. Mount once at the app root. */
export function Toaster() {
  const toasts = useToastStore((state) => state.toasts)

  return (
    <section
      aria-label="Notifications"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-60 flex flex-col gap-2 sm:left-auto sm:w-96"
    >
      {toasts.map((item) => (
        <ToastCard key={item.id} item={item} />
      ))}
    </section>
  )
}

function ToastCard({ item }: { item: ToastItem }) {
  const dismiss = useToastStore((state) => state.dismiss)
  const [leaving, setLeaving] = useState(false)
  const [paused, setPaused] = useState(false)
  const Icon = ICONS[item.variant]

  // Auto-dismiss, paused while the pointer is over the toast.
  useEffect(() => {
    if (paused || leaving) return
    const timer = window.setTimeout(() => setLeaving(true), item.durationMs)
    return () => window.clearTimeout(timer)
  }, [paused, leaving, item.durationMs])

  useEffect(() => {
    if (!leaving) return
    const timer = window.setTimeout(() => dismiss(item.id), EXIT_MS)
    return () => window.clearTimeout(timer)
  }, [leaving, dismiss, item.id])

  return (
    <div
      role={item.variant === 'error' ? 'alert' : undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className={cn(
        'pointer-events-auto flex items-start gap-3 rounded-lg bg-surface py-3 pr-2 pl-3 shadow-overlay',
        leaving ? 'animate-fade-out' : 'animate-rise-in',
      )}
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', ICON_TONES[item.variant])} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-body-md font-medium text-foreground">{item.title}</p>
        {item.description && <p className="mt-0.5 text-body-sm text-muted-foreground">{item.description}</p>}
        {item.action && (
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={() => {
              item.action?.onClick()
              setLeaving(true)
            }}
          >
            {item.action.label}
          </Button>
        )}
      </div>
      <Button variant="ghost" size="icon-sm" aria-label="Dismiss notification" onClick={() => setLeaving(true)}>
        <X />
      </Button>
    </div>
  )
}
