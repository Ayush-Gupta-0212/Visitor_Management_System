import { CalendarClock, Hourglass, ShieldAlert, UserPlus, Users } from 'lucide-react'
import { useMemo } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useNow } from '@/hooks/useNow'
import { formatTime } from '@/lib/format'
import { summarizeDay } from '@/lib/visitorRules'
import { useUiStore } from '@/store/useUiStore'
import { useVmsStore } from '@/store/useVmsStore'
import { VerifyPassPopover } from './VerifyPassPopover'
import { VisitorTable } from './VisitorTable'
import { WalkInRegistrationModal } from './WalkInRegistrationModal'

/** Front-desk console: live stats, the visitor list, walk-in registration and pass verification. */
export function GatekeeperConsole() {
  const openWalkIn = useUiStore((state) => state.openWalkIn)
  const registerButton = (
    <Button onClick={openWalkIn}>
      <UserPlus /> Register walk-in
    </Button>
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Gatekeeper Console"
        badge={
          <Badge variant="success" pulse>
            Live monitor
          </Badge>
        }
        description="Real-time visitor processing, temporary card issue and compliance monitoring for the Mumbai Goregaon front desk."
        actions={
          <>
            <VerifyPassPopover />
            {registerButton}
          </>
        }
      />
      <DeskStats />
      <VisitorTable title="Visitors" emptyAction={registerButton} />
      <WalkInRegistrationModal />
    </div>
  )
}

function DeskStats() {
  const visitors = useVmsStore((state) => state.visitors)
  const now = useNow()
  const day = useMemo(() => summarizeDay(visitors, now), [visitors, now])
  const share = (count: number) => (day.total > 0 ? count / day.total : 0)

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="On site now"
        value={day.onSite}
        unit={day.onSite === 1 ? 'visitor' : 'visitors'}
        detail={`${day.checkedOut} checked out today`}
        icon={Users}
        tone="success"
        progress={share(day.onSite)}
      />
      <StatCard
        label="Expected today"
        value={day.expected}
        unit="arrivals"
        detail={day.nextArrival ? `Next: ${day.nextArrival.fullName}, ${formatTime(day.nextArrival.timeWindowStart)}` : 'No more arrivals today'}
        icon={CalendarClock}
        progress={share(day.expected)}
      />
      <StatCard
        label="Overstay alerts"
        value={day.overstay}
        unit={day.overstay === 1 ? 'visitor' : 'visitors'}
        detail={day.overstay > 0 ? 'Action required: check out or escort' : 'Everyone is within their window'}
        icon={ShieldAlert}
        tone="danger"
        progress={day.onSite > 0 ? day.overstay / day.onSite : 0}
        alert={day.overstay > 0}
      />
      <StatCard
        label="Pending approvals"
        value={day.pending}
        unit="requests"
        detail={day.pending > 0 ? 'Waiting on hosts' : 'No requests waiting'}
        icon={Hourglass}
        tone="warning"
        progress={share(day.pending)}
      />
    </div>
  )
}
