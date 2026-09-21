/**
 * Application state.
 *
 * A deliberate split:
 *
 *   - The 50,000 visit records live in a `VisitIndex` held OUTSIDE React state.
 *     Putting them in a store would mean React (and zustand's equality checks)
 *     walking a huge object graph on every keystroke. Instead the index is
 *     mutated in place and a `dataVersion` counter is bumped; components
 *     subscribe to the counter, re-run their query, and get the ~20 rows they
 *     actually render.
 *
 *   - Everything small and genuinely reactive (session, policy, toasts,
 *     notifications, loading flags) lives in the zustand store as normal.
 *
 * Every mutation follows the same five steps, which is what keeps the UI
 * responsive and the data consistent:
 *
 *   1. check the business rule      -> throws a DomainError the user can read
 *   2. apply the change locally     -> UI updates immediately (optimistic)
 *   3. write an audit entry         -> approval history, never mutated
 *   4. broadcast to other tabs      -> the host's bell lights up
 *   5. await the simulated network  -> roll back and explain if it fails
 */
import { create } from 'zustand';
import type {
  AuditEntry,
  CheckInMethod,
  Employee,
  Office,
  Policy,
  Role,
  Visit,
  VisitType,
  Visitor,
} from '@/domain/types';
import { DEFAULT_POLICY } from '@/domain/types';
import { VisitIndex } from '@/data/indexes';
import { MinHeap } from '@/data/minHeap';
import { generateSeedData } from '@/data/seed';
import { deriveStatus } from '@/domain/statusMachine';
import {
  assertCanApprove,
  assertCanCheckIn,
  assertCanCheckOut,
  assertCanReject,
  assertPreApprovalQuota,
  assertValidWindow,
} from '@/domain/rules';
import { toUserMessage } from '@/domain/errors';
import { request } from '@/api/mockApi';
import { publish, subscribe } from './realtime';
import { normalisePhone } from '@/domain/validators';
import { startOfDay } from '@/shared/lib/datetime';

/* ------------------------------------------------------------------ *
 * The index: one instance, module-scoped, outside React.
 * ------------------------------------------------------------------ */

export const visitIndex = new VisitIndex();

/**
 * Pending time-driven deadlines, earliest first. The ticker inspects only the
 * head of this heap, so the sweep costs O(1) per tick instead of O(N).
 */
const deadlines = new MinHeap<string>();

export interface Toast {
  id: string;
  kind: 'success' | 'error' | 'info';
  message: string;
  /** Optional single undo action, shown as a button inside the toast. */
  undo?: () => void;
}

export interface HostNotification {
  id: string;
  visitId: string;
  title: string;
  body: string;
  at: number;
  read: boolean;
}

export interface AppState {
  /* data */
  dataVersion: number;
  offices: Office[];
  visitCount: number;
  booting: boolean;
  bootError: string | null;

  /* session - there is no real auth; the role is chosen on the landing screen */
  role: Role;
  currentUserId: string;

  /* config */
  policy: Policy;

  /* derived-but-small collections */
  audit: AuditEntry[];
  toasts: Toast[];
  notifications: HostNotification[];

  /* actions */
  bootstrap: (visitCount?: number) => Promise<void>;
  setRole: (role: Role, userId?: string) => void;
  setPolicy: (patch: Partial<Policy>) => void;

  approveVisit: (visitId: string) => Promise<void>;
  rejectVisit: (visitId: string, reason: string) => Promise<void>;
  checkIn: (visitId: string, method: CheckInMethod) => Promise<void>;
  checkOut: (visitId: string, additionalInfo?: string) => Promise<void>;
  redeemPass: (passCode: string) => Promise<string>;

  createInvite: (input: InviteInput) => Promise<string[]>;
  createWalkIn: (input: WalkInInput) => Promise<string>;

