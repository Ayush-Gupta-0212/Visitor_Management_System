# Demonstration walkthrough

A script for the submission video (target: 4 minutes). Timings are a guide, not
a constraint. Record at 1080p; make the browser window ~1440px wide so the
visitor table shows its full layout.

**Before recording**
- `npm run dev`, then open two browser windows side by side.
- Window **A** → role **Front desk**. Window **B** → role **Host employee**.
- In window B, note the host's name in the header — you will register a walk-in
  for that person, so the notification lands in the right queue.
- Have a terminal ready with `npm run bench` already run, output on screen.

---

## 0:00 — What it is (20s)

> "This is a Visitor Management System for the Movinsync case study. React,
> TypeScript, no backend — the data layer is mocked, but the indexing,
> the approval workflow and the state machine are real. I'll show the visitor
> journey end to end, then the parts I spent the engineering on: query
> performance and error handling."

Show the front desk visitor table at rest.

## 0:20 — Host invites a guest (40s)

Window B → **Invite visitors**.

- Fill Event title, Types of Visit, Office, date, time window, personal note —
  point out this is the wireframe screen.
- Search a guest in the right pane, add two. Note the **Added guests** list.
- Leave **Pre-approve these guests** ticked; point at the **quota meter**:
  > "Admins cap pre-approvals per employee per day — the brief asks for it. The
  > rule is enforced before anything is created, and the meter shows what's
  > left."
- **Confirm invite** → the confirmation screen shows a **QR e-pass per guest**.
  > "In production these go out by email and SMS."

## 1:00 — Walk-in registration, with the host notified live (60s)

Window A → **Register walk-in**.

- Fill the details. Use the **camera** for the photo — then, to make the point:
  > "The photo is mandatory. If the camera is blocked — which happens constantly
  > at a real reception — there's an upload fallback, so the flow never dead-ends."
- Pick the host who is signed in to window B.
- **Send approval request**.

**Now put both windows on screen.** This is the moment of the video.

- Window B's **notification bell** lights up immediately; the request is in the
  approvals queue, flagged *"At reception now"*.
  > "Two tabs are two users. There's no server, so this is BroadcastChannel —
  > but nothing here is on a timer, it's a real message."
- Approve in B → window A flips from "waiting" to **Approved** with the QR pass.

## 2:00 — Check-in and check-out (30s)

Window A → visitor table.

- Type or paste the pass code into **Scan or type pass** → **Check in**.
  > "A real QR reader emits the decoded string as keyboard input, which is
  > exactly what this field receives."
- Try the same pass a second time → **"This pass has already been used."**
- Open the visitor in the table → **Guest details** drawer: timeline, other
  details, additional information, **Check out**.

## 2:30 — Performance, at 50,000 records (60s)

Admin → **Data tools → 50,000 visits**. Back to the visitor table.

- Point at the strip under the toolbar:
  > "That's the live query readout: which plan ran, how long it took, and how
  > many of the fifty thousand records were actually examined."
- Type a name. Watch the numbers.
  > "Search is an inverted prefix index — one map lookup to a small candidate
  > set, instead of scanning fifty thousand records per keystroke."
- Toggle status filters; point out the plan switching between **SEEK** and
  **SCAN**.
  > "An index isn't automatically faster. For broad filters, building a
  > 39,000-entry set and sorting it was *slower* than a plain Array.filter — the
  > benchmark caught that. So the query picks one of three strategies based on
  > how selective it is. The broad one walks a pre-sorted timeline and skips the
  > sort entirely."
- Scroll the table fast.
  > "Rows are virtualised — about twenty DOM nodes regardless of how many match."

Cut to the terminal with `npm run bench` output.
> "Both sides return identical, identically-sorted results, and the cache is
> cleared before every timed run. Search 8× faster, date range 48×, and the
> deadline sweep 3,489× — that one's a min-heap, so the overstay ticker costs
> O(1) per tick instead of scanning everything every fifteen seconds."

## 3:30 — Error handling (30s)

Admin → **Fail half of all requests**.

- Approve something → watch it apply immediately, then **roll back** with a
  readable error.
  > "Updates are optimistic and reverse themselves if the request fails."
- Reject a visit without a reason → inline error.
- Exceed the pre-approval quota → the rule refuses with an explanation of what
  to do instead.
- Show the **audit log** filling up, then **Export CSV**.
  > "Every transition is recorded with who did it and when — the brief asks for
  > approval history for audit."

## 4:00 — Close (20s)

> "The complexity analysis with the measured numbers is in docs/COMPLEXITY.md,
> including where it's still slow and why. The README maps every requirement in
> the brief to the file that implements it. Thanks for watching."

---

## If you have to cut

Keep, in this order: the **two-window live approval**, the **50,000-record
search with the plan readout**, and the **rollback under induced failure**.
Those three are what the evaluation criteria are actually asking about.

## Screenshots to include in the README or submission email

1. Visitor table at 50,000 records with the query readout visible.
2. Guest details drawer open on an overstaying visitor.
3. Invite Visitors form with guests added and the quota meter.
4. A QR e-pass.
5. The approvals queue with a walk-in flagged "At reception now".
6. Admin dashboard.
7. Terminal showing `npm run bench` output.
