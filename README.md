# Visitor Management System

A workplace Visitor Management System: visitor registration with photo capture,
a host approval workflow with real-time notification, pre-approval with QR
e-passes, and a front-desk console that stays responsive over 50,000 visit
records.

Built for the Movinsync frontend case study (Project 1).

**Stack:** React 19 · TypeScript · Vite · Tailwind CSS v4 · Zustand ·
TanStack Virtual — no backend, no UI kit, no form library.

---

## Quick start

```bash
npm install
npm run dev
```

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Type-check and build for production |
| `npm test` | Unit tests (22 tests) |
| `npm run bench` | Performance benchmark vs. the naive implementation |
| `npm run typecheck` | Type-check only |

**To see the interesting parts in 60 seconds**

1. Open the app twice, side by side.
2. In tab A, keep the role selector on **Front desk**. In tab B switch it to
   **Host employee**. (The role is stored per tab, so the two stay separate.)
3. In tab A, **Register walk-in** → fill the form → **Send approval request**.
4. Watch tab B: the notification bell updates instantly and the request appears
   in the approvals queue. Approve it.
5. Tab A flips to "Approved" and shows the QR entry pass — no refresh anywhere.
6. Go to **Admin → Data tools → 50,000 visits**, then back to the visitor table
   and type in the search box. The strip under the toolbar reports which query
   plan ran, how long it took, and how many of the 50,000 records were examined.

---

## Requirements traceability

Every requirement in the case-study brief, and where it is implemented.

### I. Visitor registration

| Requirement | Where |
|---|---|
| Full name | [`WalkInPage.tsx`](src/features/visitors/WalkInPage.tsx) |
| Contact information (mobile and/or email) | `WalkInPage.tsx`, validated in [`validators.ts`](src/domain/validators.ts) |
| Purpose of visit | `WalkInPage.tsx` |
| Host employee details (name + department) | [`pickers.tsx`](src/features/visitors/pickers.tsx) → `HostPicker` |
| Company / organisation name | `WalkInPage.tsx` |
| Check-in and check-out time, automatically logged | [`store.ts`](src/app/store.ts) → `checkIn`, `checkOut` |
| **Mandatory photo capture** | [`PhotoCapture.tsx`](src/features/visitors/PhotoCapture.tsx) — webcam with upload fallback; submission is blocked without one |
| Guard **or self-service kiosk** collects details | `WalkInPage.tsx` (front desk) and pass-code self check-in on the visitor table |
| System automatically requests host approval | `store.ts` → `createWalkIn` publishes to the host |
| Visitor badge / digital QR generated after approval | [`PassQr.tsx`](src/features/invites/PassQr.tsx), printable via `@media print` |

### II. Approval workflow

| Requirement | Where |
|---|---|
| Real-time notification to the host | [`realtime.ts`](src/app/realtime.ts) — BroadcastChannel; bell in [`Layout.tsx`](src/app/Layout.tsx) |
| Quick approve / reject through the web portal | [`ApprovalsPage.tsx`](src/features/approvals/ApprovalsPage.tsx) |
| Access granted on approval; pass issued | `store.ts` → `approveVisit` issues a single-use `passCode` |
| Denied access; **security notified** | `rejectVisit` requires a reason; the front desk sees "Entry denied — security has been notified. Do not issue a badge." |
| Approval history tracked **for audit** | [`AdminPage.tsx`](src/features/admin/AdminPage.tsx) → append-only audit log with CSV export |
| Only authorised visitors can enter | [`statusMachine.ts`](src/domain/statusMachine.ts) — check-in is impossible from any state except `APPROVED` |

### III. Pre-approval

| Requirement | Where |
|---|---|
| Schedule and approve in advance for a date + time window | [`InvitePage.tsx`](src/features/invites/InvitePage.tsx) |
| QR code / e-pass issued to the visitor | `PassQr.tsx`, shown on the confirmation screen |
| Scan on arrival, bypassing manual approval | `VisitorsPage.tsx` → `ScanPass`; `store.ts` → `redeemPass` |
| **Request expires if the visitor does not check in within the window** | [`minHeap.ts`](src/data/minHeap.ts) + `store.ts` → `sweepDeadlines`, rule in `statusMachine.ts` → `deriveStatus` |
| Admin-enforced pre-approval limits (max N per employee per day) | [`rules.ts`](src/domain/rules.ts) → `assertPreApprovalQuota`; configurable in Admin; live quota meter on the invite form |

### IV. Wireframes

| Reference screenshot | Implemented as |
|---|---|
| Invite a visitor (with the 7 "Types of Visit" options) | `InvitePage.tsx` |
| Search and add employee / guest | `pickers.tsx` → `GuestPicker`, with the "Added guests" list |
| Front desk application (visitor table + guest details) | `VisitorsPage.tsx`, [`GuestDetails.tsx`](src/features/visitors/GuestDetails.tsx) |

The originals are in [`docs/reference/`](docs/reference). The brief says
screenshots are reference only, so the layout follows them closely while adding
what the written requirements need (status facets, a performance readout, the
audit trail).

### Evaluation criteria

