import { addMinutes, isAfter, parseISO } from 'date-fns'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { EMPLOYEE_DIRECTORY, OFFICES, createMockAuditLog, createMockVisitors } from '@/data/mockData'
import { formatDay, formatDuration, formatTime, formatWindow, minutesBetween, toIsoDate } from '@/lib/format'
import { authorize, type Permission } from '@/lib/rbac'
import { failure } from '@/lib/result'
import { createId } from '@/lib/utils'
import { findVisitor, findVisitorByPassToken } from '@/lib/visitorIndex'
import {
  DEFAULT_WALK_IN_MINUTES,
  PASS_NOT_FOUND,
  STATUS_LABELS,
  canTransition,
  cardError,
  checkInWindowError,
  countApprovalsForDay,
  hasLapsed,
  isOnSite,
  isOverstaying,
  isPhoto,
  nextFreeCard,
  normalizeDetails,
  selfCheckInProblem,
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
  KioskRequestInput,
  PreApprovalInput,
  SystemSettings,
  UserSession,
  VisitorFilters,
  VisitorRecord,
  VisitorStatus,
  VmsError,
  WalkInInput,
} from '@/types/vms'
import { getSessionUser } from './useAuthStore'
import { browserStorage } from './storage'

/*
 * The Visitor Management store (Zustand + persist).
 *
 * Every staff action checks the signed-in user's permissions (lib/rbac), validates
 * its input and the visit's lifecycle (lib/visitorRules), commits, and appends to
 * the audit trail in the same update. The kiosk actions are the only public ones.
 * Failures come back as `{ ok: false, error }` rather than exceptions, so the UI
 * can show the message. Visitors are a flat array; id and pass-token lookups go
 * through the O(1) indexes in lib/visitorIndex.
 */

export const DEFAULT_SETTINGS: SystemSettings = {
  maxPreApprovalsPerEmployeePerDay: 5,
  autoOverstayThresholdMinutes: 30,
}

/** localStorage key for the shared visitor data; other tabs listen for changes to it. */
export const VMS_STORAGE_KEY = 'vms-store'

/** The site the lobby kiosk stands in. */
export const KIOSK_SITE: string = OFFICES[0]

/** Filters a fresh view starts with: everything for today. */
export function createDefaultFilters(now: Date = new Date()): VisitorFilters {
  const today = toIsoDate(now)
  return { query: '', status: 'ALL', visitorType: 'ALL', dateRange: { from: today, to: today } }
}

interface VmsState {
  visitors: VisitorRecord[]
  settings: SystemSettings
  activeFilters: VisitorFilters
  /** Newest first, capped at MAX_AUDIT_ENTRIES. */
  auditLog: AuditEntry[]
}

interface VmsActions {
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
  /** Gatekeeper lengthens an on-site visitor's window, clearing an overstay. */
  extendVisit: (visitorId: string, minutes: number) => ActionResult<VisitorRecord>

  /** Public: a visitor asks for a visit at the lobby kiosk; the host must approve it. */
  submitKioskRequest: (input: KioskRequestInput) => ActionResult<VisitorRecord>
  /** Public: a pre-approved visitor scans their e-pass at the kiosk and checks themselves in. */
  selfCheckIn: (passToken: string, photoUrl: string) => ActionResult<VisitorRecord>

  /** Flags on-site visitors past window end + grace period as OVERSTAY; returns the ids flagged. */
  evaluateOverstayStatuses: (now?: Date) => string[]
  /** Expires requests and pre-approvals whose window closed without a check-in; returns their ids. */
  expireLapsedApprovals: (now?: Date) => string[]

  updateSettings: (patch: Partial<SystemSettings>) => ActionResult<SystemSettings>
  /** Adds a sign-in or sign-out to the audit trail (called by session.ts). */
  recordSecurityEvent: (action: 'SIGNED_IN' | 'SIGNED_OUT', user: UserSession, detail: string) => void
  /** Restores the seeded visits, default policy and audit trail (demo utility). */
  resetDemoData: () => void
}

export type VmsStore = VmsState & VmsActions

/** The slice saved to localStorage and shared by every tab. Filters are per-tab UI state. */
type PersistedVms = Pick<VmsState, 'visitors' | 'settings' | 'auditLog'>

const MAX_AUDIT_ENTRIES = 300

