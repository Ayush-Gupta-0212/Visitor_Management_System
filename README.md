# PassKey VMS: Visitor Management System

A front-desk visitor management system built for the MoveInSync frontend case study. It covers the whole visit lifecycle: walk-in registration with photo capture, host approval, pre-approval scheduling with a daily quota, scannable QR e-passes, a self-service lobby kiosk, check-in and check-out with temporary cards, stay extensions, automatic overstay and expiry detection, and a security audit trail.

Everyone signs in with their own account, and each role sees and does only what role-based access control (RBAC) allows. Open the app in several tabs and they stay in sync live: a request made at the kiosk appears on the host's screen immediately, and the host's decision appears back at the kiosk and the front desk. It runs entirely in the browser on mock data, with no backend, in light or dark mode.

**Stack:** Vite 8 · React 19 · TypeScript 6 (strict) · Tailwind CSS 4 · Radix UI primitives · Zustand 5 (with `persist`) · date-fns · lucide-react · uqr (QR encoding) · jsQR (QR decoding) · Vitest

For design decisions, complexity analysis and interview notes, see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Executive summary

Legacy enterprise VMS tools usually work like paper logbooks on a screen: one long form, a table with no context, and approval that happens over the phone. This project is built around the people who actually use a VMS each day:

| Role | Who | What they get |
| --- | --- | --- |
| **Gatekeeper** | Front-desk security | A live console: who is on site, who is overdue, who is expected next. Walk-in registration with a webcam photo, QR pass scanning, check-in and check-out with temp-card tracking, and one-click stay extensions. |
| **Host Employee** | The person being visited | Live requests to approve or reject, invitations with shareable QR e-passes, and a meter showing how much of today's approval quota is left. |
| **Super Admin** | Workplace operations | Site-wide analytics, an editable access policy (quota and overstay grace period), the team's accounts and permission matrix, and a filterable audit log. |
| **Visitor** | The guest | An e-pass that opens on their own phone, and a lobby kiosk where they can check themselves in or request a visit, with no staff needed. |

What it does better than a legacy VMS:

- **Nothing is silent.** Every action ends in a toast that says what happened, or why it didn't: *"Daily Pre-Approval Quota Exceeded (Limit: 5)"*, *"This visit is booked at Bengaluru Whitefield; you're on duty at Mumbai Goregaon."*
- **Every screen is live.** Approvals, check-ins and arrivals reach every open tab straight away, and each person is alerted only about what concerns them.
- **Time-based rules run by themselves.** Overstays are flagged and unused passes expire without anyone checking. The app re-checks every 30 seconds and whenever it loads.
- **Real passes, real scanning.** Passes carry a genuine QR code. The desk and the kiosk read it with the camera, from a screenshot, or from a typed code.
- **Dense but calm, in light or dark.** The design comes from a Google Stitch design system: Geist for the interface, JetBrains Mono for times and card numbers, 1px hairlines, and colour reserved for status. Dark mode is a full second palette, not an inverted filter, and switching themes reveals the new one in a circle from the toggle.

---

## Demo and credentials

