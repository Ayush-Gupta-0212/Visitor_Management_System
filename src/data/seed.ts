/**
 * Deterministic mock-data generator.
 *
 * The case study says to use mock data where no API is available. Rather than
 * shipping a large JSON fixture, we generate the dataset at boot from a seeded
 * pseudo-random number generator. That buys three things:
 *
 *   - the dataset size is a runtime dial (1k / 10k / 50k) so the performance
 *     claims can be demonstrated live instead of asserted;
 *   - the bundle stays small - 50,000 records as JSON would be several MB;
 *   - the same seed always produces the same data, so screenshots, tests and
 *     benchmarks are reproducible.
 */
import type {
  Employee,
  Office,
  Visit,
  VisitSource,
  VisitStatus,
  VisitType,
  Visitor,
  CheckInMethod,
} from '@/domain/types';
import { VISIT_TYPES } from '@/domain/types';
import { MS_PER_DAY, MS_PER_HOUR, startOfDay } from '@/shared/lib/datetime';

/**
 * mulberry32: a tiny, fast, well-distributed PRNG.
 * `Math.random()` cannot be seeded, which would make the data different on every
 * reload and every machine.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST_NAMES = [
  'Ayush', 'Lalita', 'Dhulabhai', 'Ajay', 'Arun', 'Navin', 'Sukhdev', 'Vinod', 'Geeta',
  'Jagesh', 'Vanraj', 'Nilesh', 'Sanjay', 'Teja', 'Akshay', 'Priya', 'Rahul', 'Sneha',
  'Imran', 'Fatima', 'Rohit', 'Kavya', 'Manish', 'Deepa', 'Suresh', 'Anita', 'Vikram',
  'Neha', 'Karthik', 'Divya', 'Ramesh', 'Pooja', 'Aditya', 'Swati', 'Nikhil', 'Meera',
];

const LAST_NAMES = [
  'Mehta', 'Bamania', 'Singh', 'Kumar', 'Patidar', 'Ahari', 'Dindor', 'Gohil', 'Maru',
  'Pandey', 'Gandhi', 'Neeradi', 'Sharma', 'Verma', 'Reddy', 'Nair', 'Iyer', 'Bose',
  'Chauhan', 'Joshi', 'Desai', 'Kulkarni', 'Rao', 'Pillai', 'Shetty', 'Bhat', 'Menon',
];

const COMPANIES = [
  'Walsons', 'Movinsync', 'Infosys', 'Tata Elxsi', 'Wipro', 'Accenture', 'Zomato',
  'Sodexo', 'ISS Facility', 'Quess Corp', 'Blue Dart', 'Urban Company', 'Larsen & Toubro',
  'HDFC Bank', 'Reliance Jio', 'Swiggy', 'Freshworks', 'Zoho', 'Razorpay', 'CRED',
];

const DEPARTMENTS = [
  'Engineering', 'Human Resources', 'Finance', 'Facilities', 'Legal', 'Marketing',
  'Operations', 'Security', 'Procurement', 'Customer Success',
];

const EVENT_TITLES = [
  'Meeting', 'Quarterly Review', 'Vendor Demo', 'Interview - Frontend', 'Site Audit',
  'AMC Maintenance', 'Contract Signing', 'Training Session', 'Client Workshop',
  'Equipment Delivery', 'Compliance Inspection', 'Product Walkthrough',
];

export const OFFICES: Office[] = [
  { id: 'off-1', name: 'Mumbai Goregaon', city: 'Mumbai' },
  { id: 'off-2', name: 'Bengaluru Whitefield', city: 'Bengaluru' },
  { id: 'off-3', name: 'Gurugram Cyber City', city: 'Gurugram' },
  { id: 'off-4', name: 'Hyderabad Hitec City', city: 'Hyderabad' },
];

export interface SeedResult {
  offices: Office[];
  employees: Employee[];
  visitors: Visitor[];
  visits: Visit[];
}

export interface SeedOptions {
  visitCount: number;
  visitorCount?: number;
  employeeCount?: number;
  seed?: number;
  /** "Now" used to place visits in the past/future. Injected so tests are stable. */
  now?: number;
}

/** Number of days of history the generated dataset spans. */
const HISTORY_DAYS = 90;
const FUTURE_DAYS = 7;

