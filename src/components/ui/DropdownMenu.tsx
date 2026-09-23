import * as MenuPrimitive from '@radix-ui/react-dropdown-menu'
import { Check } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export const DropdownMenu = MenuPrimitive.Root
export const DropdownMenuTrigger = MenuPrimitive.Trigger
export const DropdownMenuRadioGroup = MenuPrimitive.RadioGroup

const itemStyles =
  'relative flex h-8 cursor-default items-center gap-2 rounded px-2 text-body-md outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-muted [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground'

export function DropdownMenuContent({ className, sideOffset = 6, ...props }: ComponentProps<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-48 origin-(--radix-dropdown-menu-content-transform-origin) rounded-lg bg-surface p-1 text-foreground shadow-overlay outline-hidden',
          'data-[state=closed]:animate-pop-out data-[state=open]:animate-pop-in',
          className,
        )}
        {...props}
      />
    </MenuPrimitive.Portal>
  )
}

export function DropdownMenuItem({ className, ...props }: ComponentProps<typeof MenuPrimitive.Item>) {
  return <MenuPrimitive.Item className={cn(itemStyles, className)} {...props} />
}

export function DropdownMenuRadioItem({ className, children, ...props }: ComponentProps<typeof MenuPrimitive.RadioItem>) {
  return (
    <MenuPrimitive.RadioItem className={cn(itemStyles, 'pr-8', className)} {...props}>
      {children}
      <MenuPrimitive.ItemIndicator className="absolute right-2 flex items-center">
        <Check />
      </MenuPrimitive.ItemIndicator>
    </MenuPrimitive.RadioItem>
  )
}

export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof MenuPrimitive.Label>) {
  return <MenuPrimitive.Label className={cn('px-2 py-1.5', className)} {...props} />
}

export function DropdownMenuSeparator({ className, ...props }: ComponentProps<typeof MenuPrimitive.Separator>) {
  return <MenuPrimitive.Separator className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />
}
