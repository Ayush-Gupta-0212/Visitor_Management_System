# Movinsync Frontend Case Study — Project 1: Visitor Management System

**Build plan & execution spec.** Extracted requirements, scoring analysis, architecture, and a
day-by-day schedule.

---

## 1. What the assignment actually asks for

From the PDF (pages 1–5):

**Submission requirements**
1. Clean code — meaningful names, indentation, comments, decomposed into small modules.
2. Implement the wireframes — screenshots are *reference only*, own UI allowed. **Using a
   framework (React/Angular) is a plus point.** Mock data allowed where no API exists.
3. Document the code — explain logic and reusable parts, especially complex algorithms.
4. Submit on GitHub, share the link.
5. Demo video (preferred) or screenshots.

**Stated evaluation criteria (verbatim headings)**
| # | Criterion | What they literally ask |
|---|---|---|
| 1 | **Complexity Estimation** | Thorough time & space complexity analysis; efficient algorithms and data structures; monitor resource consumption for cost-effective scaling |
| 2 | **User Experience** | Intuitive, easy to navigate; system gives feedback on success/failure |
| 3 | **Error Handling** | Graceful errors, informative messages, checks preventing invalid operations / data inconsistencies |
| 4 | **Performance** | Efficient with **large datasets or high loads**; no lag in response times |
| 5 | **Scalability** | Handles increasing users without degradation; adaptable to changing requirements |
| 6 | **Functionality** | Fulfils purpose; **all essential features implemented**; user-friendly |

### Functional requirements (Section 1 of the PDF)

**I. Visitor Registration** — capture Full Name, Contact (mobile/email), Purpose of Visit, Host
Employee (name + department), Company/Organization, Check-in & Check-out time (auto-logged),
**mandatory photo capture**.
Process: guard **or self-service kiosk** collects details + photo → system auto-sends approval
request to host → **visitor badge (physical or digital QR)** generated after approval.

**II. Approval Workflow** — real-time notification to host (email/SMS/app); quick approve/reject
via app or web portal; on approval visitor allowed entry + pass issued; on rejection entry denied
and **security is notified**; **approval history tracked for audit**.

**III. Pre-Approval** — employee schedules and approves access in advance for a **date + time
window** (e.g. 10 AM–12 PM); pre-approved visitor gets **QR/e-pass via email or SMS** to scan on
arrival, bypassing manual approval; **request auto-expires if the visitor doesn't check in within
the window**; admin can enforce rules such as **max 5 pre-approvals per employee per day**.

**IV. Screenshots** — three reference screens (saved in `docs/reference/`):
1. `01-invite-visitors-dropdown.png` — Invite Visitors form; "Types of Visit" dropdown open with
   options: Business Guests, Vendor, Personnel, Govt Officials, Interview, PwC Network Firm, Others.
2. `02-invite-visitors-filled.png` — same form filled: Event Title, Types of Visit, Office, Date,
   start/end time, "Personal note to guests" (optional), right pane = search box "Search by name,
   id, email or phone" + **ADDED GUESTS** list with avatar initials and remove (×). Primary CTA
   "Confirm Invite" (disabled → enabled when valid).
3. `03-front-desk-visitors.png` — Visitors list: `All (27)` count, search box, date picker
   (Feb 10 2025), time-range picker (12:00 am – 11:59 pm), refresh button; table columns
   Visitor (with "Host: …" subtext) / Type of Invite (with "Self Check-in" subtext) / Entry Time /
   Exit Time / Status (`OVERSTAY`, `SELF CHECK-OUT`) with a column filter icon. Right side =
   **Guest Details drawer**: guest ↔ host avatars, OVERSTAY badge, check-in/check-out timeline,
   visit summary, collapsible "Other Details" (Company, Role, Sponsor LOS, Temp Card No),
   "Additional Information" textarea with `0/1000` counter, and a **Check-Out** primary button.