type Actor = Pick<AuditEntry, 'actorName' | 'actorRole'>
const SYSTEM: Actor = { actorName: 'System', actorRole: 'SYSTEM' }
const KIOSK: Actor = { actorName: 'Self-service kiosk', actorRole: 'SYSTEM' }
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

const invalid = (fields: FieldErrors) => failure('VALIDATION', 'Some details need attention.', fields)
const hasErrors = (fields: FieldErrors) => Object.keys(fields).length > 0
const noFreeCard = () => failure('CONFLICT', 'Every temporary card is in use. Collect cards from departing visitors first.')

/** The signed-in user if they hold `permission`, otherwise why they can't act. */
function signedInWith(permission: Permission): { ok: true; user: UserSession } | { ok: false; error: VmsError } {
  const user = getSessionUser()
  const denied = authorize(user, permission)
  if (denied || !user) return { ok: false, error: denied ?? { code: 'UNAUTHORIZED', message: 'Sign in to continue.' } }
  return { ok: true, user }
}

export const useVmsStore = create<VmsStore>()(
  persist(
    (set, get) => {
      /** Adds a new record and its audit entry in one update. */
      const insert = (record: VisitorRecord, action: AuditAction, detail: string, actor: Actor): ActionResult<VisitorRecord> => {
        set((state) => ({
          visitors: [record, ...state.visitors],
          auditLog: withAudit(state.auditLog, [auditEntry(action, actor, record, detail)]),
        }))
        return { ok: true, data: record }
      }

      /** Replaces a record in place and appends its audit entry in one update. */
      const commit = (updated: VisitorRecord, action: AuditAction, detail: string, actor: Actor): ActionResult<VisitorRecord> => {
        set((state) => ({
          visitors: state.visitors.map((v) => (v.id === updated.id ? updated : v)),
          auditLog: withAudit(state.auditLog, [auditEntry(action, actor, updated, detail)]),
        }))
        return { ok: true, data: updated }
      }

      /**
       * The checks every single-visitor staff action shares, in order: signed in with the
       * permission, the visitor exists, host ownership / site scope, and the lifecycle
       * allows moving to `next`. Returns the visitor and the acting user.
       */
      const authorizeTransition = (
        permission: Permission,
        visitorId: string,
        next: VisitorStatus,
        verb: string,
      ): ActionResult<{ visitor: VisitorRecord; user: UserSession }> => {
        const who = signedInWith(permission)
        if (!who.ok) return who

        const visitor = findVisitor(get().visitors, visitorId)
        if (!visitor) return failure('NOT_FOUND', 'That visitor record no longer exists.')

        const scoped = authorize(who.user, permission, visitor)
        if (scoped) return { ok: false, error: scoped }

        if (!canTransition(visitor.status, next)) {
          return failure('INVALID_TRANSITION', `Can't ${verb} ${visitor.fullName} (currently ${STATUS_LABELS[visitor.status]}).`)
        }
        return { ok: true, data: { visitor, user: who.user } }
      }

      /** QUOTA_EXCEEDED when `hostId` already has the maximum approved visits for `day`. */
      const quotaError = (hostId: string, day: IsoDate) => {
        const { visitors, settings } = get()
        const approved = countApprovalsForDay(visitors, hostId, day)
        const limit = settings.maxPreApprovalsPerEmployeePerDay
        if (approved < limit) return null
        return failure('QUOTA_EXCEEDED', `Daily limit reached: ${approved} of ${limit} visits are already approved for ${formatDay(day)}.`)
      }

      /** Checks shared by every registration made in the lobby (desk or kiosk): details, photo and host. */
      const validateLobbyVisit = (input: KioskRequestInput): { ok: true; host: Employee } | { ok: false; error: VmsError } => {
        const host = EMPLOYEE_DIRECTORY.find((employee) => employee.id === input.hostEmployeeId)
        const fields = { ...validateVisitorDetails(input), ...validateWalkIn(input, get().visitors) }
        if (!host) fields.hostEmployeeId = 'Choose the employee the visitor is here to see.'
        if (!host || hasErrors(fields)) return invalid(fields)
        return { ok: true, host }
      }

      /** A lobby-registered visit whose window opens now; callers set the status. */
      const lobbyVisit = (input: KioskRequestInput, host: Employee, office: string, now: Date): VisitorRecord => ({
        id: createId(),
        ...normalizeDetails(input),
        hostEmployeeId: host.id,
        hostEmployeeName: host.name,
        hostDepartment: host.department,
        office,
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
        ...seedData(),
        settings: DEFAULT_SETTINGS,
        activeFilters: createDefaultFilters(),

        setFilters: (patch) => set((state) => ({ activeFilters: { ...state.activeFilters, ...patch } })),
        resetFilters: () => set({ activeFilters: createDefaultFilters() }),

        createPreApproval: (input) => {
          const who = signedInWith('visitor:pre-approve')
          if (!who.ok) return who
          const { user } = who

          const now = new Date()
          const fields = {
            ...validateVisitorDetails(input),
            ...validateWindow(input.timeWindowStart, input.timeWindowEnd, now),
          }
          if (hasErrors(fields)) return invalid(fields)

          const start = parseISO(input.timeWindowStart)
          const expectedDate = toIsoDate(start)
          const overQuota = quotaError(user.id, expectedDate)
          if (overQuota) return overQuota

          const record: VisitorRecord = {
            id: createId(),
            ...normalizeDetails(input),
            hostEmployeeId: user.id,
            hostEmployeeName: user.name,
            hostDepartment: user.department,
            office: input.office?.trim() || user.office,
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
          return insert(record, 'PRE_APPROVED', `${describeWindow(record)} at ${record.office}`, actorOf(user))
        },

        registerWalkInVisitor: (input) => {
          const who = signedInWith('visitor:register-walk-in')
          if (!who.ok) return who
          const checked = validateLobbyVisit(input)
          if (!checked.ok) return checked

          const card = input.tempCardNumber?.trim().toUpperCase() || nextFreeCard(get().visitors)
          if (!card) return noFreeCard()

          const now = new Date()
          const record: VisitorRecord = {
            ...lobbyVisit(input, checked.host, who.user.office, now),
            status: 'CHECKED_IN',
            actualCheckInTime: now.toISOString(),
            tempCardNumber: card,
          }
          return insert(record, 'WALK_IN_ADMITTED', `Admitted with ${card}; ${record.hostEmployeeName} notified`, actorOf(who.user))
        },

        requestHostApproval: (input) => {
          const who = signedInWith('visitor:register-walk-in')
          if (!who.ok) return who
          // The card is issued at check-in, after the host approves.
          const request = { ...input, tempCardNumber: undefined }
          const checked = validateLobbyVisit(request)
          if (!checked.ok) return checked

          const record = lobbyVisit(request, checked.host, who.user.office, new Date())
          return insert(record, 'APPROVAL_REQUESTED', `Registered at the front desk; waiting on ${record.hostEmployeeName}`, actorOf(who.user))
        },

        approveVisitor: (visitorId) => {
          const checked = authorizeTransition('visitor:approve', visitorId, 'PRE_APPROVED', 'approve')
          if (!checked.ok) return checked
          const { visitor, user } = checked.data
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
            actorOf(user),
          )
        },

        rejectVisitor: (visitorId, reason) => {
          const checked = authorizeTransition('visitor:reject', visitorId, 'REJECTED', 'reject')
          if (!checked.ok) return checked
          const { visitor, user } = checked.data

          const trimmed = reason.trim()
          if (trimmed.length < 3) return invalid({ reason: 'Add a short reason so the front desk knows why.' })
          if (trimmed.length > 500) return invalid({ reason: 'Keep the reason under 500 characters.' })

          const revoked = visitor.status === 'PRE_APPROVED'
          return commit(
            { ...visitor, status: 'REJECTED', rejectionReason: trimmed },
            'REJECTED',
            `${revoked ? 'Pre-approval revoked' : 'Request denied'}: ${trimmed}`,
            actorOf(user),
          )
        },

        checkInVisitor: (visitorId, capture = {}) => {
          const checked = authorizeTransition('visitor:check-in', visitorId, 'CHECKED_IN', 'check in')
          if (!checked.ok) return checked
          const { visitor, user } = checked.data
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
            actorOf(user),
          )
        },

        checkOutVisitor: (visitorId) => {
          const checked = authorizeTransition('visitor:check-out', visitorId, 'CHECKED_OUT', 'check out')
          if (!checked.ok) return checked
          const { visitor, user } = checked.data
          const now = new Date()
          const stayed = visitor.actualCheckInTime ? `; on site ${formatDuration(minutesBetween(visitor.actualCheckInTime, now))}` : ''

          return commit(
            { ...visitor, status: 'CHECKED_OUT', actualCheckOutTime: now.toISOString() },
            'CHECKED_OUT',
            `Returned temp card ${visitor.tempCardNumber ?? '-'}${stayed}`,
            actorOf(user),
          )
        },

        extendVisit: (visitorId, minutes) => {
          const who = signedInWith('visitor:extend')
          if (!who.ok) return who
          const visitor = findVisitor(get().visitors, visitorId)
          if (!visitor) return failure('NOT_FOUND', 'That visitor record no longer exists.')
          const scoped = authorize(who.user, 'visitor:extend', visitor)
          if (scoped) return { ok: false, error: scoped }
          if (!isOnSite(visitor)) return failure('INVALID_TRANSITION', `Only visitors on site can have their stay extended.`)
          if (!Number.isInteger(minutes) || minutes < 15 || minutes > 480) {
            return invalid({ minutes: 'Extend by between 15 minutes and 8 hours.' })
          }

          // Extend from whichever is later, the current end or now, so an overstay gets the full extra time.
          const now = new Date()
          const end = parseISO(visitor.timeWindowEnd)
          const newEnd = addMinutes(isAfter(now, end) ? now : end, minutes)
          return commit(
            { ...visitor, status: 'CHECKED_IN', timeWindowEnd: newEnd.toISOString() },
            'VISIT_EXTENDED',
            `Stay extended by ${formatDuration(minutes)}, now until ${formatTime(newEnd)}`,
            actorOf(who.user),
          )
        },

        submitKioskRequest: (input) => {
          const checked = validateLobbyVisit(input)
          if (!checked.ok) return checked

          const record: VisitorRecord = { ...lobbyVisit(input, checked.host, KIOSK_SITE, new Date()), source: 'SELF_SERVICE' }
          return insert(record, 'APPROVAL_REQUESTED', `Requested a visit with ${record.hostEmployeeName} at the kiosk`, KIOSK)
        },

        selfCheckIn: (passToken, photoUrl) => {
          const { visitors } = get()
          const visitor = findVisitorByPassToken(visitors, passToken)
          if (!visitor) return failure('NOT_FOUND', PASS_NOT_FOUND)

          const now = new Date()
          const problem = selfCheckInProblem(visitor, KIOSK_SITE, now)
          if (problem) return failure('INVALID_TRANSITION', problem)
          if (!isPhoto(photoUrl)) return invalid({ photoUrl: 'Take a photo for your visitor badge.' })
          const card = nextFreeCard(visitors)
          if (!card) return noFreeCard()

          return commit(
            { ...visitor, status: 'CHECKED_IN', actualCheckInTime: now.toISOString(), tempCardNumber: card, photoUrl },
            'CHECKED_IN',
            `Self check-in with e-pass; temp card ${card}`,
            KIOSK,
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
          const who = signedInWith('settings:update')
          if (!who.ok) return who
          const { settings } = get()

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
            auditLog: withAudit(state.auditLog, [auditEntry('POLICY_UPDATED', actorOf(who.user), null, detail)]),
          }))
          // A shorter grace period can tip visitors into overstay straight away.
          get().evaluateOverstayStatuses()
          return { ok: true, data: next }
        },

        recordSecurityEvent: (action, user, detail) =>
          set((state) => ({ auditLog: withAudit(state.auditLog, [auditEntry(action, actorOf(user), null, detail)]) })),

        resetDemoData: () => {
          const seed = seedData()
          const user = getSessionUser()
          set({
            visitors: seed.visitors,
            auditLog: withAudit(seed.auditLog, [
              auditEntry('DATA_RESET', user ? actorOf(user) : SYSTEM, null, 'Restored the seeded visits, default policy and audit trail'),
            ]),
            settings: DEFAULT_SETTINGS,
            activeFilters: createDefaultFilters(),
          })
        },
      }
    },
    {
      name: VMS_STORAGE_KEY,
      version: 3,
      storage: createJSONStorage(() => browserStorage('localStorage')),
      partialize: (state): PersistedVms => ({
        visitors: state.visitors,
        settings: state.settings,
        auditLog: state.auditLog,
      }),
      // v1 records lack `office`, `approvedAt` and the audit trail, so those start fresh.
      // v2 also saved the demo role, which the tab's own session now replaces; merge ignores it.
      migrate: (persisted, version) => (version < 2 ? ({} as PersistedVms) : (persisted as PersistedVms)),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<PersistedVms>
        return {
          ...current,
          visitors: saved.visitors ?? current.visitors,
          auditLog: saved.auditLog ?? current.auditLog,
          settings: { ...current.settings, ...saved.settings },
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
