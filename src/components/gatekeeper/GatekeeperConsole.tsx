import { CalendarClock, Hourglass, ShieldAlert, TabletSmartphone, UserPlus, Users } from 'lucide-react'
import { useMemo } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useNow } from '@/hooks/useNow'
import { formatTime } from '@/lib/format'
import { KIOSK_HREF } from '@/lib/router'
import { summarizeDay } from '@/lib/visitorRules'
import { useVisibleVisitors } from '@/store/hooks'
import { useUser } from '@/store/useAuthStore'
import { useUiStore } from '@/store/useUiStore'
import { ScanPassButton } from './ScanPassModal'
import { VisitorTable } from './VisitorTable'
import { WalkInRegistrationModal } from './WalkInRegistrationModal'

/** Front-desk console: live stats, the visitor list, walk-in registration and pass scanning. */
export function GatekeeperConsole() {
  const user = useUser()
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
        description={`Real-time visitor processing, temporary card issue and compliance monitoring for the ${user.office} front desk.`}
        actions={
          <>
            <a
              href={KIOSK_HREF}
              target="_blank"
              rel="noreferrer"
              title="Open the self-service kiosk for the lobby tablet in a new tab"
              className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-body-md font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden [&_svg]:size-4"
            >
              <TabletSmartphone aria-hidden /> Lobby kiosk
            </a>
            <ScanPassButton />
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
  const visitors = useVisibleVisitors()
  const now = useNow()
  const day = useMemo(() => summarizeDay(visitors, now), [visitors, now])
  const share = (count: number) => (day.total > 0 ? count / day.total : 0)

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="On site now"
        index={0}
        value={day.onSite}
        unit={day.onSite === 1 ? 'visitor' : 'visitors'}
        detail={`${day.checkedOut} checked out today`}
        icon={Users}
        tone="success"
        progress={share(day.onSite)}
      />
      <StatCard
        label="Expected today"
        index={1}
        value={day.expected}
        unit="arrivals"
        detail={day.nextArrival ? `Next: ${day.nextArrival.fullName}, ${formatTime(day.nextArrival.timeWindowStart)}` : 'No more arrivals today'}
        icon={CalendarClock}
        progress={share(day.expected)}
      />
      <StatCard
        label="Overstay alerts"
        index={2}
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
        index={3}
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