export function generateSeedData(options: SeedOptions): SeedResult {
  const {
    visitCount,
    visitorCount = Math.max(50, Math.round(visitCount * 0.4)),
    employeeCount = Math.max(10, Math.min(500, Math.round(visitCount * 0.01))),
    seed = 42,
    now = Date.now(),
  } = options;

  const rand = mulberry32(seed);
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(rand() * list.length)];
  const int = (min: number, max: number): number => min + Math.floor(rand() * (max - min + 1));

  /* ---------------------------- employees ---------------------------- */
  const employees: Employee[] = [];
  for (let i = 0; i < employeeCount; i++) {
    const first = pick(FIRST_NAMES);
    const last = pick(LAST_NAMES);
    employees.push({
      id: `emp-${i}`,
      name: `${first} ${last}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@movinsync.com`,
      phone: `9${int(100000000, 999999999)}`,
      department: pick(DEPARTMENTS),
      officeId: pick(OFFICES).id,
    });
  }

  /* ---------------------------- visitors ----------------------------- */
  const visitors: Visitor[] = [];
  for (let i = 0; i < visitorCount; i++) {
    const first = pick(FIRST_NAMES);
    const last = pick(LAST_NAMES);
    visitors.push({
      id: `vis-${i}`,
      fullName: `${first} ${last}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`,
      phone: `${int(6, 9)}${int(100000000, 999999999)}`,
      company: pick(COMPANIES),
      createdAt: now - int(0, HISTORY_DAYS) * MS_PER_DAY,
    });
  }

  /* ----------------------------- visits ------------------------------ */
  const visits: Visit[] = [];
  const today = startOfDay(now);

  /*
   * A slice of the dataset is forced to be happening *right now*.
   *
   * Left purely to chance, a dataset spread over 97 days almost never contains
   * a visit that is in progress at the moment the page loads, so the front
   * desk's "Inside" filter and the overstay ticker would both open empty - the
   * two things most worth looking at. These visits are generated the same way
   * as the rest; only their timing is pinned.
   */
  const liveCount = Math.max(8, Math.round(visitCount * 0.02));

  for (let i = 0; i < visitCount; i++) {
    const visitor = visitors[Math.floor(rand() * visitors.length)];
    const host = employees[Math.floor(rand() * employees.length)];

    const isLive = i < liveCount;

    let scheduledStart: number;
    let scheduledEnd: number;

    if (isLive) {
      // Started up to 2.5 hours ago, running for another 0.5-3 hours.
      scheduledStart = now - int(0, 150) * 60_000;
      scheduledEnd = now + int(30, 180) * 60_000;
    } else {
      // Day offset: mostly history, a slice today, a few upcoming.
      const dayOffset = int(-HISTORY_DAYS, FUTURE_DAYS);
      const day = today + dayOffset * MS_PER_DAY;

      // Visits cluster in office hours, with a peak around 10am and 3pm.
      const startHour = weightedHour(rand);
      scheduledStart = day + startHour * MS_PER_HOUR + int(0, 3) * 15 * 60_000;
      scheduledEnd = scheduledStart + int(1, 6) * 30 * 60_000;
    }

    const { status, checkInAt, checkOutAt, checkInMethod } = isLive
      ? {
          status: 'CHECKED_IN' as const,
          checkInAt: scheduledStart + int(0, 8) * 60_000,
          checkOutAt: undefined,
          checkInMethod: (rand() < 0.5 ? 'SELF' : 'FRONT_DESK') as CheckInMethod,
        }
      : deriveSeedStatus(rand, scheduledStart, scheduledEnd, now);

    // Source is chosen *after* status so the two cannot contradict each other:
    // a pre-approved visit is by definition already approved, so it can never
    // also be awaiting approval.
    const source: VisitSource = pickSource(rand(), status);

    visits.push({
      id: `vst-${i}`,
      visitorId: visitor.id,
      hostId: host.id,
      officeId: host.officeId,
      eventTitle: pick(EVENT_TITLES),
      visitType: pick(VISIT_TYPES) as VisitType,
      note: rand() < 0.3 ? 'Please report at Front Desk' : undefined,
      status,
      source,
      scheduledStart,
      scheduledEnd,
      createdAt: scheduledStart - int(1, 72) * MS_PER_HOUR,
      createdBy: source === 'WALK_IN' ? 'front-desk' : host.id,
      approvedAt:
        status === 'REJECTED' || status === 'PENDING_APPROVAL'
          ? undefined
          : scheduledStart - int(1, 24) * MS_PER_HOUR,
      rejectedAt: status === 'REJECTED' ? scheduledStart - int(1, 12) * MS_PER_HOUR : undefined,
      rejectionReason: status === 'REJECTED' ? 'Host unavailable on this date' : undefined,
      checkInAt,
      checkInMethod,
      checkOutAt,
      passCode: status === 'PENDING_APPROVAL' ? undefined : `VMS-${(100000 + i).toString(36).toUpperCase()}`,
      passRedeemed: checkInAt !== undefined,
      tempCardNo: checkInAt !== undefined ? String(int(1, 60)) : undefined,
    });
  }

  return { offices: OFFICES, employees, visitors, visits };
}

