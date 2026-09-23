import { addMinutes, differenceInMinutes, isAfter, isBefore, isValid, parseISO, subMinutes } from 'date-fns'
import { formatDay, formatTime, toIsoDate } from './format'
import { hostVisitsOn } from './visitorIndex'
import type {
  IsoDate,
  IsoDateTime,
  SystemSettings,
  VisitSource,
  VisitorDetailsInput,
  VisitorFilters,
  VisitorRecord,
  VisitorStatus,
  VisitorType,
  WalkInInput,
} from '@/types/vms'

/*
 * Business rules for visits: lifecycle, time windows, the daily pre-approval
 * quota, temporary cards, input validation, filtering and day summaries.
 * Pure functions with no React or store code, so each can be tested alone.
 * List scans are a single O(N) pass; the quota check is O(K) over one host's
 * bookings for one day, via the index in visitorIndex.ts.
 */

/** Field name → message, for highlighting form inputs. */
export type FieldErrors = Record<string, string>

export const STATUS_LABELS: Record<VisitorStatus, string> = {
  PENDING_APPROVAL: 'Pending approval',
  PRE_APPROVED: 'Pre-approved',
  CHECKED_IN: 'Checked in',
  OVERSTAY: 'Overstay',
  CHECKED_OUT: 'Checked out',
  REJECTED: 'Rejected',
  EXPIRED: 'Expired',
}

export const VISITOR_TYPE_LABELS: Record<VisitorType, string> = {
  BUSINESS_GUEST: 'Business guest',
  VENDOR: 'Vendor',
  CONTRACT_STAFF: 'Contract staff',
  INTERVIEW: 'Interview',
  GOVT_OFFICIAL: 'Govt official',
  OTHER: 'Other',
}

export const SOURCE_LABELS: Record<VisitSource, string> = {
  PRE_APPROVAL: 'Pre-approved invite',
  WALK_IN: 'Walk-in',
  SELF_SERVICE: 'Kiosk request',
}

/* Lifecycle */

/*
 *  PENDING_APPROVAL ──► PRE_APPROVED ──► CHECKED_IN ──► CHECKED_OUT
 *        │                  │              ▲    │            ▲
 *        ├──► REJECTED ◄────┤      extend  │    ▼            │
 *        └──► EXPIRED  ◄────┘              └── OVERSTAY ─────┘
 */
const TRANSITIONS: Record<VisitorStatus, readonly VisitorStatus[]> = {
  PENDING_APPROVAL: ['PRE_APPROVED', 'REJECTED', 'EXPIRED'],
  PRE_APPROVED: ['CHECKED_IN', 'REJECTED', 'EXPIRED'],
  CHECKED_IN: ['CHECKED_OUT', 'OVERSTAY'],
  OVERSTAY: ['CHECKED_OUT', 'CHECKED_IN'], // back to CHECKED_IN when the desk extends the stay
  CHECKED_OUT: [],
  REJECTED: [],
  EXPIRED: [],
}

export function canTransition(from: VisitorStatus, to: VisitorStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

/** On the premises, and therefore holding a temporary card. */
export function isOnSite(visitor: VisitorRecord): boolean {
  return visitor.status === 'CHECKED_IN' || visitor.status === 'OVERSTAY'
}

/** Desk order: people needing attention first, then arrivals, then history. */
const STATUS_PRIORITY: Record<VisitorStatus, number> = {
  OVERSTAY: 0,
  PENDING_APPROVAL: 1,
  CHECKED_IN: 2,
  PRE_APPROVED: 3,
  CHECKED_OUT: 4,
  EXPIRED: 5,
  REJECTED: 6,
}
const CLOSED: ReadonlySet<VisitorStatus> = new Set(['CHECKED_OUT', 'EXPIRED', 'REJECTED'])

/** Sorts by status priority; live visits soonest first, closed ones newest first. O(N log N). */
export function sortForDesk(visitors: readonly VisitorRecord[]): VisitorRecord[] {
  return [...visitors].sort((a, b) => {
    const byStatus = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]
    if (byStatus !== 0) return byStatus
    const byStart = a.timeWindowStart.localeCompare(b.timeWindowStart)
    return CLOSED.has(a.status) ? -byStart : byStart
  })
}

