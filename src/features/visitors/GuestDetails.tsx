/**
 * The Guest Details panel from the reference wireframe.
 *
 * Shows who is visiting whom, the check-in/check-out timeline, the visit
 * metadata, a free-text note the front desk can add, and the actions available
 * for the visit's current state. Which actions appear is decided by the status
 * machine and the role, never by the component guessing.
 */
import { useEffect, useState } from 'react';
import type { Visit } from '@/domain/types';
import { useStore, visitIndex } from '@/app/store';
import { can } from '@/app/permissions';
import { Avatar, Badge, Button, Textarea } from '@/shared/ui/primitives';
import { StatusBadge, statusLabel } from './status';
import { NOTE_MAX } from '@/domain/rules';
import { toUserMessage } from '@/domain/errors';
import { formatDateTime, formatDuration, formatTime } from '@/shared/lib/datetime';
import { PassQr } from '@/features/invites/PassQr';

export function GuestDetails({ visit }: { visit: Visit }) {
  const role = useStore((state) => state.role);
  const checkIn = useStore((state) => state.checkIn);
  const checkOut = useStore((state) => state.checkOut);
  const approve = useStore((state) => state.approveVisit);
  const pushToast = useStore((state) => state.pushToast);

  const [note, setNote] = useState(visit.additionalInfo ?? '');
  const [busy, setBusy] = useState(false);
  const [showOther, setShowOther] = useState(true);

  // Switching to a different guest must not carry the previous note over.
  useEffect(() => {
    setNote(visit.additionalInfo ?? '');
  }, [visit.id, visit.additionalInfo]);

  const visitor = visitIndex.visitors.get(visit.visitorId);
  const host = visitIndex.employees.get(visit.hostId);

  /** Wraps an action so every failure surfaces as a readable toast. */
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      pushToast({ kind: 'error', message: toUserMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  const canCheckOut =
    can(role, 'visitors.checkOut') && (visit.status === 'CHECKED_IN' || visit.status === 'OVERSTAY');
  const canCheckIn = can(role, 'visitors.checkIn') && visit.status === 'APPROVED';
  const canApprove = can(role, 'approvals.decide') && visit.status === 'PENDING_APPROVAL';

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-5">
        {/* who is meeting whom */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col items-center text-center">
            <Avatar name={visitor?.fullName ?? '??'} />
            <p className="mt-1.5 max-w-28 truncate text-sm font-bold text-ink">
              {visitor?.fullName ?? 'Unknown visitor'}
            </p>
            <p className="text-xs text-muted">{visitor?.phone}</p>
            <p className="text-[11px] text-muted">Guest</p>
          </div>

          <div className="mt-4 flex-1 border-t border-dashed border-line" aria-hidden="true" />

          <div className="flex flex-col items-center text-center">
            <Avatar name={host?.name ?? '??'} />
            <p className="mt-1.5 max-w-28 truncate text-sm font-bold text-ink">{host?.name}</p>
            <p className="max-w-32 truncate text-xs text-muted">{host?.email}</p>
            <p className="text-[11px] text-muted">Host</p>
          </div>
        </div>

        {/* timeline */}
        <ol className="space-y-3">
          <TimelineStep
            done={visit.checkInAt !== undefined}
            label="Check-in"
            detail={visit.checkInAt ? formatTime(visit.checkInAt) : 'Not yet arrived'}
          />
          <TimelineStep
            done={visit.checkOutAt !== undefined}
            label="Check-out"
            detail={
              visit.checkOutAt
                ? formatTime(visit.checkOutAt)
                : visit.status === 'OVERSTAY'
                  ? `Overdue by ${formatDuration(Date.now() - visit.scheduledEnd)}`
                  : 'Still inside'
            }
            tone={visit.status === 'OVERSTAY' && !visit.checkOutAt ? 'danger' : 'default'}
          />
        </ol>

        {/* visit summary */}
        <div className="border-t border-line pt-4">
          <p className="text-sm font-bold text-ink">
            {visit.source === 'WALK_IN' ? 'Walk-in visitor' : visit.eventTitle} —{' '}
            {visitor?.fullName}
          </p>
          <p className="mt-1 text-sm text-muted">
            {formatDateTime(visit.scheduledStart)} – {formatDateTime(visit.scheduledEnd)}
          </p>
          <p className="mt-1 text-sm text-muted">{visit.visitType}</p>
          {visit.note && <p className="mt-2 text-sm text-muted italic">“{visit.note}”</p>}
          {visit.rejectionReason && (
            <p className="mt-2 text-sm font-medium text-danger">
              Rejected: {visit.rejectionReason}
            </p>
          )}
        </div>

        {/* other details */}
        <div className="border-t border-line pt-4">
          <button
            onClick={() => setShowOther((value) => !value)}
            aria-expanded={showOther}
            className="flex w-full items-center justify-between text-sm font-bold text-ink"
          >
            Other details
            <span aria-hidden="true" className="text-muted">
              {showOther ? '▾' : '▸'}
            </span>
          </button>

          {showOther && (
            <ul className="mt-2 space-y-1 text-sm text-muted">
              <li>Company: {visitor?.company || '—'}</li>
              <li>Email: {visitor?.email || '—'}</li>
              <li>Host department: {host?.department ?? '—'}</li>
              <li>Temp card no: {visit.tempCardNo ?? '—'}</li>
              <li>Pass code: {visit.passCode ?? 'Not issued'}</li>
            </ul>
          )}
        </div>

        {/* the e-pass, once one exists */}
        {visit.passCode && !visit.passRedeemed && (
          <div className="border-t border-line pt-4">
            <p className="mb-2 text-sm font-bold text-ink">Entry pass</p>
            <PassQr code={visit.passCode} />
          </div>
        )}

        {/* additional information */}
        <div className="border-t border-line pt-4">
          <Textarea
            label="Additional information"
            value={note}
            counterMax={NOTE_MAX}
            placeholder="Anything security should know about this visit"
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {canApprove && (
          <Button variant="primary" block loading={busy} onClick={() => void run(() => approve(visit.id))}>
            Approve visit
          </Button>
        )}
        {canCheckIn && (
          <Button
            variant="primary"
            block
            loading={busy}
            onClick={() => void run(() => checkIn(visit.id, 'FRONT_DESK'))}
          >
            Check in
          </Button>
        )}
        {canCheckOut && (
          <Button
            variant="primary"
            block
            loading={busy}
            onClick={() => void run(() => checkOut(visit.id, note))}
          >
            Check out
          </Button>
        )}
        {!canApprove && !canCheckIn && !canCheckOut && (
          <p className="text-center text-xs text-muted">
            No actions available for a visit that is {statusLabel(visit).toLowerCase()}.
          </p>
        )}
      </div>
    </div>
  );
}

function TimelineStep({
  done,
  label,
  detail,
  tone = 'default',
}: {
  done: boolean;
  label: string;
  detail: string;
  tone?: 'default' | 'danger';
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className={[
          'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white',
          done ? 'bg-ok' : 'bg-line text-muted',
        ].join(' ')}
      >
        {done ? '✓' : '•'}
      </span>
      <div>
        <p className="text-sm font-semibold text-ink">{label}</p>
        <p className={`text-xs ${tone === 'danger' ? 'font-semibold text-danger' : 'text-muted'}`}>
          {detail}
        </p>
      </div>
    </li>
  );
}

/** Small header adornment: the status, shown next to the drawer title. */
export function GuestDetailsBadge({ visit }: { visit: Visit }) {
  return visit.status === 'OVERSTAY' ? <Badge tone="danger">Overstay</Badge> : <StatusBadge visit={visit} />;
}
