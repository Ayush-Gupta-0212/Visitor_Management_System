import { addDays, addMinutes, format, getHours, isSameDay, roundToNearestMinutes } from 'date-fns'
import { Gauge, Send } from 'lucide-react'
import { type FormEvent, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Modal, ModalBody, ModalClose, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from '@/components/ui/Modal'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { OFFICES } from '@/data/mockData'
import { notifyError } from '@/lib/feedback'
import { formatDay, formatWindow, toIsoDate } from '@/lib/format'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { type FieldErrors, VISITOR_TYPE_LABELS, countApprovalsForDay, validateWindow } from '@/lib/visitorRules'
import { useUiStore } from '@/store/useUiStore'
import { useVmsStore } from '@/store/useVmsStore'
import type { IsoDateTime, VisitorRecord, VisitorType } from '@/types/vms'
import { type GuestDraft, GuestChipInput } from './GuestChipInput'

/** A sensible first slot: the next half hour today, or 10–11 AM tomorrow when it's late. */
function defaultSchedule(now: Date) {
  const start = roundToNearestMinutes(addMinutes(now, 15), { nearestTo: 30, roundingMethod: 'ceil' })
  const slot = isSameDay(start, now) && getHours(start) < 19 ? start : addMinutes(addDays(new Date(now.toDateString()), 1), 10 * 60)
  return { date: toIsoDate(slot), start: format(slot, 'HH:mm'), end: format(addMinutes(slot, 60), 'HH:mm') }
}

/** Date plus from/to times as ISO instants. An end at or before the start means the next day. */
function composeWindow(date: string, start: string, end: string): { start: IsoDateTime; end: IsoDateTime; overnight: boolean } | null {
  if (!date || !start || !end) return null
  const startsAt = new Date(`${date}T${start}`)
  let endsAt = new Date(`${date}T${end}`)
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return null
  const overnight = endsAt.getTime() <= startsAt.getTime()
  if (overnight) endsAt = addDays(endsAt, 1)
  return { start: startsAt.toISOString(), end: endsAt.toISOString(), overnight }
}

/** The host's "Invite Visitors" form, after the reference screen. Opened through the UI store (`openInvite`). */
export function InviteVisitorModal() {
  const open = useUiStore((state) => state.inviteOpen)
  const session = useUiStore((state) => state.inviteSession)
  const closeInvite = useUiStore((state) => state.closeInvite)

  return (
    <Modal open={open} onOpenChange={(next) => !next && closeInvite()}>
      <ModalContent size="xl">
        <InviteForm key={session} onDone={closeInvite} />
      </ModalContent>
    </Modal>
  )
}

function InviteForm({ onDone }: { onDone: () => void }) {
  const user = useVmsStore((state) => state.currentUser)
  const visitors = useVmsStore((state) => state.visitors)
  const limit = useVmsStore((state) => state.settings.maxPreApprovalsPerEmployeePerDay)
  const openPass = useUiStore((state) => state.openPass)
  const defaults = useMemo(() => defaultSchedule(new Date()), [])
  const formRef = useRef<HTMLFormElement>(null)

  const [title, setTitle] = useState('')
  const [visitorType, setVisitorType] = useState<VisitorType>('BUSINESS_GUEST')
  const [office, setOffice] = useState<string>(OFFICES[0])
  const [date, setDate] = useState(defaults.date)
  const [start, setStart] = useState(defaults.start)
  const [end, setEnd] = useState(defaults.end)
  const [note, setNote] = useState('')
  const [guests, setGuests] = useState<GuestDraft[]>([])
  const [errors, setErrors] = useState<FieldErrors>({})

  const visitWindow = composeWindow(date, start, end)
  // Quota: approvals already used on the chosen day, via the O(K) host/day index.
  const used = date ? countApprovalsForDay(visitors, user.id, date) : 0
  const remaining = Math.max(0, limit - used)
  const overQuota = guests.length > remaining

  const clear = (...keys: string[]) =>
    setErrors((current) => {
      if (!keys.some((key) => key in current)) return current
      const next = { ...current }
      for (const key of keys) delete next[key]
      return next
    })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const problems: FieldErrors = {}
    const trimmedTitle = title.trim()
    if (trimmedTitle.length < 3) problems.title = 'Give the visit a title, e.g. "Quarterly business review".'
    else if (trimmedTitle.length > 200) problems.title = 'Keep the title under 200 characters.'
    if (!visitWindow) problems.timeWindowStart = 'Choose a date and a start and end time.'
    else Object.assign(problems, validateWindow(visitWindow.start, visitWindow.end, new Date()))
    if (guests.length === 0) problems.guests = 'Add at least one guest.'
    if (note.trim().length > 1000) problems.personalNote = 'Keep the note under 1,000 characters.'

    if (Object.keys(problems).length > 0 || !visitWindow) {
      flushSync(() => setErrors(problems))
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      return
    }
    if (overQuota) return // the inline warning already explains why

    const store = useVmsStore.getState()
    const issued: VisitorRecord[] = []
    for (const guest of guests) {
      const result = store.createPreApproval({
        fullName: guest.fullName,
        email: guest.email,
        phone: guest.phone,
        company: guest.company,
        purpose: trimmedTitle,
        visitorType,
        office,
        personalNote: note,
        timeWindowStart: visitWindow.start,
        timeWindowEnd: visitWindow.end,
      })
      if (!result.ok) {
        notifyError(result.error)
        break
      }
      issued.push(result.data)
    }

    if (issued.length > 0) {
      const first = issued[0]
      toast.success(issued.length === 1 ? `Pass issued for ${first.fullName}` : `${issued.length} passes issued`, {
        description: `${formatDay(first.expectedDate)}, ${formatWindow(first.timeWindowStart, first.timeWindowEnd)} at ${office}. Guests get their e-pass by email or SMS.`,
        action: { label: 'View pass', onClick: () => openPass(first.id) },
      })
    }
    if (issued.length === guests.length) onDone()
    else setGuests((current) => current.slice(issued.length))
  }

  return (
    <form ref={formRef} noValidate onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <ModalHeader>
        <ModalTitle>Invite visitors</ModalTitle>
        <ModalDescription>Pre-approve guests for a date and time window. Each guest gets a digital pass with a QR code.</ModalDescription>
      </ModalHeader>

      <ModalBody className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Field id="invite-title" label="Event title" required error={errors.title}>
            {(control) => (
              <Input
                {...control}
                autoFocus
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value)
                  clear('title')
                }}
                placeholder="e.g. Quarterly business review"
              />
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="invite-type" label="Type of visit" required>
              {(control) => (
                <Select value={visitorType} onValueChange={(value) => setVisitorType(value as VisitorType)}>
                  <SelectTrigger {...control}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(VISITOR_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
            <Field id="invite-office" label="Office location" required>
              {(control) => (
                <Select value={office} onValueChange={setOffice}>
                  <SelectTrigger {...control}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OFFICES.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1.2fr_1fr_1fr]">
            <Field id="invite-date" label="Date" required error={errors.timeWindowStart}>
              {(control) => (
                <Input
                  {...control}
                  type="date"
                  value={date}
                  min={toIsoDate(new Date())}
                  onChange={(event) => {
                    setDate(event.target.value)
                    clear('timeWindowStart', 'timeWindowEnd')
                  }}
                  className="font-mono text-mono-code"
                />
              )}
            </Field>
            <Field id="invite-start" label="From" required>
              {(control) => (
                <Input
                  {...control}
                  type="time"
                  step={900}
                  value={start}
                  aria-invalid={errors.timeWindowStart ? true : undefined}
                  onChange={(event) => {
                    setStart(event.target.value)
                    clear('timeWindowStart', 'timeWindowEnd')
                  }}
                  className="font-mono text-mono-code"
                />
              )}
            </Field>
            <Field id="invite-end" label="To" required error={errors.timeWindowEnd}>
              {(control) => (
                <Input
                  {...control}
                  type="time"
                  step={900}
                  value={end}
                  onChange={(event) => {
                    setEnd(event.target.value)
                    clear('timeWindowEnd')
                  }}
                  className="font-mono text-mono-code"
                />
              )}
            </Field>
          </div>
          {visitWindow?.overnight && (
            <p className="-mt-2 text-body-sm text-muted-foreground">Ends the next day, {formatDay(visitWindow.end)}.</p>
          )}
          <Field
            id="invite-note"
            label="Personal note to guests"
            error={errors.personalNote}
            aside={<span className="font-mono text-mono-code text-muted-foreground tabular-nums">{note.length}/1000</span>}
          >
            {(control) => (
              <Textarea
                {...control}
                value={note}
                maxLength={1000}
                onChange={(event) => {
                  setNote(event.target.value)
                  clear('personalNote')
                }}
                placeholder="e.g. Please report at the front desk with a photo ID."
              />
            )}
          </Field>
        </div>

        <div className="flex flex-col gap-3">
          <Field id="invite-guests" label="Guests" required error={errors.guests} hint="Search your past guests, or add someone new.">
            {(control) => (
              <GuestChipInput
                {...control}
                guests={guests}
                onChange={(next) => {
                  setGuests(next)
                  clear('guests')
                }}
              />
            )}
          </Field>
          <QuotaNotice used={used} limit={limit} requested={guests.length} day={date} />
        </div>
      </ModalBody>

      <ModalFooter>
        <ModalClose asChild>
          <Button variant="outline">Cancel</Button>
        </ModalClose>
        <Button type="submit" disabled={overQuota}>
          <Send /> {guests.length > 1 ? `Confirm & send ${guests.length} invites` : 'Confirm invite'}
        </Button>
      </ModalFooter>
    </form>
  )
}

interface QuotaNoticeProps {
  used: number
  limit: number
  requested: number
  day: string
}

/** Inline quota check: how many approvals are left on the chosen day, and a blocking warning when the invite exceeds them. */
function QuotaNotice({ used, limit, requested, day }: QuotaNoticeProps) {
  if (!day) return null
  const remaining = Math.max(0, limit - used)
  const over = requested > remaining

  return (
    <div
      role={over ? 'alert' : undefined}
      className={cn(
        'flex items-start gap-2 rounded-md border px-3 py-2.5 text-body-sm',
        over ? 'border-danger-border bg-danger-subtle text-danger-strong' : 'border-border bg-background text-muted-foreground',
      )}
    >
      <Gauge className="mt-0.5 size-4 shrink-0" aria-hidden />
      {over ? (
        <p>
          <span className="font-medium">Daily pre-approval quota exceeded.</span> You can approve {remaining} more{' '}
          {remaining === 1 ? 'visitor' : 'visitors'} for {formatDay(day)} (limit {limit}). Remove {requested - remaining}{' '}
          {requested - remaining === 1 ? 'guest' : 'guests'} or choose another date.
        </p>
      ) : (
        <p>
          {remaining} of {limit} approvals left for {formatDay(day)}
          {requested > 0 ? `; this invite uses ${requested}.` : '.'}
        </p>
      )}
    </div>
  )
}
