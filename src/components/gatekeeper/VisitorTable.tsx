import { CalendarDays, ChevronLeft, ChevronRight, Search, SearchX, Users } from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { VisitorStatusBadge } from '@/components/visitor/VisitorStatusBadge'
import { describeSource } from '@/components/visitor/presentation'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useNow } from '@/hooks/useNow'
import { formatDay, formatDuration, formatRelative, formatTimeWithDay, minutesBetween, toIsoDate } from '@/lib/format'
import { visibleTo } from '@/lib/rbac'
import { cn } from '@/lib/utils'
import { VISITOR_TYPE_LABELS, countByStatus, filterVisitors, sortForDesk } from '@/lib/visitorRules'
import { useUiStore } from '@/store/useUiStore'
import { useVmsStore } from '@/store/useVmsStore'
import type { VisitorFilters, VisitorRecord } from '@/types/vms'

const STATUS_TABS = [
  { value: 'ALL', label: 'All' },
  { value: 'CHECKED_IN', label: 'Checked in' },
  { value: 'PRE_APPROVED', label: 'Pre-approved' },
  { value: 'OVERSTAY', label: 'Overstay' },
  { value: 'CHECKED_OUT', label: 'Checked out' },
] as const satisfies readonly { value: VisitorFilters['status']; label: string }[]

type StatusTab = (typeof STATUS_TABS)[number]['value']

const PAGE_SIZE = 10
const SHORTCUT_HINT = /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘K' : 'Ctrl K'

interface VisitorTableProps {
  title: string
  /** Offered in the empty state when no filter explains the emptiness, e.g. "Register walk-in". */
  emptyAction?: ReactNode
}

/**
 * The visitor list for the desk (and the admin's all-visits view). Reads and writes
 * the store's shared filters; search is debounced so filtering runs once typing
 * pauses. Each filter pass is O(N), then O(N log N) to sort; only one page renders.
 */
