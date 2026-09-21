/**
 * Routes, boot sequence and the background ticker.
 */
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useStore } from './store';
import { Layout } from './Layout';
import { ErrorBoundary } from './ErrorBoundary';
import { can } from './permissions';
import type { Action } from './permissions';
import { useInterval } from '@/shared/hooks';
import { Toaster, ErrorState, TableSkeleton } from '@/shared/ui/feedback';
import { VisitorsPage } from '@/features/visitors/VisitorsPage';
import { WalkInPage } from '@/features/visitors/WalkInPage';
import { ApprovalsPage } from '@/features/approvals/ApprovalsPage';
import { InvitePage } from '@/features/invites/InvitePage';
import { AdminPage } from '@/features/admin/AdminPage';

/** How often the expiry/overstay sweep runs. The sweep itself is O(1) per tick. */
const TICK_MS = 15_000;

export function App() {
  const booting = useStore((state) => state.booting);
  const bootError = useStore((state) => state.bootError);
  const bootstrap = useStore((state) => state.bootstrap);
  const sweep = useStore((state) => state.sweepDeadlines);
  const location = useLocation();

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useInterval(sweep, TICK_MS);

  if (bootError) {
    return <ErrorState message={bootError} onRetry={() => void bootstrap()} />;
  }

  return (
    <Layout>
      <ErrorBoundary resetKey={location.pathname}>
        {booting ? (
          <div className="mx-auto max-w-6xl px-4 py-8">
            <p className="mb-4 text-sm text-muted">Generating and indexing the visitor dataset…</p>
            <TableSkeleton rows={10} />
          </div>
        ) : (
          <Routes>
            <Route path="/" element={<Navigate to="/frontdesk" replace />} />

            <Route
              path="/frontdesk"
              element={
                <Guard action="visitors.view">
                  <VisitorsPage />
                </Guard>
              }
            />
            <Route
              path="/frontdesk/walk-in"
              element={
                <Guard action="visitors.register">
                  <WalkInPage />
                </Guard>
              }
            />
            <Route
              path="/host"
              element={
                <Guard action="approvals.decide">
                  <ApprovalsPage />
                </Guard>
              }
            />
            <Route
              path="/host/invite"
              element={
                <Guard action="invites.create">
                  <InvitePage />
                </Guard>
              }
            />
            <Route
              path="/admin"
              element={
                <Guard action="admin.configure">
                  <AdminPage />
                </Guard>
              }
            />

            <Route
              path="*"
              element={
                <ErrorState message="That page does not exist. Use the navigation above to get back." />
              }
            />
          </Routes>
        )}
      </ErrorBoundary>
      <Toaster />
    </Layout>
  );
}

/**
 * Route guard. Renders an explanation rather than redirecting silently, so a
 * user who follows a bookmarked link understands why the screen is not
 * available instead of being bounced somewhere unexpected.
 */
function Guard({ action, children }: { action: Action; children: React.ReactNode }) {
  const role = useStore((state) => state.role);

  if (!can(role, action)) {
    return (
      <ErrorState message="Your current role does not have access to this screen. Switch role using the selector in the top right." />
    );
  }
  return <>{children}</>;
}
