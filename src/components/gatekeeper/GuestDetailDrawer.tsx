import { addMinutes, parseISO } from 'date-fns'
import { Ban, Building2, Camera, Check, CircleAlert, LogIn, LogOut, type LucideIcon, Mail, Phone, QrCode } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { RejectVisitorModal } from '@/components/host/RejectVisitorModal'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/Sheet'
import { VisitorStatusBadge } from '@/components/visitor/VisitorStatusBadge'
import { describeSource } from '@/components/visitor/presentation'
import { EMPLOYEE_DIRECTORY } from '@/data/mockData'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useNow } from '@/hooks/useNow'
import { approveAndNotify, checkInAndNotify, checkOutAndNotify } from '@/lib/feedback'
import { formatDateTime, formatTime, formatTimeWithDay, formatWindow } from '@/lib/format'
import { can } from '@/lib/rbac'
import { cn } from '@/lib/utils'
import { VISITOR_TYPE_LABELS, isOnSite } from '@/lib/visitorRules'
import { useVisitor } from '@/store/hooks'
import { useUiStore } from '@/store/useUiStore'
import { useVmsStore } from '@/store/useVmsStore'
import type { IsoDateTime, VisitorRecord } from '@/types/vms'

/**
 * Slide-over with everything about one visit. Opened from any table row, the bell or
 * a host list through the UI store. It docks right on desktop and becomes a bottom
 * sheet below 1024 px, as the design specifies for tablets.
 */
export function GuestDetailDrawer() {
  const detailVisitorId = useUiStore((state) => state.detailVisitorId)
  const closeDetails = useUiStore((state) => state.closeDetails)
  const visitor = useVisitor(detailVisitorId)
  const desktop = useMediaQuery('(min-width: 1024px)')
  // Keep rendering the last visitor while the sheet animates closed.
  const [shown, setShown] = useState(visitor)
  if (visitor && visitor !== shown) setShown(visitor)
  const display = visitor ?? shown

  return (
    <Sheet open={Boolean(visitor)} onOpenChange={(open) => !open && closeDetails()}>
      <SheetContent side={desktop ? 'right' : 'bottom'}>{display && <VisitorProfile key={display.id} visitor={display} />}</SheetContent>
    </Sheet>
  )
}

function VisitorProfile({ visitor }: { visitor: VisitorRecord }) {
  const now = useNow()
  const graceMinutes = useVmsStore((state) => state.settings.autoOverstayThresholdMinutes)
  const rejectedAt = useVmsStore((state) =>
    visitor.status === 'REJECTED'
      ? (state.auditLog.find((entry) => entry.visitorId === visitor.id && entry.action === 'REJECTED')?.at ?? null)
      : null,
  )
  const openPass = useUiStore((state) => state.openPass)
  const host = EMPLOYEE_DIRECTORY.find((employee) => employee.id === visitor.hostEmployeeId)

  return (
    <>
      <SheetHeader>
        <div className="flex flex-wrap items-center gap-2">
          <VisitorStatusBadge visitor={visitor} now={now} />
          <span className="eyebrow">{describeSource(visitor)}</span>
        </div>
        <SheetTitle className="mt-1.5">{visitor.fullName}</SheetTitle>
        <SheetDescription>{[visitor.company, VISITOR_TYPE_LABELS[visitor.visitorType]].filter(Boolean).join(' · ')}</SheetDescription>
      </SheetHeader>

      <SheetBody className="flex flex-col gap-6">
        <div className="flex gap-4">
          {visitor.photoUrl ? (
            <img
              src={visitor.photoUrl}
              alt={`Photo of ${visitor.fullName}`}
              className="size-24 shrink-0 rounded-lg border border-border object-cover"
            />
          ) : (
            <div className="flex size-24 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-muted text-center">
              <Camera className="size-5 text-muted-foreground" aria-hidden />
              <span className="px-2 text-body-sm text-muted-foreground">Photo at check-in</span>
            </div>
          )}
          <dl className="flex min-w-0 flex-col justify-center gap-2">
            <ContactRow icon={Phone} label="Phone" value={visitor.phone} href={`tel:${visitor.phone.replace(/\s/g, '')}`} />
            <ContactRow icon={Mail} label="Email" value={visitor.email} href={`mailto:${visitor.email}`} />
            <ContactRow icon={Building2} label="Office" value={visitor.office} />
          </dl>
        </div>

        <section aria-label="Host" className="flex items-center gap-3 rounded-lg border border-border p-3">
          <Avatar name={visitor.hostEmployeeName} src={host?.avatar} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Host employee</p>
            <p className="truncate text-body-md font-medium text-foreground">{visitor.hostEmployeeName}</p>
            <p className="truncate text-body-sm text-muted-foreground">
              {visitor.hostDepartment}
              {host ? ` · ${host.email}` : ''}
            </p>
          </div>
        </section>

        <Timeline events={buildTimeline(visitor, graceMinutes, rejectedAt)} now={now} />

        <section aria-labelledby="visit-metadata">
          <h3 id="visit-metadata" className="eyebrow mb-3">
            Credentials & assignment
          </h3>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border">
            <Metadata label="Company name" value={visitor.company || 'Independent visitor'} />
            <Metadata label="Role" value={VISITOR_TYPE_LABELS[visitor.visitorType]} />
            <Metadata label="Temp card no." value={visitor.tempCardNumber ?? 'Not issued'} mono />
            <Metadata label="Pass ID" value={visitor.qrCodePlaceholder.slice(0, 8).toUpperCase()} mono />
            <Metadata label="Approved window" value={formatWindow(visitor.timeWindowStart, visitor.timeWindowEnd)} wide />
            <Metadata label="Purpose" value={visitor.purpose} wide />
          </dl>
        </section>

        {visitor.personalNote && <Note title="Note to guest">{visitor.personalNote}</Note>}
        {visitor.rejectionReason && (
          <Note title="Rejection reason" danger>
            {visitor.rejectionReason}
          </Note>
        )}
      </SheetBody>

      <SheetFooter>
        <ProfileActions visitor={visitor} />
        <Button variant="outline" onClick={() => openPass(visitor.id)}>
          <QrCode /> View digital pass
        </Button>
      </SheetFooter>
    </>
  )
}

