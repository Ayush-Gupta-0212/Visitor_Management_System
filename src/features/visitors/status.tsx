/**
 * How a visit's state is presented.
 *
 * The reference wireframe shows labels like "OVERSTAY" and "SELF CHECK-OUT" -
 * that is, the label combines the status with *how* the visitor came and went.
 * Rather than storing that combination (which would duplicate state and let the
 * two drift apart), it is derived here in one place.
 */
import type { Visit } from '@/domain/types';
import { Badge } from '@/shared/ui/primitives';
import type { BadgeTone } from '@/shared/ui/primitives';

export function statusLabel(visit: Visit): string {
  switch (visit.status) {
    case 'CHECKED_OUT':
      return visit.checkInMethod === 'SELF' ? 'Self check-out' : 'Checked out';
    case 'CHECKED_IN':
      return 'Inside';
    case 'PENDING_APPROVAL':
      return 'Awaiting approval';
    case 'APPROVED':
      return visit.source === 'PRE_APPROVAL' ? 'Pre-approved' : 'Approved';
    case 'OVERSTAY':
      return 'Overstay';
    case 'REJECTED':
      return 'Rejected';
    case 'EXPIRED':
      return 'Expired';
  }
}

export function statusTone(visit: Visit): BadgeTone {
  switch (visit.status) {
    case 'OVERSTAY':
    case 'REJECTED':
      return 'danger';
    case 'PENDING_APPROVAL':
      return 'warn';
    case 'CHECKED_IN':
      return 'ok';
    case 'APPROVED':
      return 'brand';
    default:
      return 'neutral';
  }
}

export function StatusBadge({ visit }: { visit: Visit }) {
  return <Badge tone={statusTone(visit)}>{statusLabel(visit)}</Badge>;
}

/** Subtext under the "Type of invite" column, matching the wireframe. */
export function sourceLabel(visit: Visit): string {
  if (visit.source === 'WALK_IN') return 'Walk-in';
  if (visit.source === 'PRE_APPROVAL') return 'Pre-approved · e-pass';
  return visit.checkInMethod === 'SELF' ? 'Self check-in' : 'Invited';
}