> Note the implicit statuses visible in the screenshot: `OVERSTAY`, `SELF CHECK-OUT`, plus
> "Self Check-in" and "Walk In Visitor". These must exist in the model.

---

## 2. How to actually win this

Read the rubric again: **four of the six criteria are performance/scale/complexity**, on a
*frontend* role. Almost every candidate will submit a form + a table with 10 hardcoded rows and
lose those four categories by default. That is the entire opportunity.

**The five differentiators, in order of leverage:**

1. **A real complexity & performance story.** Ship with **50,000 mock visit records**, a search
   that is O(k) not O(n), list virtualization, a benchmark script, and a `docs/COMPLEXITY.md`
   with a Big-O table *and measured numbers*. This single file answers criteria 1, 4 and 5.
2. **A requirements traceability matrix in the README** — every bullet of the PDF mapped to the
   file/route that implements it. The reviewer can verify 100% coverage in 30 seconds instead of
   hunting. Reviewers reward what they can check fast.
3. **Multi-persona, real-time demo.** Four roles (Front Desk, Host, Visitor Kiosk, Admin) and
   cross-tab sync via `BroadcastChannel`. In the video: front desk registers a walk-in in one tab,
   the host tab's notification bell lights up instantly, host approves, the kiosk tab prints the
   QR pass. That looks like a product, not an assignment.
4. **Visible rigor**: TypeScript, an explicit state machine for visit status, tests, CI badge,
   deployed link, error boundaries, a11y. Rare in this candidate pool.
5. **Demo video with a script.** 3–5 min, narrated, showing the edge cases (rejection → security
   alert, expiry, quota exceeded, offline). Most submissions have no video at all.

Nothing guarantees selection, but this combination puts the submission in the top 1–2% of what a
campus-hiring reviewer normally sees.

**Deliberate non-goals:** no real backend, no real auth, no SMS/email provider. Simulate all three
honestly and *say so* in the README — a clean mock layer scores better than a half-broken Firebase.

---

## 3. Product scope — personas, routes, features

Mock auth: a role-picker login screen (no passwords) → role stored in state, RBAC enforced by a
permissions map, route guards, and a `<Can action="..." />` component.

### A. Front Desk / Security — `/frontdesk`
Rebuilds screenshot 3, plus the walk-in flow.
- Visitors table: search, date picker, time-range picker, status filter, refresh, live count.
- **Virtualized** rows, sticky header, column sort, URL-synced filters (shareable/back-button safe).
- Guest Details drawer: timeline, other details, additional-info textarea with counter, Check-Out.
- **Walk-in registration**: full form + **webcam photo capture** (`getUserMedia`, canvas snapshot,
  fallback to file upload when camera denied) → auto-fires approval request to host.
- **QR scan check-in**: scan a pre-approved e-pass → validates window, status, and single-use.
- Overstay banner + live ticker; "Notify Security" action on rejected visitors.
- Badge print view (`@media print`) with QR.

### B. Host Employee — `/host`
- **Invite Visitors** form — pixel-faithful to screenshots 1 & 2: Event Title, Types of Visit
  (the 7 options), Office, Date, start/end time, personal note (optional, char-limited), right-pane
  guest search with debounce + Added Guests chips with initials avatars, disabled→enabled CTA.
- **Pending approvals** queue: approve / reject with reason, keyboard shortcuts, bulk actions.
- **Pre-approval**: date + time window, quota meter ("3 of 5 used today"), blocked at limit with a
  clear message; generates QR e-pass; simulated "email/SMS sent" with a viewable e-pass preview.
- My visitors: upcoming / today / history.
- Notification bell — real-time via BroadcastChannel, unread count, toast.

### C. Visitor Kiosk — `/kiosk`
- Large-touch-target self-service flow: details → photo → purpose → host search → submit →
  "waiting for approval" screen that flips live to Approved (QR pass shown) or Rejected.
- Returning visitor fast path: phone number → prefill from the visitor index.
- Idle auto-reset timer; full-screen; works keyboardless.

