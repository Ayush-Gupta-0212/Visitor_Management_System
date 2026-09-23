# PassKey VMS: Visitor Management System

A front-desk visitor management system built for the MoveInSync frontend case study. It covers the whole visit lifecycle: walk-in registration with photo capture, host approval, pre-approval scheduling with a daily quota, check-in and check-out with temporary cards, automatic overstay and expiry detection, digital passes and a security audit trail.

It runs entirely in the browser on mock data. Nothing needs a backend or a login.

**Stack:** Vite 8 · React 19 · TypeScript 6 (strict) · Tailwind CSS 4 · Radix UI primitives · Zustand 5 (with `persist`) · date-fns · lucide-react

For design decisions, complexity analysis and interview notes, see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Executive summary

Legacy enterprise VMS tools usually work like paper logbooks on a screen: one long form, a table with no context, and approval that happens over the phone. This project is built around the three people who actually use a VMS each day:

| Role | Who | What they get |
| --- | --- | --- |
| **Gatekeeper** | Front-desk security | A live console: who is on site, who is overdue, who is expected next. Walk-in registration with a webcam photo, pass verification, and check-in and check-out with temp-card tracking. |
| **Host Employee** | The person being visited | A workspace for approving or rejecting live requests, inviting guests ahead of time, and seeing how much of today's approval quota is left. |
| **Super Admin** | Workplace operations | Site-wide analytics, an editable access policy (quota and overstay grace period) and a filterable audit log. |

What it does better than a legacy VMS:

- **Nothing is silent.** Every action ends in a toast that says what happened, or why it didn't: *"Daily Pre-Approval Quota Exceeded (Limit: 5)"*, *"Too early: Akshay Tiwari's pass is valid from 11:00 AM on Thu 24 Sep."*
- **Time-based rules run by themselves.** Overstays are flagged and unused passes expire without anyone checking. The app re-checks every 30 seconds and again whenever it loads.
- **Dense but calm.** The visual design comes from a Google Stitch design system: Geist for the interface, JetBrains Mono for times, badge IDs and card numbers, 1px hairline borders, and colour reserved for status.
- **Built for the actual workflow.** Keyboard shortcuts (⌘K / Ctrl K to search), a drawer that turns into a bottom sheet on tablets, confirmation before a card is collected at check-out, and a status badge on every row that shows exactly how long a visitor has overstayed.

---

## Demo and credentials

