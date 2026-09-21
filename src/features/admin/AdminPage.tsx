/**
 * Admin: operational overview, policy configuration, the audit trail, and the
 * controls used to demonstrate scale and failure handling.
 *
 * The statistics are computed from the facet buckets rather than by scanning
 * the dataset - `countByStatus` is a `Set.size` read, so the dashboard costs
 * the same at 1,000 records as at 50,000.
 */
import { useMemo, useState } from 'react';
import { useStore, visitIndex } from '@/app/store';
import { Badge, Button, Card, Input } from '@/shared/ui/primitives';
import { EmptyState } from '@/shared/ui/feedback';
import { getNetworkProfile, setNetworkProfile } from '@/api/mockApi';
import { formatDateTime, endOfDay, startOfDay } from '@/shared/lib/datetime';
import { entryKey } from '@/data/indexes';
import type { VisitStatus } from '@/domain/types';

const SEED_SIZES = [1_000, 10_000, 50_000];

export function AdminPage() {
  const dataVersion = useStore((state) => state.dataVersion);
  const visitCount = useStore((state) => state.visitCount);
  const policy = useStore((state) => state.policy);
  const setPolicy = useStore((state) => state.setPolicy);
  const bootstrap = useStore((state) => state.bootstrap);
  const auditEntries = useStore((state) => state.audit);

  const [chaos, setChaos] = useState(() => getNetworkProfile().failureRate > 0);

  const stats = useMemo(() => {
    const count = (status: VisitStatus) => visitIndex.countByStatus(status);
    const todayIds = visitIndex.query({
      from: startOfDay(Date.now()),
      to: endOfDay(Date.now()),
    });

    // Peak-hour histogram over today's visits only: 24 buckets, one pass.
    const byHour = new Array<number>(24).fill(0);
    for (const id of todayIds) {
      const visit = visitIndex.visits.get(id);
      if (visit) byHour[new Date(entryKey(visit)).getHours()] += 1;
    }

    return {
      today: todayIds.length,
      inside: count('CHECKED_IN'),
      overstay: count('OVERSTAY'),
      pending: count('PENDING_APPROVAL'),
      rejected: count('REJECTED'),
      expired: count('EXPIRED'),
      byHour,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataVersion]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <h1 className="mb-5 text-lg font-bold text-ink">Admin</h1>

      {/* ------------------------------ stats ------------------------------ */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Visits today" value={stats.today} />
        <Stat label="Currently inside" value={stats.inside} tone="ok" />
        <Stat label="Overstaying" value={stats.overstay} tone="danger" />
        <Stat label="Awaiting approval" value={stats.pending} tone="warn" />
        <Stat label="Rejected" value={stats.rejected} />
        <Stat label="Expired" value={stats.expired} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Card className="p-5">
          <h2 className="text-sm font-bold text-ink">Arrivals by hour, today</h2>
          <p className="mb-4 text-xs text-muted">
            Used to spot peak load and staff the desk accordingly.
          </p>
          <HourHistogram values={stats.byHour} />
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-bold text-ink">Policies</h2>
          <p className="mb-4 text-xs text-muted">
            Enforced by <code className="text-[11px]">src/domain/rules.ts</code> on every write.
          </p>

          <div className="flex flex-col gap-4">
            <Input
              label="Pre-approvals per employee per day"
              type="number"
              min={1}
              max={50}
              value={String(policy.preApprovalLimitPerDay)}
              onChange={(event) =>
                setPolicy({ preApprovalLimitPerDay: Math.max(1, Number(event.target.value)) })
              }
            />
            <Input
              label="Overstay grace period (minutes)"
              type="number"
              min={0}
              max={240}
              value={String(policy.overstayGraceMinutes)}
              onChange={(event) =>
                setPolicy({ overstayGraceMinutes: Math.max(0, Number(event.target.value)) })
              }
            />
            <Input
              label="Auto-expiry grace period (minutes)"
              type="number"
              min={0}
              max={240}
              value={String(policy.expiryGraceMinutes)}
              onChange={(event) =>
                setPolicy({ expiryGraceMinutes: Math.max(0, Number(event.target.value)) })
              }
            />
          </div>
        </Card>
      </div>

      {/* ---------------------------- data tools ---------------------------- */}
      <Card className="mt-5 p-5">
        <h2 className="text-sm font-bold text-ink">Data &amp; network tools</h2>
        <p className="mb-4 text-xs text-muted">
          These exist to demonstrate the claims in the README rather than for production use.
        </p>

        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="mb-1.5 text-xs font-semibold text-muted uppercase">Dataset size</p>
            <div className="flex gap-2">
              {SEED_SIZES.map((size) => (
                <Button
                  key={size}
                  variant={visitCount === size ? 'primary' : 'secondary'}
                  onClick={() => void bootstrap(size)}
                >
                  {size.toLocaleString()} visits
                </Button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold text-muted uppercase">Simulated network</p>
            <label className="flex items-center gap-2 rounded-lg border border-line px-3 py-2.5">
              <input
                type="checkbox"
                checked={chaos}
                onChange={(event) => {
                  setChaos(event.target.checked);
                  setNetworkProfile({ failureRate: event.target.checked ? 0.5 : 0 });
                }}
                className="size-4"
              />
              <span className="text-sm text-ink">
                Fail half of all requests
                <span className="block text-xs text-muted">
                  Shows rollback and error messaging in action.
                </span>
              </span>
            </label>
          </div>
        </div>
      </Card>

      {/* ----------------------------- audit log ---------------------------- */}
      <Card className="mt-5">
        <header className="flex items-center gap-3 border-b border-line px-5 py-4">
          <h2 className="text-sm font-bold text-ink">Audit log</h2>
          <Badge tone="neutral">{auditEntries.length} entries this session</Badge>
          <Button
            variant="secondary"
            className="ml-auto"
            onClick={() => downloadCsv(auditEntries)}
            disabled={auditEntries.length === 0}
          >
            Export CSV
          </Button>
        </header>

        {auditEntries.length === 0 ? (
          <EmptyState
            title="No activity yet"
            body="Approve, reject or check someone in and every state change is recorded here with who did it and when."
          />
        ) : (
          <ul className="max-h-96 divide-y divide-line overflow-y-auto">
            {auditEntries.slice(0, 200).map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-baseline gap-x-3 px-5 py-2.5">
                <span className="text-sm font-semibold text-ink">{entry.action}</span>
                <span className="text-xs text-muted">
                  by {actorName(entry.actor)} · {formatDateTime(entry.at)}
                </span>
                {entry.from && entry.to && (
                  <span className="text-xs text-muted">
                    {entry.from} → {entry.to}
                  </span>
                )}
                {entry.detail && <span className="text-xs text-muted italic">{entry.detail}</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------- pieces ------------------------------- */

function Stat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  tone?: 'neutral' | 'ok' | 'warn' | 'danger';
}) {
  const colour = {
    neutral: 'text-ink',
    ok: 'text-ok',
    warn: 'text-warn',
    danger: 'text-danger',
  }[tone];

  return (
    <Card className="px-4 py-3">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-black ${colour}`}>{value.toLocaleString()}</p>
    </Card>
  );
}

/**
 * A plain SVG bar chart. A charting library would be ~50 KB for one histogram;
 * this is 20 lines and themes itself with the same CSS variables as everything
 * else.
 */
function HourHistogram({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);

  return (
    <div>
      <svg viewBox="0 0 480 120" className="h-32 w-full" role="img" aria-label="Arrivals by hour">
        {values.map((value, hour) => {
          const height = (value / max) * 96;
          return (
            <rect
              key={hour}
              x={hour * 20 + 2}
              y={104 - height}
              width={16}
              height={Math.max(height, value > 0 ? 2 : 0)}
              rx={2}
              fill="var(--color-brand)"
              opacity={value === 0 ? 0.15 : 0.85}
            >
              <title>{`${hour}:00 — ${value} arrivals`}</title>
            </rect>
          );
        })}
        <line x1="0" y1="105" x2="480" y2="105" stroke="var(--color-line)" strokeWidth="1" />
      </svg>
      <div className="flex justify-between text-[10px] text-muted">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>23:00</span>
      </div>
    </div>
  );
}

/* ------------------------------ helpers ------------------------------- */

function actorName(actor: string): string {
  if (actor === 'SYSTEM') return 'the system';
  if (actor === 'front-desk') return 'the front desk';
  return visitIndex.employees.get(actor)?.name ?? actor;
}

/** Exports the audit trail. Quoting is escaped so commas in reasons survive. */
function downloadCsv(entries: { id: string; visitId: string; actor: string; action: string; at: number; from?: string; to?: string; detail?: string }[]): void {
  const header = ['id', 'visitId', 'actor', 'action', 'timestamp', 'from', 'to', 'detail'];
  const escape = (value: string | number | undefined) =>
    `"${String(value ?? '').replace(/"/g, '""')}"`;

  const rows = entries.map((entry) =>
    [
      entry.id,
      entry.visitId,
      actorName(entry.actor),
      entry.action,
      new Date(entry.at).toISOString(),
      entry.from,
      entry.to,
      entry.detail,
    ]
      .map(escape)
      .join(','),
  );

  const blob = new Blob([[header.join(','), ...rows].join('\n')], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `vms-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