### D. Admin — `/admin`
- Dashboard: visitors today/week, peak-hour chart, avg visit duration, overstay rate, top hosts,
  approval SLA — all derived with memoized selectors over the 50k dataset (perf story).
- Policies: pre-approval limit per employee/day, overstay threshold, auto-expiry grace, office list.
- **Audit log**: append-only, every state transition with actor + timestamp + before/after, with
  filter and CSV export. Directly answers "tracks approval history for audit purposes".
- Data tools: seed size selector (1k / 10k / 50k), reset, export JSON.

---

## 4. Domain model & state machine

```ts
Office      { id, name, city }
Employee    { id, name, email, phone, department, officeId, role }
Visitor     { id, fullName, phone, email, company, photoDataUrl, createdAt }
Visit       { id, visitorId, hostId, officeId, visitType, eventTitle, note,
              scheduledStart, scheduledEnd, status, passCode, source,
              createdBy, createdAt, approvedAt, rejectedReason,
              checkInAt, checkOutAt, tempCardNo, additionalInfo }
AuditEntry  { id, visitId, actor, action, at, from, to, meta }
Policy      { preApprovalLimitPerDay, overstayMinutes, expiryGraceMinutes }
```

**Visit status machine** (invalid transitions throw — this is the "prevent invalid operations"
answer):

```
DRAFT ─▶ PENDING_APPROVAL ─▶ APPROVED ─▶ CHECKED_IN ─▶ CHECKED_OUT
            │                   │            │
            │                   │            └─▶ OVERSTAY ─▶ CHECKED_OUT
            ├─▶ REJECTED        └─▶ EXPIRED (no check-in within window)
            └─▶ EXPIRED
```
`PRE_APPROVED` is `APPROVED` with `source = 'PRE_APPROVAL'`; `SELF_CHECK_OUT` /
`WALK_IN` / `SELF_CHECK_IN` are recorded as `source` flags so the table can render the exact
subtext from the screenshot.

Guard rules to implement and *show failing gracefully* in the video:
- cannot check out before check-in; cannot check in a rejected/expired visit;
- cannot approve outside the scheduled window; QR pass is single-use;
- duplicate visitor detection by phone (merge prompt);
- pre-approval quota; date/time range validity (end > start); required fields incl. photo.

---

## 5. Architecture

```
src/
  app/            router, providers, error boundaries, layout shells
  features/
    visitors/     list, drawer, walk-in form, photo capture
    invites/      invite form, guest search, added-guests
    approvals/    queue, approve/reject, notifications
    preapproval/  window picker, quota, e-pass + QR
    kiosk/        self-service flow
    admin/        dashboard, policies, audit log
  domain/         types, status machine, guards, policy engine  (pure, 100% unit-tested)
  data/           indexes, repository, seed generator, persistence (IndexedDB)
  mocks/          MSW handlers — latency, pagination, failure injection
  shared/         ui kit (Button, Input, Select, Drawer, Table, Toast, Empty, Skeleton),
                  hooks (useDebounce, useVirtual, useBroadcast, useIdle), lib (date, qr, csv)
```

**Stack** (keep it tight; every dep must earn its place)
- React 19 + TypeScript + Vite
- Tailwind CSS v4 (design tokens, dark mode)
- Zustand + immer for app state; TanStack Query optional if MSW is treated as a real API
- react-hook-form + zod (schema is the single source of truth for validation)
- @tanstack/react-virtual (list virtualization)
- MSW v2 (mock REST API with artificial latency + error injection toggle)
- Dexie (IndexedDB) for persistence of the 50k dataset
- `qrcode` (generate) + `html5-qrcode` (scan)
- Recharts (admin dashboard)
- Vitest + React Testing Library; Playwright for one happy-path E2E
- ESLint + Prettier + husky + lint-staged; GitHub Actions; deploy to Vercel

