import { type KeyboardEvent, type ReactNode, useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
  /** Shown after the label, e.g. the number of matching rows. */
  count?: number
}

interface SegmentedControlProps<T extends string> {
  value: T
  onValueChange: (value: T) => void
  options: readonly SegmentedOption<T>[]
  /** Accessible name for the group. */
  label: string
  className?: string
}

const NAVIGATION_KEYS = new Set(['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'])

/**
 * Stitch segmented view control: a radio group whose selected option sits on a
 * white pill that slides between options. Arrow keys, Home and End move the selection.
 */
export function SegmentedControl<T extends string>({ value, onValueChange, options, label, className }: SegmentedControlProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pill, setPill] = useState<{ x: number; width: number } | null>(null)

  useLayoutEffect(() => {
    const container = containerRef.current
    const active = container?.querySelector<HTMLElement>('[aria-checked="true"]')
    if (!container || !active) return
    const measure = () => setPill({ x: active.offsetLeft, width: active.offsetWidth })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    observer.observe(active)
    return () => observer.disconnect()
  }, [value])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!NAVIGATION_KEYS.has(event.key)) return
    event.preventDefault()
    const current = options.findIndex((option) => option.value === value)
    const last = options.length - 1
    const next =
      event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : event.key === 'ArrowRight' || event.key === 'ArrowDown' ? (current === last ? 0 : current + 1)
      : current === 0 ? last
      : current - 1
    onValueChange(options[next].value)
    containerRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus()
  }

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn('relative inline-flex items-center rounded-md border border-neutral-border bg-muted p-0.5', className)}
    >
      {pill && (
        <span
          aria-hidden
          className="absolute top-0.5 bottom-0.5 left-0 rounded bg-surface shadow-hairline transition-[transform,width] duration-200"
          style={{ transform: `translateX(${pill.x}px)`, width: pill.width }}
        />
      )}
      {options.map((option) => {
        const checked = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onValueChange(option.value)}
            className={cn(
              'relative inline-flex h-7 flex-1 items-center justify-center gap-1.5 rounded px-2.5 text-label-md whitespace-nowrap transition-colors',
              'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden [&_svg]:size-3.5 [&_svg]:shrink-0',
              checked ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span className={cn('font-mono text-mono-code tabular-nums', checked ? 'text-muted-foreground' : 'text-placeholder')}>
                {option.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