There is no hosted deployment yet, so run the app locally (see [Setup](#setup-and-run)).

The sign-in page lists every account. **Click one to sign in with a single click**, or type the details yourself. Every password is `firstname@123`.

| Role | Name | Email | Password |
| --- | --- | --- | --- |
| Gatekeeper | Suresh Pawar | `suresh.pawar@corp.example` | `suresh@123` |
| Host Employee | Lalita Mehta | `lalita.mehta@corp.example` | `lalita@123` |
| Host Employee | Rohan Deshpande | `rohan.deshpande@corp.example` | `rohan@123` |
| Host Employee | Ananya Iyer | `ananya.iyer@corp.example` | `ananya@123` |
| Host Employee | Vikram Rathore | `vikram.rathore@corp.example` | `vikram@123` |
| Host Employee | Meera Krishnan | `meera.krishnan@corp.example` | `meera@123` |
| Host Employee | Farhan Qureshi | `farhan.qureshi@corp.example` | `farhan@123` |
| Super Admin | Kavita Joshi | `kavita.joshi@corp.example` | `kavita@123` |

**Each browser tab has its own session**, so you can be the gatekeeper in one tab and a host in another, side by side. All tabs share the same visitor data. Five wrong passwords in a row pause sign-in for 30 seconds.

Two pages need no sign-in:

- **`/#/kiosk`**: the self-service kiosk for the lobby tablet. It's linked from the sign-in page and the gatekeeper console.
- **`/#/pass/…`**: a visitor's e-pass, opened from a link the host shares.

Visitor and host names follow the assignment's reference screens (Dhulabhai Bamania, Ajay Singh, Arun Kumar, Navin Patidar, host Lalita Mehta and others). Companies, emails (reserved `.example` domains) and phone numbers are fictional.

### The seeded data

On first load the app generates **20 visits relative to the current time**, so there is always something to act on whenever you open it:

- 3 visitors overstaying and 5 on site
- 4 pre-approved visits: one arriving now, one later today, two in the next two days
- 2 kiosk requests waiting on a host
- history: 4 checked out, 1 rejected, 1 expired

Everything is saved in `localStorage`. **Reset mock database** (top bar) restores the seed, freshly generated for the current time, after asking for confirmation.

### A five-minute, three-tab walkthrough

1. **Set up three tabs.** Tab 1: sign in as **Suresh** (gatekeeper). Tab 2: sign in as **Lalita** (host). Tab 3: open **`/#/kiosk`**.
2. **Kiosk: request a visit.** Choose *I don't have a pass*, fill in a name, a mobile number and a purpose, pick **Lalita Mehta**, tap **Use mock photo**, then **Ask for approval**. The kiosk waits for Lalita.
3. **Host: approve it.** Lalita's tab raises an alert and the bell shows the request. Click **Approve**. The kiosk switches to *You're approved* at once and Suresh gets a *ready to check in* alert.
4. **Kiosk: check in.** Tap **Check in now**. The kiosk shows the visitor's card number, and both Suresh and Lalita are told the visitor has arrived.
5. **Host: share a pass.** Open an upcoming visitor's pass (the QR icon under *My upcoming visitors*), or invite someone new with **Invite visitors**. Under **Share**, copy the link, email it, send it on WhatsApp, or **Copy pass code**.
6. **Gatekeeper: scan the pass.** Click **Scan pass**. Hold the pass up to the webcam, choose an image of it (a screenshot or the downloaded pass), or paste the code. The dialog shows whose pass it is and offers **Check in** once the visit window is open.
7. **Gatekeeper: overstays.** In the *Overstay* tab open Dhulabhai Bamania. Give him **+1 hour**, or check him out: the drawer first asks you to collect card TC-116.
8. **Admin.** Sign in as **Kavita**. Change the policy, look at the permission matrix under **Team & access**, and read the audit log: every step above is there, with who did it and when. Try the theme toggle too.

---

## Key feature walkthrough

### Personal sign-in and role-based access

- **Accounts.** Eight accounts across three roles (`src/data/mockData.ts`). Only a salted SHA-256 hash of each password is stored, never the password itself. The sign-in form gives the same message for an unknown email and a wrong password, so it never reveals which accounts exist.
- **Sessions.** A session lives in `sessionStorage`, which is why each tab has its own. Sign-in and sign-out are written to the audit log.
- **Permissions.** They are a matrix in `src/lib/rbac.ts`, and two are scoped as well: a host can approve or reject only their own visitors, and a gatekeeper can act only on visits booked at their own site.
- **Enforcement.** Every store action checks the signed-in user before it does anything. The UI asks the same `authorize()` function which buttons to show, so a button is never the only line of defence. A host calling the check-in action directly still gets `FORBIDDEN`.
- **The admin's view.** The admin sees the whole matrix, and each person's last sign-in, under **Team & access**.

### Visitor registration and camera integration

The walk-in modal (`src/components/gatekeeper/WalkInRegistrationModal.tsx`) collects full name, phone, email, purpose, visitor category, host (a searchable combobox), company, expected stay and an optional temp card ID.

The photo is **mandatory**, per the brief. `PhotoCapture.tsx` offers three sources:

1. **Webcam.** A live, mirrored preview; **Capture photo** freezes a frame.
2. **File upload.** Offered when there is no camera or permission is denied, with the toast *"Camera Permission Denied: Using Fallback"*.
3. **Use mock photo.** Generates an initials tile instantly, for testing.

Every image is centre-cropped and re-encoded as a 320 px JPEG (roughly 15–25 kB). The camera stops as soon as a frame is captured or the dialog closes. The form checks everything in one pass, lists every problem at once and focuses the first. The guard then either **checks the visitor in now** (the next free temp card is issued automatically) or **sends the request to the host**, as the brief describes.

### Two-way approval workflow, live across tabs

Requests come from the front desk (walk-ins sent to the host) and the self-service kiosk.

- **Host side.** A pending-approvals banner and a bell with a live count; the bell rings when a new request arrives. **Approve** issues a pass (*"Pass Approved for [Name]"*). **Reject** asks for a reason and offers quick reasons.
- **Desk side.** The bell groups requests into *Approved · ready to check in* (with **Check in**), *Waiting on host*, and *Denied · do not admit* (with the host's reason).
- **Live sync.** When one tab saves, every other tab reloads the shared data (`src/store/useLiveSync.ts`) and alerts its own user about what concerns them: new requests and arrivals for a host, decisions and kiosk activity for the desk.

### Pre-approval scheduling and quota enforcement

**Invite visitors** follows the reference screen: event title, type of visit, office, date with a from/to window (an end time earlier than the start means the next day), a personal note (0/1000) and a multi-guest chip picker that searches past guests.

The quota (default **5 approved visits per host per visit day**, set by the admin) is enforced in two places:

- **In the form, live:** *"3 of 5 approvals left for Thu 24 Sep; this invite uses 2."* Over the limit, a warning appears and **Confirm** is disabled.
- **In the store,** for every pre-approval and every approval, so no UI path can get around it.

Revoked approvals and walk-ins admitted directly at the desk don't count.

### QR e-passes: sharing and scanning

- **The pass.** It is one SVG (`PassCard.tsx`), so what's shown, printed and downloaded are identical.
- **The QR code.** It is a real one (`uqr`), and it encodes only the pass token: an opaque random UUID that means nothing without the desk's records.
- **Sharing.** The **Share** menu sends the pass as a link (`/#/pass/…`), by email (`mailto:`) or on WhatsApp (`wa.me`), or copies the pass code or the invitation text.
- **The pass link.** The link carries the pass details, so it opens on the visitor's phone with no server. When the browser also holds the live record, the page shows its live status.
- **Scanning.** The desk's **Scan pass** and the kiosk read passes the same three ways (`PassScanner.tsx`): the camera, decoded with jsQR four times a second; an image of the pass; or the typed code.
- **Keeping the decoder small.** jsQR (130 kB) is downloaded only the first time a scanner opens.
- **Lookup.** A token resolves to its visit through an O(1) index lookup.

### Self-service kiosk

`/#/kiosk` is built for a lobby tablet, with large touch targets and a live clock.

- **I have a visitor pass.** The visitor scans their pass. The kiosk checks it is for this site, approved and inside its window, then takes a badge photo, checks them in and shows their temp card number.
- **I don't have a pass.** The visitor fills in their details and photo and chooses their host. The kiosk then waits, updating live: *approved* (check in now), *rejected* (with the host's reason) or *expired*.
- **Idle reset.** Left alone, the kiosk returns to its welcome screen.

### Overstay tracking and stay extensions

`useStatusSweep()` runs when the app mounts and every 30 seconds:

- **Overstays.** A checked-in visitor more than the grace period (default 30 min) past their window becomes `OVERSTAY`. The row badge pulses and shows the time overdue (*Overstay +1h 12m*).
- **Expiry.** A pre-approval or request whose window closed without a check-in becomes `EXPIRED`.

The desk can extend an on-site visitor's stay by 30 minutes, 1 hour or 2 hours from the visitor drawer. An overstaying visitor goes back to *Checked in*, and the extension is audited.

### Dark mode and motion

- **Theme choice.** Light, dark or follow the system. It is remembered, synced across tabs, and applied before first paint so the page never flashes.
- **Theme switch.** The sun/moon toggle reveals the new theme in a circle from the button (View Transitions API).
- **Motion.** Stat figures count up and their bars fill in, with cards rising in one after another. Rows cascade in after filtering, the bell rings on new requests, and the kiosk's check-in tick draws itself. Dialogs pop in and sheets slide in.
- **Reduced motion.** All of it respects `prefers-reduced-motion`.

### Also included

- **Error boundaries** around each role's panel and the shared overlays, with **Try again** and **Reset mock database** fallbacks.
- **Empty states** everywhere a list can be empty, each with a next step.
- **Accessibility:** labelled fields with linked error messages, keyboard-operable comboboxes and segmented controls, a skip link, and focus returned when overlays close.

---

## Setup and run

Requires Node.js 20+ (developed on Node 22) and npm. The camera and sign-in need a secure context, which `localhost` counts as.

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
| `npm test` | Runs the Vitest suite (31 tests: rules, RBAC, pass links and QR, and end-to-end store workflows) |
| `npm run build` | Type-checks the whole project (`tsc -b`, strict), then builds for production into `dist/` |
| `npm run preview` | Serves the production build locally |
| `npm run lint` | Lints with oxlint |

To start over, use **Reset mock database** in the app, or clear the `vms-store` key from localStorage.

---

## Project structure

```text
src/
  types/vms.ts              Domain types: visitor, statuses, roles, sessions, audit entries, action results
  data/
    mockData.ts             Employee directory, the eight accounts (hashed passwords), seed visits and audit trail
    demoCredentials.ts      Demo passwords shown on the sign-in page (a reviewer convenience)
  lib/
    rbac.ts                 Permission matrix and scopes: can(), authorize(), visibleTo()
    visitorRules.ts         Lifecycle, time windows, quota, temp cards, kiosk rules, validation, filtering
    visitorIndex.ts         O(1) / O(K) lookup indexes over the visitor list
    auth.ts                 Salted SHA-256 password hashing (Web Crypto)
    qr.ts, passLink.ts      QR encode/decode; shareable pass links and token extraction
    passExport.ts           Download and print the pass SVG
    router.ts               Hash routes: workspace, kiosk, pass page
    format.ts, photo.ts     Date formatting; photo compression and monograms
    toast.ts, feedback.ts   Toast queue; store action → toast wiring
  store/
    useVmsStore.ts          Shared visitor data: actions, RBAC checks, audit trail, persistence
    useAuthStore.ts         Who is signed in (per tab, sessionStorage)
    session.ts              signIn / signOut, lockout after failed attempts
    useLiveSync.ts          Cross-tab sync and role-aware live alerts
    useThemeStore.ts        Light / dark / system theme with the circular reveal
    useUiStore.ts           Which drawer, pass or dialog is open (not persisted)
    hooks.ts                Derived hooks (visible visitors, pending requests, status sweep)
  pages/                    Sign-in page, self-service kiosk, public pass page
  components/
    ui/                     Primitives: Button, Badge, Input, Select, Modal, Sheet, Popover, ...
    layout/                 Navbar, profile menu, theme toggle, notification bell, error boundary
    shared/                 Stat card, panel, page header, employee combobox, photo capture
    gatekeeper/             Console, visitor table, guest drawer, walk-in modal, pass scanning dialog
    host/                   Host dashboard, invite modal, guest chip picker, reject modal
    admin/                  Governance hub, policy settings, team & access, audit log
    visitor/                Pass card, QR code, pass scanner, digital pass modal, status badge
  test/fixtures.ts          Test helpers
tailwind.config.js          Design-system scales (type, radius, elevation, spacing, motion)
src/index.css               Light and dark colour tokens as CSS variables, base styles
```

## Known limitations

- **No backend.** Data lives in one browser's `localStorage`. Tabs of that browser stay in sync; other devices don't. If two tabs write in the same instant, the last write wins. [ARCHITECTURE.md](ARCHITECTURE.md#anticipated-interview-qa) describes the production design.
- **Sign-in is a demo.** Passwords are checked in the browser against hashes that ship with the app, and the demo passwords are shown on the sign-in page. Production would use the company's identity provider (SSO) and server-side sessions.
- **Pass tokens are not signed.** A token is a random UUID, checked against the desk's own records and the approved window. Production would sign tokens and make them expire.
- **Notifications stay in the app.** Alerts appear in open tabs. Passes can be shared by email or WhatsApp links, but nothing is sent automatically.
