import { useEffect, useRef } from 'react'
import { checkInAndNotify } from '@/lib/feedback'
import { toast } from '@/lib/toast'
import type { AuditEntry, UserSession, VisitorRecord } from '@/types/vms'
import { getSessionUser } from './useAuthStore'
import { useUiStore } from './useUiStore'
import { VMS_STORAGE_KEY, useVmsStore } from './useVmsStore'

/** At most this many alerts per sync, so a burst of remote changes doesn't bury the screen. */
const MAX_ALERTS = 3

/**
 * Keeps every open tab in step, which makes the multi-user workflow real: a host in one
 * window sees a desk or kiosk request the moment it's made in another, and the desk sees
 * the decision. When another tab saves visitor data, this tab reloads it from localStorage
 * and, when `alerts` is on (the staff workspace, not the kiosk), raises alerts that concern
 * its own signed-in user. Browsers fire `storage` events only in the *other* tabs, so
 * nobody is alerted about their own actions.
 */
export function useLiveSync(alerts: boolean): void {
  const alertsRef = useRef(alerts)
  useEffect(() => {
    alertsRef.current = alerts
  }, [alerts])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== VMS_STORAGE_KEY) return
      const before = useVmsStore.getState()
      void Promise.resolve(useVmsStore.persist.rehydrate()).then(() => {
        if (!alertsRef.current) return
        const after = useVmsStore.getState()
        announce(before.visitors, after.visitors, before.auditLog[0], after.auditLog[0], getSessionUser())
      })
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
}

function announce(
  before: readonly VisitorRecord[],
  after: readonly VisitorRecord[],
  previousHead: AuditEntry | undefined,
  head: AuditEntry | undefined,
  user: UserSession | null,
): void {
  if (!user) return
  if (head && head.id !== previousHead?.id && head.action === 'DATA_RESET') {
    useUiStore.getState().closeAll()
    toast.info('The mock database was reset', { description: `${head.actorName} restored the seeded visits in another window.` })
    return
  }

  const { openDetails } = useUiStore.getState()
  const previousStatus = new Map(before.map((visitor) => [visitor.id, visitor.status]))
  let alerts = 0

  for (const visitor of after) {
    if (alerts >= MAX_ALERTS) break
    const was = previousStatus.get(visitor.id)
    if (was === visitor.status) continue
    const view = { label: 'View', onClick: () => openDetails(visitor.id) }

    if (user.role === 'HOST_EMPLOYEE' && visitor.hostEmployeeId === user.id) {
      if (visitor.status === 'PENDING_APPROVAL') {
        toast.warning(`New visitor request: ${visitor.fullName}`, {
          description: `${visitor.source === 'SELF_SERVICE' ? 'At the lobby kiosk' : 'At the front desk'} · ${visitor.purpose}`,
          action: { label: 'Review', onClick: () => openDetails(visitor.id) },
          durationMs: 9000,
        })
      } else if (visitor.status === 'CHECKED_IN' && (was === 'PRE_APPROVED' || was === undefined)) {
        toast.info(`${visitor.fullName} has arrived`, {
          description: `Checked in at ${visitor.office}${visitor.tempCardNumber ? ` with visitor card ${visitor.tempCardNumber}` : ''}.`,
          action: view,
        })
      } else {
        continue
      }
      alerts++
    } else if (user.role === 'GATEKEEPER' && visitor.office === user.office) {
      if (was === 'PENDING_APPROVAL' && visitor.status === 'PRE_APPROVED') {
        toast.success(`${visitor.hostEmployeeName} approved ${visitor.fullName}`, {
          description: 'Ready to check in.',
          action: { label: 'Check in', onClick: () => checkInAndNotify(visitor) },
          durationMs: 9000,
        })
      } else if (was === 'PENDING_APPROVAL' && visitor.status === 'REJECTED') {
        toast.error(`${visitor.hostEmployeeName} denied ${visitor.fullName}`, {
          description: visitor.rejectionReason ?? 'Do not admit this visitor.',
          action: view,
        })
      } else if (was === undefined && visitor.source === 'SELF_SERVICE' && visitor.status === 'PENDING_APPROVAL') {
        toast.info(`Kiosk request: ${visitor.fullName}`, { description: `Waiting for ${visitor.hostEmployeeName} to approve.`, action: view })
      } else if (was === 'PRE_APPROVED' && visitor.status === 'CHECKED_IN') {
        toast.info(`${visitor.fullName} checked in at the kiosk`, { description: `Temp card ${visitor.tempCardNumber} issued.`, action: view })
      } else {
        continue
      }
      alerts++
    }
  }
}