export function VisitorTable({ title, emptyAction }: VisitorTableProps) {
  const visitors = useVmsStore((state) => state.visitors)
  const currentUser = useVmsStore((state) => state.currentUser)
  const filters = useVmsStore((state) => state.activeFilters)
  const setFilters = useVmsStore((state) => state.setFilters)
  const resetFilters = useVmsStore((state) => state.resetFilters)
  const openDetails = useUiStore((state) => state.openDetails)
  const now = useNow()
  const searchRef = useRef<HTMLInputElement>(null)

  // Search box: local for instant typing, pushed to the store 250 ms after typing stops.
  const [query, setQuery] = useState(filters.query)
  const debouncedQuery = useDebouncedValue(query, 250)
  const lastPushed = useRef(filters.query)

  useEffect(() => {
    if (debouncedQuery === lastPushed.current) return
    lastPushed.current = debouncedQuery
    setFilters({ query: debouncedQuery })
  }, [debouncedQuery, setFilters])

  // Reflect outside changes (clear filters, role switch, database reset) back into the box.
  useEffect(() => {
    if (filters.query === lastPushed.current) return
    lastPushed.current = filters.query
    setQuery(filters.query)
  }, [filters.query])

  // ⌘K / Ctrl+K, or "/" outside a text field, focuses search.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const typing = event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"]')
      const shortcut = (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) || (event.key === '/' && !typing)
      if (!shortcut) return
      event.preventDefault()
      searchRef.current?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Everything except the status tab, so each tab can show its own count.
  const scoped = useMemo(
    () => filterVisitors(visibleTo(currentUser, visitors), { ...filters, status: 'ALL' }, now),
    [visitors, currentUser, filters, now],
  )
  const counts = useMemo(() => countByStatus(scoped), [scoped])
  const activeTab: StatusTab = STATUS_TABS.some((tab) => tab.value === filters.status) ? (filters.status as StatusTab) : 'ALL'
  const rows = useMemo(
    () => sortForDesk(activeTab === 'ALL' ? scoped : scoped.filter((visitor) => visitor.status === activeTab)),
    [scoped, activeTab],
  )

  // Any filter change sends the list back to page 1.
  const filterKey = `${filters.query}|${filters.status}|${filters.visitorType}|${filters.dateRange.from}|${filters.dateRange.to}`
  const [paging, setPaging] = useState({ key: filterKey, page: 1 })
  if (paging.key !== filterKey) setPaging({ key: filterKey, page: 1 })
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const page = Math.min(paging.key === filterKey ? paging.page : 1, pageCount)
  const firstRow = (page - 1) * PAGE_SIZE
  const pageRows = rows.slice(firstRow, firstRow + PAGE_SIZE)

  const today = toIsoDate(now)
  const { from, to } = filters.dateRange
  const selectedDay = from && from === to ? from : ''
  const allDates = !from && !to
  const narrowed = filters.query.trim() !== '' || activeTab !== 'ALL' || filters.visitorType !== 'ALL'
  const setDay = (day: string) => setFilters({ dateRange: day ? { from: day, to: day } : { from: null, to: null } })

  return (
    <section aria-label={title} className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search visitor, host, company or temp card"
            aria-label="Search visitors"
            className="pr-16 pl-9"
          />
          {!query && (
            <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border border-border bg-muted px-1.5 font-mono text-mono-code text-muted-foreground sm:block">
              {SHORTCUT_HINT}
            </kbd>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="date"
              value={selectedDay}
              onChange={(event) => setDay(event.target.value)}
              aria-label="Visit date"
              className="w-44 pl-9 font-mono text-mono-code"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => setDay(today)} disabled={selectedDay === today}>
            Today
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDay('')} disabled={allDates}>
            All dates
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto border-b border-border px-4 py-2.5">
        <SegmentedControl
          label="Filter by status"
          value={activeTab}
          onValueChange={(status) => setFilters({ status })}
          options={STATUS_TABS.map((tab) => ({ ...tab, count: counts[tab.value] }))}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-left">
          <caption className="sr-only">
            {title}, {allDates ? 'all dates' : formatDay(selectedDay || today)}
          </caption>
          <thead className="bg-background">
            <tr className="border-b border-border">
              <HeaderCell>Visitor</HeaderCell>
              <HeaderCell className="hidden md:table-cell">Type of invite</HeaderCell>
              <HeaderCell>Entry</HeaderCell>
              <HeaderCell className="hidden sm:table-cell">Exit</HeaderCell>
              <HeaderCell>Status</HeaderCell>
              <HeaderCell>
                <span className="sr-only">Actions</span>
              </HeaderCell>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((visitor, index) => (
              <VisitorRow key={visitor.id} visitor={visitor} index={index} now={now} onOpen={openDetails} />
            ))}
          </tbody>
        </table>
        {rows.length === 0 &&
          (narrowed ? (
            <EmptyState
              icon={SearchX}
              title="No visitors match these filters"
              description="Try another name, company or card number, or clear the filters."
              action={
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Users}
              title={allDates ? 'No visitors yet' : `No visitors on ${formatDay(selectedDay || today)}`}
              description="Walk-ins and pre-approved guests appear here as they are registered."
              action={emptyAction}
            />
          ))}
      </div>

      <footer className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex flex-wrap items-center gap-x-2 text-body-sm text-muted-foreground">
          {rows.length > 0 ? (
            <span>
              Showing{' '}
              <span className="font-medium text-foreground tabular-nums">
                {firstRow + 1}–{firstRow + pageRows.length}
              </span>{' '}
              of <span className="font-medium text-foreground tabular-nums">{rows.length}</span>
            </span>
          ) : (
            <span>No results</span>
          )}
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-success-dot" aria-hidden />
            Live, re-checked every 30 s
          </span>
        </p>
        {pageCount > 1 && (
          <nav aria-label="Pagination" className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => setPaging({ key: filterKey, page: page - 1 })} disabled={page === 1}>
              <ChevronLeft /> Previous
            </Button>
            <span className="px-2 font-mono text-mono-code text-muted-foreground tabular-nums">
              {page} / {pageCount}
            </span>
            <Button variant="outline" size="sm" onClick={() => setPaging({ key: filterKey, page: page + 1 })} disabled={page === pageCount}>
              Next <ChevronRight />
            </Button>
          </nav>
        )}
      </footer>
    </section>
  )
}

function HeaderCell({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <th scope="col" className={cn('eyebrow h-9 px-4 font-medium whitespace-nowrap', className)}>
      {children}
    </th>
  )
}

