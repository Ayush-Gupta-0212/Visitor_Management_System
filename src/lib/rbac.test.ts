import { describe, expect, it } from 'vitest'
import { makeUser, makeVisitor } from '@/test/fixtures'
import { authorize, can, visibleTo } from './rbac'

const gatekeeper = makeUser('GATEKEEPER')
const host = makeUser('HOST_EMPLOYEE', { id: 'emp-lalita' })
const admin = makeUser('ADMIN')

describe('role permissions', () => {
  it('gives each role only its own actions', () => {
    expect(can('GATEKEEPER', 'visitor:check-in')).toBe(true)
    expect(can('GATEKEEPER', 'visitor:approve')).toBe(false)
    expect(can('HOST_EMPLOYEE', 'visitor:pre-approve')).toBe(true)
    expect(can('HOST_EMPLOYEE', 'visitor:check-in')).toBe(false)
    expect(can('ADMIN', 'settings:update')).toBe(true)
    expect(can('ADMIN', 'visitor:check-out')).toBe(false)
  })
})

describe('authorize', () => {
  const visit = makeVisitor({ hostEmployeeId: 'emp-lalita', office: 'Mumbai Goregaon' })

  it('requires a signed-in user', () => {
    expect(authorize(null, 'visitor:check-in', visit)?.code).toBe('UNAUTHORIZED')
  })

  it('refuses actions outside the role', () => {
    expect(authorize(host, 'visitor:check-in', visit)?.code).toBe('FORBIDDEN')
  })

  it('lets hosts decide only on their own visitors', () => {
    expect(authorize(host, 'visitor:approve', visit)).toBeNull()
    expect(authorize(host, 'visitor:approve', { ...visit, hostEmployeeId: 'emp-rohan' })?.code).toBe('FORBIDDEN')
  })

  it('keeps the desk to visits booked at its own site', () => {
    expect(authorize(gatekeeper, 'visitor:check-in', visit)).toBeNull()
    expect(authorize(gatekeeper, 'visitor:check-in', { ...visit, office: 'Bengaluru Whitefield' })?.message).toMatch(/on duty at Mumbai Goregaon/)
  })
})

describe('visibleTo', () => {
  const visitors = [
    makeVisitor({ hostEmployeeId: 'emp-lalita' }),
    makeVisitor({ hostEmployeeId: 'emp-rohan' }),
    makeVisitor({ hostEmployeeId: 'emp-lalita', office: 'Bengaluru Whitefield' }),
  ]

  it('scopes the list by role', () => {
    expect(visibleTo(admin, visitors)).toHaveLength(3)
    expect(visibleTo(gatekeeper, visitors)).toHaveLength(2)
    expect(visibleTo(host, visitors)).toHaveLength(2)
    expect(visibleTo(null, visitors)).toHaveLength(0)
  })
})
