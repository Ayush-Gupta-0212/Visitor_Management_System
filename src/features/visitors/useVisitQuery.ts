/**
 * Bridges the (non-reactive) VisitIndex to React.
 *
 * `useMemo` keyed on the filters *and* on `dataVersion` is what makes this work:
 * the index is mutated in place, so React cannot see the change; bumping the
 * version counter in the store is the signal to re-run the query. The result is
 * an array of ids - a few hundred bytes - not the records themselves, so
 * nothing large is ever copied into React state.
 *
 * The URL is the source of truth for the filters. That means a filtered view can
 * be bookmarked and shared, the back button works, and a reload does not lose
 * the front desk's place.
 */
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore, visitIndex } from '@/app/store';
import type { SortDir, SortKey, VisitQuery } from '@/data/indexes';
import type { VisitStatus } from '@/domain/types';
import { useDebounced } from '@/shared/hooks';
import { endOfDay, parseDayKey, startOfDay, toDateInput } from '@/shared/lib/datetime';

export interface VisitFilters {
  text: string;
  day: string;
  minuteFrom: number;
  minuteTo: number;
  statuses: VisitStatus[];
  sortBy: SortKey;
  sortDir: SortDir;
}

const ALL_DAYS = 'all';

export function useVisitFilters() {
  const [params, setParams] = useSearchParams();

  const filters: VisitFilters = useMemo(
    () => ({
      text: params.get('q') ?? '',
      day: params.get('day') ?? toDateInput(Date.now()),
      minuteFrom: Number(params.get('from') ?? 0),
      minuteTo: Number(params.get('to') ?? 1439),
      statuses: (params.get('status')?.split(',').filter(Boolean) ?? []) as VisitStatus[],
      sortBy: (params.get('sortBy') ?? 'entry') as SortKey,
      sortDir: (params.get('sortDir') ?? 'desc') as SortDir,
    }),
    [params],
  );

  const update = useCallback(
    (patch: Partial<VisitFilters>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          const write = (key: string, value: string, fallback: string) => {
            if (value === fallback) next.delete(key);
            else next.set(key, value);
          };

          if (patch.text !== undefined) write('q', patch.text, '');
          if (patch.day !== undefined) write('day', patch.day, '');
          if (patch.minuteFrom !== undefined) write('from', String(patch.minuteFrom), '0');
          if (patch.minuteTo !== undefined) write('to', String(patch.minuteTo), '1439');
          if (patch.statuses !== undefined) write('status', patch.statuses.join(','), '');
          if (patch.sortBy !== undefined) write('sortBy', patch.sortBy, 'entry');
          if (patch.sortDir !== undefined) write('sortDir', patch.sortDir, 'desc');

          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return { filters, update, showingAllDays: filters.day === ALL_DAYS, ALL_DAYS };
}

export interface VisitQueryResult {
  ids: string[];
  stats: { matched: number; scanned: number; durationMs: number; plan: string; cached: boolean };
  /** True while the debounce is still catching up with what was typed. */
  pending: boolean;
}

export function useVisitQuery(filters: VisitFilters): VisitQueryResult {
  const dataVersion = useStore((state) => state.dataVersion);
  const debouncedText = useDebounced(filters.text, 250);

  const query: VisitQuery = useMemo(() => {
    const base: VisitQuery = {
      text: debouncedText || undefined,
      statuses: filters.statuses.length > 0 ? filters.statuses : undefined,
      sortBy: filters.sortBy,
      sortDir: filters.sortDir,
    };

    if (filters.day !== ALL_DAYS) {
      const dayTs = parseDayKey(filters.day);
      base.from = startOfDay(dayTs);
      base.to = endOfDay(dayTs);
    }
    // Only send the time-of-day window when it is narrower than a full day;
    // otherwise it would force the query planner off its fast path for nothing.
    if (filters.minuteFrom > 0) base.minuteFrom = filters.minuteFrom;
    if (filters.minuteTo < 1439) base.minuteTo = filters.minuteTo;

    return base;
  }, [debouncedText, filters.statuses, filters.sortBy, filters.sortDir, filters.day, filters.minuteFrom, filters.minuteTo]);

  const ids = useMemo(
    () => visitIndex.query(query),
    // `dataVersion` is the signal that the mutable index changed underneath us.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, dataVersion],
  );

  return {
    ids,
    stats: { ...visitIndex.lastStats },
    pending: debouncedText !== filters.text,
  };
}
