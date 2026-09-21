/**
 * Walk-in registration at the front desk.
 *
 * This is the spec's registration flow: the guard collects the visitor's
 * details and photo, the system sends the host an approval request, and the
 * visitor waits. The "waiting" panel below is live - when the host approves in
 * another tab, it flips to the issued pass without a refresh.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, visitIndex } from '@/app/store';
import { VISIT_TYPES } from '@/domain/types';
import type { VisitType } from '@/domain/types';
import { Button, Card, Input, Select } from '@/shared/ui/primitives';
import { useForm } from '@/shared/hooks/useForm';
import { email as emailRule, phone as phoneRule, required } from '@/domain/validators';
import { PhotoCapture } from './PhotoCapture';
import { HostPicker } from './pickers';
import { toUserMessage } from '@/domain/errors';
import { StatusBadge } from './status';
import { PassQr } from '@/features/invites/PassQr';

const DURATIONS = [
  { value: '30', label: '30 minutes' },
  { value: '60', label: '1 hour' },
  { value: '120', label: '2 hours' },
  { value: '240', label: '4 hours' },
  { value: '480', label: 'Full day' },
];

export function WalkInPage() {
  const createWalkIn = useStore((state) => state.createWalkIn);
  const offices = useStore((state) => state.offices);
  const dataVersion = useStore((state) => state.dataVersion);
  const navigate = useNavigate();

  const form = useForm(
    {
      fullName: '',
      phone: '',
      email: '',
      company: '',
      purpose: '',
      visitType: 'Business Guests',
      duration: '60',
      officeId: 'off-1',
    },
    {
      fullName: [required('Full name')],
      phone: [phoneRule],
      email: [emailRule],
      company: [required('Company')],
      purpose: [required('Purpose of visit')],
    },
  );

  const [hostId, setHostId] = useState('');
  const [photo, setPhoto] = useState<string | undefined>();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [createdVisitId, setCreatedVisitId] = useState<string | null>(null);

  // Read through dataVersion so the panel re-renders when the host responds.
  void dataVersion;
  const createdVisit = createdVisitId ? visitIndex.visits.get(createdVisitId) : undefined;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError(null);

    const fieldsValid = form.validateAll();
    if (!hostId) setSubmitError('Choose the employee this visitor is here to see.');
    if (!photo) setSubmitError('A photo is required before the visitor can be registered.');
    if (!fieldsValid || !hostId || !photo) return;

    setBusy(true);
    try {
      const visitId = await createWalkIn({
        fullName: form.values.fullName,
        phone: form.values.phone,
        email: form.values.email,
        company: form.values.company,
        purpose: form.values.purpose,
        visitType: form.values.visitType as VisitType,
        hostId,
        officeId: form.values.officeId,
        photoDataUrl: photo,
        durationMinutes: Number(form.values.duration),
      });
      setCreatedVisitId(visitId);
    } catch (error) {
      setSubmitError(toUserMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    form.reset();
    setHostId('');
    setPhoto(undefined);
    setCreatedVisitId(null);
    setSubmitError(null);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <header className="mb-5 flex items-center gap-3">
        <button
          onClick={() => navigate('/frontdesk')}
          aria-label="Back to visitors"
          className="rounded-lg px-2 py-1 text-xl text-muted hover:bg-canvas hover:text-ink"
        >
          ←
        </button>
        <h1 className="text-lg font-bold text-ink">Register walk-in visitor</h1>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-5">
          <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Full name"
                required
                value={form.values.fullName}
                error={form.errorFor('fullName')}
                onChange={(e) => form.setValue('fullName', e.target.value)}
                onBlur={() => form.blur('fullName')}
              />
              <Input
                label="Mobile number"
                required
                inputMode="tel"
                value={form.values.phone}
                error={form.errorFor('phone')}
                hint="Used to find returning visitors"
                onChange={(e) => form.setValue('phone', e.target.value)}
                onBlur={() => form.blur('phone')}
              />
              <Input
                label="Email"
                type="email"
                value={form.values.email}
                error={form.errorFor('email')}
                onChange={(e) => form.setValue('email', e.target.value)}
                onBlur={() => form.blur('email')}
              />
              <Input
                label="Company / organisation"
                required
                value={form.values.company}
                error={form.errorFor('company')}
                onChange={(e) => form.setValue('company', e.target.value)}
                onBlur={() => form.blur('company')}
              />
            </div>

            <Input
              label="Purpose of visit"
              required
              placeholder="e.g. Quarterly review with the finance team"
              value={form.values.purpose}
              error={form.errorFor('purpose')}
              onChange={(e) => form.setValue('purpose', e.target.value)}
              onBlur={() => form.blur('purpose')}
            />

            <div className="grid gap-4 sm:grid-cols-3">
              <Select
                label="Type of visit"
                required
                value={form.values.visitType}
                options={VISIT_TYPES.map((type) => ({ value: type, label: type }))}
                onChange={(e) => form.setValue('visitType', e.target.value)}
              />
              <Select
                label="Office"
                required
                value={form.values.officeId}
                options={offices.map((office) => ({ value: office.id, label: office.name }))}
                onChange={(e) => form.setValue('officeId', e.target.value)}
              />
              <Select
                label="Expected duration"
                value={form.values.duration}
                options={DURATIONS}
                onChange={(e) => form.setValue('duration', e.target.value)}
              />
            </div>

            <HostPicker value={hostId} onChange={setHostId} />

            <PhotoCapture value={photo} onChange={setPhoto} />

            {submitError && (
              <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
                {submitError}
              </p>
            )}

            <div className="flex gap-2">
              <Button type="submit" variant="primary" loading={busy}>
                Send approval request
              </Button>
              <Button type="button" variant="ghost" onClick={reset}>
                Clear form
              </Button>
            </div>
          </form>
        </Card>

        <Card className="h-fit p-5">
          <h2 className="text-sm font-bold text-ink">Status</h2>

          {!createdVisit ? (
            <p className="mt-2 text-sm text-muted">
              Fill in the visitor's details and take their photo. The host is notified the moment you
              submit, and their decision appears here.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="flex items-center gap-2">
                <StatusBadge visit={createdVisit} />
                <span className="text-sm text-muted">
                  {visitIndex.employees.get(createdVisit.hostId)?.name}
                </span>
              </div>

              {createdVisit.status === 'PENDING_APPROVAL' && (
                <p className="text-sm text-muted">
                  Waiting for the host to respond. Ask the visitor to take a seat — this panel
                  updates automatically.
                </p>
              )}

              {createdVisit.status === 'APPROVED' && createdVisit.passCode && (
                <>
                  <p className="text-sm font-medium text-ok">
                    Approved. Print the badge or show this pass at the gate.
                  </p>
                  <PassQr code={createdVisit.passCode} />
                  <Button variant="secondary" block onClick={() => window.print()}>
                    Print badge
                  </Button>
                </>
              )}

              {createdVisit.status === 'REJECTED' && (
                <div className="rounded-lg bg-danger-soft px-3 py-2">
                  <p className="text-sm font-bold text-danger">Entry denied</p>
                  <p className="text-sm text-danger">
                    {createdVisit.rejectionReason ?? 'The host declined this visit.'}
                  </p>
                  <p className="mt-1 text-xs text-danger">
                    Security has been notified. Do not issue a badge.
                  </p>
                </div>
              )}

              <Button variant="ghost" block onClick={reset}>
                Register another visitor
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
