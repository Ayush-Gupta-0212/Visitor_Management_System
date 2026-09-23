import { useUser } from '@/store/useAuthStore'
import { NotificationBell } from './NotificationBell'
import { ProfileMenu } from './ProfileMenu'
import { ResetDatabaseButton } from './ResetDatabaseButton'
import { ThemeToggle } from './ThemeToggle'
import { ROLE_ICONS, WORKSPACE_LABELS } from './roles'

/** Sticky top bar: branding, the signed-in workspace and site, database reset, theme, requests and the profile menu. */
export function Navbar() {
  const user = useUser()
  const RoleIcon = ROLE_ICONS[user.role]

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 md:px-margin-desktop">
        <div className="flex min-w-0 items-center gap-2.5">
          <img src="/favicon.svg" alt="" className="size-8 shrink-0 rounded-[10px] dark:ring-1 dark:ring-border-strong" />
          <span className="text-headline-md whitespace-nowrap">PassKey VMS</span>
          <span className="hidden items-center gap-1.5 rounded border border-border px-2 py-0.5 text-label-md text-foreground sm:inline-flex">
            <RoleIcon className="size-3.5 text-muted-foreground" aria-hidden />
            {WORKSPACE_LABELS[user.role]}
          </span>
          <span className="hidden items-center gap-1.5 rounded bg-muted px-2 py-0.5 text-label-md text-muted-foreground xl:inline-flex">
            <span className="relative flex size-1.5" aria-hidden>
              <span className="absolute inset-0 animate-ping rounded-full bg-success-dot opacity-75" />
              <span className="relative size-1.5 rounded-full bg-success-dot" />
            </span>
            {user.office} · Main Lobby
          </span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <ResetDatabaseButton />
          <ThemeToggle />
          <NotificationBell />
          <ProfileMenu />
        </div>
      </div>
    </header>
  )
}