export function countByStatus(visitors: readonly VisitorRecord[]): Record<VisitorStatus | 'ALL', number> {
  const counts: Record<VisitorStatus | 'ALL', number> = {
    ALL: visitors.length,
    PENDING_APPROVAL: 0,
    PRE_APPROVED: 0,
    CHECKED_IN: 0,
    OVERSTAY: 0,
    CHECKED_OUT: 0,
    REJECTED: 0,
    EXPIRED: 0,
  }
  for (const visitor of visitors) counts[visitor.status]++
  return counts
}

/* Time windows */

/** How long before the window opens a pre-approved visitor may already check in. */
export const EARLY_CHECK_IN_MINUTES = 30
/** Expected stay for a walk-in when the desk doesn't specify one. */
export const DEFAULT_WALK_IN_MINUTES = 120

/** On site and more than `graceMinutes` past the end of the approved window. */
export function isOverstaying(visitor: VisitorRecord, now: Date, graceMinutes: number): boolean {
  return visitor.status === 'CHECKED_IN' && isAfter(now, addMinutes(parseISO(visitor.timeWindowEnd), graceMinutes))
}

/** Requested or approved, but the window closed before the visitor checked in. */
export function hasLapsed(visitor: VisitorRecord, now: Date): boolean {
  const awaitingArrival = visitor.status === 'PENDING_APPROVAL' || visitor.status === 'PRE_APPROVED'
  return awaitingArrival && isAfter(now, parseISO(visitor.timeWindowEnd))
}

/** Why a pre-approved visitor can't check in at `now`, or null if they can. */
export function checkInWindowError(visitor: VisitorRecord, now: Date): string | null {
  if (isAfter(now, parseISO(visitor.timeWindowEnd))) {
    return `${visitor.fullName}'s pass expired at ${formatTime(visitor.timeWindowEnd)}.`
  }
  if (isBefore(now, subMinutes(parseISO(visitor.timeWindowStart), EARLY_CHECK_IN_MINUTES))) {
    return `Too early: ${visitor.fullName}'s pass is valid from ${formatTime(visitor.timeWindowStart)} on ${formatDay(visitor.expectedDate)}.`
  }
  return null
}

/* Self check-in at the lobby kiosk */

export const PASS_NOT_FOUND = "We couldn't find a pass with that code. Please see the front desk."

/** What the kiosk tells a visitor whose pass can't be used for self check-in. */
const SELF_CHECK_IN_BLOCKED: Record<Exclude<VisitorStatus, 'PRE_APPROVED'>, string> = {
  PENDING_APPROVAL: "Your host hasn't approved this visit yet. Please see the front desk.",
  CHECKED_IN: "You're already checked in. Enjoy your visit!",
  OVERSTAY: "You're already checked in. Please see the front desk.",
  CHECKED_OUT: 'This pass has already been used. Please see the front desk.',
  REJECTED: 'This pass was revoked by your host. Please see the front desk.',
  EXPIRED: 'This pass has expired. Please see the front desk.',
}

/**
 * Why `visitor` can't check themselves in at the kiosk at `site` right now, or null
 * if they can. The kiosk asks before taking the photo; the store asks again on submit.
 */
export function selfCheckInProblem(visitor: VisitorRecord, site: string, now: Date): string | null {
  if (visitor.office !== site) return `This pass is for our ${visitor.office} office. Please see the front desk.`
  if (visitor.status !== 'PRE_APPROVED') return SELF_CHECK_IN_BLOCKED[visitor.status]
  return checkInWindowError(visitor, now)
}

/* Daily pre-approval quota */

/**
 * Visits `hostId` has approved for `day`: pre-approvals plus requests they
 * approved, minus any they later revoked. Walk-ins the desk admitted directly
 * never count. O(K) over the host's K bookings that day, via the host/day index.
 */
export function countApprovalsForDay(visitors: readonly VisitorRecord[], hostId: string, day: IsoDate): number {
  let count = 0
  for (const visitor of hostVisitsOn(visitors, hostId, day)) {
    if (visitor.approvedAt !== null && visitor.status !== 'REJECTED') count++
  }
  return count
}

/* Temporary cards */

const CARD_PATTERN = /^TC-\d{3}$/
const CARD_POOL = { first: 101, last: 999 }

function cardsInUse(visitors: readonly VisitorRecord[]): Set<string> {
  const inUse = new Set<string>()
  for (const visitor of visitors) {
    if (isOnSite(visitor) && visitor.tempCardNumber) inUse.add(visitor.tempCardNumber)
  }
  return inUse
}