/** The main action for this visit, given the viewer's role and the visit's status. */
function ProfileActions({ visitor }: { visitor: VisitorRecord }) {
  const user = useVmsStore((state) => state.currentUser)
  const [rejecting, setRejecting] = useState(false)
  const isTheirHost = user.role === 'HOST_EMPLOYEE' && visitor.hostEmployeeId === user.id
  const rejectModal = <RejectVisitorModal visitor={rejecting ? visitor : null} onClose={() => setRejecting(false)} />

  if (isOnSite(visitor) && can(user.role, 'visitor:check-out')) return <CheckOutAction visitor={visitor} />

  if (visitor.status === 'PRE_APPROVED' && can(user.role, 'visitor:check-in')) {
    return (
      <Button onClick={() => checkInAndNotify(visitor)}>
        <LogIn /> Check in visitor
      </Button>
    )
  }

  if (visitor.status === 'PENDING_APPROVAL' && isTheirHost) {
    return (
      <>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => approveAndNotify(visitor)}>
            <Check /> Approve
          </Button>
          <Button variant="destructive" className="flex-1" onClick={() => setRejecting(true)}>
            <Ban /> Reject
          </Button>
        </div>
        {rejectModal}
      </>
    )
  }

  if (visitor.status === 'PRE_APPROVED' && isTheirHost) {
    return (
      <>
        <Button variant="destructive" onClick={() => setRejecting(true)}>
          <Ban /> Revoke pre-approval
        </Button>
        {rejectModal}
      </>
    )
  }

  if (visitor.status === 'PENDING_APPROVAL') {
    return <StatusNote tone="warning">Waiting for {visitor.hostEmployeeName} to approve. Don't admit the visitor yet.</StatusNote>
  }
  if (visitor.status === 'REJECTED') {
    return <StatusNote tone="danger">Entry denied by {visitor.hostEmployeeName}. Do not admit this visitor.</StatusNote>
  }
  return null
}

/** Two-step check-out: the first click asks the guard to collect the temp card, the second confirms. */
function CheckOutAction({ visitor }: { visitor: VisitorRecord }) {
  const [confirming, setConfirming] = useState(false)

  if (!confirming) {
    return (
      <Button onClick={() => setConfirming(true)}>
        <LogOut /> Check-out visitor
      </Button>
    )
  }

  return (
    <div className="flex animate-fade-in flex-col gap-2.5 rounded-md border border-warning-border bg-warning-subtle p-3">
      <p className="text-body-sm text-warning-strong">
        Collect temporary card <span className="font-mono font-medium">{visitor.tempCardNumber ?? '(none issued)'}</span> from{' '}
        {visitor.fullName} before confirming.
      </p>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
        <Button autoFocus className="flex-1" onClick={() => checkOutAndNotify(visitor) && setConfirming(false)}>
          <LogOut /> Confirm check-out
        </Button>
      </div>
    </div>
  )
}

interface TimelineEvent {
  label: string
  at: IsoDateTime | null
  tone: 'done' | 'alert' | 'upcoming'
  detail?: string
}