There is no hosted deployment yet, so run the app locally (see [Setup](#setup-and-run)).

There is no sign-in. Switch between the three demo users with the **Gatekeeper | Host Employee | Super Admin** control in the top bar. On small screens it moves to a second row, and the avatar menu offers the same choice.

| Role | Demo user | Department |
| --- | --- | --- |
| Gatekeeper | Suresh Pawar | Security · Front Desk |
| Host Employee | Lalita Mehta | Internal Firm Services |
| Super Admin | Kavita Joshi | Workplace Operations |

Visitor and host names follow the assignment's reference screens (Dhulabhai Bamania, Ajay Singh, Arun Kumar, Navin Patidar, host Lalita Mehta and others). Companies, emails (reserved `.example` domains) and phone numbers are fictional.

### The seeded data

On first load the app generates **20 visits relative to the current time**, so there is always something to act on whenever you open it:

- 3 visitors overstaying and 5 on site
- 4 pre-approved visits: one arriving now, one later today, two in the next two days
- 2 kiosk requests waiting on a host
- history: 4 checked out, 1 rejected, 1 expired

Everything you do is saved in `localStorage`. **Reset mock database** (top bar) puts the seed back, freshly generated for the current time, after asking for confirmation.

### A five-minute walkthrough

1. **Gatekeeper.** Open the *Overstay* tab, open Dhulabhai Bamania and check him out. The drawer asks you to collect card TC-116 before confirming.
2. **Gatekeeper.** Click **Register walk-in**, choose Lalita Mehta as host, click **Use mock photo**, then **Send for host approval**.
3. **Host Employee.** The bell and the yellow banner show the request. Approve it and a *Pass Approved* toast appears, with a link to the digital pass. Reject Imran Sheikh with a reason.
4. **Host Employee.** During working hours Lalita now has 5 of 5 approvals for today. Open **Invite visitors**, add a guest: an inline warning blocks the invite. Change the date to tomorrow and send it.
5. **Gatekeeper.** Under **Approved · ready to check in** in the bell, check the walk-in in. Copy a token from any pass (**Copy token**) and paste it into **Verify pass**.
6. **Super Admin.** Lower the overstay grace period and save. The audit log shows every step above, attributed to the person who did it.

---

## Key feature walkthrough

### Visitor registration and camera integration

The walk-in modal (`src/components/gatekeeper/WalkInRegistrationModal.tsx`) collects full name, phone, email, purpose, visitor category, host (a searchable combobox over the employee directory), company, expected stay and an optional temp card ID.

The photo is **mandatory**, per the brief. `PhotoCapture.tsx` tries three sources in order:

1. **Webcam.** `navigator.mediaDevices.getUserMedia` shows a live, mirrored preview; **Capture photo** freezes a frame onto a canvas.
2. **File upload.** Used when there is no camera or permission is denied. The user sees *"Camera Permission Denied: Using Fallback"*.
3. **Use mock photo.** Generates an initials tile instantly, for testing.

Every image is centre-cropped and re-encoded as a 320 px JPEG (roughly 15–25 kB) before it is stored. The camera stream is stopped as soon as a frame is captured or the dialog closes.

The form validates everything in one pass, lists all problems at once and moves focus to the first invalid field. Submitting works two ways:

- **Check in now** admits the visitor immediately and issues the next free temp card (TC-101 upwards, never one already held on site).
- **Send for host approval** creates a pending request, which the host approves before the desk admits the visitor. This is the flow the brief describes.

### Two-way approval workflow

Requests come from the front desk (walk-ins sent to the host) or the self-service kiosk (seeded).

- **Host side:** a pending-approvals banner on the dashboard and a bell with a live count. **Approve** issues a pass and shows a *"Pass Approved for [Name]"* toast with a **View pass** action. **Reject** opens a dialog that requires a reason and offers four quick reasons.
- **Desk side:** the bell groups requests into *Approved · ready to check in* (with a **Check in** button), *Waiting on host*, and *Denied · do not admit* (with the host's reason), so the guard knows who to turn away.
- **Ownership:** hosts see and decide only on their own visitors. A host can also revoke a pre-approval before the guest arrives, which frees that quota slot.

Every decision is written to the audit log with the time and the person who made it.

### Pre-approval scheduling and quota enforcement

**Invite visitors** (`src/components/host/InviteVisitorModal.tsx`) follows the reference screen: event title, type of visit, office location, date with a from/to window (an end time earlier than the start means the next day), a personal note to guests (0/1000) and a multi-guest chip picker. The picker searches the host's past guests by name, email or phone, and has an inline form for adding someone new.

The quota (default **5 approved visits per host per visit day**, set by the admin) is enforced in two places:

- **In the form, live.** *"3 of 5 approvals left for Thu 24 Sep; this invite uses 2."* If the guests would exceed the limit, a red warning appears and **Confirm** is disabled.
- **In the store,** for every pre-approval and every approval of a request, so no UI path can get around it.

Pre-approvals and approved requests count toward the quota. Revoked approvals and walk-ins admitted directly at the desk do not.

### Real-time overstay tracking

`useStatusSweep()` runs two sweeps as soon as the app mounts and again every 30 seconds:

- **Overstay:** a checked-in visitor whose window ended more than the grace period ago (default 30 minutes) becomes `OVERSTAY`. The row badge pulses rose and shows the time overdue (*Overstay +1h 12m*), and the stats and the host's on-site list update with it.
- **Expiry:** a pre-approval or request whose window closed without a check-in becomes `EXPIRED`, as the brief requires.

Both sweeps also run when saved data is loaded, so anything that lapsed while the tab was closed is caught. The front desk's *Today* view always includes everyone currently on site, including an overnight overstay whose visit started yesterday.

### Extensible digital pass and QR architecture

`DigitalPassModal.tsx` renders the pass as a single SVG component: visitor photo, name, company, host, office, date and window, pass status and temp card. That same SVG is:

- shown in the modal,
- **printed** from a bare pop-up window containing only the pass, and
- **downloaded** as a standalone `.svg` file.

The QR code is `<QRCodePlaceholder data={visitor.qrCodePlaceholder} />`. It draws a deterministic QR-like pattern from the pass token but is **not scannable**. Its doc comment explains where production code plugs in: a real encoder, signed and expiring tokens, and camera decoding with `BarcodeDetector` or ZXing.

The desk side of that architecture already works. **Verify pass** resolves a token to its visit with an O(1) index lookup (`findVisitorByPassToken`) and opens the visitor's drawer. A camera scanner would feed decoded tokens into that same function.

### Also included

- **Error boundaries** around each role's panel and around the shared overlays, with **Try again** and **Reset mock database** fallbacks.
- **Empty states** for table searches, pending approvals, upcoming guests, the audit log and the notification bell.
- **Motion:** modal pop-in and pop-out, sheet slide, a sliding role and filter pill, and staggered row entrances when filters change. All motion is disabled under `prefers-reduced-motion`.
- **Accessibility:** labelled fields with linked error messages, keyboard-operable comboboxes and segmented controls, a skip link, and focus returned to the trigger when overlays close.

---

## Setup and run

Requires Node.js 20+ (developed on Node 22) and npm.

```bash
npm install
```
```bash
npm run dev
```

Then open http://localhost:5173.

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | Type-checks the whole project (`tsc -b`, strict), then produces a production build in `dist/` |
| `npm run preview` | Serves the production build locally |
| `npm run lint` | Lints with oxlint |

To start over from a clean slate, use **Reset mock database** in the app, or clear the `vms-store` key from the browser's localStorage.

---

## Project structure

```text
src/
  types/vms.ts              Domain types: visitor, statuses, roles, audit entries, action results
  data/mockData.ts          Employee directory, demo users, seed visits and seed audit trail
  lib/
    rbac.ts                 Permission matrix, can(), authorize(), visibleTo()
    visitorRules.ts         Lifecycle, time windows, quota, temp cards, validation, filtering
    visitorIndex.ts         O(1) / O(K) lookup indexes over the visitor list
    format.ts, photo.ts     Date and duration formatting; photo compression and monograms
    toast.ts, feedback.ts   Toast queue; store action to toast wiring
  store/
    useVmsStore.ts          Zustand store: actions, audit trail, persistence
    hooks.ts                Derived hooks (pending requests, visitor by id, status sweep)
    useUiStore.ts           Which drawer, pass or dialog is open (not persisted)
  components/
    ui/                     Primitives: Button, Badge, Input, Select, Modal, Sheet, Popover, ...
    layout/                 Navbar, role switcher, notification bell, error boundary
    gatekeeper/             Console, visitor table, guest drawer, walk-in modal, photo capture
    host/                   Host dashboard, invite modal, guest chip picker, reject modal
    admin/                  Governance hub, policy settings, audit log
    visitor/                Digital pass, QR placeholder, status badge
tailwind.config.js          Design-system scales (type, radius, elevation, spacing, motion)
src/index.css               Colour tokens as CSS variables and base styles
```

## Known limitations

- **No backend.** Data lives in one browser's `localStorage`, so two tabs or two devices don't share state. [ARCHITECTURE.md](ARCHITECTURE.md#anticipated-interview-qa) describes the production design.
- **Notifications are in-app only.** Host alerts appear in the bell; there is no email, SMS or IVR delivery.
- **The QR code is a placeholder** and cannot be scanned.
- **No automated test suite.** The build type-checks strictly and lints clean. The business rules are pure functions written to be unit-tested, but no test runner is configured.
