/**
 * The in-memory database behind the visitor table.
 *
 * The front desk screen has to search, filter by date, filter by time-of-day,
 * filter by status and sort - over the whole visit history, on every keystroke.
 * Doing that with `Array.filter().sort()` is O(N log N) per interaction; at
 * N = 50,000 the input visibly stutters.
 *
 * STRUCTURES
 * ----------
 *   1. Map<id, Visit>                 primary record store          O(1) lookup
 *   2. Map<facetValue, Set<id>>       status / host / office / day  O(1) bucket
 *   3. timeline: sorted [ts, id]      date & time-range queries     O(log N + k)
 *   4. SearchIndex (inverted prefix)  free-text search              O(candidates)
 *
 * The timeline is sorted by the same key the table sorts by - entry time,
 * meaning `checkInAt ?? scheduledStart`. Keeping those two in agreement is what
 * makes the strategies below able to skip sorting altogether.
 *
 * QUERY STRATEGIES
 * ----------------
 * A query picks one of three plans based on how selective it is. This matters:
 * an index is not unconditionally faster, and an earlier version of this file
 * was measurably *slower* than `Array.filter` for broad filters because it built
 * a 39,000-entry Set and then sorted it. The benchmark caught that; the fix was
 * to stop treating "use the index" as always correct.
 *
 *   SLICE   no filters at all           two binary searches       O(log N + k)
 *   SEEK    selective filters (few hits) iterate candidates, sort  O(k log k)
 *   SCAN    broad filters (many hits)    walk the sorted timeline  O(range), no sort
 *
 * Full analysis with measured numbers: docs/COMPLEXITY.md
 */
import type { Visit, VisitStatus, Visitor, Employee } from '@/domain/types';
import { SearchIndex, intersect } from './searchIndex';
import { dayKey, minutesSinceMidnight } from '@/shared/lib/datetime';

export type SortKey = 'entry' | 'exit' | 'visitor' | 'status';
export type SortDir = 'asc' | 'desc';
export type QueryPlan = 'SLICE' | 'SEEK' | 'SCAN';

export interface VisitQuery {
  /** Free text matched against visitor name/email/phone/company and host name. */
  text?: string;
  statuses?: VisitStatus[];
  hostId?: string;
  officeId?: string;
  /** Absolute range on the visit's entry time. */
  from?: number;
  to?: number;
  /** Time-of-day window in minutes since midnight, e.g. 0 - 1439. */
  minuteFrom?: number;
  minuteTo?: number;
  sortBy?: SortKey;
  sortDir?: SortDir;
}

/** Diagnostics surfaced in the UI performance readout and in the benchmark. */
export interface QueryStats {
  matched: number;
  /** Records the engine actually looked at. The point is that it is << total. */
  scanned: number;
  durationMs: number;
  plan: QueryPlan;
  cached: boolean;
}

interface TimeEntry {
  ts: number;
  id: string;
}

const QUERY_CACHE_LIMIT = 24;

/**
 * Above this fraction of the dataset, walking the pre-sorted timeline beats
 * materialising a candidate Set and sorting it. Derived from the benchmark:
 * see docs/COMPLEXITY.md, "Choosing between SEEK and SCAN".
 */
const SCAN_THRESHOLD = 0.15;

/** The key the visitor table sorts and filters by: when the visitor arrived. */
export function entryKey(visit: Visit): number {
  return visit.checkInAt ?? visit.scheduledStart;
}

export class VisitIndex {
  /** 1. Primary store. */
  readonly visits = new Map<string, Visit>();
  readonly visitors = new Map<string, Visitor>();
  readonly employees = new Map<string, Employee>();

  /** 2. Facet buckets. Every mutation keeps these in sync - see `update()`. */
  private byStatus = new Map<VisitStatus, Set<string>>();
  private byHost = new Map<string, Set<string>>();
  private byOffice = new Map<string, Set<string>>();
  private byDay = new Map<string, Set<string>>();
  private byVisitor = new Map<string, Set<string>>();

  /** Pre-approvals used per host per day, so the quota rule is an O(1) read. */
  private preApprovalByHostDay = new Map<string, number>();