interface VisitorRowProps {
  visitor: VisitorRecord
  index: number
  now: Date
  onOpen: (visitorId: string) => void
}

function VisitorRow({ visitor, index, now, onOpen }: VisitorRowProps) {
  return (
    <tr
      onClick={() => onOpen(visitor.id)}
      className="animate-row-in cursor-pointer border-b border-muted transition-colors last:border-b-0 hover:bg-surface-hover"
      style={{ animationDelay: `${Math.min(index, 10) * 18}ms` }}
    >
      <td className="px-4 py-3">
        <div className="flex max-w-60 items-center gap-3">
          <Avatar name={visitor.fullName} src={visitor.photoUrl} />
          <div className="min-w-0">
            <p className="truncate text-body-md font-medium text-foreground">{visitor.fullName}</p>
            <p className="truncate text-body-sm text-muted-foreground">Host: {visitor.hostEmployeeName}</p>
          </div>
        </div>
      </td>
      <td className="hidden px-4 py-3 md:table-cell">
        <Badge shape="tag">{VISITOR_TYPE_LABELS[visitor.visitorType]}</Badge>
        <p className="mt-1 text-body-sm whitespace-nowrap text-muted-foreground">{describeSource(visitor)}</p>
      </td>
      <td className="px-4 py-3">
        <EntryCell visitor={visitor} now={now} />
      </td>
      <td className="hidden px-4 py-3 sm:table-cell">
        <ExitCell visitor={visitor} now={now} />
      </td>
      <td className="px-4 py-3">
        <VisitorStatusBadge visitor={visitor} now={now} />
      </td>
      <td className="px-4 py-3 text-right">
        <Button
          variant="ghost"
          size="sm"
          aria-label={`View details for ${visitor.fullName}`}
          onClick={(event) => {
            event.stopPropagation()
            onOpen(visitor.id)
          }}
        >
          <span className="hidden lg:inline">View details</span>
          <ChevronRight />
        </Button>
      </td>
    </tr>
  )
}

function EntryCell({ visitor, now }: { visitor: VisitorRecord; now: Date }) {
  if (visitor.actualCheckInTime) {
    return <TimeCell time={formatTimeWithDay(visitor.actualCheckInTime, now)} note={formatRelative(visitor.actualCheckInTime, now)} />
  }
  const note = visitor.status === 'PENDING_APPROVAL' ? 'Awaiting host' : visitor.status === 'PRE_APPROVED' ? 'Expected' : 'Never entered'
  return <TimeCell time={formatTimeWithDay(visitor.timeWindowStart, now)} note={note} muted />
}

function ExitCell({ visitor, now }: { visitor: VisitorRecord; now: Date }) {
  const due = formatTimeWithDay(visitor.timeWindowEnd, now)
  if (visitor.actualCheckOutTime) {
    return <TimeCell time={formatTimeWithDay(visitor.actualCheckOutTime, now)} note="Checked out" />
  }
  if (visitor.status === 'OVERSTAY') {
    return <TimeCell time={due} note={`+${formatDuration(minutesBetween(visitor.timeWindowEnd, now))} overdue`} tone="danger" />
  }
  if (visitor.status === 'CHECKED_IN') {
    const minutesLeft = minutesBetween(now, visitor.timeWindowEnd)
    const note = minutesLeft >= 0 ? `Due in ${formatDuration(minutesLeft)}` : `${formatDuration(-minutesLeft)} past, in grace`
    return <TimeCell time={due} note={note} />
  }
  return <TimeCell time={due} note="Window ends" muted />
}

interface TimeCellProps {
  time: string
  note: string
  muted?: boolean
  tone?: 'danger'
}

function TimeCell({ time, note, muted = false, tone }: TimeCellProps) {
  const danger = tone === 'danger'
  return (
    <div className="whitespace-nowrap">
      <p className={cn('font-mono text-mono-code', danger ? 'text-danger-strong' : muted ? 'text-muted-foreground' : 'text-foreground')}>
        {time}
      </p>
      <p className={cn('text-body-sm', danger ? 'font-medium text-danger-strong' : 'text-muted-foreground')}>{note}</p>
    </div>
  )
}
