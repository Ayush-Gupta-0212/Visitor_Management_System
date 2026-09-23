import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

const variants = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary-hover hover:ring-1 hover:ring-primary/20',
  outline: 'border border-border bg-surface text-foreground hover:border-border-strong hover:bg-surface-hover',
  destructive:
    'border border-danger-border bg-danger-subtle text-danger-strong hover:border-danger/40 hover:bg-danger/10',
  ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
}

const sizes = {
  sm: 'h-8 gap-1.5 px-3 text-label-md',
  md: 'h-9 gap-2 px-3 text-body-md font-medium',
  'icon-sm': 'size-8',
  icon: 'size-9',
}

export interface ButtonProps extends ComponentProps<'button'> {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
}

/** 32px (`sm`) or 36px (`md`) tall, 12px inline padding, 6px radius; presses in by 1%. */
export function Button({ className, variant = 'primary', size = 'md', type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md whitespace-nowrap transition-all select-none',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-hidden',
        'active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50',
        '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  )
}
