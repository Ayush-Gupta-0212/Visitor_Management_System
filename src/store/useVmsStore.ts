import { addMinutes, parseISO } from 'date-fns'
import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { DEMO_USERS, EMPLOYEE_DIRECTORY, OFFICES, createMockAuditLog, createMockVisitors } from '@/data/mockData'
import { formatDay, formatDuration, formatTime, formatWindow, minutesBetween, toIsoDate } from '@/lib/format'
import { authorize, type Permission } from '@/lib/rbac'
import { createId } from '@/lib/utils'
import { findVisitor } from '@/lib/visitorIndex'
import {
  DEFAULT_WALK_IN_MINUTES,
  STATUS_LABELS,
  canTransition,
  cardError,
  checkInWindowError,
  countApprovalsForDay,
  hasLapsed,
  isOverstaying,
  nextFreeCard,
  normalizeDetails,
  validateSettings,
  validateVisitorDetails,
  validateWalkIn,
  validateWindow,
  type FieldErrors,
} from '@/lib/visitorRules'
import type {
  ActionResult,
  AuditAction,
  AuditEntry,
  CheckInCapture,
  Employee,
  IsoDate,
  PreApprovalInput,
  Role,
  SystemSettings,
  UserSession,
  VisitorFilters,
  VisitorRecord,
  VisitorStatus,
  VmsError,
  VmsErrorCode,
  WalkInInput,
} from '@/types/vms'

/*
 * The Visitor Management store (Zustand + persist).
 *
 * Every mutating action authorizes the current user (lib/rbac), validates its input
 * and the visit's lifecycle (lib/visitorRules), commits, and appends to the audit
 * trail in the same update. Failures come back as `{ ok: false, error }` rather than
 * exceptions, so the UI can show the message. Visitors are a flat array; id lookups
 * go through the O(1) index in lib/visitorIndex.
 */

export const DEFAULT_SETTINGS: SystemSettings = {
  maxPreApprovalsPerEmployeePerDay: 5,
  autoOverstayThresholdMinutes: 30,
}

/** Filters a fresh view starts with: everything for today. */
export function createDefaultFilters(now: Date = new Date()): VisitorFilters {
  const today = toIsoDate(now)
  return { query: '', status: 'ALL', visitorType: 'ALL', dateRange: { from: today, to: today } }
}

interface VmsState {
  currentUser: UserSession
  visitors: VisitorRecord[]
  settings: SystemSettings
  activeFilters: VisitorFilters
  /** Newest first, capped at MAX_AUDIT_ENTRIES. */
  auditLog: AuditEntry[]
}

interface VmsActions {
  /** Switches the viewing perspective to the demo user for `role`, with fresh filters. */
  switchRole: (role: Role) => void
  setFilters: (patch: Partial<VisitorFilters>) => void
  resetFilters: () => void

  /** Host schedules a visitor in advance; fails with QUOTA_EXCEEDED past the daily limit. */
  createPreApproval: (input: PreApprovalInput) => ActionResult<VisitorRecord>
  /** Gatekeeper registers an unannounced visitor, with the desk photo, and checks them straight in. */
  registerWalkInVisitor: (input: WalkInInput) => ActionResult<VisitorRecord>
  /** Gatekeeper registers a walk-in (with photo) and asks the host to approve before entry. */
  requestHostApproval: (input: WalkInInput) => ActionResult<VisitorRecord>
  /** Host approves one of their own pending requests (counts toward the daily limit). */
  approveVisitor: (visitorId: string) => ActionResult<VisitorRecord>
  /** Host denies a pending request, or revokes a pre-approval before the visitor arrives. */
  rejectVisitor: (visitorId: string, reason: string) => ActionResult<VisitorRecord>
  /** Gatekeeper admits a pre-approved visitor inside their window and issues a temp card. */
  checkInVisitor: (visitorId: string, capture?: CheckInCapture) => ActionResult<VisitorRecord>
  checkOutVisitor: (visitorId: string) => ActionResult<VisitorRecord>

  /** Flags on-site visitors past window end + grace period as OVERSTAY; returns the ids flagged. */
  evaluateOverstayStatuses: (now?: Date) => string[]
  /** Expires requests and pre-approvals whose window closed without a check-in; returns their ids. */
  expireLapsedApprovals: (now?: Date) => string[]

