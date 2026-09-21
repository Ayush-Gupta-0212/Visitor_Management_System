/**
 * Correctness tests for the query engine.
 *
 * The important property here is that the three query plans (SLICE, SEEK, SCAN)
 * are interchangeable: the planner may pick any of them for performance, so if
 * they ever disagreed the UI would show different rows depending on dataset
 * size. The final test pins that down against a brute-force reference.
 */
import { describe, expect, it } from 'vitest';
import { VisitIndex, entryKey, lowerBound, upperBound } from './indexes';
import type { VisitQuery } from './indexes';
import { generateSeedData } from './seed';
import { MinHeap } from './minHeap';
import { SearchIndex } from './searchIndex';
import type { Visit } from '@/domain/types';

const FIXED_NOW = new Date('2025-06-15T09:00:00').getTime();

function buildIndex(visitCount = 2_000) {
  const data = generateSeedData({ visitCount, seed: 7, now: FIXED_NOW });
  const index = new VisitIndex();
  index.load(data.visitors, data.employees, data.visits);
  return { index, ...data };
}

/** Brute-force reference implementation used to check the query planner. */
function referenceQuery(visits: Visit[], q: VisitQuery): string[] {
  const statusSet = q.statuses ? new Set(q.statuses) : null;
  return visits
    .filter((v) => {
      const key = entryKey(v);
      if (q.from !== undefined && key < q.from) return false;
      if (q.to !== undefined && key > q.to) return false;
      if (statusSet && !statusSet.has(v.status)) return false;
      if (q.hostId && v.hostId !== q.hostId) return false;
      if (q.officeId && v.officeId !== q.officeId) return false;
      return true;
    })
    .sort((a, b) => {
      // Same total ordering the index uses: entry time desc, then id.
      const byTime = entryKey(b) - entryKey(a);
      if (byTime !== 0) return byTime;
      return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
    })
    .map((v) => v.id);
}

describe('binary search helpers', () => {
  const arr = [{ ts: 10 }, { ts: 20 }, { ts: 20 }, { ts: 30 }];

  it('finds the first index at or after the target', () => {
    expect(lowerBound(arr, 5)).toBe(0);
    expect(lowerBound(arr, 20)).toBe(1);
    expect(lowerBound(arr, 25)).toBe(3);
    expect(lowerBound(arr, 99)).toBe(4);
  });

  it('finds the first index strictly after the target', () => {
    expect(upperBound(arr, 20)).toBe(3);
    expect(upperBound(arr, 30)).toBe(4);
  });
});

describe('MinHeap', () => {
  it('always yields the earliest deadline first', () => {
    const heap = new MinHeap<string>();
    for (const at of [50, 10, 40, 20, 30]) heap.push(at, `v${at}`);

    expect(heap.peek()?.value).toBe('v10');
    const order = [heap.pop(), heap.pop(), heap.pop(), heap.pop(), heap.pop()].map((n) => n?.at);
    expect(order).toEqual([10, 20, 30, 40, 50]);
    expect(heap.pop()).toBeUndefined();
  });

  it('drains only the entries that are already due', () => {
    const heap = new MinHeap<string>();
    heap.push(10, 'a');
    heap.push(20, 'b');
    heap.push(30, 'c');

    expect(heap.drainDueBy(20)).toEqual(['a', 'b']);
    expect(heap.size).toBe(1);
    expect(heap.drainDueBy(5)).toEqual([]);
  });
});

describe('SearchIndex', () => {
  it('matches prefixes of any token, in any field', () => {
    const index = new SearchIndex();
    index.add('1', ['Lalita Mehta', 'lalita.mehta@pwc.com', '9756195792', 'Walsons']);
    index.add('2', ['Arun Kumar', 'arun@example.com', '9811111111', 'Infosys']);

    expect([...index.search('lal')]).toEqual(['1']);
    expect([...index.search('mehta')]).toEqual(['1']);
    expect([...index.search('walsons')]).toEqual(['1']);
    expect([...index.search('975619')]).toEqual(['1']);
    expect([...index.search('arun')]).toEqual(['2']);
    expect([...index.search('zzz')]).toEqual([]);
  });

  it('treats multiple words as AND', () => {
    const index = new SearchIndex();
    index.add('1', ['Lalita Mehta', '', '', '']);
    index.add('2', ['Lalita Singh', '', '', '']);

    expect([...index.search('lalita')].sort()).toEqual(['1', '2']);
    expect([...index.search('lalita mehta')]).toEqual(['1']);
  });

  it('forgets a removed record', () => {
    const index = new SearchIndex();
    index.add('1', ['Arun Kumar', '', '', '']);
    index.remove('1');
    expect([...index.search('arun')]).toEqual([]);
    expect(index.size).toBe(0);
  });
});

