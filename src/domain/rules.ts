/**
 * Business rules that guard every state-changing operation.
 *
 * Each rule is a small `assertX` function that either returns silently or throws
 * a DomainError carrying a message written for the person at the front desk.
 * Components never re-implement these checks; they call the rule and catch.
 */
import type { Policy, Visit } from './types';
import { DomainError } from './errors';
import { assertTransition } from './statusMachine';

const MINUTE = 60_000;

/* ------------------------------ scheduling ------------------------------ */

/** "e.g. 10 AM - 12 PM": the window must be non-empty and not in the past. */
export function assertValidWindow(start: number, end: number, now: number): void {
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new DomainError('WINDOW_REQUIRED', 'Please choose a date and time for the visit.');
  }
  if (end <= start) {
    throw new DomainError('WINDOW_INVERTED', 'The end time must be after the start time.');
  }
  if (end < now - 5 * MINUTE) {
    throw new DomainError('WINDOW_PAST', 'That time window is already in the past.');
  }
}

/**
 * "Admins can enforce rules, such as pre-approval limits
 *  (e.g. max 5 visitors per employee per day)."
 *
 * `usedToday` is supplied by the caller, who reads it from the per-host/per-day
 * index in O(1) rather than counting the whole dataset - see `src/data/indexes.ts`.
 */
export function assertPreApprovalQuota(usedToday: number, policy: Policy): void {
  if (usedToday >= policy.preApprovalLimitPerDay) {
    throw new DomainError(
      'QUOTA_EXCEEDED',
      `Daily pre-approval limit reached (${policy.preApprovalLimitPerDay} visitors per day). ` +
        'Ask an admin to raise the limit, or invite the guest for another day.',
    );
  }
}

/* ------------------------------ approval ------------------------------ */

export function assertCanApprove(visit: Visit, now: number): void {
  assertTransition(visit.status, 'APPROVED');
  if (now > visit.scheduledEnd + MINUTE) {
    throw new DomainError(
      'WINDOW_CLOSED',
      'This visit window has already closed, so it can no longer be approved.',
    );
  }
}

export function assertCanReject(visit: Visit, reason: string): void {
  assertTransition(visit.status, 'REJECTED');
  if (!reason.trim()) {
    throw new DomainError('REASON_REQUIRED', 'Please give a reason so security can act on it.');
  }
}

/* ------------------------------ front desk ------------------------------ */

/**
 * Check-in guards. Ordered from most to least specific so the visitor is told
 * the single most useful thing, not a generic failure.
 */
export function assertCanCheckIn(visit: Visit, now: number): void {
  assertTransition(visit.status, 'CHECKED_IN');
  if (visit.passRedeemed) {
    throw new DomainError(
      'PASS_ALREADY_USED',
      'This pass has already been used. Passes are valid for a single entry.',
    );
  }
  if (now < visit.scheduledStart - 30 * MINUTE) {
    throw new DomainError(
      'TOO_EARLY',
      'The visitor is more than 30 minutes early. Ask the host to confirm before letting them in.',
    );
  }
  if (now > visit.scheduledEnd) {
    throw new DomainError('WINDOW_CLOSED', 'The approved time window for this visit has ended.');
  }
}

export function assertCanCheckOut(visit: Visit): void {
  if (visit.status !== 'CHECKED_IN' && visit.status !== 'OVERSTAY') {
    throw new DomainError(
      'NOT_CHECKED_IN',
      'This visitor has not checked in yet, so they cannot be checked out.',
    );
  }
}

/* ------------------------------ text limits ------------------------------ */

export const NOTE_MAX = 1000;

export function assertNoteLength(note: string): void {
  if (note.length > NOTE_MAX) {
    throw new DomainError('NOTE_TOO_LONG', `Note must be ${NOTE_MAX} characters or fewer.`);
  }
}
