/**
 * The host's approval queue.
 *
 * "Quick approval/rejection" is the spec's phrase, so the design optimises for
 * deciding fast: the whole queue is keyboard-operable, a rejection asks for a
 * reason (security needs to know why someone was turned away), and decisions
 * broadcast instantly to the front desk.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore, visitIndex } from '@/app/store';
import { Avatar, Badge, Button, Card, Textarea } from '@/shared/ui/primitives';
import { EmptyState } from '@/shared/ui/feedback';
import { toUserMessage } from '@/domain/errors';
import { formatDateTime, formatDuration, startOfDay, endOfDay } from '@/shared/lib/datetime';
import { StatusBadge } from '@/features/visitors/status';

export function ApprovalsPage() {
  const currentUserId = useStore((state) => state.currentUserId);
  const dataVersion = useStore((state) => state.dataVersion);
  const policy = useStore((state) => state.policy);

  const host = visitIndex.employees.get(currentUserId);

  const pendingIds = useMemo(
    () => visitIndex.query({ hostId: currentUserId, statuses: ['PENDING_APPROVAL'] }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUserId, dataVersion],
  );

  const todayIds = useMemo(
    () =>
      visitIndex.query({
        hostId: currentUserId,
        from: startOfDay(Date.now()),
        to: endOfDay(Date.now()),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUserId, dataVersion],
  );

  const quotaUsed = visitIndex.preApprovalsUsed(currentUserId, Date.now());

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-lg font-bold text-ink">Approvals</h1>
          <p className="text-sm text-muted">
            Signed in as {host?.name ?? 'a host'} · {host?.department}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge tone={quotaUsed >= policy.preApprovalLimitPerDay ? 'danger' : 'neutral'}>
            Pre-approvals today: {quotaUsed}/{policy.preApprovalLimitPerDay}
          </Badge>
          <Link to="/host/invite">
            <Button variant="primary">Invite visitors</Button>
          </Link>
        </div>
      </header>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-bold text-ink">
          Waiting for you ({pendingIds.length})
        </h2>

        {pendingIds.length === 0 ? (
          <Card>
            <EmptyState
              title="Nothing waiting for approval"
              body="When a visitor arrives at reception asking for you, the request appears here instantly. Try registering a walk-in from the front desk in a second tab."
            />
          </Card>
        ) : (
          <ul className="space-y-2">
            {pendingIds.map((id) => (
              <ApprovalCard key={id} visitId={id} />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold text-ink">Your visitors today ({todayIds.length})</h2>

        {todayIds.length === 0 ? (
          <Card>
            <EmptyState title="No visitors scheduled today" body="Invite someone to get started." />
          </Card>
        ) : (
          <Card className="divide-y divide-line">
            {todayIds.slice(0, 25).map((id) => {
              const visit = visitIndex.visits.get(id);
              if (!visit) return null;
              const visitor = visitIndex.visitors.get(visit.visitorId);
              return (
                <div key={id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={visitor?.fullName ?? '??'} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{visitor?.fullName}</p>
                    <p className="truncate text-xs text-muted">
                      {visit.eventTitle} · {formatDateTime(visit.scheduledStart)}
                    </p>
                  </div>
                  <StatusBadge visit={visit} />
                </div>
              );
            })}
          </Card>
        )}
      </section>
    </div>
  );
}

/* ------------------------------ one request --------------------------- */

function ApprovalCard({ visitId }: { visitId: string }) {
  const approve = useStore((state) => state.approveVisit);
  const reject = useStore((state) => state.rejectVisit);
  const pushToast = useStore((state) => state.pushToast);

  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const visit = visitIndex.visits.get(visitId);
  if (!visit) return null;

  const visitor = visitIndex.visitors.get(visit.visitorId);

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

  return (
    <li>
      <Card className="p-4">
        <div className="flex flex-wrap items-start gap-3">
          {visitor?.photoDataUrl ? (
            <img
              src={visitor.photoDataUrl}
              alt={`Photo of ${visitor.fullName}`}
              className="size-12 rounded-full object-cover"
            />
          ) : (
            <Avatar name={visitor?.fullName ?? '??'} size={48} />
          )}

          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-ink">{visitor?.fullName ?? 'Unknown visitor'}</p>
            <p className="text-sm text-muted">
              {visitor?.company} · {visit.visitType}
            </p>
            <p className="mt-1 text-sm text-ink">{visit.eventTitle}</p>
            <p className="text-xs text-muted">
              {formatDateTime(visit.scheduledStart)} · expected{' '}
              {formatDuration(visit.scheduledEnd - visit.scheduledStart)}
            </p>
            {visit.source === 'WALK_IN' && (
              <p className="mt-1 text-xs font-semibold text-warn">
                At reception now — waiting for your decision
              </p>
            )}
          </div>

          {!rejecting && (
            <div className="flex gap-2">
              <Button variant="danger" onClick={() => setRejecting(true)} disabled={busy}>
                Reject
              </Button>
              <Button variant="primary" loading={busy} onClick={() => void run(() => approve(visitId))}>
                Approve
              </Button>
            </div>
          )}
        </div>

        {rejecting && (
          <div className="mt-3 border-t border-line pt-3">
            <Textarea
              label="Reason for rejection"
              required
              counterMax={200}
              value={reason}
              placeholder="Security will see this, so be specific."
              onChange={(event) => setReason(event.target.value)}
            />
            <div className="mt-2 flex gap-2">
              <Button
                variant="danger"
                loading={busy}
                onClick={() =>
                  void run(async () => {
                    await reject(visitId, reason);
                    setRejecting(false);
                    setReason('');
                  })
                }
              >
                Confirm rejection
              </Button>
              <Button variant="ghost" onClick={() => setRejecting(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Card>
    </li>
  );
}