**Why MSW matters:** the PDF says "use mock data if api is not available". A mock *API* with
realistic latency, pagination and a "chaos mode" toggle lets you demo loading skeletons, retries
and error states truthfully — that's criteria 2, 3 and 4 in one move.

---

## 6. The complexity & performance plan (highest-leverage deliverable)

Seed **50,000 visits / 20,000 visitors / 500 employees**. Everything below goes into
`docs/COMPLEXITY.md` with a Big-O table *and* measured p50/p95 numbers on that dataset.

**Data structures**
| Structure | Purpose | Complexity |
|---|---|---|
| `Map<id, Visit>` | primary store | O(1) get/set |
| `Map<token, Set<id>>` prefix/inverted index on name, phone, email, company | search | build O(N·t), query **O(k)** where k = matches, vs O(N) naive `Array.filter` |
| `Map<status, Set<id>>`, `Map<hostId, Set<id>>`, `Map<'YYYY-MM-DD', Set<id>>` | facet filters | O(1) bucket fetch; combine via set intersection O(min\|A\|,\|B\|) |
| Sorted array of `(entryTs, id)` | date/time-range queries | binary search **O(log N + k)** |
| **Min-heap keyed by expectedExitAt** | overstay & pre-approval expiry detection | ticker inspects only the head: **O(1) per tick**, O(log N) per push — instead of scanning all N rows every second |
| LRU cache of last query results | repeated filter combos | O(1) |

**Rendering**
- `@tanstack/react-virtual`: DOM nodes ≈ viewport rows (~20) regardless of N → **O(1) DOM**.
- Memoized selectors + `React.memo` rows; stable callbacks; keys by id.
- Debounced search (250 ms) + `startTransition` for the non-urgent list update.
- Index build moved to a **Web Worker** so the first paint is never blocked (mention as the scaling
  answer even if implemented last).

**Targets to state and measure**
- Search p95 < 16 ms @ 50k · filter apply < 30 ms · 60 fps scroll · TTI < 1.5 s · bundle < 250 KB gz.
- Memory: index ≈ O(N·t) entries; report measured heap via `performance.memory` in the bench script.

**Prove it:** `npm run bench` prints a table (naive vs indexed) and the README embeds the output +
a screenshot of a Chrome Performance trace. Add a "Perf" page in the app itself with a live
stopwatch of the last query — the reviewer can feel it.

---

## 7. Error handling & UX polish checklist

- zod validation, inline field errors, error summary on submit, focus first invalid field.
- Toast system for success/failure (aria-live polite/assertive).
- Route-level `ErrorBoundary` with recovery action; global unhandled-rejection handler.
- MSW chaos toggle → retry with exponential backoff, "Retry" button on failed panels.
- Optimistic approve/check-in with rollback + "Undo" toast.
- Every list has explicit **loading skeleton / empty / error / no-results** states.
- Offline: IndexedDB persistence + online/offline banner + queued actions replayed on reconnect
  (front-desk kiosks lose wifi — this is a real Movinsync-domain insight worth naming in the README).
- Confirmation dialogs for destructive/irreversible actions (reject, check-out).
- Accessibility: keyboard-only front desk flow, focus trap + restore in drawer/modal, visible focus
  rings, WCAG AA contrast, `prefers-reduced-motion`, semantic table markup, labelled inputs.
- Responsive: kiosk = touch/tablet, front desk = desktop table → card list on mobile.

---

## 8. Day-by-day plan (compress or stretch to your deadline)

