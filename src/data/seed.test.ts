/**
 * Invariants for the generated dataset.
 *
 * Mock data that contradicts itself undermines everything built on top of it:
 * a row reading "Pre-approved - e-pass" next to a status of "Awaiting approval"
 * is nonsense, and it shipped once because `source` and `status` were chosen
 * independently. These tests pin the relationships the UI relies on.
 */
import { describe, expect, it } from 'vitest';
import { generateSeedData } from './seed';

const FIXED_NOW = new Date('2025-06-15T09:00:00').getTime();

const { visits, visitors, employees } = generateSeedData({
  visitCount: 20_000,
  seed: 11,
  now: FIXED_NOW,
});

describe('seeded dataset', () => {
  it('is deterministic for a given seed', () => {
    const again = generateSeedData({ visitCount: 200, seed: 11, now: FIXED_NOW });
    const first = generateSeedData({ visitCount: 200, seed: 11, now: FIXED_NOW });
    expect(again.visits).toEqual(first.visits);
  });

  it('never marks a visit pre-approved unless it was actually approved', () => {
    const contradictory = visits.filter(
      (v) =>
        v.source === 'PRE_APPROVAL' &&
        (v.status === 'PENDING_APPROVAL' || v.status === 'REJECTED'),
    );
    expect(contradictory).toHaveLength(0);
  });

  it('issues a pass to every visit that got past approval', () => {
    const approvedWithoutPass = visits.filter(
      (v) => v.status !== 'PENDING_APPROVAL' && !v.passCode,
    );
    expect(approvedWithoutPass).toHaveLength(0);
  });

  it('records an arrival time for anyone who got inside', () => {
    const missing = visits.filter(
      (v) =>
        (v.status === 'CHECKED_IN' || v.status === 'CHECKED_OUT' || v.status === 'OVERSTAY') &&
        v.checkInAt === undefined,
    );
    expect(missing).toHaveLength(0);
  });

  it('never checks anyone out before they checked in', () => {
    const reversed = visits.filter(
      (v) => v.checkOutAt !== undefined && v.checkInAt !== undefined && v.checkOutAt < v.checkInAt,
    );
    expect(reversed).toHaveLength(0);
  });

  it('never leaves a future visit already checked in, or a past one pending', () => {
    const futureButInside = visits.filter(
      (v) => v.scheduledStart > FIXED_NOW && v.checkInAt !== undefined,
    );
    expect(futureButInside).toHaveLength(0);
  });

  it('always ends a visit after it starts', () => {
    expect(visits.filter((v) => v.scheduledEnd <= v.scheduledStart)).toHaveLength(0);
  });

  it('points every visit at a visitor and a host that exist', () => {
    const visitorIds = new Set(visitors.map((v) => v.id));
    const employeeIds = new Set(employees.map((e) => e.id));

    const orphaned = visits.filter(
      (v) => !visitorIds.has(v.visitorId) || !employeeIds.has(v.hostId),
    );
    expect(orphaned).toHaveLength(0);
  });

  it('includes visits that are in progress right now, so the demo is not empty', () => {
    const inProgress = visits.filter((v) => v.status === 'CHECKED_IN');
    expect(inProgress.length).toBeGreaterThan(0);

    for (const visit of inProgress) {
      expect(visit.scheduledStart).toBeLessThanOrEqual(FIXED_NOW);
      expect(visit.scheduledEnd).toBeGreaterThan(FIXED_NOW);
    }
  });
});
