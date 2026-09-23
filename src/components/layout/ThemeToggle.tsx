import { Moon, Sun } from 'lucide-react'
import type { MouseEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { changeTheme, useResolvedTheme } from '@/store/useThemeStore'

/** Sun/moon button that flips between light and dark, revealing the new theme in a circle from the button. */
export function ThemeToggle({ className }: { className?: string }) {
  const dark = useResolvedTheme() === 'dark'

  const toggle = (event: MouseEvent<HTMLButtonElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    changeTheme(dark ? 'light' : 'dark', { x: box.left + box.width / 2, y: box.top + box.height / 2 })
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={dark ? 'Light theme' : 'Dark theme'}
      className={cn('relative overflow-hidden', className)}
    >
      <Sun className={cn('absolute transition-all duration-500', dark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0')} />
      <Moon className={cn('absolute transition-all duration-500', dark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100')} />
    </Button>
  )
}