  updateSettings: (patch: Partial<SystemSettings>) => ActionResult<SystemSettings>
  /** Restores the seeded visits, default policy and audit trail (demo utility, not role-gated). */
  resetDemoData: () => void
}

export type VmsStore = VmsState & VmsActions

/** The slice saved to localStorage. Filters are per-session UI state, so they're left out. */
type PersistedVms = Pick<VmsState, 'visitors' | 'settings' | 'auditLog'> & { role: Role }

const MAX_AUDIT_ENTRIES = 300

type Actor = Pick<AuditEntry, 'actorName' | 'actorRole'>
const SYSTEM: Actor = { actorName: 'System', actorRole: 'SYSTEM' }
const actorOf = (user: UserSession): Actor => ({ actorName: user.name, actorRole: user.role })

function auditEntry(action: AuditAction, actor: Actor, visitor: VisitorRecord | null, detail: string, at = new Date()): AuditEntry {
  return {
    id: createId(),
    at: at.toISOString(),
    action,
    ...actor,
    visitorId: visitor?.id ?? null,
    visitorName: visitor?.fullName ?? null,
    detail,
  }
}

const withAudit = (log: AuditEntry[], entries: AuditEntry[]) => [...entries, ...log].slice(0, MAX_AUDIT_ENTRIES)
const describeWindow = (visitor: VisitorRecord) =>
  `${formatDay(visitor.expectedDate)}, ${formatWindow(visitor.timeWindowStart, visitor.timeWindowEnd)}`

function seedData(now = new Date()): Pick<VmsState, 'visitors' | 'auditLog'> {
  const visitors = createMockVisitors(now)
  return { visitors, auditLog: createMockAuditLog(visitors, now) }
}

function failure(code: VmsErrorCode, message: string, fields?: FieldErrors): { ok: false; error: VmsError } {
  return { ok: false, error: fields ? { code, message, fields } : { code, message } }
}

const invalid = (fields: FieldErrors) => failure('VALIDATION', 'Some details need attention.', fields)
const hasErrors = (fields: FieldErrors) => Object.keys(fields).length > 0
const noFreeCard = () => failure('CONFLICT', 'Every temporary card is in use. Collect cards from departing visitors first.')

/** localStorage, except a failed write (e.g. quota filled by captured photos) warns instead of breaking the action. */
const safeLocalStorage: StateStorage = {
  getItem: (name) => localStorage.getItem(name),
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value)
    } catch (error) {
      console.warn('[vms] Could not save visitor data; changes will last until the page reloads.', error)
    }
  },
  removeItem: (name) => localStorage.removeItem(name),
}

