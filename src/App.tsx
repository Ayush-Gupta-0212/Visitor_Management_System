import { type ComponentType, Suspense, lazy, useEffect } from 'react'
import { GuestDetailDrawer } from '@/components/gatekeeper/GuestDetailDrawer'
import { ErrorBoundary } from '@/components/layout/ErrorBoundary'
import { Navbar } from '@/components/layout/Navbar'
import { WORKSPACE_LABELS } from '@/components/layout/roles'
import { Toaster } from '@/components/ui/Toaster'
import { DigitalPassModal } from '@/components/visitor/DigitalPassModal'
import { type Route, useRoute } from '@/lib/router'
import { LoginPage } from '@/pages/LoginPage'
import { useStatusSweep } from '@/store/hooks'
import { useSessionUser } from '@/store/useAuthStore'
import { useLiveSync } from '@/store/useLiveSync'
import { useThemeSync } from '@/store/useThemeStore'
import type { Role, UserSession } from '@/types/vms'

// Each role's panel and the public pages are their own chunks: a host never downloads the
// gatekeeper console, and the lobby kiosk never downloads any staff screen.
const GatekeeperConsole = lazy(() => import('@/components/gatekeeper/GatekeeperConsole').then((m) => ({ default: m.GatekeeperConsole })))
const HostDashboard = lazy(() => import('@/components/host/HostDashboard').then((m) => ({ default: m.HostDashboard })))
const AdminDashboard = lazy(() => import('@/components/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })))
const KioskPage = lazy(() => import('@/pages/KioskPage').then((m) => ({ default: m.KioskPage })))
const PublicPassPage = lazy(() => import('@/pages/PublicPassPage').then((m) => ({ default: m.PublicPassPage })))

const PANELS: Record<Role, ComponentType> = {
  GATEKEEPER: GatekeeperConsole,
  HOST_EMPLOYEE: HostDashboard,
  ADMIN: AdminDashboard,
}

/** Shown for the moment a lazily loaded screen is downloading. */
function PanelSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="flex flex-col gap-6">
      <div className="h-16 w-2/3 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((key) => (
          <div key={key} className="h-32 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-lg bg-muted" />
    </div>
  )
}

function PageTitle({ route, user }: { route: Route; user: UserSession | null }) {
  const title =
    route.name === 'kiosk'
      ? 'Visitor kiosk'
      : route.name === 'pass'
        ? 'Visitor pass'
        : user
          ? `${WORKSPACE_LABELS[user.role]} · ${user.name}`
          : 'Sign in'
  useEffect(() => {
    document.title = `${title} · PassKey VMS`
  }, [title])
  return null
}

export default function App() {
  const route = useRoute()
  const user = useSessionUser()
  useThemeSync()
  // Every tab reloads shared data when another tab changes it; only the staff workspace raises alerts.
  useLiveSync(route.name === 'workspace')
  // Overstay and expiry detection runs in every open tab, every 30 seconds.
  useStatusSweep()

  return (
    <>
      <PageTitle route={route} user={user} />
      {route.name === 'kiosk' ? (
        <Suspense fallback={null}>
          <KioskPage />
        </Suspense>
      ) : route.name === 'pass' ? (
        <Suspense fallback={null}>
          <PublicPassPage payload={route.payload} />
        </Suspense>
      ) : user ? (
        <Workspace key={user.id} user={user} />
      ) : (
        <LoginPage />
      )}
      <Toaster />
    </>
  )
}

/** The signed-in shell: top bar, the role's own panel, and the overlays every panel shares. */
function Workspace({ user }: { user: UserSession }) {
  const Panel = PANELS[user.role]

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        onClick={(event) => {
          // Keep the hash for routing; just move focus to the content.
          event.preventDefault()
          document.getElementById('main')?.focus()
        }}
        className="sr-only z-50 rounded-md bg-surface px-3 py-2 text-body-md shadow-overlay focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <Navbar />

      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 outline-hidden md:px-margin-desktop md:py-8">
        <ErrorBoundary label={WORKSPACE_LABELS[user.role]}>
          <Suspense fallback={<PanelSkeleton />}>
            <div className="animate-fade-in">
              <Panel />
            </div>
          </Suspense>
        </ErrorBoundary>
      </main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 text-body-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between md:px-margin-desktop">
          <p>PassKey VMS · {user.office} front desk</p>
          <p className="inline-flex items-center gap-1.5 font-mono text-mono-code">
            <span className="size-1.5 rounded-full bg-success-dot" aria-hidden />
            Mock data in this browser · live across tabs
          </p>
        </div>
      </footer>

      <ErrorBoundary label="Visitor details">
        <GuestDetailDrawer />
        <DigitalPassModal />
      </ErrorBoundary>
    </div>
  )
}
