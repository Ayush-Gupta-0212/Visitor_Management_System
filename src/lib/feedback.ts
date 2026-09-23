import { useUiStore } from '@/store/useUiStore'
import { useVmsStore } from '@/store/useVmsStore'
import type { CheckInCapture, VisitorRecord, VmsError, VmsErrorCode } from '@/types/vms'
import { formatDay, formatWindow } from './format'
import { toast } from './toast'

/*
 * Runs store actions on behalf of the UI and reports the outcome as a toast, so
 * every button that approves, checks in or checks out gives identical feedback.
 */

const ERROR_TITLES: Record<VmsErrorCode, string> = {
  FORBIDDEN: 'Not allowed for this role',
  NOT_FOUND: 'Visitor not found',
  VALIDATION: 'Check the highlighted fields',
  INVALID_TRANSITION: "That action isn't available",
  QUOTA_EXCEEDED: 'Daily Pre-Approval Quota Exceeded',
  CONFLICT: 'Temporary card unavailable',
}

/** Shows a failed store action as an error toast. */
export function notifyError(error: VmsError): void {
  const limit = useVmsStore.getState().settings.maxPreApprovalsPerEmployeePerDay
  const title = error.code === 'QUOTA_EXCEEDED' ? `${ERROR_TITLES.QUOTA_EXCEEDED} (Limit: ${limit})` : ERROR_TITLES[error.code]
  toast.error(title, { description: error.message })
}

export function approveAndNotify(visitor: VisitorRecord): boolean {
  const result = useVmsStore.getState().approveVisitor(visitor.id)
  if (!result.ok) {
    notifyError(result.error)
    return false
  }
  toast.success(`Pass Approved for ${visitor.fullName}`, {
    description: `Valid ${formatDay(visitor.expectedDate)}, ${formatWindow(visitor.timeWindowStart, visitor.timeWindowEnd)}. The front desk can check them in.`,
    action: { label: 'View pass', onClick: () => useUiStore.getState().openPass(visitor.id) },
  })
  return true
}

export function checkInAndNotify(visitor: VisitorRecord, capture?: CheckInCapture): boolean {
  const result = useVmsStore.getState().checkInVisitor(visitor.id, capture)
  if (!result.ok) {
    notifyError(result.error)
    return false
  }
  toast.success(`${visitor.fullName} checked in`, {
    description: `Temp card ${result.data.tempCardNumber} issued. ${visitor.hostEmployeeName} has been notified.`,
  })
  return true
}

export function checkOutAndNotify(visitor: VisitorRecord): boolean {
  const result = useVmsStore.getState().checkOutVisitor(visitor.id)
  if (!result.ok) {
    notifyError(result.error)
    return false
  }
  toast.success('Visitor Checked Out Successfully', {
    description: `${visitor.fullName} returned ${visitor.tempCardNumber ?? 'their card'}.`,
  })
  return true
}
