import type { Role, UserSession, VisitorRecord, VmsError } from '@/types/vms'

/*
 * Role-based access control. The store enforces these on every action; UI code
 * asks `can()` rather than comparing roles, so a permission can move between
 * roles in one place. Two permissions are also scoped: hosts may only decide on
 * their own visitors, and gatekeepers only act on visits booked at their site.
 */

export type Permission =
  | 'visitor:pre-approve'
  | 'visitor:approve'
  | 'visitor:reject'
  | 'visitor:register-walk-in'
  | 'visitor:check-in'
  | 'visitor:check-out'
  | 'visitor:extend'
  | 'visitor:view-site'
  | 'visitor:view-all'
  | 'settings:update'

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  GATEKEEPER: ['visitor:register-walk-in', 'visitor:check-in', 'visitor:check-out', 'visitor:extend', 'visitor:view-site'],
  HOST_EMPLOYEE: ['visitor:pre-approve', 'visitor:approve', 'visitor:reject'],
  ADMIN: ['visitor:view-all', 'settings:update'],
}

/** Permissions a host may only use on their own visitors. */
const HOST_SCOPED: ReadonlySet<Permission> = new Set(['visitor:approve', 'visitor:reject'])
/** Permissions a gatekeeper may only use on visits booked at their own site. */
const SITE_SCOPED: ReadonlySet<Permission> = new Set(['visitor:check-in', 'visitor:check-out', 'visitor:extend'])

export const ROLE_LABELS: Record<Role, string> = {
  GATEKEEPER: 'Gatekeeper',
  HOST_EMPLOYEE: 'Host Employee',
  ADMIN: 'Super Admin',
}

export const PERMISSION_LABELS: Record<Permission, string> = {
  'visitor:pre-approve': 'pre-approve visitors',
  'visitor:approve': 'approve visitor requests',
  'visitor:reject': 'reject visitor requests',
  'visitor:register-walk-in': 'register walk-in visitors',
  'visitor:check-in': 'check visitors in',
  'visitor:check-out': 'check visitors out',
  'visitor:extend': 'extend visitor stays',
  'visitor:view-site': "view their site's visitors",
  'visitor:view-all': 'view every visitor',
  'settings:update': 'change system settings',
}

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission)
}

export function permissionsOf(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role]
}

/**
 * Why `user` may not use `permission` (on `visitor`, when given), or null when allowed.
 * Checks, in order: signed in, role, host ownership, and site.
 */
export function authorize(user: UserSession | null, permission: Permission, visitor?: VisitorRecord): VmsError | null {
  if (!user) return { code: 'UNAUTHORIZED', message: 'Sign in to continue.' }
  if (!can(user.role, permission)) {
    return { code: 'FORBIDDEN', message: `The ${ROLE_LABELS[user.role]} role can't ${PERMISSION_LABELS[permission]}.` }
  }
  if (visitor && HOST_SCOPED.has(permission) && visitor.hostEmployeeId !== user.id) {
    return {
      code: 'FORBIDDEN',
      message: `Only ${visitor.hostEmployeeName}, the visitor's host, can approve or reject this visit.`,
    }
  }
  if (visitor && SITE_SCOPED.has(permission) && visitor.office !== user.office) {
    return { code: 'FORBIDDEN', message: `This visit is booked at ${visitor.office}; you're on duty at ${user.office}.` }
  }
  return null
}

/** The visitors `user` may see: admins see all, gatekeepers their site, hosts their own guests. O(N). */
export function visibleTo(user: UserSession | null, visitors: VisitorRecord[]): VisitorRecord[] {
  if (!user) return []
  if (can(user.role, 'visitor:view-all')) return visitors
  if (can(user.role, 'visitor:view-site')) return visitors.filter((visitor) => visitor.office === user.office)
  return visitors.filter((visitor) => visitor.hostEmployeeId === user.id)
}
