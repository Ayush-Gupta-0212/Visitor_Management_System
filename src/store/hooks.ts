import { isAfter, parseISO } from 'date-fns'
import { useEffect, useMemo } from 'react'
import { visibleTo } from '@/lib/rbac'
import { findVisitor } from '@/lib/visitorIndex'
import type { VisitorRecord } from '@/types/vms'
import { useVmsStore } from './useVmsStore'

/*
 * React hooks over the store. Each subscribes to the smallest slice it needs and
 * memoizes derived lists, so components re-render only when their inputs change.
 */

const byWindowStart = (a: VisitorRecord, b: VisitorRecord) => a.timeWindowStart.localeCompare(b.timeWindowStart)

/** Every visitor the current user may see (hosts: only their own). */
export function useVisibleVisitors(): VisitorRecord[] {
  const visitors = useVmsStore((state) => state.visitors)
  const currentUser = useVmsStore((state) => state.currentUser)
  return useMemo(() => visibleTo(currentUser, visitors), [currentUser, visitors])
}

/** One visitor by id, O(1) through the index built for the current list. */
export function useVisitor(id: string | null): VisitorRecord | undefined {
  return useVmsStore((state) => (id ? findVisitor(state.visitors, id) : undefined))
}

/** Requests waiting on a host decision that the current user can see, earliest window first. */
export function usePendingRequests(): VisitorRecord[] {
  const visible = useVisibleVisitors()
  return useMemo(() => visible.filter((v) => v.status === 'PENDING_APPROVAL').sort(byWindowStart), [visible])
}

/** Desk or kiosk requests a host has approved, waiting for the gatekeeper to admit the visitor. */
export function useApprovedRequests(): VisitorRecord[] {
  const visible = useVisibleVisitors()
  return useMemo(
    () => visible.filter((v) => v.status === 'PRE_APPROVED' && v.source !== 'PRE_APPROVAL').sort(byWindowStart),
    [visible],
  )
}

/** Requests a host turned down while the visitor may still be at the gate (their window is open). */
export function useDeniedRequests(now: Date): VisitorRecord[] {
  const visible = useVisibleVisitors()
  return useMemo(
    () =>
      visible.filter(
        (v) => v.status === 'REJECTED' && v.source !== 'PRE_APPROVAL' && isAfter(parseISO(v.timeWindowEnd), now),
      ),
    [visible, now],
  )
}

/**
 * Keeps time-based statuses current while mounted: expires lapsed approvals and flags
 * overstays immediately, then every `intervalMs`. Mount once, near the app root.
 */
export function useStatusSweep(intervalMs = 30_000): void {
  useEffect(() => {
    const runSweep = () => {
      const { expireLapsedApprovals, evaluateOverstayStatuses } = useVmsStore.getState()
      expireLapsedApprovals()
      evaluateOverstayStatuses()
    }
    runSweep()
    const timer = window.setInterval(runSweep, intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs])
}