/** Lowest-numbered card nobody on site is holding, or null if every card is out. O(N + pool size). */
export function nextFreeCard(visitors: readonly VisitorRecord[]): string | null {
  const inUse = cardsInUse(visitors)
  for (let n = CARD_POOL.first; n <= CARD_POOL.last; n++) {
    if (!inUse.has(`TC-${n}`)) return `TC-${n}`
  }
  return null
}

/** Why `card` can't be issued right now, or null if it can. */
export function cardError(card: string, visitors: readonly VisitorRecord[]): string | null {
  if (!CARD_PATTERN.test(card)) return 'Card numbers look like TC-104.'
  if (cardsInUse(visitors).has(card)) return `${card} is already issued to someone on site.`
  return null
}

/* Validation */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_PATTERN = /^\+?[\d\s()-]+$/
const PHOTO_PATTERN = /^(data:image\/|https?:\/\/)/

/** A captured photo (data URI) or a hosted image URL. */
export const isPhoto = (value: string) => PHOTO_PATTERN.test(value)

const collapseSpaces = (text: string) => text.trim().replace(/\s+/g, ' ')

/** Checks the details every registration path collects. Returns all problems at once. */
export function validateVisitorDetails(input: VisitorDetailsInput): FieldErrors {
  const errors: FieldErrors = {}
  const name = collapseSpaces(input.fullName)
  const email = input.email.trim()
  const phone = input.phone.trim()
  const phoneDigits = phone.replace(/\D/g, '').length
  const purpose = collapseSpaces(input.purpose)

  if (name.length < 2) errors.fullName = "Enter the visitor's full name."
  else if (name.length > 80) errors.fullName = 'Keep the name under 80 characters.'

  if (email && !EMAIL_PATTERN.test(email)) errors.email = 'Enter a valid email address.'
  if (phone && (!PHONE_PATTERN.test(phone) || phoneDigits < 7 || phoneDigits > 15)) {
    errors.phone = 'Enter a valid phone number.'
  }
  if (!email && !phone) errors.phone = 'Add a mobile number or an email address.'

  if (purpose.length < 3) errors.purpose = 'Describe the purpose of the visit.'
  else if (purpose.length > 200) errors.purpose = 'Keep the purpose under 200 characters.'

  if (input.company.trim().length > 100) errors.company = 'Keep the company name under 100 characters.'
  if (!Object.hasOwn(VISITOR_TYPE_LABELS, input.visitorType)) errors.visitorType = 'Choose a visitor type.'
  if ((input.personalNote ?? '').trim().length > 1000) errors.personalNote = 'Keep the note under 1,000 characters.'

  return errors
}

/** A pre-approval window must be well-formed, at most 24 hours long, and not already over. */
export function validateWindow(start: IsoDateTime, end: IsoDateTime, now: Date): FieldErrors {
  const startsAt = parseISO(start)
  const endsAt = parseISO(end)

  if (!isValid(startsAt)) return { timeWindowStart: 'Choose when the visit starts.' }
  if (!isValid(endsAt)) return { timeWindowEnd: 'Choose when the visit ends.' }
  if (!isAfter(endsAt, startsAt)) return { timeWindowEnd: 'The window must end after it starts.' }
  if (differenceInMinutes(endsAt, startsAt) > 24 * 60) return { timeWindowEnd: 'A visit window can be at most 24 hours.' }
  if (!isAfter(endsAt, now)) return { timeWindowEnd: 'This window has already ended.' }
  return {}
}

/** Walk-in extras: the mandatory photo, a sensible expected stay, and a free card if one is named. */
export function validateWalkIn(input: WalkInInput, visitors: readonly VisitorRecord[]): FieldErrors {
  const errors: FieldErrors = {}
  const minutes = input.expectedDurationMinutes ?? DEFAULT_WALK_IN_MINUTES
  const card = input.tempCardNumber?.trim().toUpperCase()

  if (!isPhoto(input.photoUrl)) errors.photoUrl = "Capture the visitor's photo; it's mandatory at the desk."
  if (!Number.isInteger(minutes) || minutes < 15 || minutes > 24 * 60) {
    errors.expectedDurationMinutes = 'Expected stay must be between 15 minutes and 24 hours.'
  }
  const cardProblem = card ? cardError(card, visitors) : null
  if (cardProblem) errors.tempCardNumber = cardProblem

  return errors
}

