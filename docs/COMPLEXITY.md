# Complexity & Performance

Measured, not asserted. Every number below comes from `npm run bench`, which
compares this implementation against the naive `Array.filter().sort()` version of
the same feature on the same data. The benchmark source is
[`scripts/bench.ts`](../scripts/bench.ts).

> **Run it yourself:** `npm run bench` (50,000 visits) or `npm run bench -- 100000`.

---

## 1. The problem

The front desk screen filters, searches, sorts and paginates the whole visit
history on every keystroke. Written the obvious way that is:

```js
visits
  .filter(v => matchesText(v) && matchesStatus(v) && inDateRange(v))
  .sort(byEntryTime)
```

which is **O(N) filtering + O(N log N) sorting, per keystroke**. At N = 50,000
that measures 42–61 ms — three to four dropped frames on every character typed,
and it gets linearly worse as the company grows.

## 2. The structures

| # | Structure | Where | Serves | Complexity |
|---|---|---|---|---|
| 1 | `Map<id, Visit>` | `indexes.ts` | record lookup | O(1) |
| 2 | `Map<facet, Set<id>>` for status / host / office / day | `indexes.ts` | facet filters, counts | O(1) bucket fetch; intersection O(min(\|A\|,\|B\|)) |
| 3 | `timeline: [{ts, id}]`, sorted | `indexes.ts` | date & time-range queries, default sort | O(log N + k) |
| 4 | Inverted **prefix index** `Map<prefix, Set<id>>` | `searchIndex.ts` | free-text search | build O(R·T·P); query O(C) |
| 5 | **Min-heap** keyed by deadline | `minHeap.ts` | expiry & overstay detection | push O(log N), peek O(1) |
| 6 | LRU memo `Map<queryKey, result>` | `indexes.ts` | repeated filter combinations | O(1) |

Where R = records, T = tokens per record, P = `MAX_PREFIX` (4), C = candidates
sharing the query's prefix, k = rows returned.

### Why a prefix index rather than `String.includes`

For each searchable token (`"Lalita"`, `"Walsons"`, `"9756195792"`) the first
four prefixes are stored:

```
"l" → {v1, v7, …}   "la" → {v1, …}   "lal" → {v1}   "lali" → {v1}
```

A query does one O(1) `Map.get` to obtain a small candidate set and only verifies
the full query text against those candidates. Queries longer than four characters
fall back to verifying candidates, which keeps the index size bounded instead of
growing with the square of token length.

**Trade-off, stated plainly:** this costs memory (P entries per token) and a
one-off build. It is the classic time-for-space trade, and it is the right one
here because search runs thousands of times per session and the build runs once.

### Why a min-heap for deadlines

Two rules are time-driven: an approved visitor who never arrives must expire, and
a checked-in visitor still inside past their window is an overstay. The obvious
implementation scans every visit on an interval — **O(N) per tick, forever**.

Instead all pending deadlines live in a heap ordered by when they fire. A tick
only inspects the head:

```ts
const head = deadlines.peek();          // O(1)
if (!head || head.at > now) return;     // the common case: nothing to do
```

So a tick costs **O(1) when nothing is due** and O(d log N) when d deadlines are —
independent of dataset size. This is the single biggest algorithmic win in the
project: **3,489× faster per tick**.

## 3. The query planner

An index is *not* unconditionally faster, and pretending otherwise produces
slower code. An earlier revision of `indexes.ts` was **1.5× slower than
`Array.filter`** for broad filters, because it built a 39,000-entry `Set` and
then sorted it — both more expensive than one cache-friendly linear pass. The
benchmark caught it; the fix was to choose a strategy per query:

| Plan | Chosen when | Method | Complexity |
|---|---|---|---|
| **SLICE** | no filters at all | two binary searches on the timeline | O(log N + k) |
| **SEEK** | estimated matches ≤ 15% of N | iterate the candidate set, then sort | O(k log k) |
| **SCAN** | estimated matches > 15% of N | walk the pre-sorted timeline in order | O(range), **no sort** |

The estimate is read straight off the bucket sizes (`Set.size`), so planning
itself is O(number of facets). SCAN's trick is that the timeline is *already*
sorted by the column the table sorts by, so a broad query never sorts at all.

The current query's plan, timing and records examined are displayed live in the
app, in the strip under the visitor table's toolbar.

### Correctness of the optimisation

Three plans answering one question is only safe if they always agree. The test
`"gives identical results whichever plan the query planner picks"` in
[`indexes.test.ts`](../src/data/indexes.test.ts) runs eight query shapes through
the planner and compares every result against a brute-force reference, asserting
that more than one plan was exercised.