/**
 * Office traffic is not uniform: it peaks mid-morning and mid-afternoon. Seeding
 * a realistic distribution makes the admin peak-hour chart meaningful instead of
 * a flat line.
 */
function weightedHour(rand: () => number): number {
  const weights = [
    /* 0-6  */ 0.2, 0.1, 0.1, 0.1, 0.2, 0.4, 1,
    /* 7-12 */ 3, 6, 9, 10, 8, 6,
    /* 13-18*/ 5, 7, 9, 8, 6, 4,
    /* 19-23*/ 2, 1, 0.6, 0.3, 0.2,
  ];
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = rand() * total;
  for (let hour = 0; hour < weights.length; hour++) {
    roll -= weights[hour];
    if (roll <= 0) return hour;
  }
  return 10;
}

/**
 * How the visit came about, constrained by the state it ended up in.
 *
 * `PRE_APPROVAL` means the host approved in advance and an e-pass was issued,
 * so it is only valid for visits that were in fact approved. Choosing the two
 * independently produced rows reading "Pre-approved - e-pass" next to a status
 * of "Awaiting approval", which is nonsense a reviewer would spot immediately.
 */
function pickSource(roll: number, status: VisitStatus): VisitSource {
  const wasNeverApproved = status === 'PENDING_APPROVAL' || status === 'REJECTED';
  if (wasNeverApproved) {
    return roll < 0.65 ? 'INVITE' : 'WALK_IN';
  }
  if (roll < 0.4) return 'INVITE';
  if (roll < 0.8) return 'PRE_APPROVAL';
  return 'WALK_IN';
}

/**
 * Chooses a plausible terminal state for a seeded visit, respecting the same
 * rules the live state machine enforces (nothing in the past stays "pending",
 * nothing in the future is already checked in).
 */
function deriveSeedStatus(
  rand: () => number,
  scheduledStart: number,
  scheduledEnd: number,
  now: number,
): {
  status: VisitStatus;
  checkInAt?: number;
  checkOutAt?: number;
  checkInMethod?: CheckInMethod;
} {
  const method: CheckInMethod = rand() < 0.5 ? 'SELF' : rand() < 0.7 ? 'FRONT_DESK' : 'QR_PASS';

  // Future visit: still waiting, or already approved.
  if (scheduledStart > now) {
    return { status: rand() < 0.45 ? 'PENDING_APPROVAL' : 'APPROVED' };
  }

  // In progress right now.
  if (scheduledEnd > now) {
    const roll = rand();
    if (roll < 0.55) {
      return {
        status: 'CHECKED_IN',
        checkInAt: scheduledStart + Math.floor(rand() * 10 * 60_000),
        checkInMethod: method,
      };
    }
    if (roll < 0.75) return { status: 'APPROVED' };
    return { status: 'PENDING_APPROVAL' };
  }

  // Past visit.
  const roll = rand();
  if (roll < 0.06) return { status: 'REJECTED' };
  if (roll < 0.16) return { status: 'EXPIRED' };

  const checkInAt = scheduledStart + Math.floor(rand() * 15 * 60_000);
  if (roll < 0.3) {
    // Stayed past the window and never checked out - an OVERSTAY.
    return { status: 'OVERSTAY', checkInAt, checkInMethod: method };
  }
  /*
   * Clamp the departure to after the arrival. The two offsets are drawn
   * independently, so on a 30-minute visit a late arrival (+15 min) could
   * otherwise precede an early departure (-20 min) and produce a visitor who
   * left before they got there.
   */
  const checkOutAt = Math.max(checkInAt + 5 * 60_000, scheduledEnd - Math.floor(rand() * 20 * 60_000));
  return { status: 'CHECKED_OUT', checkInAt, checkOutAt, checkInMethod: method };
}