  sweepDeadlines: () => void;
  markNotificationsRead: () => void;
  pushToast: (toast: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;
}

export interface InviteInput {
  eventTitle: string;
  visitType: VisitType;
  officeId: string;
  scheduledStart: number;
  scheduledEnd: number;
  note?: string;
  guestIds: string[];
  /** Pre-approved invites skip the host approval step and issue a pass at once. */
  preApproved: boolean;
}

export interface WalkInInput {
  fullName: string;
  phone: string;
  email: string;
  company: string;
  visitType: VisitType;
  hostId: string;
  officeId: string;
  purpose: string;
  photoDataUrl?: string;
  durationMinutes: number;
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

function makePassCode(): string {
  return `VMS-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function audit(
  visitId: string,
  actor: string,
  action: string,
  extra: Partial<AuditEntry> = {},
): AuditEntry {
  return { id: nextId('aud'), visitId, actor, action, at: Date.now(), ...extra };
}

/** Deadlines only matter for visits that can still change on their own. */
function trackDeadline(visit: Visit): void {
  if (visit.status === 'APPROVED' || visit.status === 'PENDING_APPROVAL') {
    deadlines.push(visit.scheduledEnd, visit.id);
  } else if (visit.status === 'CHECKED_IN') {
    deadlines.push(visit.scheduledEnd, visit.id);
  }
}

/* ------------------------------------------------------------------ *
 * Session persistence
 *
 * The chosen role is kept in sessionStorage, not localStorage, and the
 * difference matters for this app: sessionStorage is per-tab, so a reload keeps
 * you signed in as the same person, while a second tab can be a different one.
 * That is what makes the two-tab demo work - front desk in one, host in the
 * other - which localStorage would break by forcing both tabs to share a role.
 *
 * Every access is wrapped: storage throws in private mode and in some embedded
 * browsers, and a security guard should never see a blank screen because of it.
 */
const SESSION_KEY = 'vms.session';

interface PersistedSession {
  role: Role;
  currentUserId: string;
}

function readSession(): PersistedSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as PersistedSession) : null;
  } catch {
    return null;
  }
}

function writeSession(session: PersistedSession): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Storage unavailable - the app works fine, it just will not remember.
  }
}

/* ------------------------------------------------------------------ *
 * Store
 * ------------------------------------------------------------------ */

export const useStore = create<AppState>((set, get) => ({
  dataVersion: 0,
  offices: [],
  visitCount: 0,
  booting: true,
  bootError: null,

  role: readSession()?.role ?? 'FRONT_DESK',
  currentUserId: readSession()?.currentUserId ?? 'emp-0',

  policy: DEFAULT_POLICY,

  audit: [],
  toasts: [],
  notifications: [],

  /* ---------------------------- bootstrap --------------------------- */

  async bootstrap(visitCount = 2_000) {
    set({ booting: true, bootError: null });
    try {
      // Yield a frame first so the loading state actually paints before the
      // synchronous generate+index work blocks the main thread.
      await new Promise((resolve) => setTimeout(resolve, 16));

      const { visitors, employees, visits, offices } = generateSeedData({ visitCount });
      visitIndex.load(visitors, employees, visits);

      deadlines.clear();
      for (const visit of visits) trackDeadline(visit);

      set((state) => ({
        offices,
        visitCount: visits.length,
        booting: false,
        dataVersion: state.dataVersion + 1,
        // Default the "logged in" host to whoever has the most pending
        // requests, so the approvals screen is never empty on first load -
        // but never override a session the user already chose.
        currentUserId: readSession()?.currentUserId ?? busiestHost(employees) ?? 'emp-0',
      }));
    } catch (error) {
      set({ booting: false, bootError: toUserMessage(error) });
    }
  },

  setRole(role, userId) {
    set((state) => {
      const next = { role, currentUserId: userId ?? state.currentUserId };
      writeSession(next);
      return next;
    });
  },

  setPolicy(patch) {
    set((state) => ({ policy: { ...state.policy, ...patch } }));
  },

  /* ---------------------------- approvals --------------------------- */

  async approveVisit(visitId) {
    const visit = visitIndex.visits.get(visitId);
    if (!visit) return;

    assertCanApprove(visit, Date.now());

    const previous = { status: visit.status, approvedAt: visit.approvedAt, passCode: visit.passCode };
    const patch: Partial<Visit> = {
      status: 'APPROVED',
      approvedAt: Date.now(),
      passCode: visit.passCode ?? makePassCode(),
    };

    const entry = audit(visitId, get().currentUserId, 'Approved visit', {
      from: visit.status,
      to: 'APPROVED',
    });

    applyLocal(set, visitId, patch, entry);
    publish({ type: 'VISIT_CHANGED', visitId, patch, audit: entry });

    try {
      await request(() => true);
      get().pushToast({ kind: 'success', message: 'Visitor approved. A pass has been issued.' });
    } catch (error) {
      applyLocal(set, visitId, previous, audit(visitId, 'SYSTEM', 'Rolled back approval'));
      get().pushToast({ kind: 'error', message: toUserMessage(error) });
    }
  },

  async rejectVisit(visitId, reason) {
    const visit = visitIndex.visits.get(visitId);
    if (!visit) return;

    assertCanReject(visit, reason);

    const previous = { status: visit.status, rejectedAt: visit.rejectedAt, rejectionReason: visit.rejectionReason };
    const patch: Partial<Visit> = {
      status: 'REJECTED',
      rejectedAt: Date.now(),
      rejectionReason: reason.trim(),
    };
    const entry = audit(visitId, get().currentUserId, 'Rejected visit', {
      from: visit.status,
      to: 'REJECTED',
      detail: reason.trim(),
    });

    applyLocal(set, visitId, patch, entry);
    publish({ type: 'VISIT_CHANGED', visitId, patch, audit: entry });

    try {
      await request(() => true);
      get().pushToast({
        kind: 'info',
        message: 'Visitor rejected. Security has been notified at the front desk.',
      });
    } catch (error) {
      applyLocal(set, visitId, previous, audit(visitId, 'SYSTEM', 'Rolled back rejection'));
      get().pushToast({ kind: 'error', message: toUserMessage(error) });
    }
  },

  /* --------------------------- front desk --------------------------- */

  async checkIn(visitId, method) {
    const visit = visitIndex.visits.get(visitId);
    if (!visit) return;

    assertCanCheckIn(visit, Date.now());

    const patch: Partial<Visit> = {
      status: 'CHECKED_IN',
      checkInAt: Date.now(),
      checkInMethod: method,
      passRedeemed: true,
      tempCardNo: visit.tempCardNo ?? String(1 + Math.floor(Math.random() * 60)),
    };
    const entry = audit(visitId, get().currentUserId, 'Checked in', {
      from: visit.status,
      to: 'CHECKED_IN',
      detail: method,
    });

    applyLocal(set, visitId, patch, entry);
    trackDeadline({ ...visit, ...patch });
    publish({ type: 'VISIT_CHANGED', visitId, patch, audit: entry });

    try {
      await request(() => true);
      get().pushToast({ kind: 'success', message: 'Visitor checked in.' });
    } catch (error) {
      applyLocal(
        set,
        visitId,
        { status: visit.status, checkInAt: undefined, passRedeemed: visit.passRedeemed },
        audit(visitId, 'SYSTEM', 'Rolled back check-in'),
      );
      get().pushToast({ kind: 'error', message: toUserMessage(error) });
    }
  },

  async checkOut(visitId, additionalInfo) {
    const visit = visitIndex.visits.get(visitId);
    if (!visit) return;

    assertCanCheckOut(visit);

    const patch: Partial<Visit> = {
      status: 'CHECKED_OUT',
      checkOutAt: Date.now(),
      additionalInfo: additionalInfo ?? visit.additionalInfo,
    };
    const entry = audit(visitId, get().currentUserId, 'Checked out', {
      from: visit.status,
      to: 'CHECKED_OUT',
    });

    applyLocal(set, visitId, patch, entry);
    publish({ type: 'VISIT_CHANGED', visitId, patch, audit: entry });

    try {
      await request(() => true);
      get().pushToast({ kind: 'success', message: 'Visitor checked out.' });
    } catch (error) {
      applyLocal(
        set,
        visitId,
        { status: visit.status, checkOutAt: undefined },
        audit(visitId, 'SYSTEM', 'Rolled back check-out'),
      );
      get().pushToast({ kind: 'error', message: toUserMessage(error) });
    }
  },

  /** Looks a pass code up and checks the holder in. Used by the QR/e-pass flow. */
  async redeemPass(passCode) {
    const code = passCode.trim().toUpperCase();
    const match = [...visitIndex.visits.values()].find((v) => v.passCode === code);

    if (!match) {
      throw new Error(`No visit found for pass ${code}. Check the code and try again.`);
    }
    await get().checkIn(match.id, 'QR_PASS');
    return match.id;
  },

  /* ----------------------------- creation --------------------------- */

  async createInvite(input) {
    const now = Date.now();
    assertValidWindow(input.scheduledStart, input.scheduledEnd, now);

    if (input.guestIds.length === 0) {
      throw new Error('Add at least one guest to the invite.');
    }

    const hostId = get().currentUserId;

    // Pre-approval quota is per host, per day, and counts the whole batch.
    if (input.preApproved) {
      const used = visitIndex.preApprovalsUsed(hostId, input.scheduledStart);
      const policy = get().policy;
      for (let i = 0; i < input.guestIds.length; i++) {
        assertPreApprovalQuota(used + i, policy);
      }
    }

    const createdIds: string[] = [];

    for (const guestId of input.guestIds) {
      const visit: Visit = {
        id: nextId('vst'),
        visitorId: guestId,
        hostId,
        officeId: input.officeId,
        eventTitle: input.eventTitle.trim(),
        visitType: input.visitType,
        note: input.note?.trim() || undefined,
        status: input.preApproved ? 'APPROVED' : 'PENDING_APPROVAL',
        source: input.preApproved ? 'PRE_APPROVAL' : 'INVITE',
        scheduledStart: input.scheduledStart,
        scheduledEnd: input.scheduledEnd,
        createdAt: now,
        createdBy: hostId,
        approvedAt: input.preApproved ? now : undefined,
        passCode: input.preApproved ? makePassCode() : undefined,
      };

      const entry = audit(visit.id, hostId, input.preApproved ? 'Pre-approved visit' : 'Invited visitor', {
        to: visit.status,
      });

      visitIndex.insert(visit);
      trackDeadline(visit);
      set((state) => ({ dataVersion: state.dataVersion + 1, audit: [entry, ...state.audit] }));
      publish({ type: 'VISIT_CREATED', visit, audit: entry });

      createdIds.push(visit.id);
    }

    await request(() => true);
    return createdIds;
  },

  async createWalkIn(input) {
    const now = Date.now();
    const scheduledEnd = now + input.durationMinutes * 60_000;

    // Re-use an existing visitor record when the phone number is already known,
    // so repeat visitors do not pile up duplicates.
    const normalised = normalisePhone(input.phone);
    const existing = [...visitIndex.visitors.values()].find(
      (v) => normalisePhone(v.phone) === normalised,
    );

    const visitor: Visitor = existing ?? {
      id: nextId('vis'),
      fullName: input.fullName.trim(),
      phone: input.phone.trim(),
      email: input.email.trim(),
      company: input.company.trim(),
      photoDataUrl: input.photoDataUrl,
      createdAt: now,
    };

    const visit: Visit = {
      id: nextId('vst'),
      visitorId: visitor.id,
      hostId: input.hostId,
      officeId: input.officeId,
      eventTitle: input.purpose.trim(),
      visitType: input.visitType,
      status: 'PENDING_APPROVAL',
      source: 'WALK_IN',
      scheduledStart: now,
      scheduledEnd,
      createdAt: now,
      createdBy: 'front-desk',
    };

    const entry = audit(visit.id, 'front-desk', 'Registered walk-in visitor', {
      to: 'PENDING_APPROVAL',
      detail: visitor.fullName,
    });

    visitIndex.insert(visit, existing ? undefined : visitor);
    trackDeadline(visit);

    const host = visitIndex.employees.get(input.hostId);
    set((state) => ({
      dataVersion: state.dataVersion + 1,
      audit: [entry, ...state.audit],
      notifications: [
        {
          id: nextId('ntf'),
          visitId: visit.id,
          title: `${visitor.fullName} is at reception`,
          body: `${input.purpose.trim()} - awaiting your approval`,
          at: now,
          read: false,
        },
        ...state.notifications,
      ].slice(0, 50),
    }));

    publish({ type: 'VISIT_CREATED', visit, visitor: existing ? undefined : visitor, audit: entry });

    await request(() => true);
    get().pushToast({
      kind: 'success',
      message: `Approval request sent to ${host?.name ?? 'the host'}.`,
    });

    return visit.id;
  },

  /* ---------------------------- the ticker -------------------------- */

  /**
   * Runs on an interval. Costs O(1) when nothing is due, because the heap's
   * head is the earliest deadline in the whole system.
   */
  sweepDeadlines() {
    const now = Date.now();
    const head = deadlines.peek();
    if (!head || head.at > now) return;

    const { policy } = get();
    const dueIds = deadlines.drainDueBy(now);
    let changed = 0;

    for (const visitId of dueIds) {
      const visit = visitIndex.visits.get(visitId);
      if (!visit) continue;

      const next = deriveStatus(visit, now, policy);
      if (!next) {
        // Not due yet after all (the grace period moved it) - requeue.
        const graceMs =
          (visit.status === 'CHECKED_IN' ? policy.overstayGraceMinutes : policy.expiryGraceMinutes) *
          60_000;
        deadlines.push(visit.scheduledEnd + graceMs, visitId);
        continue;
      }

      visitIndex.update(visitId, { status: next });
      changed += 1;

      const entry = audit(visitId, 'SYSTEM', next === 'EXPIRED' ? 'Expired automatically' : 'Flagged as overstay', {
        from: visit.status,
        to: next,
      });
      set((state) => ({ audit: [entry, ...state.audit].slice(0, 500) }));

      // An overstaying visitor is still inside, so keep watching them.
      if (next === 'OVERSTAY') deadlines.push(now + 15 * 60_000, visitId);
    }

    if (changed > 0) set((state) => ({ dataVersion: state.dataVersion + 1 }));
  },

  /* ------------------------------ chrome ---------------------------- */

  markNotificationsRead() {
    set((state) => ({ notifications: state.notifications.map((n) => ({ ...n, read: true })) }));
  },

  pushToast(toast) {
    const id = nextId('toast');
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    setTimeout(() => get().dismissToast(id), 5_000);
  },

  dismissToast(id) {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));

/* ------------------------------------------------------------------ *
 * Shared mutation helper
 * ------------------------------------------------------------------ */

/** Mutates the index, records the audit entry, and signals React. */
function applyLocal(
  set: (fn: (state: AppState) => Partial<AppState>) => void,
  visitId: string,
  patch: Partial<Visit>,
  entry: AuditEntry,
): void {
  visitIndex.update(visitId, patch);
  set((state) => ({
    dataVersion: state.dataVersion + 1,
    audit: [entry, ...state.audit].slice(0, 500),
  }));
}

/** Picks the host with the most pending requests, for a non-empty first screen. */
function busiestHost(employees: Employee[]): string | undefined {
  let best: string | undefined;
  let bestCount = -1;
  const today = startOfDay(Date.now());

  for (const employee of employees.slice(0, 50)) {
    const count = visitIndex.preApprovalsUsed(employee.id, today);
    const pending = [...visitIndex.visits.values()].filter(
      (v) => v.hostId === employee.id && v.status === 'PENDING_APPROVAL',
    ).length;
    if (pending + count > bestCount) {
      bestCount = pending + count;
      best = employee.id;
    }
  }
  return best;
}

/* ------------------------------------------------------------------ *
 * Realtime wiring - applies changes made in other tabs
 * ------------------------------------------------------------------ */

subscribe((message) => {
  const store = useStore.getState();

  switch (message.type) {
    case 'VISIT_CHANGED': {
      if (!visitIndex.visits.has(message.visitId)) return;
      visitIndex.update(message.visitId, message.patch);
      useStore.setState((state) => ({
        dataVersion: state.dataVersion + 1,
        audit: [message.audit, ...state.audit].slice(0, 500),
      }));
      break;
    }
    case 'VISIT_CREATED': {
      if (visitIndex.visits.has(message.visit.id)) return;
      visitIndex.insert(message.visit, message.visitor);
      trackDeadline(message.visit);

      const isForMe = message.visit.hostId === store.currentUserId;
      const visitor = visitIndex.visitors.get(message.visit.visitorId);

      useStore.setState((state) => ({
        dataVersion: state.dataVersion + 1,
        audit: [message.audit, ...state.audit].slice(0, 500),
        notifications:
          isForMe && message.visit.status === 'PENDING_APPROVAL'
            ? [
                {
                  id: nextId('ntf'),
                  visitId: message.visit.id,
                  title: `${visitor?.fullName ?? 'A visitor'} is at reception`,
                  body: `${message.visit.eventTitle} - awaiting your approval`,
                  at: Date.now(),
                  read: false,
                },
                ...state.notifications,
              ].slice(0, 50)
            : state.notifications,
      }));
      break;
    }
    case 'DATASET_RESEEDED': {
      void useStore.getState().bootstrap(message.visitCount);
      break;
    }
  }
});