  /** 3. Visits sorted ascending by entry time, for range queries and sorting. */
  private timeline: TimeEntry[] = [];

  /** 4. Free-text indexes. */
  private visitorSearch = new SearchIndex();
  private hostSearch = new SearchIndex();

  /** Memoised results for repeated filter combinations (simple LRU). */
  private queryCache = new Map<string, string[]>();

  lastStats: QueryStats = {
    matched: 0,
    scanned: 0,
    durationMs: 0,
    plan: 'SLICE',
    cached: false,
  };

  /* ------------------------------------------------------------------ *
   * Loading
   * ------------------------------------------------------------------ */

  /**
   * Bulk load. Building the timeline with one `sort` at the end is O(N log N)
   * once, far cheaper than N inserts into a sorted array (O(N^2), because each
   * insert shifts the tail).
   */
  load(visitors: Visitor[], employees: Employee[], visits: Visit[]): void {
    this.clear();

    for (const v of visitors) {
      this.visitors.set(v.id, v);
      this.visitorSearch.add(v.id, [v.fullName, v.email, v.phone, v.company]);
    }
    for (const e of employees) {
      this.employees.set(e.id, e);
      this.hostSearch.add(e.id, [e.name, e.email, e.phone, e.department]);
    }
    for (const visit of visits) {
      this.visits.set(visit.id, visit);
      this.addToBuckets(visit);
      this.timeline.push({ ts: entryKey(visit), id: visit.id });
    }

    this.timeline.sort(compareEntries);
  }

  clear(): void {
    this.visits.clear();
    this.visitors.clear();
    this.employees.clear();
    this.byStatus.clear();
    this.byHost.clear();
    this.byOffice.clear();
    this.byDay.clear();
    this.byVisitor.clear();
    this.preApprovalByHostDay.clear();
    this.timeline = [];
    this.visitorSearch.clear();
    this.hostSearch.clear();
    this.queryCache.clear();
  }

  /* ------------------------------------------------------------------ *
   * Mutation - every write goes through here so no index can drift
   * ------------------------------------------------------------------ */

  insert(visit: Visit, visitor?: Visitor): void {
    if (visitor && !this.visitors.has(visitor.id)) {
      this.visitors.set(visitor.id, visitor);
      this.visitorSearch.add(visitor.id, [
        visitor.fullName,
        visitor.email,
        visitor.phone,
        visitor.company,
      ]);
    }
    this.visits.set(visit.id, visit);
    this.addToBuckets(visit);
    insertSorted(this.timeline, { ts: entryKey(visit), id: visit.id });
    this.queryCache.clear();
  }

  /**
   * Applies a partial change and repairs only the indexes it affects.
   *
   * Re-positioning the timeline entry is O(N) because of the array shift, but
   * it only happens when a human checks someone in - a handful of times a
   * minute, not once per render - so the cost is irrelevant in practice and
   * keeping the array contiguous makes every read faster.
   */
  update(id: string, patch: Partial<Visit>): Visit {
    const current = this.visits.get(id);
    if (!current) throw new Error(`Visit ${id} not found`);

    const next: Visit = { ...current, ...patch };

    if (patch.status !== undefined && patch.status !== current.status) {
      this.byStatus.get(current.status)?.delete(id);
      bucket(this.byStatus, next.status).add(id);
    }

    const previousKey = entryKey(current);
    const nextKey = entryKey(next);
    if (previousKey !== nextKey) {
      removeFromTimeline(this.timeline, previousKey, id);
      insertSorted(this.timeline, { ts: nextKey, id });

      this.byDay.get(dayKey(previousKey))?.delete(id);
      bucket(this.byDay, dayKey(nextKey)).add(id);
    }

    this.visits.set(id, next);
    this.queryCache.clear();
    return next;
  }

