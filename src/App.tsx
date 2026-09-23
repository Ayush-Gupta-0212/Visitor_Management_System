import { type ComponentType, Suspense, lazy } from 'react'
import { GuestDetailDrawer } from '@/components/gatekeeper/GuestDetailDrawer'
import { ErrorBoundary } from '@/components/layout/ErrorBoundary'
import { Navbar } from '@/components/layout/Navbar'
import { Toaster } from '@/components/ui/Toaster'
import { DigitalPassModal } from '@/components/visitor/DigitalPassModal'
import { useStatusSweep } from '@/store/hooks'
import { useVmsStore } from '@/store/useVmsStore'
import type { Role } from '@/types/vms'

// Each role's panel is its own chunk, so a gatekeeper never downloads the host or admin screens up front.
const GatekeeperConsole = lazy(() => import('@/components/gatekeeper/GatekeeperConsole').then((m) => ({ default: m.GatekeeperConsole })))
const HostDashboard = lazy(() => import('@/components/host/HostDashboard').then((m) => ({ default: m.HostDashboard })))
const AdminDashboard = lazy(() => import('@/components/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })))

const PANELS: Record<Role, { label: string; Panel: ComponentType }> = {
  GATEKEEPER: { label: 'Gatekeeper console', Panel: GatekeeperConsole },
  HOST_EMPLOYEE: { label: 'Host workspace', Panel: HostDashboard },
  ADMIN: { label: 'Governance hub', Panel: AdminDashboard },
}

/** Shown for the moment a role's chunk is loading. */
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

export default function App() {
  // Overstay and expiry detection runs for every role, every 30 seconds.
  useStatusSweep()
  const role = useVmsStore((state) => state.currentUser.role)
  const { label, Panel } = PANELS[role]

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-surface px-3 py-2 text-body-md shadow-overlay focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <Navbar />

      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-margin-desktop md:py-8">
        {/* Keyed by role: switching perspective remounts the panel (with a fade) and resets its error state. */}
        <ErrorBoundary key={role} label={label}>
          <Suspense fallback={<PanelSkeleton />}>
            <div className="animate-fade-in">
              <Panel />
            </div>
          </Suspense>
        </ErrorBoundary>
      </main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 text-body-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between md:px-margin-desktop">
          <p>PassKey VMS · Mumbai Goregaon front desk</p>
          <p className="font-mono text-mono-code">Mock data · stored in this browser only</p>
        </div>
      </footer>

      <ErrorBoundary label="Visitor details">
        <GuestDetailDrawer />
        <DigitalPassModal />
      </ErrorBoundary>
      <Toaster />
    </div>
  )
}
