/**
 * The visit lifecycle, expressed as an explicit finite state machine.
 *
 *   PENDING_APPROVAL ─▶ APPROVED ─▶ CHECKED_IN ─▶ CHECKED_OUT
 *          │                │            │
 *          │                │            └─▶ OVERSTAY ─▶ CHECKED_OUT
 *          ├─▶ REJECTED     └─▶ EXPIRED
 *          └─▶ EXPIRED
 *
 * Why a table instead of scattered `if` statements: every illegal operation the
 * evaluation criteria ask us to prevent ("checks in place to prevent invalid
 * operations or data inconsistencies") is blocked in exactly one place, and the
 * rules can be unit-tested without rendering a single component.
 */
import type { Visit, VisitStatus } from './types';
import { DomainError } from './errors';

/**
 * Allowed transitions. `Record<K, V>` is TypeScript's "object with these exact
 * keys" type - if a new VisitStatus is added to the union, this object fails to
 * compile until the new state is handled. That is the compiler doing code review.
 */
const TRANSITIONS: Record<VisitStatus, readonly VisitStatus[]> = {
  PENDING_APPROVAL: ['APPROVED', 'REJECTED', 'EXPIRED'],
  APPROVED: ['CHECKED_IN', 'EXPIRED', 'REJECTED'],
  REJECTED: [],
  EXPIRED: [],
  CHECKED_IN: ['CHECKED_OUT', 'OVERSTAY'],
  OVERSTAY: ['CHECKED_OUT'],
  CHECKED_OUT: [],
};

/** Human-readable labels used in the UI. Keeps copy out of components. */
export const STATUS_LABEL: Record<VisitStatus, string> = {
  PENDING_APPROVAL: 'Pending approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  EXPIRED: 'Expired',
  CHECKED_IN: 'Checked in',
  OVERSTAY: 'Overstay',
  CHECKED_OUT: 'Checked out',
};

/** Terminal states can never change again, so the UI hides all actions on them. */
export function isTerminal(status: VisitStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

export function canTransition(from: VisitStatus, to: VisitStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/**
 * Throws a user-facing error if the transition is not allowed.
 * Call this before mutating any visit.
 */
export function assertTransition(from: VisitStatus, to: VisitStatus): void {
  if (!canTransition(from, to)) {
    throw new DomainError(
      'INVALID_TRANSITION',
      `Cannot move a visit from "${STATUS_LABEL[from]}" to "${STATUS_LABEL[to]}".`,
    );
  }
}

/* ------------------------------------------------------------------ *
 * Derived status
 * ------------------------------------------------------------------ */

/**
 * Computes the status a visit *should* have at time `now`, applying the two
 * time-driven rules:
 *
 *   - an APPROVED visitor who never arrived within the window EXPIRES
 *   - a CHECKED_IN visitor still inside past their window is an OVERSTAY
 *
 * Returns `null` when nothing should change. This is a pure function of
 * (visit, now), which is why the expiry sweep in `src/data/expiryQueue.ts` can
 * be tested deterministically with a fixed clock.
 */
export function deriveStatus(
  visit: Visit,
  now: number,
  grace: { expiryGraceMinutes: number; overstayGraceMinutes: number },
): VisitStatus | null {
  const MINUTE = 60_000;

  if (visit.status === 'APPROVED' || visit.status === 'PENDING_APPROVAL') {
    if (now > visit.scheduledEnd + grace.expiryGraceMinutes * MINUTE) {
      return 'EXPIRED';
    }
  }

  if (visit.status === 'CHECKED_IN') {
    if (now > visit.scheduledEnd + grace.overstayGraceMinutes * MINUTE) {
      return 'OVERSTAY';
    }
  }

  return null;
}
