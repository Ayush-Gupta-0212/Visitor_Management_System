/**
 * The front desk's visitor list - the screen from the third reference wireframe.
 *
 * Two things make this screen the performance story of the project:
 *
 *   1. The query runs against the indexes in `src/data/indexes.ts`, so filtering
 *      50,000 records does not mean touching 50,000 records.
 *   2. The rows are virtualised: however many rows match, only the ~20 visible
 *      ones exist in the DOM. Without this, a 39,000-row result set would create
 *      hundreds of thousands of DOM nodes and lock the browser up.
 *
 * The strip under the toolbar reports what the query engine actually did, which
 * is there so the behaviour can be seen rather than taken on trust.
 */
import { memo, useCallback, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Link } from 'react-router-dom';
import { useStore, visitIndex } from '@/app/store';
import type { SortKey } from '@/data/indexes';
import type { Visit, VisitStatus } from '@/domain/types';
import { Badge, Button } from '@/shared/ui/primitives';
import { EmptyState } from '@/shared/ui/feedback';
import { Drawer } from '@/shared/ui/Drawer';
import { GuestDetails, GuestDetailsBadge } from './GuestDetails';
import { StatusBadge, sourceLabel } from './status';
import { useVisitFilters, useVisitQuery } from './useVisitQuery';
import { formatTime, toDateInput } from '@/shared/lib/datetime';
import { toUserMessage } from '@/domain/errors';

const ROW_HEIGHT = 68;

