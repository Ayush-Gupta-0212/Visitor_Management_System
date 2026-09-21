/**
 * Domain types for the Visitor Management System.
 *
 * Everything in `src/domain` is pure TypeScript: no React, no browser APIs, no
 * network calls. That makes the business rules trivially unit-testable and keeps
 * them reusable if the UI is ever rewritten (criterion: "adaptable to changing
 * requirements").
 */

/* ------------------------------------------------------------------ *
 * String-literal unions
 *
 * A union like `'APPROVED' | 'REJECTED'` is TypeScript's cheapest and most
 * useful feature: the compiler rejects any value outside the list, and `switch`
 * statements over it are checked for exhaustiveness. We use unions instead of
 * enums because they erase to plain strings at runtime.
 * ------------------------------------------------------------------ */

/** The lifecycle state of a single visit. See `statusMachine.ts` for transitions. */
export type VisitStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CHECKED_IN'
  | 'OVERSTAY'
  | 'CHECKED_OUT';

/** How the visit came into existence. Drives which approval path applies. */
export type VisitSource =
  | 'INVITE' // host invited the guest for a specific event
  | 'PRE_APPROVAL' // host approved in advance; guest arrives with a QR e-pass
  | 'WALK_IN'; // guest turned up unannounced; host is asked to approve live

/** Who physically performed the check-in. Rendered as row subtext in the table. */
export type CheckInMethod = 'SELF' | 'FRONT_DESK' | 'QR_PASS';

/**
 * Purpose of visit. These are exactly the options shown in the reference
 * wireframe's "Types of Visit" dropdown.
 */
export type VisitType =
  | 'Business Guests'
  | 'Vendor'
  | 'Personnel'
  | 'Govt Officials'
  | 'Interview'
  | 'PwC Network Firm'
  | 'Others';

export const VISIT_TYPES: readonly VisitType[] = [
  'Business Guests',
  'Vendor',
  'Personnel',
  'Govt Officials',
  'Interview',
  'PwC Network Firm',
  'Others',
];

/** Application roles. There is no real authentication - see `src/app/session.ts`. */
export type Role = 'FRONT_DESK' | 'HOST' | 'ADMIN';

/* ------------------------------------------------------------------ *
 * Entities
 * ------------------------------------------------------------------ */

export interface Office {
  id: string;
  name: string;
  city: string;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  officeId: string;
}

export interface Visitor {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  company: string;
  /** Base64 data URL captured from the webcam, or undefined for seeded records. */
  photoDataUrl?: string;
  createdAt: number;
}

/**
 * A single visit. This is the central record of the system and the one we hold
 * 50,000 of in memory, so the shape is kept flat and primitive-only: no nested
 * objects, no Date instances (timestamps are numbers, which sort and compare in
 * O(1) without allocation).
 */
export interface Visit {
  id: string;
  visitorId: string;
  hostId: string;
  officeId: string;

  eventTitle: string;
  visitType: VisitType;
  /** Optional "Personal note to guests" from the invite form. Max 1000 chars. */
  note?: string;

  status: VisitStatus;
  source: VisitSource;

  /** Start/end of the approved window, as epoch milliseconds. */
  scheduledStart: number;
  scheduledEnd: number;

  createdAt: number;
  createdBy: string;
  approvedAt?: number;
  rejectedAt?: number;
  rejectionReason?: string;
  checkInAt?: number;
  checkInMethod?: CheckInMethod;
  checkOutAt?: number;

  /** Single-use code printed on the QR e-pass. Present once approved. */
  passCode?: string;
  /** Set to true the moment the pass is used, so it cannot be reused. */
  passRedeemed?: boolean;

  tempCardNo?: string;
  additionalInfo?: string;
}

/** Append-only audit record. Never updated, never deleted. */
export interface AuditEntry {
  id: string;
  visitId: string;
  /** Employee id or 'SYSTEM' for automatic transitions such as expiry. */
  actor: string;
  action: string;
  at: number;
  from?: VisitStatus;
  to?: VisitStatus;
  detail?: string;
}

/** Admin-configurable rules. See `policy.ts` for how each one is enforced. */
export interface Policy {
  /** "Admins can enforce pre-approval limits (e.g. max 5 visitors per employee per day)." */
  preApprovalLimitPerDay: number;
  /** Minutes past `scheduledEnd` before a checked-in visit is flagged OVERSTAY. */
  overstayGraceMinutes: number;
  /** Minutes past `scheduledEnd` before an un-arrived approved visit EXPIRES. */
  expiryGraceMinutes: number;
}

export const DEFAULT_POLICY: Policy = {
  preApprovalLimitPerDay: 5,
  overstayGraceMinutes: 0,
  expiryGraceMinutes: 30,
};
