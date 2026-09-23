import { NotificationBell } from './NotificationBell'
import { ProfileMenu } from './ProfileMenu'
import { ResetDatabaseButton } from './ResetDatabaseButton'
import { RoleSwitcher } from './RoleSwitcher'

/** Sticky top bar: branding, role switcher, database reset, request bell and the active user. */
export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 md:px-margin-desktop">
        <div className="flex shrink-0 items-center gap-2.5">
          <img src="/favicon.svg" alt="" className="size-8" />
          <span className="text-headline-md">PassKey VMS</span>
          <span className="hidden items-center gap-1.5 rounded bg-muted px-2 py-0.5 text-label-md text-muted-foreground xl:inline-flex">
            <span className="relative flex size-1.5" aria-hidden>
              <span className="absolute inset-0 animate-ping rounded-full bg-success-dot opacity-75" />
              <span className="relative size-1.5 rounded-full bg-success-dot" />
            </span>
            Mumbai Goregaon · Main Lobby
          </span>
        </div>
        <RoleSwitcher className="mx-auto hidden md:inline-flex" />
        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <ResetDatabaseButton />
          <NotificationBell />
          <ProfileMenu />
        </div>
      </div>
      <div className="border-t border-border px-4 py-2 md:hidden">
        <RoleSwitcher className="flex w-full" />
      </div>
    </header>
  )
}