const STATUS_OPTIONS: { value: VisitStatus; label: string }[] = [
  { value: 'PENDING_APPROVAL', label: 'Awaiting approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'CHECKED_IN', label: 'Inside' },
  { value: 'OVERSTAY', label: 'Overstay' },
  { value: 'CHECKED_OUT', label: 'Checked out' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'EXPIRED', label: 'Expired' },
];

export function VisitorsPage() {
  const { filters, update, ALL_DAYS } = useVisitFilters();
  const { ids, stats, pending } = useVisitQuery(filters);
  const totalVisits = useStore((state) => state.visitCount);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: ids.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  const toggleSort = useCallback(
    (key: SortKey) => {
      if (filters.sortBy === key) {
        update({ sortDir: filters.sortDir === 'asc' ? 'desc' : 'asc' });
      } else {
        update({ sortBy: key, sortDir: 'desc' });
      }
    },
    [filters.sortBy, filters.sortDir, update],
  );

  const selected = selectedId ? (visitIndex.visits.get(selectedId) ?? null) : null;

  return (
    <div className="flex h-[calc(100vh-57px)]">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-3 border-b border-line bg-surface px-4 py-3 sm:px-6">
          <h1 className="text-lg font-bold text-ink">Visitors</h1>
          <Badge tone="neutral">
            {stats.matched.toLocaleString()} of {totalVisits.toLocaleString()}
          </Badge>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <ScanPass />
            <Button variant="secondary" onClick={() => update({ text: '', statuses: [] })}>
              Clear filters
            </Button>
            <Link to="/frontdesk/walk-in">
              <Button variant="primary">Register walk-in</Button>
            </Link>
          </div>
        </header>

        {/* filters */}
        <div className="flex flex-wrap items-end gap-3 border-b border-line bg-surface px-4 py-3 sm:px-6">
          <label className="min-w-56 flex-1">
            <span className="sr-only">Search by name, email or phone</span>
            <input
              type="search"
              value={filters.text}
              onChange={(event) => update({ text: event.target.value })}
              placeholder="Search by name, email or phone"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-muted uppercase">Date</span>
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={filters.day === ALL_DAYS ? '' : filters.day}
                onChange={(event) =>
                  update({ day: event.target.value || toDateInput(Date.now()) })
                }
                className="rounded-lg border border-line bg-surface px-2 py-2 text-sm text-ink"
              />
              <Button
                variant={filters.day === ALL_DAYS ? 'primary' : 'ghost'}
                onClick={() =>
                  update({ day: filters.day === ALL_DAYS ? toDateInput(Date.now()) : ALL_DAYS })
                }
              >
                All dates
              </Button>
            </div>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-muted uppercase">Time window</span>
            <div className="flex items-center gap-1">
              <input
                type="time"
                value={minutesToTime(filters.minuteFrom)}
                onChange={(event) => update({ minuteFrom: timeToMinutes(event.target.value) })}
                className="rounded-lg border border-line bg-surface px-2 py-2 text-sm text-ink"
              />
              <span aria-hidden="true" className="text-muted">
                –
              </span>
              <input
                type="time"
                value={minutesToTime(filters.minuteTo)}
                onChange={(event) => update({ minuteTo: timeToMinutes(event.target.value) })}
                className="rounded-lg border border-line bg-surface px-2 py-2 text-sm text-ink"
              />
            </div>
          </label>

          <fieldset className="flex flex-col gap-1">
            <legend className="text-[11px] font-semibold text-muted uppercase">Status</legend>
            <div className="flex flex-wrap gap-1">
              {STATUS_OPTIONS.map((option) => {
                const active = filters.statuses.includes(option.value);
                return (
                  <button
                    key={option.value}
                    aria-pressed={active}
                    onClick={() =>
                      update({
                        statuses: active
                          ? filters.statuses.filter((s) => s !== option.value)
                          : [...filters.statuses, option.value],
                      })
                    }
                    className={[
                      'rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
                      active
                        ? 'border-brand bg-brand text-white'
                        : 'border-line text-muted hover:text-ink',
                    ].join(' ')}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>

        <QueryStatsBar stats={stats} pending={pending} total={totalVisits} />

        {/* table */}
        <div className="min-h-0 flex-1 bg-surface">
          <div role="table" aria-rowcount={ids.length} className="flex h-full flex-col">
            <div
              role="row"
              className="grid shrink-0 grid-cols-[2fr_1.4fr_1fr_1fr_1.1fr] gap-3 border-b border-line px-4 py-2.5 text-[11px] font-bold tracking-wide text-muted uppercase sm:px-6"
            >
              <SortHeader label="Visitor" sortKey="visitor" filters={filters} onSort={toggleSort} />
              <span role="columnheader">Type of invite</span>
              <SortHeader label="Entry time" sortKey="entry" filters={filters} onSort={toggleSort} />
              <SortHeader label="Exit time" sortKey="exit" filters={filters} onSort={toggleSort} />
              <SortHeader label="Status" sortKey="status" filters={filters} onSort={toggleSort} />
            </div>

            {ids.length === 0 ? (
              <EmptyState
                title="No visitors match these filters"
                body="Try a different date, clear the status chips, or search for a different name."
                action={
                  <Button variant="secondary" onClick={() => update({ text: '', statuses: [], day: ALL_DAYS })}>
                    Show all visitors
                  </Button>
                }
              />
            ) : (
              <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
                {/* The spacer is the full height of all rows; only the visible
                    slice is actually rendered inside it. */}
                <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
                  {virtualizer.getVirtualItems().map((item) => {
                    const visit = visitIndex.visits.get(ids[item.index]);
                    if (!visit) return null;
                    return (
                      <div
                        key={item.key}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: item.size,
                          transform: `translateY(${item.start}px)`,
                        }}
                      >
                        <VisitRow
                          visit={visit}
                          index={item.index}
                          selected={visit.id === selectedId}
                          onSelect={setSelectedId}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Drawer
        open={selected !== null}
        onClose={() => setSelectedId(null)}
        title="Guest details"
        titleAdornment={selected ? <GuestDetailsBadge visit={selected} /> : undefined}
      >
        {selected && <GuestDetails visit={selected} />}
      </Drawer>
    </div>
  );
}

/* --------------------------------- row -------------------------------- */

interface VisitRowProps {
  visit: Visit;
  index: number;
  selected: boolean;
  onSelect: (id: string) => void;
}

/**
 * Memoised so that scrolling - which changes which rows are mounted, not their
 * contents - does not re-render every row that stayed on screen.
 */
const VisitRow = memo(function VisitRow({ visit, index, selected, onSelect }: VisitRowProps) {
  const visitor = visitIndex.visitors.get(visit.visitorId);
  const host = visitIndex.employees.get(visit.hostId);

  return (
    <div
      role="row"
      aria-rowindex={index + 1}
      aria-selected={selected}
      tabIndex={0}
      onClick={() => onSelect(visit.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(visit.id);
        }
      }}
      className={[
        'grid h-full cursor-pointer grid-cols-[2fr_1.4fr_1fr_1fr_1.1fr] items-center gap-3 border-b border-line px-4 sm:px-6',
        selected ? 'bg-brand-soft' : 'hover:bg-canvas',
      ].join(' ')}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ink underline-offset-2 hover:underline">
          {visitor?.fullName ?? 'Unknown visitor'}
        </p>
        <p className="truncate text-xs text-muted">Host: {host?.name ?? '—'}</p>
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm text-ink">{visit.visitType}</p>
        <p className="truncate text-xs text-muted">{sourceLabel(visit)}</p>
      </div>

      <p className="text-sm text-ink">{formatTime(visit.checkInAt)}</p>
      <p className="text-sm text-ink">{formatTime(visit.checkOutAt)}</p>

      <div>
        <StatusBadge visit={visit} />
      </div>
    </div>
  );
});

/* ------------------------------- headers ------------------------------ */

function SortHeader({
  label,
  sortKey,
  filters,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  filters: { sortBy: SortKey; sortDir: 'asc' | 'desc' };
  onSort: (key: SortKey) => void;
}) {
  const active = filters.sortBy === sortKey;

  return (
    <button
      role="columnheader"
      aria-sort={active ? (filters.sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      onClick={() => onSort(sortKey)}
      className="flex items-center gap-1 text-left uppercase hover:text-ink"
    >
      {label}
      <span aria-hidden="true">{active ? (filters.sortDir === 'asc' ? '▲' : '▼') : ''}</span>
    </button>
  );
}

/* --------------------------- performance strip ------------------------ */

function QueryStatsBar({
  stats,
  pending,
  total,
}: {
  stats: { matched: number; scanned: number; durationMs: number; plan: string; cached: boolean };
  pending: boolean;
  total: number;
}) {
  const skipped = total - stats.scanned;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line bg-canvas px-4 py-1.5 text-[11px] text-muted sm:px-6">
      <span>
        Query plan: <strong className="font-bold text-ink">{stats.plan}</strong>
        {stats.cached && ' (memoised)'}
      </span>
      <span>
        Took <strong className="font-bold text-ink">{stats.durationMs.toFixed(2)} ms</strong>
      </span>
      <span>
        Examined {stats.scanned.toLocaleString()} of {total.toLocaleString()} records
        {skipped > 0 && ` — skipped ${skipped.toLocaleString()}`}
      </span>
      <span>Rendering ~20 rows of {stats.matched.toLocaleString()} matched</span>
      {pending && <span className="font-semibold text-brand">typing…</span>}
    </div>
  );
}

/* ------------------------------ pass entry ---------------------------- */

/**
 * Check-in by pass code. Standing in for a webcam QR scan: the reader hardware
 * at a real reception emits the decoded string as keyboard input, which is
 * exactly what typing into this box does.
 */
function ScanPass() {
  const redeemPass = useStore((state) => state.redeemPass);
  const pushToast = useStore((state) => state.pushToast);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!code.trim()) return;

    setBusy(true);
    try {
      await redeemPass(code);
      setCode('');
    } catch (error) {
      pushToast({ kind: 'error', message: toUserMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex items-center gap-1">
      <label className="sr-only" htmlFor="pass-code">
        Entry pass code
      </label>
      <input
        id="pass-code"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        placeholder="Scan or type pass"
        className="w-40 rounded-lg border border-line bg-surface px-3 py-2 font-mono text-sm text-ink uppercase"
      />
      <Button type="submit" variant="secondary" loading={busy}>
        Check in
      </Button>
    </form>
  );
}

/* ------------------------------- helpers ------------------------------ */

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function timeToMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