  private addToBuckets(visit: Visit): void {
    bucket(this.byStatus, visit.status).add(visit.id);
    bucket(this.byHost, visit.hostId).add(visit.id);
    bucket(this.byOffice, visit.officeId).add(visit.id);
    bucket(this.byDay, dayKey(entryKey(visit))).add(visit.id);
    bucket(this.byVisitor, visit.visitorId).add(visit.id);

    if (visit.source === 'PRE_APPROVAL') {
      const key = quotaKey(visit.hostId, visit.scheduledStart);
      this.preApprovalByHostDay.set(key, (this.preApprovalByHostDay.get(key) ?? 0) + 1);
    }
  }

  /* ------------------------------------------------------------------ *
   * Reads
   * ------------------------------------------------------------------ */

  get size(): number {
    return this.visits.size;
  }

  /** O(1). Backs the pre-approval quota rule in `domain/rules.ts`. */
  preApprovalsUsed(hostId: string, dayTs: number): number {
    return this.preApprovalByHostDay.get(quotaKey(hostId, dayTs)) ?? 0;
  }

  countByStatus(status: VisitStatus): number {
    return this.byStatus.get(status)?.size ?? 0;
  }

  visitsOnDay(dayTs: number): Set<string> {
    return this.byDay.get(dayKey(dayTs)) ?? new Set();
  }

  /** Drops memoised results. Used by the benchmark to time real work, not Map hits. */
  clearQueryCache(): void {
    this.queryCache.clear();
  }

