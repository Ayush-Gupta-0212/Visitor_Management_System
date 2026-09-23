import type { Role, UserSession, VisitorRecord, VmsError } from '@/types/vms'

/*
 * Role-based access control. The store enforces these on every action; UI code
 * should ask `can()` rather than compare roles, so a permission can move
 * between roles in one place.
 */

export type Permission =
  | 'visitor:pre-approve'
  | 'visitor:approve'
  | 'visitor:reject'
  | 'visitor:register-walk-in'
  | 'visitor:check-in'
  | 'visitor:check-out'
  | 'visitor:view-all'
  | 'settings:update'

const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  GATEKEEPER: new Set(['visitor:register-walk-in', 'visitor:check-in', 'visitor:check-out', 'visitor:view-all']),
  HOST_EMPLOYEE: new Set(['visitor:pre-approve', 'visitor:approve', 'visitor:reject']),
  ADMIN: new Set(['visitor:view-all', 'settings:update']),
}

/** Permissions a host may only exercise on their own visitors. */
const HOST_SCOPED: ReadonlySet<Permission> = new Set(['visitor:approve', 'visitor:reject'])

export const ROLE_LABELS: Record<Role, string> = {
  GATEKEEPER: 'Gatekeeper',
  HOST_EMPLOYEE: 'Host Employee',
  ADMIN: 'Super Admin',
}

const PERMISSION_LABELS: Record<Permission, string> = {
  'visitor:pre-approve': 'pre-approve visitors',
  'visitor:approve': 'approve visitor requests',
  'visitor:reject': 'reject visitor requests',
  'visitor:register-walk-in': 'register walk-in visitors',
  'visitor:check-in': 'check visitors in',
  'visitor:check-out': 'check visitors out',
  'visitor:view-all': 'view every visitor',
  'settings:update': 'change system settings',
}

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission)
}

/**
 * Why `user` may not use `permission` (on `visitor`, when given), or null when allowed.
 * Host-scoped permissions also require the user to be that visitor's host.
 */
export function authorize(user: UserSession, permission: Permission, visitor?: VisitorRecord): VmsError | null {
  if (!can(user.role, permission)) {
    return { code: 'FORBIDDEN', message: `The ${ROLE_LABELS[user.role]} role can't ${PERMISSION_LABELS[permission]}.` }
  }
  if (visitor && HOST_SCOPED.has(permission) && visitor.hostEmployeeId !== user.id) {
    return {
      code: 'FORBIDDEN',
      message: `Only ${visitor.hostEmployeeName}, the visitor's host, can approve or reject this visit.`,
    }
  }
  return null
}

/** The visitors `user` may see: hosts see only their own guests. O(n). */
export function visibleTo(user: UserSession, visitors: VisitorRecord[]): VisitorRecord[] {
  return can(user.role, 'visitor:view-all') ? visitors : visitors.filter((v) => v.hostEmployeeId === user.id)
}