That test found a genuine defect: visits sharing an entry timestamp came out in
different orders under SEEK and SCAN, so rows would visibly swap places as the
dataset grew. Fixed by making the ordering **total** — timestamp, then id.

## 4. Measured results

Dataset: 50,000 visits, 20,000 visitors, 500 employees. Node 22, Windows 11.
Both sides return identical, identically-sorted id lists. The memo cache is
cleared before every timed indexed iteration.

```
Seed generation  : 167.8 ms
Index build      : 600.6 ms   (one-off, at boot)
Heap after build : 77.4 MB    (records + all indexes)
```

| Operation | Naive p50 | Naive p95 | Indexed p50 | Indexed p95 | Result |
|---|---|---|---|---|---|
| Free-text search | 51.66 ms | 60.82 ms | 6.23 ms | 14.19 ms | **8.3× faster** |
| Status filter + sort | 42.26 ms | 44.56 ms | 21.52 ms | 29.92 ms | **2.0× faster** |
| Date-range query (one day) | 2.55 ms | 3.73 ms | 0.05 ms | 0.09 ms | **47.8× faster** |
| Deadline sweep, per tick | 1.05 ms | 1.97 ms | 0.0004 ms | 0.004 ms | **3,489× faster** |

Repeat of an identical query (memo hit): **0.003 ms**.

### Where it is still slow, and why that is acceptable

- **Status filter + sort returns 38,257 rows.** Only 2× faster, and 21 ms is
  over the 16.7 ms frame budget. The sort dominates and cannot be avoided when
  the user sorts by a column the timeline is not ordered by. It is acceptable
  because that interaction is a deliberate click, not a keystroke, and because
  the result is memoised — the second visit to the same filter costs 0.003 ms.
- **Free-text p95 (14 ms) is more than double its p50.** The p95 is the
  deliberately hostile query `"98"`, which prefix-matches thousands of phone
  numbers and drives the candidate set toward N. It is included rather than
  excluded, because reporting only friendly queries would be dishonest.
- **Index build is 600 ms at 50,000 records.** It runs once, behind a loading
  skeleton, and the app defaults to 2,000 records (~25 ms) with 50,000 available
  from Admin → Data tools. Moving the build into a Web Worker is the obvious
  next step and is listed in the README roadmap.

## 5. Rendering

Query speed is only half the story: a 38,257-row result would create hundreds of
thousands of DOM nodes.

| Technique | Where | Effect |
|---|---|---|
| Virtualised rows (`@tanstack/react-virtual`) | `VisitorsPage.tsx` | DOM nodes ≈ viewport rows (~20) regardless of N — **O(1) DOM** |
| `React.memo` on rows | `VisitorsPage.tsx` | scrolling re-renders only rows entering the viewport |
| 250 ms debounce on search | `useVisitQuery.ts` | collapses a burst of typing into one query |
| Records held outside React state | `store.ts` | React never diffs a 50,000-element structure; a `dataVersion` counter signals change |
| Query ids, not records, in `useMemo` | `useVisitQuery.ts` | a few hundred bytes cross the React boundary, not megabytes |
| Facet counts via `Set.size` | `AdminPage.tsx` | the dashboard costs the same at 1k and 50k |

**Bundle:** 404 KB raw, **128 KB gzipped**, including React, the router and the
QR generator.

## 6. Memory

77.4 MB for 50,000 visits, 20,000 visitors and every index — roughly 1.5 KB per
visit. The breakdown is dominated by the prefix index (four entries per token,
four searchable fields per visitor). Visit records are deliberately **flat and
primitive-only**: timestamps are numbers rather than `Date` objects, which sort
and compare without allocation and keep the records in a shape V8 can store
compactly.

For a real deployment this is the point where the dataset stops living in the
browser: the same index structures belong behind an API, with the client holding
one page at a time. The structures here were chosen so that migration is a
transport change, not a rewrite — `VisitIndex.query()` already takes a query
object and returns ids.

## 7. Scaling beyond this

| Limit | Current | Next step |
|---|---|---|
| Boot time at 50k | 600 ms, once | Build indexes in a Web Worker; stream in |
| Dataset in memory | ~1.5 KB/visit | Server-side index, cursor pagination |
| Timeline insert | O(N) splice | Skip list or bucketed-by-day arrays |
| Sort on non-timeline columns | O(k log k) | Secondary sorted arrays per sortable column |
| Cross-tab sync | BroadcastChannel | WebSocket / SSE from the server |