describe('VisitIndex', () => {
  it('returns every visit, newest first, when nothing is filtered', () => {
    const { index, visits } = buildIndex();
    const ids = index.query({});

    expect(ids).toHaveLength(visits.length);
    expect(index.lastStats.plan).toBe('SLICE');

    const times = ids.map((id) => entryKey(index.visits.get(id)!));
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeLessThanOrEqual(times[i - 1]);
    }
  });

  it('keeps the pre-approval quota count per host per day', () => {
    const { index, visits } = buildIndex();
    const preApproval = visits.find((v) => v.source === 'PRE_APPROVAL')!;
    const used = index.preApprovalsUsed(preApproval.hostId, preApproval.scheduledStart);

    const expected = visits.filter(
      (v) =>
        v.source === 'PRE_APPROVAL' &&
        v.hostId === preApproval.hostId &&
        new Date(v.scheduledStart).toDateString() ===
          new Date(preApproval.scheduledStart).toDateString(),
    ).length;

    expect(used).toBe(expected);
  });

  it('repairs its indexes when a visit changes status', () => {
    const { index } = buildIndex();
    const pending = index.query({ statuses: ['PENDING_APPROVAL'] });
    const before = index.countByStatus('PENDING_APPROVAL');

    index.update(pending[0], { status: 'APPROVED' });

    expect(index.countByStatus('PENDING_APPROVAL')).toBe(before - 1);
    expect(index.query({ statuses: ['PENDING_APPROVAL'] })).not.toContain(pending[0]);
    expect(index.query({ statuses: ['APPROVED'] })).toContain(pending[0]);
  });

  it('re-sorts the timeline when a check-in changes a visit\'s entry time', () => {
    const { index } = buildIndex();
    const approved = index.query({ statuses: ['APPROVED'] })[0];
    const checkInAt = FIXED_NOW + 5 * 3600_000;

    index.update(approved, { status: 'CHECKED_IN', checkInAt });

    const ids = index.query({});
    const times = ids.map((id) => entryKey(index.visits.get(id)!));
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeLessThanOrEqual(times[i - 1]);
    }
    expect(ids).toContain(approved);
  });

  it('adds a new visit in the right place without a full rebuild', () => {
    const { index } = buildIndex();
    const sizeBefore = index.size;

    index.insert(
      {
        id: 'vst-new',
        visitorId: 'vis-0',
        hostId: 'emp-0',
        officeId: 'off-1',
        eventTitle: 'Walk-in',
        visitType: 'Vendor',
        status: 'PENDING_APPROVAL',
        source: 'WALK_IN',
        scheduledStart: FIXED_NOW,
        scheduledEnd: FIXED_NOW + 3600_000,
        createdAt: FIXED_NOW,
        createdBy: 'front-desk',
      },
      undefined,
    );

    expect(index.size).toBe(sizeBefore + 1);
    expect(index.query({ statuses: ['PENDING_APPROVAL'] })).toContain('vst-new');
  });

  /**
   * The planner is free to choose any plan; all of them must agree with a
   * brute-force filter+sort. This is the test that lets the optimisation in
   * `query()` be trusted.
   */
  it('gives identical results whichever plan the query planner picks', () => {
    const { index, visits } = buildIndex(3_000);

    const day = new Date(FIXED_NOW);
    day.setHours(0, 0, 0, 0);

    const queries: VisitQuery[] = [
      {},
      { statuses: ['CHECKED_OUT'] }, // broad  -> SCAN
      { statuses: ['REJECTED'] }, // narrow -> SEEK
      { statuses: ['CHECKED_OUT', 'OVERSTAY', 'EXPIRED'] },
      { hostId: 'emp-3' },
      { officeId: 'off-2', statuses: ['CHECKED_OUT'] },
      { from: day.getTime(), to: day.getTime() + 86_400_000 },
      { from: day.getTime(), to: day.getTime() + 86_400_000, statuses: ['CHECKED_IN'] },
    ];

    const plansSeen = new Set<string>();
    for (const q of queries) {
      const actual = index.query(q);
      index.clearQueryCache();
      plansSeen.add(index.lastStats.plan);
      expect(actual, `query ${JSON.stringify(q)}`).toEqual(referenceQuery(visits, q));
    }

    // Guard against the suite silently exercising only one code path.
    expect(plansSeen.size).toBeGreaterThan(1);
  });

  it('finds a visitor by name, phone and company', () => {
    const { index, visitors } = buildIndex();
    const target = visitors[0];

    const byName = index.query({ text: target.fullName });
    expect(byName.length).toBeGreaterThan(0);
    for (const id of byName) {
      const visit = index.visits.get(id)!;
      const visitor = index.visitors.get(visit.visitorId)!;
      const host = index.employees.get(visit.hostId)!;
      const haystack = `${visitor.fullName} ${visitor.company} ${host.name}`.toLowerCase();
      expect(haystack).toContain(target.fullName.split(' ')[0].toLowerCase());
    }

    expect(index.query({ text: target.phone }).length).toBeGreaterThan(0);
    expect(index.query({ text: 'definitelynotpresent' })).toEqual([]);
  });
});
