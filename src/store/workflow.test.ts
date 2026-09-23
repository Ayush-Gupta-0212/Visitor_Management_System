import { addHours, addMinutes } from 'date-fns'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEMO_PASSWORDS } from '@/data/demoCredentials'
import { ACCOUNTS, EMPLOYEE_DIRECTORY } from '@/data/mockData'
import { PHOTO } from '@/test/fixtures'
import type { KioskRequestInput, PreApprovalInput } from '@/types/vms'
import { signIn, signOut } from './session'
import { useAuthStore } from './useAuthStore'
import { useVmsStore } from './useVmsStore'

/*
 * End-to-end workflows through the real store, signed in as the real demo accounts.
 * Outside a browser the store simply doesn't persist, so each test starts from a reset.
 */

const store = () => useVmsStore.getState()
const lalita = EMPLOYEE_DIRECTORY.find((employee) => employee.name === 'Lalita Mehta')!

async function signInAs(email: string) {
  const result = await signIn(email, DEMO_PASSWORDS[email])
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}

const GATEKEEPER = 'suresh.pawar@corp.example'
const HOST = 'lalita.mehta@corp.example'
const ADMIN = 'kavita.joshi@corp.example'

function invite(overrides: Partial<PreApprovalInput> = {}): PreApprovalInput {
  const start = addMinutes(new Date(), 10)
  return {
    fullName: 'Asha Rao',
    email: 'asha@example.com',
    phone: '',
    company: 'Acme',
    purpose: 'Design review',
    visitorType: 'BUSINESS_GUEST',
    timeWindowStart: start.toISOString(),
    timeWindowEnd: addHours(start, 1).toISOString(),
    ...overrides,
  }
}

const kioskRequest: KioskRequestInput = {
  fullName: 'Kabir Shah',
  email: '',
  phone: '+91 98200 12345',
  company: '',
  purpose: 'Interview',
  visitorType: 'INTERVIEW',
  hostEmployeeId: lalita.id,
  photoUrl: PHOTO,
  expectedDurationMinutes: 60,
}

beforeEach(() => {
  signOut()
  useAuthStore.setState({ failedAttempts: 0, lockedUntil: null })
  store().resetDemoData()
})

describe('sign-in', () => {
  it('accepts every demo account with its own password, and only that password', async () => {
    for (const { user } of ACCOUNTS) {
      const result = await signIn(user.email, DEMO_PASSWORDS[user.email])
      expect(result.ok && result.data.id).toBe(user.id)
      signOut()
    }
    const wrong = await signIn(HOST, DEMO_PASSWORDS[GATEKEEPER])
    expect(wrong.ok).toBe(false)
  })

  it('pauses sign-in after five failed attempts', async () => {
    for (let attempt = 1; attempt < 5; attempt++) {
      const result = await signIn(HOST, 'nope')
      expect(!result.ok && result.error.message).toContain(`${5 - attempt} attempt`)
    }
    const fifth = await signIn(HOST, 'nope')
    expect(!fifth.ok && fifth.error.message).toMatch(/paused/)
    const correct = await signIn(HOST, DEMO_PASSWORDS[HOST])
    expect(!correct.ok && correct.error.message).toMatch(/Try again in/)
  })

  it('records sign-in and sign-out in the audit trail', async () => {
    await signInAs(GATEKEEPER)
    signOut()
    expect(store().auditLog.slice(0, 2).map((entry) => entry.action)).toEqual(['SIGNED_OUT', 'SIGNED_IN'])
  })
})

