import { ChevronDown, LogOut, Monitor, Moon, Sun, TabletSmartphone } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { ROLE_LABELS } from '@/lib/rbac'
import { KIOSK_HREF } from '@/lib/router'
import { toast } from '@/lib/toast'
import { signOut } from '@/store/session'
import { useUser } from '@/store/useAuthStore'
import { type ThemePreference, changeTheme, useThemeStore } from '@/store/useThemeStore'
import { ROLE_ICONS } from './roles'

const THEMES = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const

/** The signed-in person: who they are, their theme, the visitor kiosk and sign-out. */
export function ProfileMenu() {
  const user = useUser()
  const preference = useThemeStore((state) => state.preference)
  const RoleIcon = ROLE_ICONS[user.role]

  const leave = () => {
    const firstName = user.name.split(' ')[0]
    signOut()
    toast.info(`Signed out. See you soon, ${firstName}.`)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Signed in as ${user.name}, ${ROLE_LABELS[user.role]}`}
          className="flex items-center gap-2 rounded-md p-1 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden lg:pr-2"
        >
          <Avatar name={user.name} src={user.avatar} size="sm" />
          <span className="hidden text-left lg:block">
            <span className="block text-label-md text-foreground">{user.name}</span>
            <span className="block text-body-sm text-muted-foreground">{ROLE_LABELS[user.role]}</span>
          </span>
          <ChevronDown className="hidden size-3.5 text-muted-foreground lg:block" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="flex items-center gap-3 py-2">
          <Avatar name={user.name} src={user.avatar} size="md" />
          <span className="min-w-0">
            <span className="block truncate text-body-md font-medium text-foreground">{user.name}</span>
            <span className="block truncate text-body-sm text-muted-foreground">{user.email}</span>
          </span>
        </DropdownMenuLabel>
        <div className="mx-2 mb-2 flex flex-wrap items-center gap-1.5 text-body-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-label-sm text-foreground">
            <RoleIcon className="size-3" aria-hidden /> {ROLE_LABELS[user.role]}
          </span>
          <span className="truncate">
            {user.department} · {user.office}
          </span>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="eyebrow py-1">Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={preference} onValueChange={(value) => changeTheme(value as ThemePreference)}>
          {THEMES.map(({ value, label, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon /> {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href={KIOSK_HREF} target="_blank" rel="noreferrer">
            <TabletSmartphone /> Open visitor kiosk
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={leave} className="text-danger-strong data-highlighted:bg-danger-subtle [&_svg]:text-danger-strong">
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
