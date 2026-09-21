# Architecture

## Layering

```
┌─────────────────────────────────────────────────────────┐
│ features/    visitors · invites · approvals · admin      │  React
│              screens, forms, tables, drawers             │
├─────────────────────────────────────────────────────────┤
│ app/         store · routing · realtime · permissions    │  React + browser
├─────────────────────────────────────────────────────────┤
│ api/         simulated network (latency, failure, retry) │  async boundary
├─────────────────────────────────────────────────────────┤
│ data/        indexes · search index · min-heap · seed    │  pure TS
├─────────────────────────────────────────────────────────┤
│ domain/      types · state machine · rules · validators  │  pure TS
└─────────────────────────────────────────────────────────┘
```

Dependencies point downward only. `domain/` and `data/` import no React, no DOM
and no network — which is why the rules are unit-testable and the query engine
can be benchmarked from Node with `npm run bench`.

## State management

The central decision: **the 50,000 visit records do not live in React state.**

```
  VisitIndex (module-scoped, mutable)          zustand store
  ├── Map<id, Visit>              50k          ├── role, currentUserId
  ├── facet buckets                            ├── policy
  ├── sorted timeline                          ├── toasts
  └── search indexes                           ├── notifications
                                               ├── audit entries
         ▲                                     └── dataVersion ──┐
         │                                                       │
         └──── mutated in place ◀── store actions                │
                                                                 │
  components ──── useMemo([query, dataVersion]) ◀────────────────┘
              └─▶ visitIndex.query(...) ─▶ string[] of ~ids
```

Putting the records in the store would make zustand's equality checks and
React's reconciliation walk a huge object graph on every keystroke. Instead:

1. Store actions mutate the index in place.
2. They bump `dataVersion`.
3. Components `useMemo` on `[query, dataVersion]` and re-run the query.
4. The query returns **ids** — a few hundred bytes — not records.
5. The virtualiser renders ~20 of them.

The cost of this design is that the index is mutable state React cannot see, so
every mutation must go through `store.ts` and bump the version. That constraint
is enforced by keeping `VisitIndex`'s mutators (`insert`, `update`) the only way
to change anything, and having them repair every affected bucket themselves.

## The mutation pipeline

Every state-changing action follows the same five steps:

```ts
assertCanApprove(visit, Date.now());   // 1. business rule — throws DomainError
applyLocal(set, visitId, patch, entry); // 2. optimistic local update
                                        // 3. audit entry (append-only)
publish({ type: 'VISIT_CHANGED', ... }); // 4. broadcast to other tabs
try { await request(() => true); }       // 5. simulated network
catch { applyLocal(set, visitId, previous, rollbackEntry); }
```

The UI updates immediately and rolls back with an explanation if the request
fails. Turn on **Admin → "Fail half of all requests"** to watch it happen.

## Cross-tab realtime

`BroadcastChannel` delivers a message to every other tab on the same origin
within a few milliseconds. Because every tab generates the same deterministic
dataset from the same seed, a patch identified by visit id applies cleanly
everywhere — so two tabs behave like two users against one server.

Guarded throughout: `isRealtimeSupported` is false in browsers without it, and
the app degrades to single-tab with a note in the footer.

The role is stored in **`sessionStorage`, not `localStorage`** — session storage
is per-tab, so a reload keeps you signed in as the same person while a second tab
can be someone else. `localStorage` would force both tabs to share a role and
break the demo.

## Design decisions

| Decision | Why | Cost |
|---|---|---|
| No UI component library | The brief rewards demonstrated ability; the primitives needed are a dozen components | More code to maintain |
| No form library | ~70-line `useForm` covers values, per-field rules, touched state and a submit guard | No advanced features (arrays, wizards) |
| No charting library | One histogram; 20 lines of SVG themes itself with the same CSS variables | Would not scale to many chart types |
| Hand-rolled mock API instead of MSW | No service worker to register or break on a static host; failure injection is a plain flag | Less faithful to real fetch semantics |
| Seeded generator instead of a JSON fixture | Dataset size becomes a runtime dial; bundle stays small; data is reproducible | Data is synthetic-looking on close reading |
| Timestamps as `number`, not `Date` | Sorting and comparison with no allocation, on the hot path | Formatting must convert at the edge |
| Records flat, primitive-only | Compact in memory; cheap to copy for optimistic patches | Joins (visitor, host) happen at render time |
| Filters in the URL | Bookmarkable, shareable, back button works, survives reload | Filter state must serialise |
| `dataVersion` counter | Avoids React diffing 50k records | Mutations must remember to bump it |

## Validation strategy

Three layers, each with one job:

| Layer | File | Responsibility |
|---|---|---|
| Field | `domain/validators.ts` | Shape: is this a valid phone number, email, length? |
| Rule | `domain/rules.ts` | Policy: quota, time window, can this visit be checked in? |
| Transition | `domain/statusMachine.ts` | Lifecycle: is this state change legal at all? |

Components never re-implement any of them; they call and catch. Anything thrown
goes through `toUserMessage()`, which shows `DomainError` messages verbatim and
replaces anything unexpected with a generic line — stack traces are useless to a
security guard and leak internals.

## Testing

| Suite | Covers |
|---|---|
| `statusMachine.test.ts` | Legal and illegal transitions, terminal states, time-driven expiry and overstay |
| `indexes.test.ts` | Binary search, min-heap ordering and draining, prefix search, index repair on mutation, and **planner equivalence** |

The planner-equivalence test is the important one: it runs eight query shapes
through the planner, asserts more than one plan was exercised, and compares
every result against a brute-force reference. It is what makes the optimisation
in `query()` safe to keep, and it caught a real ordering defect — see
[`COMPLEXITY.md`](COMPLEXITY.md#correctness-of-the-optimisation).

## Known limits

Listed in the README roadmap. The honest short version: the index build is 600 ms
at 50,000 records and blocks the main thread; offline actions are held in memory
only; and sorting by a non-timeline column still costs `O(k log k)`.
