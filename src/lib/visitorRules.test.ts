import { addMinutes, subMinutes } from 'date-fns'
import { describe, expect, it } from 'vitest'
import { makeVisitor } from '@/test/fixtures'
import { toIsoDate } from './format'
import {
  canTransition,
  checkInWindowError,
  countApprovalsForDay,
  filterVisitors,
  hasLapsed,
  isOverstaying,
  nextFreeCard,
  selfCheckInProblem,
  validateVisitorDetails,
  validateWindow,
} from './visitorRules'

const now = new Date('2026-09-23T10:00:00')

describe('visit lifecycle', () => {
  it('follows the documented state machine', () => {
    expect(canTransition('PENDING_APPROVAL', 'PRE_APPROVED')).toBe(true)
    expect(canTransition('PRE_APPROVED', 'CHECKED_IN')).toBe(true)
    expect(canTransition('OVERSTAY', 'CHECKED_IN')).toBe(true) // the desk extended the stay
    expect(canTransition('PENDING_APPROVAL', 'CHECKED_IN')).toBe(false) // no entry without approval
    expect(canTransition('CHECKED_OUT', 'CHECKED_IN')).toBe(false) // a used pass stays used
    expect(canTransition('REJECTED', 'PRE_APPROVED')).toBe(false)
  })

  it('flags an overstay only after the grace period', () => {
    const visitor = makeVisitor({ status: 'CHECKED_IN', timeWindowEnd: now.toISOString() })
    expect(isOverstaying(visitor, addMinutes(now, 30), 30)).toBe(false)
    expect(isOverstaying(visitor, addMinutes(now, 31), 30)).toBe(true)
    expect(isOverstaying({ ...visitor, status: 'CHECKED_OUT' }, addMinutes(now, 90), 30)).toBe(false)
  })

  it('expires approvals whose window closed before check-in', () => {
    const visitor = makeVisitor({ timeWindowEnd: now.toISOString() })
    expect(hasLapsed(visitor, subMinutes(now, 1))).toBe(false)
    expect(hasLapsed(visitor, addMinutes(now, 1))).toBe(true)
    expect(hasLapsed({ ...visitor, status: 'CHECKED_IN' }, addMinutes(now, 1))).toBe(false)
  })
})

describe('check-in window', () => {
  const visitor = makeVisitor({ fullName: 'Asha Rao', timeWindowStart: now.toISOString() }, now)

  it('opens 30 minutes early and closes at the end of the window', () => {
    expect(checkInWindowError(visitor, subMinutes(now, 30))).toBeNull()
    expect(checkInWindowError(visitor, subMinutes(now, 31))).toMatch(/^Too early/)
    expect(checkInWindowError(visitor, addMinutes(now, 61))).toMatch(/expired/)
  })

  it('lets the kiosk refuse passes for another site or in the wrong state', () => {
    expect(selfCheckInProblem(visitor, 'Mumbai Goregaon', now)).toBeNull()
    expect(selfCheckInProblem(visitor, 'Bengaluru Whitefield', now)).toMatch(/Mumbai Goregaon office/)
    expect(selfCheckInProblem({ ...visitor, status: 'REJECTED' }, 'Mumbai Goregaon', now)).toMatch(/revoked/)
    expect(selfCheckInProblem({ ...visitor, status: 'PENDING_APPROVAL' }, 'Mumbai Goregaon', now)).toMatch(/hasn't approved/)
  })
})

describe('daily pre-approval quota', () => {
  it('counts approvals and approved requests, not revoked visits or desk walk-ins', () => {
    const day = toIsoDate(now)
    const visitors = [
      makeVisitor({}, now),
      makeVisitor({ source: 'SELF_SERVICE' }, now), // request the host approved
      makeVisitor({ status: 'REJECTED' }, now), // revoked
      makeVisitor({ source: 'WALK_IN', status: 'CHECKED_IN', approvedAt: null }, now), // admitted at the desk
      makeVisitor({ status: 'PENDING_APPROVAL', approvedAt: null }, now), // still waiting
      makeVisitor({ hostEmployeeId: 'emp-rohan' }, now), // someone else's guest
    ]
    expect(countApprovalsForDay(visitors, 'emp-lalita', day)).toBe(2)
  })
})

describe('temporary cards', () => {
  it('issues the lowest card nobody on site is holding', () => {
    const visitors = [
      makeVisitor({ status: 'CHECKED_IN', tempCardNumber: 'TC-101' }),
      makeVisitor({ status: 'CHECKED_OUT', tempCardNumber: 'TC-102' }), // returned
      makeVisitor({ status: 'OVERSTAY', tempCardNumber: 'TC-103' }),
    ]
    expect(nextFreeCard(visitors)).toBe('TC-102')
  })
})

describe('validation', () => {
  it('reports every problem with a visitor at once', () => {
    const errors = validateVisitorDetails({ fullName: 'A', email: 'not-an-email', phone: '', company: '', purpose: '', visitorType: 'VENDOR' })
    expect(Object.keys(errors).sort()).toEqual(['email', 'fullName', 'purpose'])
  })

  it('needs a mobile number or an email', () => {
    const errors = validateVisitorDetails({ fullName: 'Asha Rao', email: '', phone: '', company: '', purpose: 'Interview', visitorType: 'INTERVIEW' })
    expect(errors.phone).toBeDefined()
  })

  it('rejects windows that end before they start, run over 24 hours or are already over', () => {
    const at = (minutes: number) => addMinutes(now, minutes).toISOString()
    expect(validateWindow(at(60), at(120), now)).toEqual({})
    expect(validateWindow(at(60), at(30), now).timeWindowEnd).toBeDefined()
    expect(validateWindow(at(0), at(25 * 60), now).timeWindowEnd).toBeDefined()
    expect(validateWindow(at(-120), at(-60), now).timeWindowEnd).toBeDefined()
  })
})

describe('filters', () => {
  it('matches phone numbers regardless of formatting', () => {
    const visitors = [makeVisitor({ phone: '+91 98200 12345' }, now), makeVisitor({ phone: '+91 90000 00001' }, now)]
    const filters = { query: '9820012', status: 'ALL' as const, visitorType: 'ALL' as const, dateRange: { from: null, to: null } }
    expect(filterVisitors(visitors, filters, now)).toHaveLength(1)
  })
})
