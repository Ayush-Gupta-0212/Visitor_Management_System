import { parseISO } from 'date-fns'
import { BadgeCheck, ShieldAlert, UserCheck, Users } from 'lucide-react'
import { useMemo } from 'react'
import { VisitorTable } from '@/components/gatekeeper/VisitorTable'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { Badge } from '@/components/ui/Badge'
import { useNow } from '@/hooks/useNow'
import { toIsoDate } from '@/lib/format'
import { summarizeDay } from '@/lib/visitorRules'
import { useVmsStore } from '@/store/useVmsStore'
import { AuditLog } from './AuditLog'
import { PolicySettingsCard } from './PolicySettingsCard'

/** Super-admin governance hub: site analytics, the access policy, the audit trail and every visit. */
export function AdminDashboard() {
  const visitors = useVmsStore((state) => state.visitors)
  const auditLog = useVmsStore((state) => state.auditLog)
  const settings = useVmsStore((state) => state.settings)
  const now = useNow()

  const day = useMemo(() => summarizeDay(visitors, now), [visitors, now])
  const activePasses = useMemo(() => visitors.filter((visitor) => visitor.status === 'PRE_APPROVED').length, [visitors])
  const flaggedToday = useMemo(() => {
    const today = toIsoDate(now)
    return auditLog.filter((entry) => entry.action === 'OVERSTAY_FLAGGED' && toIsoDate(parseISO(entry.at)) === today).length
  }, [auditLog, now])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Governance hub"
        badge={<Badge shape="tag">Super Admin</Badge>}
        description="Site-wide visitor analytics, the access policy every host and gate follows, and the security audit trail."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total visitors today"
          value={day.total}
          unit="visits"
          detail={`${day.checkedOut} completed · ${day.expected} still expected`}
          icon={Users}
          progress={day.total > 0 ? day.checkedOut / day.total : 0}
        />
        <StatCard
          label="Active in premises"
          value={day.onSite}
          unit="on site"
          detail={`${day.pending} ${day.pending === 1 ? 'request' : 'requests'} waiting on hosts`}
          icon={UserCheck}
          tone="success"
          progress={day.total > 0 ? day.onSite / day.total : 0}
        />
        <StatCard
          label="Overstay incidents"
          value={day.overstay}
          unit="open"
          detail={`${flaggedToday} flagged today · ${settings.autoOverstayThresholdMinutes} min grace`}
          icon={ShieldAlert}
          tone="danger"
          alert={day.overstay > 0}
        />
        <StatCard
          label="Total pre-approvals"
          value={activePasses}
          unit="active passes"
          detail={`${day.expected} scheduled for today`}
          icon={BadgeCheck}
          tone="warning"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <PolicySettingsCard
          key={`${settings.maxPreApprovalsPerEmployeePerDay}-${settings.autoOverstayThresholdMinutes}`}
          className="self-start"
        />
        <AuditLog className="lg:col-span-2" />
      </div>

      <VisitorTable title="All visits" />
    </div>
  )
}