describe('role-based access', () => {
  it('refuses every staff action when signed out', () => {
    expect(store().createPreApproval(invite())).toMatchObject({ ok: false, error: { code: 'UNAUTHORIZED' } })
  })

  it('stops each role from doing another role’s job', async () => {
    await signInAs(HOST)
    const visit = store().createPreApproval(invite())
    expect(visit.ok).toBe(true)
    if (!visit.ok) return
    expect(store().checkInVisitor(visit.data.id)).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } })

    await signInAs(GATEKEEPER)
    expect(store().rejectVisitor(visit.data.id, 'Not expected')).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } })
    expect(store().updateSettings({ maxPreApprovalsPerEmployeePerDay: 9 })).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } })

    await signInAs(ADMIN)
    expect(store().checkOutVisitor(visit.data.id)).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } })
  })

  it('lets a host decide only on their own visitors', async () => {
    const request = store().submitKioskRequest(kioskRequest)
    expect(request.ok).toBe(true)
    if (!request.ok) return

    await signInAs('rohan.deshpande@corp.example')
    expect(store().approveVisitor(request.data.id)).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } })
    await signInAs(HOST)
    expect(store().approveVisitor(request.data.id).ok).toBe(true)
  })
})

describe('visit workflows', () => {
  it('pre-approval → check-in → overstay → extension → check-out', async () => {
    await signInAs(HOST)
    const invited = store().createPreApproval(invite())
    if (!invited.ok) throw new Error(invited.error.message)

    await signInAs(GATEKEEPER)
    const checkedIn = store().checkInVisitor(invited.data.id)
    expect(checkedIn.ok && checkedIn.data.tempCardNumber).toMatch(/^TC-\d{3}$/)

    const grace = store().settings.autoOverstayThresholdMinutes
    const late = addMinutes(new Date(invited.data.timeWindowEnd), grace + 1)
    expect(store().evaluateOverstayStatuses(late)).toContain(invited.data.id)

    const extended = store().extendVisit(invited.data.id, 60)
    expect(extended.ok && extended.data.status).toBe('CHECKED_IN')

    const checkedOut = store().checkOutVisitor(invited.data.id)
    expect(checkedOut.ok && checkedOut.data.status).toBe('CHECKED_OUT')
  })

  it('enforces the daily pre-approval quota the admin sets', async () => {
    await signInAs(ADMIN)
    expect(store().updateSettings({ maxPreApprovalsPerEmployeePerDay: 1 }).ok).toBe(true)

    await signInAs(HOST)
    // A week out, clear of the seeded bookings, so only this test's invites count.
    const nextWeek = addHours(new Date(), 24 * 7)
    const at = { timeWindowStart: nextWeek.toISOString(), timeWindowEnd: addHours(nextWeek, 1).toISOString() }
    expect(store().createPreApproval(invite(at)).ok).toBe(true)
    expect(store().createPreApproval(invite({ ...at, fullName: 'Second Guest' }))).toMatchObject({ ok: false, error: { code: 'QUOTA_EXCEEDED' } })
  })

  it('kiosk request → host approval → self check-in, with no staff at the kiosk', async () => {
    const request = store().submitKioskRequest(kioskRequest)
    if (!request.ok) throw new Error(request.error.message)
    expect(request.data).toMatchObject({ status: 'PENDING_APPROVAL', source: 'SELF_SERVICE' })

    // Not approved yet, so the pass can't be used.
    expect(store().selfCheckIn(request.data.qrCodePlaceholder, PHOTO).ok).toBe(false)

    await signInAs(HOST)
    expect(store().approveVisitor(request.data.id).ok).toBe(true)
    signOut()

    const checkedIn = store().selfCheckIn(request.data.qrCodePlaceholder, PHOTO)
    expect(checkedIn.ok && checkedIn.data.status).toBe('CHECKED_IN')
    expect(store().auditLog[0]).toMatchObject({ action: 'CHECKED_IN', actorName: 'Self-service kiosk' })
  })

  it('turns away unknown and revoked passes at the kiosk', async () => {
    expect(store().selfCheckIn('00000000-0000-4000-8000-000000000000', PHOTO)).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })

    await signInAs(HOST)
    const invited = store().createPreApproval(invite())
    if (!invited.ok) throw new Error(invited.error.message)
    expect(store().rejectVisitor(invited.data.id, 'Meeting cancelled').ok).toBe(true)
    expect(store().selfCheckIn(invited.data.qrCodePlaceholder, PHOTO)).toMatchObject({ ok: false, error: { message: expect.stringMatching(/revoked/) } })
  })
})