export function validateSettings(settings: SystemSettings): FieldErrors {
  const errors: FieldErrors = {}
  const { maxPreApprovalsPerEmployeePerDay: limit, autoOverstayThresholdMinutes: grace } = settings

  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    errors.maxPreApprovalsPerEmployeePerDay = 'Allow between 1 and 50 approvals per employee per day.'
  }
  if (!Number.isInteger(grace) || grace < 0 || grace > 480) {
    errors.autoOverstayThresholdMinutes = 'Set a grace period between 0 and 480 minutes.'
  }
  return errors
}

/** Tidies free text and contact details before they're stored. */
export function normalizeDetails(input: VisitorDetailsInput) {
  return {
    fullName: collapseSpaces(input.fullName),
    email: input.email.trim().toLowerCase(),
    phone: collapseSpaces(input.phone),
    company: collapseSpaces(input.company),
    purpose: collapseSpaces(input.purpose),
    visitorType: input.visitorType,
    personalNote: (input.personalNote ?? '').trim(),
  }
}

/* Filtering and summaries */

/**
 * A visit belongs to a day range when its window overlaps the range, or when
 * the visitor is still on site and the range includes today, so an overnight
 * overstay never drops off the front desk's "today" view.
 */
function inDateRange(visitor: VisitorRecord, from: IsoDate | null, to: IsoDate | null, today: IsoDate): boolean {
  if (!from && !to) return true
  const lower = from ?? '0000-01-01'
  const upper = to ?? '9999-12-31'
  const lastDay = toIsoDate(parseISO(visitor.timeWindowEnd))
  if (visitor.expectedDate <= upper && lastDay >= lower) return true
  return isOnSite(visitor) && today >= lower && today <= upper
}

/**
 * Applies the search box, status, type and date filters in one pass. O(N).
 * Queries with three or more digits also match phone numbers, ignoring formatting.
 */
export function filterVisitors(
  visitors: readonly VisitorRecord[],
  filters: VisitorFilters,
  now: Date = new Date(),
): VisitorRecord[] {
  const today = toIsoDate(now)
  const query = filters.query.trim().toLowerCase()
  const queryDigits = query.replace(/\D/g, '')
  const { from, to } = filters.dateRange

  return visitors.filter((visitor) => {
    if (filters.status !== 'ALL' && visitor.status !== filters.status) return false
    if (filters.visitorType !== 'ALL' && visitor.visitorType !== filters.visitorType) return false
    if (!inDateRange(visitor, from, to, today)) return false
    if (!query) return true

    const text = [visitor.fullName, visitor.company, visitor.email, visitor.hostEmployeeName, visitor.tempCardNumber ?? '']
      .join(' ')
      .toLowerCase()
    return text.includes(query) || (queryDigits.length >= 3 && visitor.phone.replace(/\D/g, '').includes(queryDigits))
  })
}

export interface DaySummary {
  /** Visits active today, rejected ones excluded. */
  total: number
  onSite: number
  overstay: number
  /** Approved visitors whose window hasn't closed yet today. */
  expected: number
  pending: number
  checkedOut: number
  /** Expected visitor with the earliest window, if any. */
  nextArrival: VisitorRecord | null
}

/** Headline numbers for the dashboards, in a single O(N) pass. */
export function summarizeDay(visitors: readonly VisitorRecord[], now: Date): DaySummary {
  const today = toIsoDate(now)
  const summary: DaySummary = { total: 0, onSite: 0, overstay: 0, expected: 0, pending: 0, checkedOut: 0, nextArrival: null }

  for (const visitor of visitors) {
    if (isOnSite(visitor)) summary.onSite++
    if (visitor.status === 'OVERSTAY') summary.overstay++
    if (visitor.status === 'PENDING_APPROVAL') summary.pending++
    if (!inDateRange(visitor, today, today, today)) continue

    if (visitor.status !== 'REJECTED') summary.total++
    if (visitor.status === 'CHECKED_OUT') summary.checkedOut++
    if (visitor.status === 'PRE_APPROVED' && isAfter(parseISO(visitor.timeWindowEnd), now)) {
      summary.expected++
      if (!summary.nextArrival || visitor.timeWindowStart < summary.nextArrival.timeWindowStart) {
        summary.nextArrival = visitor
      }
    }
  }
  return summary
}
