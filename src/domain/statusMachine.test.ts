import { describe, expect, it } from 'vitest';
import { assertTransition, canTransition, deriveStatus, isTerminal } from './statusMachine';
import { DomainError } from './errors';
import type { Visit } from './types';

const GRACE = { expiryGraceMinutes: 30, overstayGraceMinutes: 0 };

function visit(overrides: Partial<Visit>): Visit {
  return {
    id: 'v1',
    visitorId: 'vis1',
    hostId: 'emp1',
    officeId: 'off-1',
    eventTitle: 'Meeting',
    visitType: 'Business Guests',
    status: 'APPROVED',
    source: 'INVITE',
    scheduledStart: 1_000_000,
    scheduledEnd: 2_000_000,
    createdAt: 0,
    createdBy: 'emp1',
    ...overrides,
  };
}

describe('visit status machine', () => {
  it('allows the documented happy path', () => {
    expect(canTransition('PENDING_APPROVAL', 'APPROVED')).toBe(true);
    expect(canTransition('APPROVED', 'CHECKED_IN')).toBe(true);
    expect(canTransition('CHECKED_IN', 'CHECKED_OUT')).toBe(true);
    expect(canTransition('CHECKED_IN', 'OVERSTAY')).toBe(true);
    expect(canTransition('OVERSTAY', 'CHECKED_OUT')).toBe(true);
  });

  it('refuses to check out someone who never checked in', () => {
    expect(canTransition('APPROVED', 'CHECKED_OUT')).toBe(false);
    expect(() => assertTransition('APPROVED', 'CHECKED_OUT')).toThrow(DomainError);
  });

  it('refuses to revive a rejected or expired visit', () => {
    expect(canTransition('REJECTED', 'APPROVED')).toBe(false);
    expect(canTransition('EXPIRED', 'CHECKED_IN')).toBe(false);
    expect(isTerminal('REJECTED')).toBe(true);
    expect(isTerminal('CHECKED_OUT')).toBe(true);
    expect(isTerminal('CHECKED_IN')).toBe(false);
  });

  it('puts a readable message on the error, not a status code', () => {
    try {
      assertTransition('CHECKED_OUT', 'CHECKED_IN');
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe('INVALID_TRANSITION');
      expect((error as DomainError).message).toContain('Checked out');
    }
  });
});

describe('deriveStatus (time-driven rules)', () => {
  it('expires an approved visit once the window plus grace has passed', () => {
    const v = visit({ status: 'APPROVED' });
    expect(deriveStatus(v, v.scheduledEnd + 10 * 60_000, GRACE)).toBeNull();
    expect(deriveStatus(v, v.scheduledEnd + 31 * 60_000, GRACE)).toBe('EXPIRED');
  });

  it('expires a request the host never answered', () => {
    const v = visit({ status: 'PENDING_APPROVAL' });
    expect(deriveStatus(v, v.scheduledEnd + 31 * 60_000, GRACE)).toBe('EXPIRED');
  });

  it('flags a checked-in visitor still inside as an overstay', () => {
    const v = visit({ status: 'CHECKED_IN', checkInAt: 1_100_000 });
    expect(deriveStatus(v, v.scheduledEnd - 1, GRACE)).toBeNull();
    expect(deriveStatus(v, v.scheduledEnd + 1, GRACE)).toBe('OVERSTAY');
  });

  it('leaves terminal states alone', () => {
    const v = visit({ status: 'CHECKED_OUT', checkOutAt: 1_900_000 });
    expect(deriveStatus(v, v.scheduledEnd + 10 * 24 * 3600_000, GRACE)).toBeNull();
  });
});
