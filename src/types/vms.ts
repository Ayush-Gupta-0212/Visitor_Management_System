/**
 * Domain model for the Visitor Management System.
 *
 * Conventions
 * - Instants are ISO 8601 strings (`Date#toISOString()`); calendar days are
 *   `yyyy-MM-dd` in the site's local time. Both survive JSON persistence as-is.
 * - Text a person types is a string ('' when left blank). Facts the system
 *   records later (check-in time, photo, temp card, rejection reason) stay
 *   `null` until they happen.
 */

/** ISO 8601 instant, e.g. `2026-09-23T04:30:00.000Z`. */
export type IsoDateTime = string

/** Local calendar day, `yyyy-MM-dd`. */
export type IsoDate = string

export type Role = 'GATEKEEPER' | 'HOST_EMPLOYEE' | 'ADMIN'

/** Someone in the company directory, i.e. a person a visitor can come to see. */
export interface Employee {
  id: string
  name: string
  email: string
  department: string
  /** Image URL (a generated monogram in the demo data). */
  avatar: string
}

/** The person using the console. There is no real sign-in; `switchRole` swaps demo users. */
export interface UserSession extends Employee {
  role: Role
}

export type VisitorStatus =
  | 'PENDING_APPROVAL' // requested without a pre-approval; waiting on the host
  | 'PRE_APPROVED' // approved; the pass is valid inside its time window
  | 'CHECKED_IN' // on site
  | 'OVERSTAY' // still on site past the window end plus the grace period
  | 'CHECKED_OUT'
  | 'REJECTED' // denied or revoked by the host
  | 'EXPIRED' // the window closed without a check-in

export type VisitorType = 'BUSINESS_GUEST' | 'VENDOR' | 'CONTRACT_STAFF' | 'INTERVIEW' | 'GOVT_OFFICIAL' | 'OTHER'

/** How a visit entered the system. */
export type VisitSource =
  | 'PRE_APPROVAL' // scheduled in advance by the host
  | 'WALK_IN' // registered at the front desk (admitted directly, or sent to the host)
  | 'SELF_SERVICE' // requested at the self-service kiosk; needs host approval

export interface VisitorRecord {
  id: string

  // Visitor
  fullName: string
  email: string
  phone: string
  company: string
  purpose: string
  visitorType: VisitorType

  // Host
  hostEmployeeId: string
  hostEmployeeName: string
  hostDepartment: string
  /** Site the visit is booked at. */
  office: string

  // Approved window. It may cross midnight (e.g. night shifts); expectedDate is the day it starts.
  expectedDate: IsoDate
  timeWindowStart: IsoDateTime
  timeWindowEnd: IsoDateTime

  // Gate activity
  actualCheckInTime: IsoDateTime | null
  actualCheckOutTime: IsoDateTime | null
  status: VisitorStatus
  /** Photo captured at the desk or kiosk (data URI). */
  photoUrl: string | null
  /** Physical card issued at check-in, e.g. `TC-104`. */
  tempCardNumber: string | null

  /** Host's note to the guest, shown on the e-pass. */
  personalNote: string
  rejectionReason: string | null
  /** Opaque token encoded in the visitor's QR e-pass. */
  qrCodePlaceholder: string

  source: VisitSource
  /**
   * When the host approved the visit (for pre-approvals, when they created it).
   * Null for requests still awaiting a decision and for walk-ins the desk admitted directly.
   */
  approvedAt: IsoDateTime | null
  createdAt: IsoDateTime
}

export interface SystemSettings {
  /** Visits one host may approve for a single day (default 5). */
  maxPreApprovalsPerEmployeePerDay: number
  /** Grace period after the window ends before an on-site visitor is flagged OVERSTAY (default 30). */
  autoOverstayThresholdMinutes: number
}

export interface VisitorFilters {
  /** Matches name, company, email, phone, host or temp card. */
  query: string
  status: VisitorStatus | 'ALL'
  visitorType: VisitorType | 'ALL'
  /** Inclusive day range; `null` leaves that end open. See `filterVisitors` for overnight visits. */
  dateRange: { from: IsoDate | null; to: IsoDate | null }
}

export type AuditAction =
  | 'PRE_APPROVED'
  | 'APPROVAL_REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'WALK_IN_ADMITTED'
  | 'CHECKED_IN'
  | 'CHECKED_OUT'
  | 'OVERSTAY_FLAGGED'
  | 'EXPIRED'
  | 'POLICY_UPDATED'
  | 'DATA_RESET'

/** One line of the security audit trail. */
export interface AuditEntry {
  id: string
  at: IsoDateTime
  action: AuditAction
  actorName: string
  /** 'SYSTEM' for automatic sweeps and the self-service kiosk. */
  actorRole: Role | 'SYSTEM'
  visitorId: string | null
  visitorName: string | null
  detail: string
}

/* Action inputs */

/** What the visitor tells us, whichever way they are registered. */
export interface VisitorDetailsInput {
  fullName: string
  email: string
  phone: string
  company: string
  purpose: string
  visitorType: VisitorType
  personalNote?: string
  /** Defaults to the front desk's own site. */
  office?: string
}

export interface PreApprovalInput extends VisitorDetailsInput {
  timeWindowStart: IsoDateTime
  timeWindowEnd: IsoDateTime
}

export interface WalkInInput extends VisitorDetailsInput {
  hostEmployeeId: string
  /** Mandatory desk photo (data URI). */
  photoUrl: string
  /** How long the visitor expects to stay; the window starts now (default 120). */
  expectedDurationMinutes?: number
  /** Card handed over at the desk; the next free card is issued when omitted. */
  tempCardNumber?: string
}

/** Optional details captured when a pre-approved visitor arrives at the desk. */
export interface CheckInCapture {
  photoUrl?: string
  tempCardNumber?: string
}

/* Action results */

export type VmsErrorCode =
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'INVALID_TRANSITION'
  | 'QUOTA_EXCEEDED'
  | 'CONFLICT'

export interface VmsError {
  code: VmsErrorCode
  /** Human-readable, ready to show in a toast. */
  message: string
  /** Per-field messages for VALIDATION errors, keyed by input field name. */
  fields?: Record<string, string>
}

/** Store actions never throw on business-rule failures; they return one of these. */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: VmsError }