  /**
   * The main query. Returns visit ids, already sorted and ready to hand to the
   * virtualiser. See the class comment for the three plans.
   */
  query(q: VisitQuery): string[] {
    const started = performance.now();
    const cacheKey = JSON.stringify(q);

    const cached = this.queryCache.get(cacheKey);
    if (cached) {
      // Refresh recency for the LRU by re-inserting at the end of the Map.
      this.queryCache.delete(cacheKey);
      this.queryCache.set(cacheKey, cached);
      this.lastStats = {
        matched: cached.length,
        scanned: 0,
        durationMs: performance.now() - started,
        plan: this.lastStats.plan,
        cached: true,
      };
      return cached;
    }

    const sortBy = q.sortBy ?? 'entry';
    const sortDir = q.sortDir ?? 'desc';

    // Binary-search the timeline once; every plan works inside this window.
    const lo = q.from === undefined ? 0 : lowerBound(this.timeline, q.from);
    const hi = q.to === undefined ? this.timeline.length : upperBound(this.timeline, q.to);
    const windowSize = Math.max(0, hi - lo);

    const hasFacets = Boolean(
      (q.text && q.text.trim()) ||
        (q.statuses && q.statuses.length > 0) ||
        q.hostId ||
        q.officeId ||
        q.minuteFrom !== undefined ||
        q.minuteTo !== undefined,
    );

    let ids: string[];
    let scanned: number;
    let plan: QueryPlan;

    if (!hasFacets && sortBy === 'entry') {
      /* SLICE - the timeline is already in the requested order, so the answer
       * is a slice of it. No predicate, no set, no sort. */
      plan = 'SLICE';
      scanned = windowSize;
      ids = new Array<string>(windowSize);
      if (sortDir === 'asc') {
        for (let i = 0; i < windowSize; i++) ids[i] = this.timeline[lo + i].id;
      } else {
        for (let i = 0; i < windowSize; i++) ids[i] = this.timeline[hi - 1 - i].id;
      }
    } else {
      // Text search is the only facet we cannot test cheaply per-record, so it
      // is resolved to a Set up front; everything else becomes a predicate.
      const textIds = q.text && q.text.trim() ? this.idsMatchingText(q.text) : null;
      const statusSet = q.statuses && q.statuses.length > 0 ? new Set(q.statuses) : null;
      const matches = (visit: Visit): boolean => {
        if (statusSet && !statusSet.has(visit.status)) return false;
        if (q.hostId && visit.hostId !== q.hostId) return false;
        if (q.officeId && visit.officeId !== q.officeId) return false;
        if (q.minuteFrom !== undefined || q.minuteTo !== undefined) {
          const minute = minutesSinceMidnight(entryKey(visit));
          if (q.minuteFrom !== undefined && minute < q.minuteFrom) return false;
          if (q.minuteTo !== undefined && minute > q.minuteTo) return false;
        }
        return true;
      };

      const estimate = textIds ? textIds.size : this.estimateFacetSize(q);
      const useSeek = estimate <= this.timeline.length * SCAN_THRESHOLD;

      if (useSeek) {
        /* SEEK - few candidates. Visit only those records, then sort them.
         * O(k log k) with k << N. */
        plan = 'SEEK';
        const candidates = textIds ?? this.facetCandidates(q);
        scanned = candidates.size;
        const rows: Visit[] = [];
        for (const id of candidates) {
          const visit = this.visits.get(id);
          if (!visit) continue;
          const key = entryKey(visit);
          if (q.from !== undefined && key < q.from) continue;
          if (q.to !== undefined && key > q.to) continue;
          if (!matches(visit)) continue;
          rows.push(visit);
        }
        const dir = sortDir === 'asc' ? 1 : -1;
        rows.sort((a, b) => dir * this.compare(a, b, sortBy));
        ids = rows.map((v) => v.id);
      } else if (sortBy === 'entry') {
        /* SCAN - many candidates. Walking the timeline yields them already in
         * entry order, so we pay O(range) and skip the sort entirely. This is
         * the plan that beat `Array.filter().sort()` in the benchmark. */
        plan = 'SCAN';
        scanned = windowSize;
        ids = [];
        if (sortDir === 'asc') {
          for (let i = lo; i < hi; i++) {
            const id = this.timeline[i].id;
            if (textIds && !textIds.has(id)) continue;
            const visit = this.visits.get(id);
            if (visit && matches(visit)) ids.push(id);
          }
        } else {
          for (let i = hi - 1; i >= lo; i--) {
            const id = this.timeline[i].id;
            if (textIds && !textIds.has(id)) continue;
            const visit = this.visits.get(id);
            if (visit && matches(visit)) ids.push(id);
          }
        }
      } else {
        /* Broad filter, but sorted by a column the timeline is not ordered by.
         * We must materialise and sort; scanning the timeline still avoids
         * building an intermediate Set. */
        plan = 'SCAN';
        scanned = windowSize;
        const rows: Visit[] = [];
        for (let i = lo; i < hi; i++) {
          const id = this.timeline[i].id;
          if (textIds && !textIds.has(id)) continue;
          const visit = this.visits.get(id);
          if (visit && matches(visit)) rows.push(visit);
        }
        const dir = sortDir === 'asc' ? 1 : -1;
        rows.sort((a, b) => dir * this.compare(a, b, sortBy));
        ids = rows.map((v) => v.id);
      }
    }

    this.lastStats = {
      matched: ids.length,
      scanned,
      durationMs: performance.now() - started,
      plan,
      cached: false,
    };

    this.queryCache.set(cacheKey, ids);
    if (this.queryCache.size > QUERY_CACHE_LIMIT) {
      // Map preserves insertion order, so the first key is the least recent.
      const oldest = this.queryCache.keys().next().value;
      if (oldest !== undefined) this.queryCache.delete(oldest);
    }

    return ids;
  }

  /**
   * Upper bound on how many records the non-text facets can match, read
   * straight off the bucket sizes - O(number of facets), no iteration. This is
   * the query planner's cost estimate.
   */
  private estimateFacetSize(q: VisitQuery): number {
    let estimate = this.timeline.length;

    if (q.statuses && q.statuses.length > 0) {
      let total = 0;
      for (const status of q.statuses) total += this.byStatus.get(status)?.size ?? 0;
      estimate = Math.min(estimate, total);
    }
    if (q.hostId) estimate = Math.min(estimate, this.byHost.get(q.hostId)?.size ?? 0);
    if (q.officeId) estimate = Math.min(estimate, this.byOffice.get(q.officeId)?.size ?? 0);

    return estimate;
  }

