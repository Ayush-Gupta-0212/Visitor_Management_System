import { Ban, Bell, Check, Inbox, LogIn } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { RejectVisitorModal } from '@/components/host/RejectVisitorModal'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import { useNow } from '@/hooks/useNow'
import { approveAndNotify, checkInAndNotify } from '@/lib/feedback'
import { formatRelative } from '@/lib/format'
import { SOURCE_LABELS } from '@/lib/visitorRules'
import { useApprovedRequests, useDeniedRequests, usePendingRequests } from '@/store/hooks'
import { useUiStore } from '@/store/useUiStore'
import { useVmsStore } from '@/store/useVmsStore'
import type { VisitorRecord } from '@/types/vms'

/**
 * Live visitor requests. Hosts approve or reject their own from here; the desk
 * sees what hosts have approved (ready to admit), what is still pending, and
 * what was denied while the visitor may still be waiting at the gate.
 */
export function NotificationBell() {
  const role = useVmsStore((state) => state.currentUser.role)
  const openDetails = useUiStore((state) => state.openDetails)
  const now = useNow()
  const pending = usePendingRequests()
  const approved = useApprovedRequests()
  const denied = useDeniedRequests(now)
  const [open, setOpen] = useState(false)
  const [rejecting, setRejecting] = useState<VisitorRecord | null>(null)

  const isHost = role === 'HOST_EMPLOYEE'
  const isDesk = role === 'GATEKEEPER'
  const readyToAdmit = isDesk ? approved : []
  const turnedAway = isDesk ? denied : []
  const count = pending.length + readyToAdmit.length + turnedAway.length

  const view = (visitor: VisitorRecord) => {
    setOpen(false)
    openDetails(visitor.id)
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={count > 0 ? `Visitor requests, ${count} need attention` : 'Visitor requests'}
          >
            <Bell />
            {count > 0 && (
              <span
                key={count}
                className="absolute top-1 right-1 flex h-4 min-w-4 animate-pop-in items-center justify-center rounded-full bg-danger px-1 font-mono text-[10px] leading-none font-medium text-white"
              >
                {count}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(24rem,calc(100vw-2rem))] p-0">
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-body-md font-medium">Visitor requests</p>
            <span className="eyebrow">{count} open</span>
          </header>
          <div className="max-h-[26rem] overflow-y-auto">
            {count === 0 && (
              <EmptyState
                icon={Inbox}
                title="No pending requests"
                description={isHost ? 'New visitor requests for you will appear here.' : 'Requests raised at the desk or kiosk appear here.'}
                className="py-8"
              />
            )}

            {readyToAdmit.length > 0 && (
              <RequestGroup title="Approved · ready to check in">
                {readyToAdmit.map((visitor) => (
                  <RequestItem
                    key={visitor.id}
                    visitor={visitor}
                    onView={() => view(visitor)}
                    meta={`Approved by ${visitor.hostEmployeeName}${visitor.approvedAt ? ` ${formatRelative(visitor.approvedAt, now)}` : ''}`}
                    actions={
                      <Button size="sm" onClick={() => checkInAndNotify(visitor)}>
                        <LogIn /> Check in
                      </Button>
                    }
                  />
                ))}
              </RequestGroup>
            )}

            {pending.length > 0 && (
              <RequestGroup title={isHost ? 'Waiting for your approval' : 'Waiting on host'}>
                {pending.map((visitor) => (
                  <RequestItem
                    key={visitor.id}
                    visitor={visitor}
                    onView={() => view(visitor)}
                    meta={
                      isHost
                        ? `${SOURCE_LABELS[visitor.source]} · ${formatRelative(visitor.createdAt, now)}`
                        : `For ${visitor.hostEmployeeName} · ${formatRelative(visitor.createdAt, now)}`
                    }
                    actions={
                      isHost && (
                        <>
                          <Button size="sm" onClick={() => approveAndNotify(visitor)}>
                            <Check /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setOpen(false)
                              setRejecting(visitor)
                            }}
                          >
                            <Ban /> Reject
                          </Button>
                        </>
                      )
                    }
                  />
                ))}
              </RequestGroup>
            )}

            {turnedAway.length > 0 && (
              <RequestGroup title="Denied · do not admit">
                {turnedAway.map((visitor) => (
                  <RequestItem
                    key={visitor.id}
                    visitor={visitor}
                    onView={() => view(visitor)}
                    meta={`${visitor.hostEmployeeName}: “${visitor.rejectionReason ?? 'No reason given'}”`}
                  />
                ))}
              </RequestGroup>
            )}
          </div>
        </PopoverContent>
      </Popover>
      <RejectVisitorModal visitor={rejecting} onClose={() => setRejecting(null)} />
    </>
  )
}

function RequestGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-border last:border-b-0">
      <h3 className="eyebrow px-4 pt-3">{title}</h3>
      <ul className="divide-y divide-muted">{children}</ul>
    </section>
  )
}

interface RequestItemProps {
  visitor: VisitorRecord
  meta: string
  actions?: ReactNode
  onView: () => void
}

function RequestItem({ visitor, meta, actions, onView }: RequestItemProps) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <Avatar name={visitor.fullName} src={visitor.photoUrl} />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onView}
          className="block max-w-full truncate rounded-sm text-left text-body-md font-medium text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
        >
          {visitor.fullName}
        </button>
        <p className="text-body-sm text-muted-foreground">{meta}</p>
        {actions && <div className="mt-2 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </li>
  )
}