/** The visit's history from its own timestamps, plus what happens next. */
function buildTimeline(visitor: VisitorRecord, graceMinutes: number, rejectedAt: IsoDateTime | null): TimelineEvent[] {
  const events: TimelineEvent[] = []
  const registered =
    visitor.source === 'PRE_APPROVAL'
      ? `Pre-approved by ${visitor.hostEmployeeName}`
      : visitor.source === 'SELF_SERVICE'
        ? 'Requested at the self-service kiosk'
        : 'Registered at the front desk'
  events.push({ label: registered, at: visitor.createdAt, tone: 'done' })

  if (visitor.approvedAt && visitor.source !== 'PRE_APPROVAL') {
    events.push({ label: `Approved by ${visitor.hostEmployeeName}`, at: visitor.approvedAt, tone: 'done', detail: 'Digital pass issued' })
  }
  if (visitor.status === 'REJECTED') {
    events.push({ label: `Rejected by ${visitor.hostEmployeeName}`, at: rejectedAt, tone: 'alert' })
  }
  if (visitor.status === 'EXPIRED') {
    events.push({ label: 'Pass expired', at: visitor.timeWindowEnd, tone: 'alert', detail: 'No check-in during the approved window' })
  }
  if (visitor.actualCheckInTime) {
    events.push({
      label: 'Checked in',
      at: visitor.actualCheckInTime,
      tone: 'done',
      detail: visitor.tempCardNumber ? `Temp card ${visitor.tempCardNumber} issued` : undefined,
    })
  }

  const flaggedAt = addMinutes(parseISO(visitor.timeWindowEnd), graceMinutes).toISOString()
  const leftLate = visitor.actualCheckOutTime !== null && visitor.actualCheckOutTime > flaggedAt
  if (visitor.status === 'OVERSTAY' || leftLate) {
    events.push({ label: 'Overstay flagged', at: flaggedAt, tone: 'alert', detail: `Window ended at ${formatTime(visitor.timeWindowEnd)}` })
  }

  if (visitor.actualCheckOutTime) {
    events.push({ label: 'Checked out', at: visitor.actualCheckOutTime, tone: 'done' })
  } else if (isOnSite(visitor)) {
    events.push({ label: 'Expected check-out', at: visitor.timeWindowEnd, tone: 'upcoming' })
  } else if (visitor.status === 'PRE_APPROVED' || visitor.status === 'PENDING_APPROVAL') {
    events.push({ label: 'Arrival window opens', at: visitor.timeWindowStart, tone: 'upcoming', detail: formatWindow(visitor.timeWindowStart, visitor.timeWindowEnd) })
  }
  return events
}

const DOT_TONES: Record<TimelineEvent['tone'], string> = {
  done: 'bg-success-dot',
  alert: 'bg-danger-dot',
  upcoming: 'border-2 border-border-strong bg-surface',
}

function Timeline({ events, now }: { events: TimelineEvent[]; now: Date }) {
  return (
    <section aria-labelledby="visit-timeline">
      <h3 id="visit-timeline" className="eyebrow mb-3">
        Visit timeline
      </h3>
      <ol className="flex flex-col gap-4 border-l border-border pl-5">
        {events.map((event) => (
          <li key={event.label} className="relative">
            <span aria-hidden className={cn('absolute top-1.5 -left-[25.5px] size-2.5 rounded-full ring-4 ring-surface', DOT_TONES[event.tone])} />
            <div className="flex items-baseline justify-between gap-3">
              <p
                className={cn(
                  'text-body-md font-medium',
                  event.tone === 'alert' ? 'text-danger-strong' : event.tone === 'upcoming' ? 'text-muted-foreground' : 'text-foreground',
                )}
              >
                {event.label}
              </p>
              {event.at && (
                <time dateTime={event.at} title={formatDateTime(event.at)} className="shrink-0 font-mono text-mono-code text-muted-foreground">
                  {formatTimeWithDay(event.at, now)}
                </time>
              )}
            </div>
            {event.detail && <p className="text-body-sm text-muted-foreground">{event.detail}</p>}
          </li>
        ))}
      </ol>
    </section>
  )
}

function ContactRow({ icon: Icon, label, value, href }: { icon: LucideIcon; label: string; value: string; href?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-body-md">
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <dt className="sr-only">{label}</dt>
      <dd className="min-w-0 truncate">
        {!value ? (
          <span className="text-muted-foreground">Not provided</span>
        ) : href ? (
          <a href={href} className="text-foreground hover:underline">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  )
}

function Metadata({ label, value, mono = false, wide = false }: { label: string; value: string; mono?: boolean; wide?: boolean }) {
  return (
    <div className={cn('bg-surface p-3', wide && 'col-span-2')}>
      <dt className="eyebrow">{label}</dt>
      <dd className={cn('mt-1 text-body-md text-foreground', mono && 'font-mono text-mono-code')}>{value}</dd>
    </div>
  )
}

function Note({ title, danger = false, children }: { title: string; danger?: boolean; children: ReactNode }) {
  return (
    <section className={cn('rounded-lg border p-3', danger ? 'border-danger-border bg-danger-subtle' : 'border-border bg-background')}>
      <h3 className={cn('eyebrow mb-1', danger && 'text-danger-strong')}>{title}</h3>
      <p className={cn('text-body-md', danger ? 'text-danger-strong' : 'text-foreground')}>{children}</p>
    </section>
  )
}

function StatusNote({ tone, children }: { tone: 'warning' | 'danger'; children: ReactNode }) {
  return (
    <p
      role="status"
      className={cn(
        'flex items-start gap-2 rounded-md border px-3 py-2.5 text-body-sm',
        tone === 'warning' ? 'border-warning-border bg-warning-subtle text-warning-strong' : 'border-danger-border bg-danger-subtle text-danger-strong',
      )}
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      {children}
    </p>
  )
}
