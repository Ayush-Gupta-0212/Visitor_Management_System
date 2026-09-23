import { format, getHours, parseISO } from 'date-fns'
import { Ban, CalendarPlus, Check, CircleCheck, DoorOpen, QrCode, UserPlus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Panel } from '@/components/shared/Panel'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { VisitorStatusBadge } from '@/components/visitor/VisitorStatusBadge'
import { describeSource } from '@/components/visitor/presentation'
import { useNow } from '@/hooks/useNow'
import { approveAndNotify } from '@/lib/feedback'
import { formatRelative, formatTimeWithDay, formatWindow, toIsoDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { VISITOR_TYPE_LABELS, countApprovalsForDay, isOnSite, sortForDesk } from '@/lib/visitorRules'
import { usePendingRequests } from '@/store/hooks'
import { useUiStore } from '@/store/useUiStore'
import { useVmsStore } from '@/store/useVmsStore'
import type { VisitorRecord } from '@/types/vms'
import { InviteVisitorModal } from './InviteVisitorModal'
import { RejectVisitorModal } from './RejectVisitorModal'

const greeting = (now: Date) => {
  const hour = getHours(now)
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
}

/** Host workspace: approve live requests, schedule guests, and keep an eye on the day's quota. */
export function HostDashboard() {
  const user = useVmsStore((state) => state.currentUser)
  const visitors = useVmsStore((state) => state.visitors)
  const limit = useVmsStore((state) => state.settings.maxPreApprovalsPerEmployeePerDay)
  const openInvite = useUiStore((state) => state.openInvite)
  const pending = usePendingRequests()
  const now = useNow()
  const [rejecting, setRejecting] = useState<VisitorRecord | null>(null)

  const mine = useMemo(() => visitors.filter((visitor) => visitor.hostEmployeeId === user.id), [visitors, user.id])
  const upcoming = useMemo(
    () => mine.filter((visitor) => visitor.status === 'PRE_APPROVED').sort((a, b) => a.timeWindowStart.localeCompare(b.timeWindowStart)),
    [mine],
  )
  const onSite = useMemo(() => sortForDesk(mine.filter(isOnSite)), [mine])
  const usedToday = countApprovalsForDay(visitors, user.id, toIsoDate(now))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${greeting(now)}, ${user.name.split(' ')[0]}`}
        badge={<Badge shape="tag">{user.department}</Badge>}
        description="Approve visitor requests and schedule guests in advance. Approved guests receive a digital pass."
        actions={
          <Button onClick={openInvite}>
            <UserPlus /> Invite visitors
          </Button>
        }
      />

      <PendingApprovals pending={pending} now={now} onReject={setRejecting} />

      <div className="grid gap-6 lg:grid-cols-3">
        <UpcomingVisitors visitors={upcoming} onRevoke={setRejecting} onInvite={openInvite} className="lg:col-span-2" />
        <div className="flex flex-col gap-6">
          <QuotaCard used={usedToday} limit={limit} />
          <OnSiteNow visitors={onSite} now={now} />
        </div>
      </div>

      <InviteVisitorModal />
      <RejectVisitorModal visitor={rejecting} onClose={() => setRejecting(null)} />
    </div>
  )
}

interface PendingApprovalsProps {
  pending: VisitorRecord[]
  now: Date
  onReject: (visitor: VisitorRecord) => void
}

/** Alert banner listing this host's live requests, with one-click approve or reject. */
function PendingApprovals({ pending, now, onReject }: PendingApprovalsProps) {
  const openDetails = useUiStore((state) => state.openDetails)

  if (pending.length === 0) {
    return (
      <div className="flex animate-fade-in items-center gap-3 rounded-lg border border-success-border bg-success-subtle px-4 py-3">
        <CircleCheck className="size-5 shrink-0 text-success" aria-hidden />
        <div>
          <p className="text-body-md font-medium text-success-strong">You're all caught up</p>
          <p className="text-body-sm text-success-strong">No visitors are waiting for your approval.</p>
        </div>
      </div>
    )
  }

  return (
    <section aria-labelledby="pending-approvals" className="animate-fade-in overflow-hidden rounded-lg border border-warning-border bg-warning-subtle">
      <header className="flex items-center gap-2.5 px-4 py-3">
        <span className="relative flex size-2" aria-hidden>
          <span className="absolute inset-0 animate-ping rounded-full bg-warning-dot opacity-75" />
          <span className="relative size-2 rounded-full bg-warning-dot" />
        </span>
        <h2 id="pending-approvals" className="text-body-md font-medium text-warning-strong">
          {pending.length} {pending.length === 1 ? 'visitor is' : 'visitors are'} waiting for your approval
        </h2>
      </header>
      <ul className="divide-y divide-muted border-t border-warning-border bg-surface">
        {pending.map((visitor, index) => (
          <li
            key={visitor.id}
            className="flex animate-row-in flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center"
            style={{ animationDelay: `${index * 30}ms` }}
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar name={visitor.fullName} src={visitor.photoUrl} size="lg" />
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => openDetails(visitor.id)}
                  className="max-w-full truncate rounded-sm text-left text-body-md font-medium text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
                >
                  {visitor.fullName}
                </button>
                <p className="truncate text-body-sm text-muted-foreground">
                  {[visitor.company, VISITOR_TYPE_LABELS[visitor.visitorType], visitor.purpose].filter(Boolean).join(' · ')}
                </p>
                <p className="text-body-sm text-muted-foreground">
                  <span className="font-mono text-mono-code">{formatWindow(visitor.timeWindowStart, visitor.timeWindowEnd)}</span> ·{' '}
                  {describeSource(visitor)} · requested {formatRelative(visitor.createdAt, now)}
                </p>
              </div>
            </div>
            <div className="flex gap-2 sm:shrink-0">
              <Button size="sm" onClick={() => approveAndNotify(visitor)}>
                <Check /> Approve
              </Button>
              <Button size="sm" variant="destructive" onClick={() => onReject(visitor)}>
                <Ban /> Reject
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

interface UpcomingVisitorsProps {
  visitors: VisitorRecord[]
  onRevoke: (visitor: VisitorRecord) => void
  onInvite: () => void
  className?: string
}

function UpcomingVisitors({ visitors, onRevoke, onInvite, className }: UpcomingVisitorsProps) {
  const openPass = useUiStore((state) => state.openPass)
  const openDetails = useUiStore((state) => state.openDetails)

  return (
    <Panel title="My upcoming visitors" description={`${visitors.length} scheduled with a valid pass`} className={className}>
      {visitors.length === 0 ? (
        <EmptyState
          icon={CalendarPlus}
          title="No upcoming visitors"
          description="Pre-approve guests so they skip the approval queue at the gate."
          action={
            <Button size="sm" onClick={onInvite}>
              <UserPlus /> Invite visitors
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-muted">
          {visitors.map((visitor, index) => {
            const startsAt = parseISO(visitor.timeWindowStart)
            return (
              <li
                key={visitor.id}
                className="flex animate-row-in items-center gap-4 px-5 py-3"
                style={{ animationDelay: `${Math.min(index, 10) * 18}ms` }}
              >
                <div className="flex w-12 shrink-0 flex-col items-center rounded-md border border-border py-1" aria-hidden>
                  <span className="eyebrow">{format(startsAt, 'MMM')}</span>
                  <span className="text-headline-md tabular-nums">{format(startsAt, 'd')}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => openDetails(visitor.id)}
                    className="max-w-full truncate rounded-sm text-left text-body-md font-medium text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
                  >
                    {visitor.fullName}
                  </button>
                  <p className="truncate text-body-sm text-muted-foreground">
                    {[visitor.company || 'Independent visitor', visitor.purpose].join(' · ')}
                  </p>
                  <p className="truncate font-mono text-mono-code text-muted-foreground">
                    {format(startsAt, 'EEE')} {formatWindow(visitor.timeWindowStart, visitor.timeWindowEnd)} · {visitor.office}
                  </p>
                </div>
                <Badge variant="success" className="hidden sm:inline-flex">
                  Pass issued
                </Badge>
                <div className="flex shrink-0">
                  <Button size="icon-sm" variant="ghost" aria-label={`View pass for ${visitor.fullName}`} onClick={() => openPass(visitor.id)}>
                    <QrCode />
                  </Button>
                  <Button size="icon-sm" variant="ghost" aria-label={`Revoke pass for ${visitor.fullName}`} onClick={() => onRevoke(visitor)}>
                    <Ban />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

function QuotaCard({ used, limit }: { used: number; limit: number }) {
  const remaining = Math.max(0, limit - used)

  return (
    <Panel title="Today's approvals">
      <div className="flex flex-col gap-3 p-5">
        <p className="flex items-baseline gap-1.5">
          <span className="text-headline-xl tabular-nums">{used}</span>
          <span className="text-body-md text-muted-foreground">of {limit} used</span>
        </p>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div
            className={cn('h-full rounded-full transition-[width] duration-500', remaining === 0 ? 'bg-danger' : 'bg-primary')}
            style={{ width: `${Math.min(100, (used / limit) * 100)}%` }}
          />
        </div>
        <p className="text-body-sm text-muted-foreground">
          {remaining === 0
            ? 'Limit reached. New approvals for today are blocked.'
            : `You can approve ${remaining} more ${remaining === 1 ? 'visitor' : 'visitors'} today. Your admin sets this limit.`}
        </p>
      </div>
    </Panel>
  )
}

function OnSiteNow({ visitors, now }: { visitors: VisitorRecord[]; now: Date }) {
  const openDetails = useUiStore((state) => state.openDetails)

  return (
    <Panel title="My visitors on site">
      {visitors.length === 0 ? (
        <EmptyState icon={DoorOpen} title="Nobody on site" description="Your checked-in visitors appear here." className="py-8" />
      ) : (
        <ul className="divide-y divide-muted">
          {visitors.map((visitor) => (
            <li key={visitor.id} className="flex items-center gap-3 px-5 py-3">
              <Avatar name={visitor.fullName} src={visitor.photoUrl} />
              <button
                type="button"
                onClick={() => openDetails(visitor.id)}
                className="min-w-0 flex-1 rounded-sm text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
              >
                <span className="block truncate text-body-md font-medium text-foreground hover:underline">{visitor.fullName}</span>
                <span className="block text-body-sm text-muted-foreground">Due out {formatTimeWithDay(visitor.timeWindowEnd, now)}</span>
              </button>
              <VisitorStatusBadge visitor={visitor} now={now} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
