import {
  addDays,
  addMinutes,
  min,
  parseISO,
  roundToNearestMinutes,
  set,
  startOfDay,
  startOfMinute,
  subDays,
  subMinutes,
} from 'date-fns'
import { formatDay, formatTime, formatWindow, toIsoDate } from '@/lib/format'
import { createMonogram } from '@/lib/photo'
import { createId } from '@/lib/utils'
import type {
  AuditAction,
  AuditEntry,
  Employee,
  IsoDateTime,
  Role,
  UserSession,
  VisitSource,
  VisitorRecord,
  VisitorStatus,
  VisitorType,
} from '@/types/vms'

/*
 * Demo data for the Mumbai Goregaon front desk. Visitor and host names follow the
 * assignment's reference screens; companies, emails (reserved `.example` domains)
 * and phone numbers are fictional.
 */

/** Sites a visit can be booked at. The front desk in this demo is the first. */
export const OFFICES = ['Mumbai Goregaon', 'Bengaluru Whitefield', 'Gurugram Cyber City', 'Hyderabad HITEC City'] as const

function employee(id: string, name: string, department: string): Employee {
  const email = `${name.toLowerCase().replace(/\s+/g, '.')}@corp.example`
  return { id, name, email, department, avatar: createMonogram(name) }
}

const lalita = employee('emp-lalita', 'Lalita Mehta', 'Internal Firm Services')
const rohan = employee('emp-rohan', 'Rohan Deshpande', 'Technology Consulting')
const ananya = employee('emp-ananya', 'Ananya Iyer', 'Talent Acquisition')
const vikram = employee('emp-vikram', 'Vikram Rathore', 'Facilities Management')
const meera = employee('emp-meera', 'Meera Krishnan', 'Finance')
const farhan = employee('emp-farhan', 'Farhan Qureshi', 'Risk & Compliance')

/** Everyone a visitor can be hosted by: the list the desk searches when registering a walk-in. */
export const EMPLOYEE_DIRECTORY: readonly Employee[] = [lalita, rohan, ananya, vikram, meera, farhan]

/** One demo user per role for `switchRole`. The host is Lalita Mehta, as in the reference screens. */
export const DEMO_USERS: Record<Role, UserSession> = {
  GATEKEEPER: { ...employee('emp-suresh', 'Suresh Pawar', 'Security · Front Desk'), role: 'GATEKEEPER' },
  HOST_EMPLOYEE: { ...lalita, role: 'HOST_EMPLOYEE' },
  ADMIN: { ...employee('emp-kavita', 'Kavita Joshi', 'Workplace Operations'), role: 'ADMIN' },
}

interface SeedVisit {
  id: string
  name: string
  company: string
  visitorType: VisitorType
  purpose: string
  host: Employee
  source: VisitSource
  status: VisitorStatus
  window: [start: Date, end: Date]
  checkIn?: Date
  checkOut?: Date
  card?: string
  note?: string
  rejectionReason?: string
}

/**
 * Twenty visits generated relative to `now`, so the console always has people on
 * site, overstaying, arriving and scheduled whenever the demo is first opened.
 */
