import { History } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Panel } from '@/components/shared/Panel'
import { Badge, type BadgeVariant } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useNow } from '@/hooks/useNow'
import { formatDateTime, formatTimeWithDay } from '@/lib/format'
import { ROLE_LABELS } from '@/lib/rbac'
import { findVisitor } from '@/lib/visitorIndex'
import { useUiStore } from '@/store/useUiStore'
import { useVmsStore } from '@/store/useVmsStore'
import type { AuditAction, AuditEntry } from '@/types/vms'

const FILTERS = [
  { value: 'ALL', label: 'All' },
  { value: 'APPROVALS', label: 'Approvals' },
  { value: 'GATE', label: 'Gate' },
  { value: 'ALERTS', label: 'Alerts' },
  { value: 'SECURITY', label: 'Security' },
] as const

type AuditFilter = (typeof FILTERS)[number]['value']

const ACTIONS: Record<AuditAction, { label: string; variant: BadgeVariant; category: Exclude<AuditFilter, 'ALL'> }> = {
  PRE_APPROVED: { label: 'Pre-approved', variant: 'success', category: 'APPROVALS' },
  APPROVAL_REQUESTED: { label: 'Requested', variant: 'warning', category: 'APPROVALS' },
  APPROVED: { label: 'Approved', variant: 'success', category: 'APPROVALS' },
  REJECTED: { label: 'Rejected', variant: 'danger', category: 'APPROVALS' },
  WALK_IN_ADMITTED: { label: 'Walk-in', variant: 'neutral', category: 'GATE' },
  CHECKED_IN: { label: 'Checked in', variant: 'success', category: 'GATE' },
  CHECKED_OUT: { label: 'Checked out', variant: 'neutral', category: 'GATE' },
  VISIT_EXTENDED: { label: 'Extended', variant: 'warning', category: 'GATE' },
  OVERSTAY_FLAGGED: { label: 'Overstay', variant: 'danger', category: 'ALERTS' },
  EXPIRED: { label: 'Expired', variant: 'neutral', category: 'ALERTS' },
  POLICY_UPDATED: { label: 'Policy', variant: 'warning', category: 'SECURITY' },
  DATA_RESET: { label: 'Reset', variant: 'neutral', category: 'SECURITY' },
  SIGNED_IN: { label: 'Signed in', variant: 'neutral', category: 'SECURITY' },
  SIGNED_OUT: { label: 'Signed out', variant: 'neutral', category: 'SECURITY' },
}

const PAGE = 25

/** Approval decisions, gate activity, automatic alerts, sign-ins and policy changes, newest first. */
export function AuditLog({ className }: { className?: string }) {
  const auditLog = useVmsStore((state) => state.auditLog)
  const now = useNow()
  const [filter, setFilter] = useState<AuditFilter>('ALL')
  const [shown, setShown] = useState(PAGE)

  const counts = useMemo(() => {
    const totals: Record<AuditFilter, number> = { ALL: auditLog.length, APPROVALS: 0, GATE: 0, ALERTS: 0, SECURITY: 0 }
    for (const entry of auditLog) totals[ACTIONS[entry.action].category]++
    return totals
  }, [auditLog])
  const entries = useMemo(
    () => (filter === 'ALL' ? auditLog : auditLog.filter((entry) => ACTIONS[entry.action].category === filter)),
    [auditLog, filter],
  )

  return (
    <Panel title="Security audit log" description={`${auditLog.length} events, newest first`} className={className}>
      <div className="overflow-x-auto border-b border-border px-5 py-2.5">
        <SegmentedControl
          label="Filter audit events"
          value={filter}
          onValueChange={(next) => {
            setFilter(next)
            setShown(PAGE)
          }}
          options={FILTERS.map((option) => ({ ...option, count: counts[option.value] }))}
        />
      </div>
      {entries.length === 0 ? (
        <EmptyState icon={History} title="No events here yet" description="Approvals, gate activity, sign-ins and policy changes are recorded as they happen." />
      ) : (
        <ol className="max-h-[34rem] divide-y divide-muted overflow-y-auto">
          {entries.slice(0, shown).map((entry) => (
            <AuditRow key={entry.id} entry={entry} now={now} />
          ))}
        </ol>
      )}
      {entries.length > shown && (
        <div className="border-t border-border p-2 text-center">
          <Button variant="ghost" size="sm" onClick={() => setShown((count) => count + PAGE)}>
            Show {Math.min(PAGE, entries.length - shown)} more
          </Button>
        </div>
      )}
    </Panel>
  )
}

function AuditRow({ entry, now }: { entry: AuditEntry; now: Date }) {
  const openDetails = useUiStore((state) => state.openDetails)
  const visitorId = entry.visitorId
  // Links only while the visit still exists (a database reset replaces runtime records).
  const linkable = useVmsStore((state) => (visitorId ? findVisitor(state.visitors, visitorId) !== undefined : false))
  const action = ACTIONS[entry.action]

  return (
    <li className="grid grid-cols-[4.75rem_minmax(0,1fr)] gap-x-3 px-5 py-3 sm:grid-cols-[6rem_minmax(0,1fr)]">
      <time dateTime={entry.at} title={formatDateTime(entry.at)} className="pt-0.5 font-mono text-mono-code text-muted-foreground">
        {formatTimeWithDay(entry.at, now)}
      </time>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Badge variant={action.variant} shape="tag">
            {action.label}
          </Badge>
          {entry.visitorName &&
            (visitorId && linkable ? (
              <button
                type="button"
                onClick={() => openDetails(visitorId)}
                className="rounded-sm text-body-md font-medium text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
              >
                {entry.visitorName}
              </button>
            ) : (
              <span className="text-body-md font-medium text-foreground">{entry.visitorName}</span>
            ))}
        </div>
        <p className="mt-1 text-body-sm text-foreground">{entry.detail}</p>
        <p className="text-body-sm text-muted-foreground">
          {entry.actorName} · {entry.actorRole === 'SYSTEM' ? (entry.actorName === 'System' ? 'Automatic' : 'Public') : ROLE_LABELS[entry.actorRole]}
        </p>
      </div>
    </li>
  )
}
