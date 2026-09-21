/**
 * "Invite Visitors" - the first two reference wireframes.
 *
 * Layout follows the reference: event details on the left, guest search and the
 * "Added guests" list on the right, one primary action pinned at the bottom
 * that stays disabled until the form is valid.
 *
 * The pre-approval switch is what turns an invite into the spec's pre-approval
 * flow: the visit skips the host-approval step, a QR e-pass is issued
 * immediately, and the daily quota is enforced before anything is created.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, visitIndex } from '@/app/store';
import { VISIT_TYPES } from '@/domain/types';
import type { VisitType } from '@/domain/types';
import { Button, Card, Input, Select, Textarea } from '@/shared/ui/primitives';
import { GuestPicker } from '@/features/visitors/pickers';
import { NOTE_MAX } from '@/domain/rules';
import { toUserMessage } from '@/domain/errors';
import { PassQr } from './PassQr';
import { combineDateAndTime, parseDayKey, toDateInput } from '@/shared/lib/datetime';

export function InvitePage() {
  const createInvite = useStore((state) => state.createInvite);
  const currentUserId = useStore((state) => state.currentUserId);
  const offices = useStore((state) => state.offices);
  const policy = useStore((state) => state.policy);
  const pushToast = useStore((state) => state.pushToast);
  const navigate = useNavigate();

  const [eventTitle, setEventTitle] = useState('Meeting');
  const [visitType, setVisitType] = useState<VisitType>('Business Guests');
  const [officeId, setOfficeId] = useState('off-1');
  const [day, setDay] = useState(toDateInput(Date.now()));
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('12:00');
  const [note, setNote] = useState('Please report at Front Desk');
  const [preApproved, setPreApproved] = useState(true);
  const [guestIds, setGuestIds] = useState<string[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdIds, setCreatedIds] = useState<string[]>([]);

  const quotaUsed = visitIndex.preApprovalsUsed(currentUserId, parseDayKey(day));
  const quotaRemaining = Math.max(0, policy.preApprovalLimitPerDay - quotaUsed);

  const titleValid = eventTitle.trim().length > 0;
  const windowValid = endTime > startTime;
  const canSubmit = titleValid && windowValid && guestIds.length > 0 && !busy;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const dayTs = parseDayKey(day);
      const ids = await createInvite({
        eventTitle,
        visitType,
        officeId,
        scheduledStart: combineDateAndTime(dayTs, startTime),
        scheduledEnd: combineDateAndTime(dayTs, endTime),
        note,
        guestIds,
        preApproved,
      });

      setCreatedIds(ids);
      setGuestIds([]);
      pushToast({
        kind: 'success',
        message: preApproved
          ? `${ids.length} e-pass${ids.length > 1 ? 'es' : ''} issued and sent to your guests.`
          : `${ids.length} invite${ids.length > 1 ? 's' : ''} created.`,
      });
    } catch (cause) {
      setError(toUserMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  if (createdIds.length > 0) {
    return <InviteConfirmation visitIds={createdIds} onDone={() => setCreatedIds([])} />;
  }

  return (
    <form onSubmit={submit} noValidate className="mx-auto flex min-h-[calc(100vh-57px)] max-w-6xl flex-col px-4 sm:px-6">
      <header className="flex items-center gap-3 py-4">
        <button
          type="button"
          onClick={() => navigate('/host')}
          aria-label="Back to approvals"
          className="rounded-lg px-2 py-1 text-xl text-muted hover:bg-canvas hover:text-ink"
        >
          ←
        </button>
        <h1 className="text-lg font-bold text-ink">Invite visitors</h1>
      </header>

      <div className="grid flex-1 gap-6 lg:grid-cols-2">
        {/* ------------------------- event details ------------------------- */}
        <div className="flex flex-col gap-4">
          <Input
            label="Event title"
            required
            value={eventTitle}
            error={titleValid ? null : 'Give the visit a title your guest will recognise.'}
            onChange={(event) => setEventTitle(event.target.value)}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Types of visit"
              required
              value={visitType}
              options={VISIT_TYPES.map((type) => ({ value: type, label: type }))}
              onChange={(event) => setVisitType(event.target.value as VisitType)}
            />
            <Select
              label="Office"
              required
              value={officeId}
              options={offices.map((office) => ({ value: office.id, label: office.name }))}
              onChange={(event) => setOfficeId(event.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Date"
              type="date"
              required
              value={day}
              onChange={(event) => setDay(event.target.value)}
            />
            <Input
              label="From"
              type="time"
              required
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
            />
            <Input
              label="To"
              type="time"
              required
              value={endTime}
              error={windowValid ? null : 'End time must be after the start time.'}
              onChange={(event) => setEndTime(event.target.value)}
            />
          </div>

          <Textarea
            label="Personal note to guests"
            counterMax={NOTE_MAX}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />

          {/* pre-approval */}
          <Card className="p-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={preApproved}
                onChange={(event) => setPreApproved(event.target.checked)}
                className="mt-1 size-4"
              />
              <span>
                <span className="block text-sm font-semibold text-ink">
                  Pre-approve these guests
                </span>
                <span className="block text-sm text-muted">
                  They receive a QR e-pass immediately and walk straight in during the time window
                  above, with no approval step on the day.
                </span>
              </span>
            </label>

            {preApproved && (
              <div className="mt-3 border-t border-line pt-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-muted">
                    Daily pre-approval quota for {day}
                  </span>
                  <span className={quotaRemaining === 0 ? 'font-bold text-danger' : 'text-muted'}>
                    {quotaUsed} of {policy.preApprovalLimitPerDay} used
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
                  <div
                    className={quotaRemaining === 0 ? 'h-full bg-danger' : 'h-full bg-brand'}
                    style={{
                      width: `${Math.min(100, (quotaUsed / policy.preApprovalLimitPerDay) * 100)}%`,
                    }}
                  />
                </div>
                {guestIds.length > quotaRemaining && (
                  <p className="mt-2 text-xs font-semibold text-danger">
                    You have selected {guestIds.length} guests but only {quotaRemaining} pre-approval
                    {quotaRemaining === 1 ? '' : 's'} remain for this date.
                  </p>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* ---------------------------- guests ----------------------------- */}
        <div>
          <GuestPicker
            selectedIds={guestIds}
            onAdd={(id) => setGuestIds((current) => [...current, id])}
            onRemove={(id) => setGuestIds((current) => current.filter((value) => value !== id))}
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
          {error}
        </p>
      )}

      <div className="sticky bottom-0 mt-6 border-t border-line bg-canvas py-4">
        <Button type="submit" variant="primary" block loading={busy} disabled={!canSubmit}>
          Confirm invite
          {guestIds.length > 0 && ` · ${guestIds.length} guest${guestIds.length > 1 ? 's' : ''}`}
        </Button>
        {!canSubmit && !busy && (
          <p className="mt-2 text-center text-xs text-muted">
            {guestIds.length === 0
              ? 'Add at least one guest to continue.'
              : 'Complete the highlighted fields to continue.'}
          </p>
        )}
      </div>
    </form>
  );
}

/* ---------------------------- confirmation ---------------------------- */

function InviteConfirmation({ visitIds, onDone }: { visitIds: string[]; onDone: () => void }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-xl font-bold text-ink">
        {visitIds.length} invitation{visitIds.length > 1 ? 's' : ''} sent
      </h1>
      <p className="mt-1 text-sm text-muted">
        In production these passes would go out by email and SMS. Here they are — the front desk can
        scan or type the code to check each guest in.
      </p>

      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {visitIds.map((id) => {
          const visit = visitIndex.visits.get(id);
          const visitor = visit ? visitIndex.visitors.get(visit.visitorId) : undefined;
          if (!visit) return null;

          return (
            <li key={id}>
              <Card className="p-4">
                <p className="text-sm font-bold text-ink">{visitor?.fullName}</p>
                <p className="mb-3 text-xs text-muted">{visitor?.email}</p>
                {visit.passCode ? (
                  <PassQr code={visit.passCode} size={120} />
                ) : (
                  <p className="text-sm text-muted">
                    Awaiting your approval on the day — no pass issued yet.
                  </p>
                )}
              </Card>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex gap-2">
        <Button variant="primary" onClick={onDone}>
          Invite more visitors
        </Button>
        <Button variant="secondary" onClick={() => window.print()}>
          Print passes
        </Button>
      </div>
    </div>
  );
}
