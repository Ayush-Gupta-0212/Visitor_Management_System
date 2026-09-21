# Two-day plan — Movinsync case study, Project 1 (Visitor Management System)

Revised for a 2-day deadline and a React-comfortable / TypeScript-new author.
The original six-day plan is in git history.

## Decisions taken, and why

| Decision | Reasoning |
|---|---|
| **TypeScript, kept plain** | It is a real differentiator and the domain has seven states with a dozen transition rules, which is exactly what types are good for. No generics gymnastics, no schema inference. Every construct used is explained in [`TYPESCRIPT-NOTES.md`](TYPESCRIPT-NOTES.md) so it can be defended in the interview. |
| **Dropped MSW, react-hook-form, zod, Recharts, Dexie** | Five fewer things to learn, explain and debug in 48 hours. Replaced by a ~90-line mock API, a ~70-line `useForm`, a 20-line SVG chart, and a deterministic seeded generator. Each replacement is smaller than the config the library would have needed. |
| **Dropped webcam QR scanning** | A camera permission failing mid-demo is a real risk with no upside. A pass-code field receives exactly what a real QR reader emits — keyboard input. |
| **Dropped Playwright** | Unit tests on the domain and the query planner catch real defects (they caught two). An E2E smoke test in 48 hours mostly tests that React renders. |
| **Kept the 50k dataset, the benchmark and COMPLEXITY.md** | Four of the six stated evaluation criteria are about complexity, performance and scale. This is where the marks are. |

## Status

### Done

- [x] Repo, Vite + React 19 + TypeScript + Tailwind v4, strict mode, path aliases
- [x] `domain/` — types, status machine, rules, validators
- [x] `data/` — facet indexes, sorted timeline, inverted prefix search, min-heap
- [x] Query planner with three strategies + live stats readout
- [x] Deterministic seeded generator (1k / 10k / 50k, runtime switchable)
- [x] Fair benchmark vs. naive `Array.filter` — `npm run bench`
- [x] 31 unit tests: domain rules, query-planner equivalence, and seeded-data invariants
- [x] Front desk visitor table: virtualised, searchable, filterable, sortable, URL-synced
- [x] Guest details drawer with timeline, e-pass, check-out
- [x] Walk-in registration with webcam photo capture + upload fallback
- [x] Host approvals queue with reasons required on rejection
- [x] Invite Visitors form matching the wireframes, with guest picker
- [x] Pre-approval, per-day quota, QR e-pass, single-use redemption
- [x] Cross-tab realtime over BroadcastChannel
- [x] Optimistic updates with rollback; injectable network failures
- [x] RBAC in the router and navigation; role persisted per tab
- [x] Admin: stats, peak-hour chart, policy editor, audit log, CSV export
- [x] README with full requirements traceability, COMPLEXITY.md, ARCHITECTURE.md

### Remaining

- [ ] **Screenshots** for the README (list is at the end of [`DEMO.md`](DEMO.md))
- [ ] **Record the demo video** — script in [`DEMO.md`](DEMO.md), ~4 minutes
- [ ] **Deploy** (Vercel or Netlify; `npm run build`, output `dist/`) and put the
      link at the top of the README
- [ ] **Push to GitHub** and share the link
- [ ] Optional if time allows: GitHub Actions running `typecheck`, `test`, `build`

### Deliberately not done

Listed in the README roadmap rather than half-built: Web Worker index
construction, webcam QR scanning, IndexedDB offline queue, server-side index.
A short honest roadmap reads better than four broken features.

## Before you submit — checklist

1. `npm run typecheck && npm test && npm run build` all pass from a clean clone.
2. `npm install && npm run dev` works on a machine that has never seen the repo.
3. The README's live link works, and the first screenshot shows the 50k query
   readout.
4. The video is under 5 minutes and shows the two-window approval, the 50k
   search, and a failure rolling back.
5. Commit history is readable — it already is; do not squash it into one commit.
6. Re-read the brief's six evaluation criteria one last time against the README
   table.

## Talking points to rehearse

These are the questions most likely to come up, because they are what the code
is unusual for:

1. **"Walk me through what happens when I type in the search box."**
   Debounce 250 ms → `useVisitQuery` memo on `[query, dataVersion]` →
   `VisitIndex.query()` → prefix index gives a candidate set → planner picks
   SEEK or SCAN → returns ids → virtualiser renders ~20 rows.

2. **"Why three query plans?"**
   Because the index was measurably *slower* than `Array.filter` for broad
   filters — building a 39,000-entry Set and sorting it cost more than one
   linear pass. Show the benchmark. This is the strongest thing in the project:
   it shows measurement driving a design change.

3. **"How do you know the three plans agree?"**
   The planner-equivalence test. It caught a real ordering bug with tied
   timestamps.

4. **"Why is the data not in React state?"**
   React would diff 50,000 records on every keystroke. The index is mutable and
   module-scoped; `dataVersion` is the signal.

5. **"What's the min-heap for?"**
   Expiry and overstay. O(1) per tick instead of O(N) — the ticker only looks at
   the earliest deadline.

6. **"What would you do with a real backend?"**
   `VisitIndex.query()` already takes a query object and returns ids, so the
   same structures move server-side and the client holds one page. It is a
   transport change, not a rewrite.

7. **"What's the weakest part?"**
   The 600 ms index build at 50k blocks the main thread; it belongs in a Web
   Worker. Say this before they find it.