export const useVmsStore = create<VmsStore>()(
  persist(
    (set, get) => {
      /** Adds a new record and its audit entry in one update. */
      const insert = (record: VisitorRecord, action: AuditAction, detail: string): ActionResult<VisitorRecord> => {
        set((state) => ({
          visitors: [record, ...state.visitors],
          auditLog: withAudit(state.auditLog, [auditEntry(action, actorOf(state.currentUser), record, detail)]),
        }))
        return { ok: true, data: record }
      }

      /** Replaces a record in place and appends its audit entry in one update. */
      const commit = (updated: VisitorRecord, action: AuditAction, detail: string): ActionResult<VisitorRecord> => {
        set((state) => ({
          visitors: state.visitors.map((v) => (v.id === updated.id ? updated : v)),
          auditLog: withAudit(state.auditLog, [auditEntry(action, actorOf(state.currentUser), updated, detail)]),
        }))
        return { ok: true, data: updated }
      }

      /**
       * The checks every single-visitor action shares, in order: the role may do this
       * at all, the visitor exists, a host-scoped action targets the user's own visitor,
       * and the lifecycle allows moving to `next`. Returns the visitor when all pass.
       */
      const authorizeTransition = (
        permission: Permission,
        visitorId: string,
        next: VisitorStatus,
        verb: string,
      ): ActionResult<VisitorRecord> => {
        const { currentUser, visitors } = get()
        const roleDenied = authorize(currentUser, permission)
        if (roleDenied) return { ok: false, error: roleDenied }

        const visitor = findVisitor(visitors, visitorId)
        if (!visitor) return failure('NOT_FOUND', 'That visitor record no longer exists.')

        const notTheirHost = authorize(currentUser, permission, visitor)
        if (notTheirHost) return { ok: false, error: notTheirHost }

        if (!canTransition(visitor.status, next)) {
          return failure('INVALID_TRANSITION', `Can't ${verb} ${visitor.fullName} (currently ${STATUS_LABELS[visitor.status]}).`)
        }
        return { ok: true, data: visitor }
      }

      /** QUOTA_EXCEEDED when `hostId` already has the maximum approved visits for `day`. */
      const quotaError = (hostId: string, day: IsoDate) => {
        const { visitors, settings } = get()
        const approved = countApprovalsForDay(visitors, hostId, day)
        const limit = settings.maxPreApprovalsPerEmployeePerDay
        if (approved < limit) return null
        return failure('QUOTA_EXCEEDED', `Daily limit reached: ${approved} of ${limit} visits are already approved for ${formatDay(day)}.`)
      }

      /** Validation and host lookup shared by both front-desk registration paths. */
      const prepareDeskVisit = (input: WalkInInput): { ok: true; host: Employee } | { ok: false; error: VmsError } => {
        const { currentUser, visitors } = get()
        const denied = authorize(currentUser, 'visitor:register-walk-in')
        if (denied) return { ok: false, error: denied }

        const host = EMPLOYEE_DIRECTORY.find((employee) => employee.id === input.hostEmployeeId)
        const fields = { ...validateVisitorDetails(input), ...validateWalkIn(input, visitors) }
        if (!host) fields.hostEmployeeId = 'Choose the employee the visitor is here to see.'
        if (!host || hasErrors(fields)) return invalid(fields)
        return { ok: true, host }
      }

      /** A desk-registered visit whose window opens now; callers set the status. */
      const deskVisit = (input: WalkInInput, host: Employee, now: Date): VisitorRecord => ({
        id: createId(),
        ...normalizeDetails(input),
        hostEmployeeId: host.id,
        hostEmployeeName: host.name,
        hostDepartment: host.department,
        office: input.office?.trim() || OFFICES[0],
        expectedDate: toIsoDate(now),
        timeWindowStart: now.toISOString(),
        timeWindowEnd: addMinutes(now, input.expectedDurationMinutes ?? DEFAULT_WALK_IN_MINUTES).toISOString(),
        actualCheckInTime: null,
        actualCheckOutTime: null,
        status: 'PENDING_APPROVAL',
        photoUrl: input.photoUrl,
        tempCardNumber: null,
        rejectionReason: null,
        qrCodePlaceholder: createId(),
        source: 'WALK_IN',
        approvedAt: null,
        createdAt: now.toISOString(),
      })

      /** Moves every visitor matching `shouldMove` to `status` with a system audit entry; writes only if something changed. */
      const sweep = (
        shouldMove: (visitor: VisitorRecord) => boolean,
        status: VisitorStatus,
        action: AuditAction,
        describe: (visitor: VisitorRecord) => string,
        now: Date,
      ): string[] => {
        const moved: VisitorRecord[] = []
        const visitors = get().visitors.map((visitor) => {
          if (!shouldMove(visitor)) return visitor
          const next = { ...visitor, status }
          moved.push(next)
          return next
        })
        if (moved.length === 0) return []
        set((state) => ({
          visitors,
          auditLog: withAudit(state.auditLog, moved.map((visitor) => auditEntry(action, SYSTEM, visitor, describe(visitor), now))),
        }))
        return moved.map((visitor) => visitor.id)
      }

      return {
        currentUser: DEMO_USERS.GATEKEEPER,
        ...seedData(),
        settings: DEFAULT_SETTINGS,
        activeFilters: createDefaultFilters(),

        switchRole: (role) => set({ currentUser: DEMO_USERS[role], activeFilters: createDefaultFilters() }),
        setFilters: (patch) => set((state) => ({ activeFilters: { ...state.activeFilters, ...patch } })),
        resetFilters: () => set({ activeFilters: createDefaultFilters() }),

        createPreApproval: (input) => {
          const { currentUser } = get()
          const denied = authorize(currentUser, 'visitor:pre-approve')
          if (denied) return { ok: false, error: denied }

          const now = new Date()
          const fields = {
            ...validateVisitorDetails(input),
            ...validateWindow(input.timeWindowStart, input.timeWindowEnd, now),
          }
          if (hasErrors(fields)) return invalid(fields)

          const start = parseISO(input.timeWindowStart)
          const expectedDate = toIsoDate(start)
          const overQuota = quotaError(currentUser.id, expectedDate)
          if (overQuota) return overQuota

          const record: VisitorRecord = {
            id: createId(),
            ...normalizeDetails(input),
            hostEmployeeId: currentUser.id,
            hostEmployeeName: currentUser.name,
            hostDepartment: currentUser.department,
            office: input.office?.trim() || OFFICES[0],
            expectedDate,
            timeWindowStart: start.toISOString(),
            timeWindowEnd: parseISO(input.timeWindowEnd).toISOString(),
            actualCheckInTime: null,
            actualCheckOutTime: null,
            status: 'PRE_APPROVED',
            photoUrl: null,
            tempCardNumber: null,
            rejectionReason: null,
            qrCodePlaceholder: createId(),
            source: 'PRE_APPROVAL',
            approvedAt: now.toISOString(),
            createdAt: now.toISOString(),
          }
          return insert(record, 'PRE_APPROVED', `${describeWindow(record)} at ${record.office}`)
        },

        registerWalkInVisitor: (input) => {
          const prepared = prepareDeskVisit(input)
          if (!prepared.ok) return prepared

          const card = input.tempCardNumber?.trim().toUpperCase() || nextFreeCard(get().visitors)
          if (!card) return noFreeCard()

          const now = new Date()
          const record: VisitorRecord = {
            ...deskVisit(input, prepared.host, now),
            status: 'CHECKED_IN',
            actualCheckInTime: now.toISOString(),
            tempCardNumber: card,
          }
          return insert(record, 'WALK_IN_ADMITTED', `Admitted with ${card}; ${record.hostEmployeeName} notified`)
        },

        requestHostApproval: (input) => {
          // The card is issued at check-in, after the host approves.
          const request = { ...input, tempCardNumber: undefined }
          const prepared = prepareDeskVisit(request)
          if (!prepared.ok) return prepared

          const record = deskVisit(request, prepared.host, new Date())
          return insert(record, 'APPROVAL_REQUESTED', `Registered at the front desk; waiting on ${record.hostEmployeeName}`)
        },

        approveVisitor: (visitorId) => {
          const checked = authorizeTransition('visitor:approve', visitorId, 'PRE_APPROVED', 'approve')
          if (!checked.ok) return checked
          const visitor = checked.data
          const now = new Date()

          if (hasLapsed(visitor, now)) {
            return failure(
              'INVALID_TRANSITION',
              `${visitor.fullName}'s requested window ended at ${formatTime(visitor.timeWindowEnd)}, so the request has expired.`,
            )
          }
          const overQuota = quotaError(visitor.hostEmployeeId, visitor.expectedDate)
          if (overQuota) return overQuota

          return commit(
            { ...visitor, status: 'PRE_APPROVED', approvedAt: now.toISOString() },
            'APPROVED',
            `Pass issued for ${describeWindow(visitor)}`,
          )
        },

        rejectVisitor: (visitorId, reason) => {
          const checked = authorizeTransition('visitor:reject', visitorId, 'REJECTED', 'reject')
          if (!checked.ok) return checked

          const trimmed = reason.trim()
          if (trimmed.length < 3) return invalid({ reason: 'Add a short reason so the front desk knows why.' })
          if (trimmed.length > 500) return invalid({ reason: 'Keep the reason under 500 characters.' })

          const revoked = checked.data.status === 'PRE_APPROVED'
          return commit(
            { ...checked.data, status: 'REJECTED', rejectionReason: trimmed },
            'REJECTED',
            `${revoked ? 'Pre-approval revoked' : 'Request denied'}: ${trimmed}`,
          )
        },

        checkInVisitor: (visitorId, capture = {}) => {
          const checked = authorizeTransition('visitor:check-in', visitorId, 'CHECKED_IN', 'check in')
          if (!checked.ok) return checked
          const visitor = checked.data
          const now = new Date()

          const outsideWindow = checkInWindowError(visitor, now)
          if (outsideWindow) return failure('INVALID_TRANSITION', outsideWindow)

          const { visitors } = get()
          const requestedCard = capture.tempCardNumber?.trim().toUpperCase()
          const cardProblem = requestedCard ? cardError(requestedCard, visitors) : null
          if (cardProblem) return invalid({ tempCardNumber: cardProblem })
          const card = requestedCard || nextFreeCard(visitors)
          if (!card) return noFreeCard()

          return commit(
            {
              ...visitor,
              status: 'CHECKED_IN',
              actualCheckInTime: now.toISOString(),
              tempCardNumber: card,
              photoUrl: capture.photoUrl ?? visitor.photoUrl,
            },
            'CHECKED_IN',
            `Issued temp card ${card}`,
          )
        },

        checkOutVisitor: (visitorId) => {
          const checked = authorizeTransition('visitor:check-out', visitorId, 'CHECKED_OUT', 'check out')
          if (!checked.ok) return checked
          const visitor = checked.data
          const now = new Date()
          const stayed = visitor.actualCheckInTime ? `; on site ${formatDuration(minutesBetween(visitor.actualCheckInTime, now))}` : ''

          return commit(
            { ...visitor, status: 'CHECKED_OUT', actualCheckOutTime: now.toISOString() },
            'CHECKED_OUT',
            `Returned temp card ${visitor.tempCardNumber ?? '-'}${stayed}`,
          )
        },

        evaluateOverstayStatuses: (now = new Date()) => {
          const grace = get().settings.autoOverstayThresholdMinutes
          return sweep(
            (visitor) => isOverstaying(visitor, now, grace),
            'OVERSTAY',
            'OVERSTAY_FLAGGED',
            (visitor) => `Window ended ${formatTime(visitor.timeWindowEnd)}; ${grace} min grace period exceeded`,
            now,
          )
        },

        expireLapsedApprovals: (now = new Date()) =>
          sweep(
            (visitor) => hasLapsed(visitor, now),
            'EXPIRED',
            'EXPIRED',
            (visitor) => `No check-in before ${formatTime(visitor.timeWindowEnd)}`,
            now,
          ),

        updateSettings: (patch) => {
          const { currentUser, settings } = get()
          const denied = authorize(currentUser, 'settings:update')
          if (denied) return { ok: false, error: denied }

          const next = { ...settings, ...patch }
          const fields = validateSettings(next)
          if (hasErrors(fields)) return invalid(fields)
          if (
            next.maxPreApprovalsPerEmployeePerDay === settings.maxPreApprovalsPerEmployeePerDay &&
            next.autoOverstayThresholdMinutes === settings.autoOverstayThresholdMinutes
          ) {
            return { ok: true, data: settings }
          }

          const detail =
            `Pre-approvals per host per day ${settings.maxPreApprovalsPerEmployeePerDay} → ${next.maxPreApprovalsPerEmployeePerDay}; ` +
            `overstay grace ${settings.autoOverstayThresholdMinutes} → ${next.autoOverstayThresholdMinutes} min`
          set((state) => ({
            settings: next,
            auditLog: withAudit(state.auditLog, [auditEntry('POLICY_UPDATED', actorOf(currentUser), null, detail)]),
          }))
          // A shorter grace period can tip visitors into overstay straight away.
          get().evaluateOverstayStatuses()
          return { ok: true, data: next }
        },

        resetDemoData: () => {
          const seed = seedData()
          set((state) => ({
            visitors: seed.visitors,
            auditLog: withAudit(seed.auditLog, [
              auditEntry('DATA_RESET', actorOf(state.currentUser), null, 'Restored the seeded visits, default policy and audit trail'),
            ]),
            settings: DEFAULT_SETTINGS,
            activeFilters: createDefaultFilters(),
          }))
        },
      }
    },
    {
      name: 'vms-store',
      version: 2,
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (state): PersistedVms => ({
        role: state.currentUser.role,
        visitors: state.visitors,
        settings: state.settings,
        auditLog: state.auditLog,
      }),
      // v1 records lack `office`, `approvedAt` and the audit trail; start those browsers on fresh demo data.
      migrate: (persisted, version) => (version < 2 ? ({} as PersistedVms) : (persisted as PersistedVms)),
      // Only the role is saved; the session is rebuilt from it so demo users stay in sync with the code.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<PersistedVms>
        return {
          ...current,
          visitors: saved.visitors ?? current.visitors,
          auditLog: saved.auditLog ?? current.auditLog,
          settings: { ...current.settings, ...saved.settings },
          currentUser: (saved.role && DEMO_USERS[saved.role]) || current.currentUser,
        }
      },
      // Visits may have lapsed or overstayed while the app was closed.
      onRehydrateStorage: () => (state) => {
        state?.expireLapsedApprovals()
        state?.evaluateOverstayStatuses()
      },
    },
  ),
)
