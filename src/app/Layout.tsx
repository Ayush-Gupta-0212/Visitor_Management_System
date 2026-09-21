/**
 * The application shell: navigation, the "who am I" switcher, the host's
 * notification bell and the connectivity banner.
 *
 * There is no real authentication in this project - it would be a backend
 * concern and the case study is a frontend exercise - so the role switcher
 * stands in for signing in as different people. Role-based access control is
 * real, though: `permissions.ts` decides which routes exist for which role, and
 * the router enforces it.
 */
import { NavLink, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useStore, visitIndex } from './store';
import { ROLE_LABEL, navigationFor } from './permissions';
import type { Role } from '@/domain/types';
import { Avatar, Badge } from '@/shared/ui/primitives';
import { useOnlineStatus } from '@/shared/hooks';
import { isRealtimeSupported } from './realtime';
import { formatTime } from '@/shared/lib/datetime';

export function Layout({ children }: { children: ReactNode }) {
  const role = useStore((state) => state.role);
  const online = useOnlineStatus();
  const navigation = navigationFor(role);

  return (
    <div className="flex min-h-full flex-col">
      {!online && (
        <div
          role="status"
          className="no-print bg-warn-soft px-4 py-2 text-center text-sm font-medium text-warn"
        >
          You are offline. Check-ins are being recorded locally and will sync when the connection
          returns.
        </div>
      )}

      <header className="no-print sticky top-0 z-20 border-b border-line bg-surface">
        <div className="flex items-center gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-brand text-sm font-black text-white">
              V
            </span>
            <span className="hidden text-sm font-bold text-ink sm:block">Visitor Management</span>
          </div>

          <nav aria-label="Main" className="flex items-center gap-1 overflow-x-auto">
            {navigation.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    'rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors',
                    isActive ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-canvas hover:text-ink',
                  ].join(' ')
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
            <RoleSwitcher />
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      {!isRealtimeSupported && (
        <p className="no-print px-6 py-2 text-center text-xs text-muted">
          Cross-tab realtime is unavailable in this browser; the app is running in single-tab mode.
        </p>
      )}
    </div>
  );
}

/* --------------------------- role switcher --------------------------- */

const ROLES: Role[] = ['FRONT_DESK', 'HOST', 'ADMIN'];

function RoleSwitcher() {
  const role = useStore((state) => state.role);
  const setRole = useStore((state) => state.setRole);
  const currentUserId = useStore((state) => state.currentUserId);
  const navigate = useNavigate();

  const landing: Record<Role, string> = {
    FRONT_DESK: '/frontdesk',
    HOST: '/host',
    ADMIN: '/admin',
  };

  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">Switch role</span>
      <select
        value={role}
        onChange={(event) => {
          const next = event.target.value as Role;
          setRole(next);
          navigate(landing[next]);
        }}
        className="rounded-lg border border-line bg-surface px-2 py-1.5 text-xs font-semibold text-ink"
      >
        {ROLES.map((value) => (
          <option key={value} value={value}>
            {ROLE_LABEL[value]}
          </option>
        ))}
      </select>
      {role === 'HOST' && <CurrentHostChip userId={currentUserId} />}
    </label>
  );
}

/**
 * Employees are read straight from the index rather than from the store: they
 * are loaded once at boot and never change, so keeping them out of reactive
 * state avoids re-rendering the header on every data mutation.
 */
function CurrentHostChip({ userId }: { userId: string }) {
  const employee = visitIndex.employees.get(userId);
  if (!employee) return null;

  return (
    <span className="hidden items-center gap-2 rounded-lg bg-canvas px-2 py-1 md:inline-flex">
      <Avatar name={employee.name} size={22} />
      <span className="text-xs font-semibold text-ink">{employee.name}</span>
    </span>
  );
}

/* -------------------------- notification bell ------------------------- */

function NotificationBell() {
  const notifications = useStore((state) => state.notifications);
  const markRead = useStore((state) => state.markNotificationsRead);
  const [open, setOpen] = useState(false);

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen((value) => !value);
          if (!open) markRead();
        }}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        className="relative rounded-lg px-2 py-1.5 text-muted hover:bg-canvas hover:text-ink"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 3a6 6 0 0 0-6 6v3.6L4.5 16h15L18 12.6V9a6 6 0 0 0-6-6Zm0 18a2.6 2.6 0 0 0 2.5-2h-5A2.6 2.6 0 0 0 12 21Z"
            fill="currentColor"
          />
        </svg>
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 grid size-4 place-items-center rounded-full bg-danger text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 rounded-xl border border-line bg-surface shadow-xl">
          <header className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-sm font-bold text-ink">Notifications</h2>
            <Badge tone="brand">Live</Badge>
          </header>

          {notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">
              Nothing yet. Register a walk-in from the front desk in another tab and it will appear
              here instantly.
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {notifications.map((notification) => (
                <li key={notification.id} className="border-b border-line px-4 py-3 last:border-0">
                  <p className="text-sm font-semibold text-ink">{notification.title}</p>
                  <p className="text-xs text-muted">{notification.body}</p>
                  <p className="mt-1 text-[11px] text-muted">{formatTime(notification.at)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