  /** Materialises the smallest useful candidate set for the SEEK plan. */
  private facetCandidates(q: VisitQuery): Set<string> {
    const sets: Set<string>[] = [];

    if (q.statuses && q.statuses.length > 0) {
      const union = new Set<string>();
      for (const status of q.statuses) {
        const ids = this.byStatus.get(status);
        if (ids) for (const id of ids) union.add(id);
      }
      sets.push(union);
    }
    if (q.hostId) sets.push(this.byHost.get(q.hostId) ?? new Set());
    if (q.officeId) sets.push(this.byOffice.get(q.officeId) ?? new Set());

    if (sets.length === 0) {
      const out = new Set<string>();
      for (const entry of this.timeline) out.add(entry.id);
      return out;
    }

    // Intersect smallest-first: O(min(|A|,|B|)) per step.
    sets.sort((a, b) => a.size - b.size);
    let result = sets[0];
    for (let i = 1; i < sets.length; i++) {
      result = intersect(result, sets[i]);
      if (result.size === 0) break;
    }
    return result;
  }

  /** Text can match the visitor or the host; the two id sets are unioned. */
  private idsMatchingText(text: string): Set<string> {
    const out = new Set<string>();
    for (const visitorId of this.visitorSearch.search(text)) {
      const ids = this.byVisitor.get(visitorId);
      if (ids) for (const id of ids) out.add(id);
    }
    for (const hostId of this.hostSearch.search(text)) {
      const ids = this.byHost.get(hostId);
      if (ids) for (const id of ids) out.add(id);
    }
    return out;
  }

  /**
   * Orders two visits by the requested column.
   *
   * Ties are broken by id, which makes the ordering *total*. That is not a
   * cosmetic detail: the query planner may answer the same question with
   * different plans, and without a tie-break two visits recorded in the same
   * millisecond would come back in a different order depending on which plan
   * ran - so rows would visibly swap places as the dataset grew. The
   * planner-equivalence test in `indexes.test.ts` fails without this.
   */
  private compare(a: Visit, b: Visit, key: SortKey): number {
    let result = 0;
    switch (key) {
      case 'entry':
        result = entryKey(a) - entryKey(b);
        break;
      case 'exit':
        result = (a.checkOutAt ?? a.scheduledEnd) - (b.checkOutAt ?? b.scheduledEnd);
        break;
      case 'status':
        result = a.status < b.status ? -1 : a.status > b.status ? 1 : 0;
        break;
      case 'visitor': {
        const an = this.visitors.get(a.visitorId)?.fullName ?? '';
        const bn = this.visitors.get(b.visitorId)?.fullName ?? '';
        result = an < bn ? -1 : an > bn ? 1 : 0;
        break;
      }
    }
    if (result !== 0) return result;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  }
}

/* ------------------------------ helpers ------------------------------ */

function bucket<K>(map: Map<K, Set<string>>, key: K): Set<string> {
  let set = map.get(key);
  if (!set) {
    set = new Set();
    map.set(key, set);
  }
  return set;
}

function quotaKey(hostId: string, ts: number): string {
  return `${hostId}|${dayKey(ts)}`;
}

/** First index whose ts >= target. Classic lower bound, O(log n). */
export function lowerBound(arr: { ts: number }[], target: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid].ts < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** First index whose ts > target. */
export function upperBound(arr: { ts: number }[], target: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid].ts <= target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Total order on timeline entries: by timestamp, then by id. See `compare()`. */
function compareEntries(a: TimeEntry, b: TimeEntry): number {
  if (a.ts !== b.ts) return a.ts - b.ts;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Keeps the timeline sorted on single inserts. Binary-searches to the start of
 * the run of equal timestamps, then walks it to honour the id tie-break.
 * O(log n) search + O(n) shift for the splice.
 */
function insertSorted(arr: TimeEntry[], entry: TimeEntry): void {
  let i = lowerBound(arr, entry.ts);
  while (i < arr.length && arr[i].ts === entry.ts && arr[i].id < entry.id) i++;
  arr.splice(i, 0, entry);
}

/**
 * Removes one entry. Binary-searches to the first record with this timestamp,
 * then walks the (tiny) run of equal timestamps to find the matching id.
 */
function removeFromTimeline(arr: TimeEntry[], ts: number, id: string): void {
  for (let i = lowerBound(arr, ts); i < arr.length && arr[i].ts === ts; i++) {
    if (arr[i].id === id) {
      arr.splice(i, 1);
      return;
    }
  }
}