export function createMockVisitors(now: Date = new Date()): VisitorRecord[] {
  const current = startOfMinute(now)
  // Scheduled visits start on half-hour slots, like real bookings.
  const slot = roundToNearestMinutes(now, { nearestTo: 30, roundingMethod: 'floor' })

  const minutesAgo = (minutes: number) => subMinutes(current, minutes)
  const fromSlot = (minutes: number) => addMinutes(slot, minutes)
  const onDay = (dayOffset: number, hours: number, minutes = 0) =>
    set(addDays(startOfDay(now), dayOffset), { hours, minutes })
  const span = (start: Date, minutes: number): [Date, Date] => [start, addMinutes(start, minutes)]
  // A walk-in's window opens at check-in and lasts their expected stay.
  const walkIn = (checkIn: Date, minutes: number) => ({ window: span(checkIn, minutes), checkIn })

  const seeds: SeedVisit[] = [
    // Still on site well past window end + grace period
    {
      id: 'vis-01', name: 'Dhulabhai Bamania', company: 'Walsons', visitorType: 'CONTRACT_STAFF',
      purpose: 'Lobby security cover, day shift', host: lalita, source: 'WALK_IN', status: 'OVERSTAY',
      ...walkIn(minutesAgo(9 * 60 + 12), 8 * 60), card: 'TC-116',
    },
    {
      id: 'vis-02', name: 'Navin Patidar', company: 'Patidar Electricals', visitorType: 'VENDOR',
      purpose: 'Electrical panel maintenance, Floor 3', host: lalita, source: 'PRE_APPROVAL', status: 'OVERSTAY',
      window: [fromSlot(-300), fromSlot(-120)], checkIn: fromSlot(-289), card: 'TC-104',
      note: 'Please report at Front Desk',
    },
    {
      id: 'vis-03', name: 'Geeta Gohil', company: 'Walsons', visitorType: 'CONTRACT_STAFF',
      purpose: 'Cafeteria deep clean', host: lalita, source: 'PRE_APPROVAL', status: 'OVERSTAY',
      window: [fromSlot(-240), fromSlot(-60)], checkIn: fromSlot(-236), card: 'TC-109',
    },

    // On site, inside their window
    {
      id: 'vis-04', name: 'Sukhdev Ahari', company: 'Walsons', visitorType: 'CONTRACT_STAFF',
      purpose: 'Lobby security cover, relief shift', host: lalita, source: 'WALK_IN', status: 'CHECKED_IN',
      ...walkIn(minutesAgo(125), 8 * 60), card: 'TC-121',
    },
    {
      id: 'vis-05', name: 'Teja Neeradi', company: 'Kinetic Analytics', visitorType: 'BUSINESS_GUEST',
      purpose: 'Quarterly business review', host: rohan, source: 'PRE_APPROVAL', status: 'CHECKED_IN',
      window: [fromSlot(-30), fromSlot(90)], checkIn: fromSlot(-23), card: 'TC-102',
      note: 'Please report at Front Desk',
    },
    {
      id: 'vis-06', name: 'Nilesh Pandey', company: 'Quickfix HVAC Services', visitorType: 'VENDOR',
      purpose: 'HVAC servicing, server room', host: vikram, source: 'PRE_APPROVAL', status: 'CHECKED_IN',
      window: [fromSlot(-60), fromSlot(120)], checkIn: fromSlot(-51), card: 'TC-107',
    },
    {
      id: 'vis-07', name: 'Priyanka Shah', company: '', visitorType: 'INTERVIEW',
      purpose: 'Final-round interview, Data Analyst', host: ananya, source: 'PRE_APPROVAL', status: 'CHECKED_IN',
      window: [fromSlot(-30), fromSlot(60)], checkIn: fromSlot(-12), card: 'TC-111',
      note: 'Carry a government-issued photo ID.',
    },
    {
      id: 'vis-08', name: 'R. K. Verma', company: 'Municipal Fire Safety Office', visitorType: 'GOVT_OFFICIAL',
      purpose: 'Annual fire safety compliance inspection', host: farhan, source: 'PRE_APPROVAL', status: 'CHECKED_IN',
      window: [fromSlot(-90), fromSlot(90)], checkIn: fromSlot(-87), card: 'TC-113',
    },

    // Visited and left
    {
      id: 'vis-09', name: 'Ajay Singh', company: 'Walsons', visitorType: 'CONTRACT_STAFF',
      purpose: 'Lobby security cover, night shift', host: lalita, source: 'WALK_IN', status: 'CHECKED_OUT',
      ...walkIn(onDay(-2, 20, 4), 8 * 60), checkOut: onDay(-1, 4, 6), card: 'TC-105',
    },
    {
      id: 'vis-10', name: 'Arun Kumar', company: 'Walsons', visitorType: 'CONTRACT_STAFF',
      purpose: 'Parking management, day shift', host: lalita, source: 'WALK_IN', status: 'CHECKED_OUT',
      ...walkIn(onDay(-1, 9, 15), 8 * 60), checkOut: onDay(-1, 17, 9), card: 'TC-106',
    },
    {
      id: 'vis-11', name: 'Vinod Dindor', company: 'Walsons', visitorType: 'CONTRACT_STAFF',
      purpose: 'Housekeeping, morning shift', host: lalita, source: 'PRE_APPROVAL', status: 'CHECKED_OUT',
      window: [onDay(-1, 7), onDay(-1, 16)], checkIn: onDay(-1, 7, 14), checkOut: onDay(-1, 15, 58), card: 'TC-118',
    },
    {
      id: 'vis-12', name: 'Jagesh Singh', company: '', visitorType: 'OTHER',
      purpose: 'Dropping off documents for an employee', host: meera, source: 'WALK_IN', status: 'CHECKED_OUT',
      ...walkIn(onDay(-3, 11, 5), 60), checkOut: onDay(-3, 11, 38), card: 'TC-103',
    },

    // Approved and expected (Rahul's window is open now, so he can be checked in straight away)
    {
      id: 'vis-13', name: 'Rahul Menon', company: 'Northwind Logistics', visitorType: 'BUSINESS_GUEST',
      purpose: 'Contract renewal discussion', host: lalita, source: 'PRE_APPROVAL', status: 'PRE_APPROVED',
      window: [fromSlot(-30), fromSlot(90)], note: 'Please report at Front Desk',
    },
    {
      id: 'vis-14', name: 'Vanraj Maru', company: 'Maru Pest Control', visitorType: 'VENDOR',
      purpose: 'Quarterly pest control, pantry and cafeteria', host: lalita, source: 'PRE_APPROVAL',
      status: 'PRE_APPROVED', window: [fromSlot(120), fromSlot(240)],
    },
    {
      id: 'vis-15', name: 'Akshay Tiwari', company: '', visitorType: 'INTERVIEW',
      purpose: 'Technical interview, Frontend Engineer', host: ananya, source: 'PRE_APPROVAL', status: 'PRE_APPROVED',
      window: [onDay(1, 11), onDay(1, 12)], note: 'Carry a government-issued photo ID.',
    },
    {
      id: 'vis-16', name: 'Deepa Raghavan', company: 'Kinetic Analytics', visitorType: 'BUSINESS_GUEST',
      purpose: 'Data platform workshop', host: rohan, source: 'PRE_APPROVAL', status: 'PRE_APPROVED',
      window: [onDay(2, 14), onDay(2, 17)],
    },

    // Raised at the kiosk, waiting on the host
    {
      id: 'vis-17', name: 'Imran Sheikh', company: 'Crestline Advisors', visitorType: 'BUSINESS_GUEST',
      purpose: 'Audit follow-up meeting', host: lalita, source: 'SELF_SERVICE', status: 'PENDING_APPROVAL',
      window: span(minutesAgo(6), 120),
    },
    {
      id: 'vis-18', name: 'Kiran Bhosale', company: 'Swift Courier Co', visitorType: 'VENDOR',
      purpose: 'Courier pickup, signed contracts', host: rohan, source: 'SELF_SERVICE', status: 'PENDING_APPROVAL',
      window: span(minutesAgo(3), 60),
    },

    // Closed without a visit
    {
      id: 'vis-19', name: 'Rakesh Jadhav', company: 'Apex Office Supplies', visitorType: 'VENDOR',
      purpose: 'Product demo', host: lalita, source: 'SELF_SERVICE', status: 'REJECTED',
      window: [onDay(-1, 15), onDay(-1, 16)],
      rejectionReason: 'Unscheduled sales visit. Please book through the procurement team.',
    },
    {
      id: 'vis-20', name: 'Pooja Nair', company: '', visitorType: 'INTERVIEW',
      purpose: 'HR screening interview', host: ananya, source: 'PRE_APPROVAL', status: 'EXPIRED',
      window: [onDay(-1, 15, 30), onDay(-1, 16, 30)],
    },
  ]

  return seeds.map((seed, index): VisitorRecord => {
    const [start, end] = seed.window
    const emailDomain = seed.company ? `${seed.company.toLowerCase().replace(/[^a-z0-9]/g, '')}.example` : 'mail.example'
    // The kiosk photographs self-service visitors; everyone else is photographed at check-in.
    const photographed = seed.checkIn !== undefined || seed.source === 'SELF_SERVICE'
    // Hosts book a day ahead; walk-ins and kiosk requests are created on arrival.
    const createdAt = seed.source === 'PRE_APPROVAL' ? min([subDays(start, 1), current]) : (seed.checkIn ?? start)

    return {
      id: seed.id,
      fullName: seed.name,
      email: `${seed.name.toLowerCase().replace(/[^a-z]+/g, '.')}@${emailDomain}`,
      phone: `+91 90000 ${10001 + index}`,
      company: seed.company,
      purpose: seed.purpose,
      visitorType: seed.visitorType,
      hostEmployeeId: seed.host.id,
      hostEmployeeName: seed.host.name,
      hostDepartment: seed.host.department,
      office: OFFICES[0],
      expectedDate: toIsoDate(start),
      timeWindowStart: start.toISOString(),
      timeWindowEnd: end.toISOString(),
      actualCheckInTime: seed.checkIn?.toISOString() ?? null,
      actualCheckOutTime: seed.checkOut?.toISOString() ?? null,
      status: seed.status,
      photoUrl: photographed ? createMonogram(seed.name) : null,
      tempCardNumber: seed.card ?? null,
      personalNote: seed.note ?? '',
      rejectionReason: seed.rejectionReason ?? null,
      qrCodePlaceholder: createId(),
      source: seed.source,
      // Pre-approvals are approved as they're created; nothing else in the seed was approved.
      approvedAt: seed.source === 'PRE_APPROVAL' ? createdAt.toISOString() : null,
      createdAt: createdAt.toISOString(),
    }
  })
}

