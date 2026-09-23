import { addMinutes } from 'date-fns'
import { toIsoDate } from '@/lib/format'
import type { UserSession, VisitorRecord } from '@/types/vms'

/** Test helpers: a valid visit and staff member, with only the fields a test cares about overridden. */

let sequence = 0

export function makeVisitor(overrides: Partial<VisitorRecord> = {}, now = new Date()): VisitorRecord {
  sequence++
  const start = overrides.timeWindowStart ? new Date(overrides.timeWindowStart) : now
  return {
    id: `visit-${sequence}`,
    fullName: 'Test Visitor',
    email: 'visitor@example.com',
    phone: '+91 90000 00000',
    company: 'Acme',
    purpose: 'Meeting',
    visitorType: 'BUSINESS_GUEST',
    hostEmployeeId: 'emp-lalita',
    hostEmployeeName: 'Lalita Mehta',
    hostDepartment: 'Internal Firm Services',
    office: 'Mumbai Goregaon',
    expectedDate: toIsoDate(start),
    timeWindowStart: start.toISOString(),
    timeWindowEnd: addMinutes(start, 60).toISOString(),
    actualCheckInTime: null,
    actualCheckOutTime: null,
    status: 'PRE_APPROVED',
    photoUrl: null,
    tempCardNumber: null,
    personalNote: '',
    rejectionReason: null,
    qrCodePlaceholder: `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
    source: 'PRE_APPROVAL',
    approvedAt: now.toISOString(),
    createdAt: now.toISOString(),
    ...overrides,
  }
}

export function makeUser(role: UserSession['role'], overrides: Partial<UserSession> = {}): UserSession {
  return {
    id: `user-${role.toLowerCase()}`,
    name: `Test ${role}`,
    email: `${role.toLowerCase()}@corp.example`,
    department: 'Testing',
    avatar: '',
    role,
    office: 'Mumbai Goregaon',
    ...overrides,
  }
}

/** A 1×1 PNG, standing in for a camera capture. */
export const PHOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