| Day | Output |
|---|---|
| **0 (½ day)** | Repo, Vite+TS+Tailwind, ESLint/Prettier/husky, routing, layout shell, design tokens, deploy skeleton to Vercel, CI green. First commit today. |
| **1** | `domain/` — types, status machine, guards, policy engine + unit tests. `data/` — seed generator (50k), indexes, repository. MSW handlers. Bench script. |
| **2** | Shared UI kit + Front Desk visitors table: virtualization, search, date/time filters, status filter, sort, URL sync, Guest Details drawer, check-out. |
| **3** | Host: Invite Visitors form (match screenshots), guest search + Added Guests, approvals queue, notification bell, BroadcastChannel sync. |
| **4** | Pre-approval + quota + QR e-pass, kiosk flow, photo capture, QR scanner check-in, badge print, overstay heap + ticker. |
| **5** | Admin dashboard, policies, audit log + CSV. Error/empty/loading states pass. A11y pass. Playwright happy path. |
| **6** | `COMPLEXITY.md`, `ARCHITECTURE.md`, README + traceability matrix, screenshots, record + edit demo video, final deploy, tag `v1.0.0`. |

**If you only have 2–3 days:** Day 0 + 1 + 2 + 3, then jump straight to Day 6. A polished Front
Desk + Host approval loop with the complexity doc beats a half-finished five-module app. Keep kiosk,
QR and admin as "documented roadmap" in the README rather than broken code.

**Commit hygiene:** small, conventional commits (`feat:`, `perf:`, `test:`), pushed daily. Reviewers
do look at the commit graph — one giant "initial commit" reads as copied.

---

## 9. Repo deliverables checklist

```
README.md                 hero GIF, live link, quick start, feature list,
                          REQUIREMENTS TRACEABILITY MATRIX, perf numbers,
                          architecture diagram, what's mocked & why, roadmap
docs/COMPLEXITY.md        Big-O table per operation + measured benchmarks + memory
docs/ARCHITECTURE.md      folder structure, state machine diagram, data flow, decisions/trade-offs
docs/reference/           the three PDF wireframes (already saved)
docs/DEMO_SCRIPT.md       video script
src/…                     code, JSDoc on every non-obvious algorithm
tests/                    unit + one E2E
.github/workflows/ci.yml  typecheck, lint, test, build
```

**README traceability matrix** — one row per PDF bullet:

| PDF requirement | Status | Where |
|---|---|---|
| Full name, contact, purpose, host, company captured | ✅ | `features/visitors/WalkInForm.tsx` |
| Mandatory photo capture | ✅ | `features/visitors/PhotoCapture.tsx` |
| Auto check-in/check-out logging | ✅ | `domain/statusMachine.ts` |
| Auto request to host + real-time notification | ✅ | `features/approvals/…`, `shared/hooks/useBroadcast.ts` |
| Badge / digital QR pass after approval | ✅ | `features/preapproval/EPass.tsx` |
| Approve / reject via web portal | ✅ | `features/approvals/Queue.tsx` |
| Security notified on rejection | ✅ | … |
| Approval history for audit | ✅ | `features/admin/AuditLog.tsx` |
| Pre-approval with date + time window | ✅ | … |
| Auto-expiry if no check-in in window | ✅ | `data/expiryHeap.ts` |
| Admin pre-approval limits (max 5/day) | ✅ | `domain/policy.ts` |
| …every remaining bullet | | |

**Demo video (3–5 min) beats:** 0:00 problem + stack in one line → 0:20 host invites (screenshot-1
form) → 0:50 kiosk walk-in + photo → 1:20 **split-screen: approval appears live in host tab** →
1:50 QR e-pass scanned at front desk → 2:20 front desk table with **50,000 rows, instant search**
(say the number out loud) → 2:50 overstay + check-out → 3:10 error cases: quota exceeded, expired
pass, API failure + retry → 3:40 admin dashboard + audit log → 4:00 complexity table on screen,
30-second close on trade-offs.

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| Scope creep kills polish | Freeze scope after Day 3; move the rest to README "Roadmap" |
| Camera/QR permissions fail on reviewer's machine | Always ship a file-upload fallback and a "simulate scan" button; never let the demo dead-end |
| 50k seed makes the deployed app slow to boot | Default seed 1k, with a UI control to jump to 50k; generate in a worker |
| Video over-runs | Write the script first, rehearse once, cut ruthlessly |
| Late start | Day 0 + 1 are non-negotiable; they carry the criteria most candidates lose |