type AuditActor = Pick<AuditEntry, 'actorName' | 'actorRole'>

/** The audit trail those visits would have produced, newest first, so the admin view has history from the start. */
export function createMockAuditLog(visitors: readonly VisitorRecord[], now: Date = new Date()): AuditEntry[] {
  const desk: AuditActor = { actorName: DEMO_USERS.GATEKEEPER.name, actorRole: 'GATEKEEPER' }
  const system: AuditActor = { actorName: 'System', actorRole: 'SYSTEM' }
  const kiosk: AuditActor = { actorName: 'Self-service kiosk', actorRole: 'SYSTEM' }
  const entries: AuditEntry[] = []

  const add = (action: AuditAction, at: IsoDateTime | Date, actor: AuditActor, visitor: VisitorRecord, detail: string) =>
    entries.push({
      id: createId(),
      at: typeof at === 'string' ? at : at.toISOString(),
      action,
      ...actor,
      visitorId: visitor.id,
      visitorName: visitor.fullName,
      detail,
    })

  for (const visitor of visitors) {
    const host: AuditActor = { actorName: visitor.hostEmployeeName, actorRole: 'HOST_EMPLOYEE' }
    const window = `${formatDay(visitor.expectedDate)}, ${formatWindow(visitor.timeWindowStart, visitor.timeWindowEnd)}`

    if (visitor.source === 'PRE_APPROVAL') add('PRE_APPROVED', visitor.createdAt, host, visitor, `${window} at ${visitor.office}`)
    if (visitor.source === 'SELF_SERVICE') {
      add('APPROVAL_REQUESTED', visitor.createdAt, kiosk, visitor, `Requested a visit with ${visitor.hostEmployeeName}`)
    }
    if (visitor.actualCheckInTime) {
      if (visitor.source === 'WALK_IN') {
        add('WALK_IN_ADMITTED', visitor.actualCheckInTime, desk, visitor, `Admitted with ${visitor.tempCardNumber}; ${visitor.hostEmployeeName} notified`)
      } else {
        add('CHECKED_IN', visitor.actualCheckInTime, desk, visitor, `Issued temp card ${visitor.tempCardNumber}`)
      }
    }
    if (visitor.status === 'OVERSTAY') {
      add('OVERSTAY_FLAGGED', addMinutes(parseISO(visitor.timeWindowEnd), 30), system, visitor,
        `Window ended ${formatTime(visitor.timeWindowEnd)}; 30 min grace period exceeded`)
    }
    if (visitor.actualCheckOutTime) {
      add('CHECKED_OUT', visitor.actualCheckOutTime, desk, visitor, `Returned temp card ${visitor.tempCardNumber}`)
    }
    if (visitor.status === 'REJECTED') {
      add('REJECTED', addMinutes(parseISO(visitor.createdAt), 12), host, visitor, `Reason: ${visitor.rejectionReason}`)
    }
    if (visitor.status === 'EXPIRED') {
      add('EXPIRED', visitor.timeWindowEnd, system, visitor, `No check-in before ${formatTime(visitor.timeWindowEnd)}`)
    }
  }

  return entries.filter((entry) => Date.parse(entry.at) <= now.getTime()).sort((a, b) => b.at.localeCompare(a.at))
}