| Criterion | How it is addressed |
|---|---|
| **Complexity estimation** | [`docs/COMPLEXITY.md`](docs/COMPLEXITY.md): Big-O per operation, the structures chosen and why, and measured numbers from `npm run bench` |
| **User experience** | Every action produces feedback (toast, inline error, live status); the front desk flow is fully keyboard-operable; filters live in the URL so the back button and bookmarks work |
| **Error handling** | Business rules throw readable `DomainError`s; forms validate on blur; route-level error boundaries; optimistic updates roll back on failure; **Admin → "Fail half of all requests"** makes all of it demonstrable |
| **Performance** | Indexed queries, three query plans, virtualised rows, debounced input, 128 KB gzipped bundle |
| **Scalability** | Runtime dataset dial (1k / 10k / 50k); structures chosen so the same query API can move behind a server; limits and next steps documented honestly |
| **Functionality** | The traceability tables above — every requirement in the brief is implemented |

---

## Architecture

```
src/
  domain/      pure business logic - types, state machine, rules, validators
  data/        indexes, search index, min-heap, seeded mock data generator
  api/         simulated network: latency, failures, retry with back-off
  app/         store, routing, realtime, permissions, layout, error boundary
  features/    visitors · invites · approvals · admin
  shared/      ui primitives, hooks, date helpers
```

`src/domain` and `src/data` contain no React, no browser APIs and no network
calls, which is what makes the business rules unit-testable and the query engine
benchmarkable from Node. Detail in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

### Visit lifecycle

```
PENDING_APPROVAL ─▶ APPROVED ─▶ CHECKED_IN ─▶ CHECKED_OUT
       │               │            │
       │               │            └─▶ OVERSTAY ─▶ CHECKED_OUT
       ├─▶ REJECTED    └─▶ EXPIRED
       └─▶ EXPIRED
```

Transitions live in one table in [`statusMachine.ts`](src/domain/statusMachine.ts).
Illegal ones throw with a message written for the person at the desk — "Cannot
move a visit from Approved to Checked out", not an error code. This is how the
brief's "checks in place to prevent invalid operations" is satisfied in one
place rather than in every component.

---

## Performance summary

50,000 visits · 20,000 visitors · 500 employees. Full method and caveats in
[`docs/COMPLEXITY.md`](docs/COMPLEXITY.md).

| Operation | Naive `Array.filter` | This implementation | |
|---|---|---|---|
| Free-text search | 51.66 ms | 6.23 ms | **8.3× faster** |
| Status filter + sort | 42.26 ms | 21.52 ms | **2.0× faster** |
| Date-range query | 2.55 ms | 0.05 ms | **47.8× faster** |
| Deadline sweep, per tick | 1.05 ms | 0.0004 ms | **3,489× faster** |

Two things worth saying out loud, because they are the parts that took the
actual engineering:

1. **The index was once slower than the naive code.** For broad filters, building
   a 39,000-entry `Set` and sorting it cost more than one linear pass. The
   benchmark exposed it and the fix was a query planner that picks between three
   strategies by estimated selectivity.
2. **The planner-equivalence test found a real bug.** Rows with identical
   timestamps were ordered differently depending on which plan ran, so the table
   reordered itself as the dataset grew. Fixed by making the sort a total order.

---

## What is mocked, and why

There is no backend — the brief says to use mock data where no API is available.
Rather than hide that, the seams are explicit:

| Real system | Here | Why this way |
|---|---|---|
| Database | Deterministic seeded generator, 1k–50k records | Size becomes a runtime dial, so performance claims can be demonstrated rather than asserted; a JSON fixture of 50k records would be megabytes of bundle |
| REST API | [`mockApi.ts`](src/api/mockApi.ts) — async, variable latency, injectable failures, retry with exponential back-off | Loading skeletons, rollback and error messaging are real code paths, not decoration |
| Push notifications / SMS / email | `BroadcastChannel` between tabs | Two tabs genuinely are two users; the demo is real rather than simulated with a timer |
| Authentication | Role selector, persisted per tab | Auth is a backend concern; **authorisation is real** — [`permissions.ts`](src/app/permissions.ts) gates routes and navigation |
| QR scanner hardware | Pass-code entry field | A real scanner emits the decoded string as keyboard input, which is exactly what this field receives. Deliberately chosen over a webcam scanner so a demo cannot dead-end on a camera permission |

## Accessibility

Keyboard-first, because a reception desk is. Full keyboard operation of the
table, drawer and comboboxes; focus trapped and restored in the drawer; a single
always-visible focus style; `aria-live` regions for toasts; labelled controls
with `aria-invalid` and `aria-describedby` on every field; `aria-sort` on
sortable headers; `prefers-reduced-motion` and `prefers-color-scheme` respected.

## Roadmap

Known limits, and what each would take:

- Move index construction into a **Web Worker** so a 50k boot never blocks paint.
- Replace the in-memory index with a **server-side** one; `VisitIndex.query()`
  already takes a query object and returns ids, so this is a transport change.
- **Webcam QR scanning** alongside pass-code entry.
- **Offline queue**: actions taken while offline are currently kept in memory
  only; persisting them to IndexedDB and replaying on reconnect is the real fix.
- Secondary sorted arrays per column, to remove the sort from broad filters.

## Documentation

| Document | Contents |
|---|---|
| [`docs/COMPLEXITY.md`](docs/COMPLEXITY.md) | Big-O analysis, data structures, query planner, measured benchmarks, memory, scaling limits |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Layering, state management, data flow, design decisions and trade-offs |
| [`docs/DEMO.md`](docs/DEMO.md) | Demonstration walkthrough, including the error cases |
| [`docs/TYPESCRIPT-NOTES.md`](docs/TYPESCRIPT-NOTES.md) | Every TypeScript construct used in the repo, and why |
| [`docs/PLAN.md`](docs/PLAN.md) | Scope decisions, what was deliberately left out, and why |
| [`docs/reference/`](docs/reference) | The wireframes and requirements extracted from the brief |
