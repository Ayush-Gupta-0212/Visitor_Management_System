/**
 * Role-based access control.
 *
 * The spec's approval workflow only works if the roles are actually separated:
 * a host must not be able to check someone in at the gate, and the front desk
 * must not be able to approve a visit on the host's behalf. Those rules live
 * here as data rather than as `if (role === ...)` scattered through components.
 *
 * `can()` is the single gate; `navigationFor()` derives the menu from the same
 * table, so a role can never see a link to a screen it is not allowed to use.
 */
import type { Role } from '@/domain/types';

export type Action =
  | 'visitors.view'
  | 'visitors.register'
  | 'visitors.checkIn'
  | 'visitors.checkOut'
  | 'invites.create'
  | 'approvals.decide'
  | 'admin.configure'
  | 'admin.audit';

const PERMISSIONS: Record<Role, readonly Action[]> = {
  FRONT_DESK: ['visitors.view', 'visitors.register', 'visitors.checkIn', 'visitors.checkOut'],
  HOST: ['visitors.view', 'invites.create', 'approvals.decide'],
  ADMIN: [
    'visitors.view',
    'visitors.register',
    'visitors.checkIn',
    'visitors.checkOut',
    'invites.create',
    'approvals.decide',
    'admin.configure',
    'admin.audit',
  ],
};

export const ROLE_LABEL: Record<Role, string> = {
  FRONT_DESK: 'Front desk',
  HOST: 'Host employee',
  ADMIN: 'Admin',
};

export function can(role: Role, action: Action): boolean {
  return PERMISSIONS[role].includes(action);
}

export interface NavItem {
  to: string;
  label: string;
  end?: boolean;
  requires: Action;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/frontdesk', label: 'Visitors', end: true, requires: 'visitors.view' },
  { to: '/frontdesk/walk-in', label: 'Register walk-in', requires: 'visitors.register' },
  { to: '/host', label: 'Approvals', end: true, requires: 'approvals.decide' },
  { to: '/host/invite', label: 'Invite visitors', requires: 'invites.create' },
  { to: '/admin', label: 'Admin', end: true, requires: 'admin.configure' },
];

export function navigationFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => can(role, item.requires));
}
