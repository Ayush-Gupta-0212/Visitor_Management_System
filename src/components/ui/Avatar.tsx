import * as AvatarPrimitive from '@radix-ui/react-avatar'
import { initials } from '@/lib/format'
import { cn } from '@/lib/utils'

const sizes = {
  xs: 'size-5 text-[9px]',
  sm: 'size-7 text-[10px]',
  md: 'size-9 text-mono-code',
  lg: 'size-12 text-body-md',
}

interface AvatarProps {
  name: string
  src?: string | null
  size?: keyof typeof sizes
  className?: string
}

/** Photo or avatar, falling back to initials while it loads or when there is none. Decorative: pair it with the name. */
export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted font-mono font-medium text-muted-foreground select-none',
        sizes[size],
        className,
      )}
    >
      {src && <AvatarPrimitive.Image src={src} alt="" className="size-full object-cover" />}
      <AvatarPrimitive.Fallback delayMs={src ? 400 : 0}>{initials(name)}</AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  )
}
