import type { IsoDate, VisitorRecord } from '@/types/vms'

/*
 * Lookup indexes over the visitor list.
 *
 * The store replaces the array on every change, so the array itself is the
 * cache key: the first lookup against a list version builds all three maps in
 * one O(N) pass, and every later lookup against that version is O(1) by id or
 * pass token, or O(K) for one host's K bookings on a day. The WeakMap drops an
 * old version's indexes when the array itself is garbage-collected.
 */

interface VisitorIndexes {
  byId: Map<string, VisitorRecord>
  byPassToken: Map<string, VisitorRecord>
  byHostDay: Map<string, VisitorRecord[]>
}

const cache = new WeakMap<readonly VisitorRecord[], VisitorIndexes>()

const hostDayKey = (hostId: string, day: IsoDate) => `${hostId}|${day}`

function buildIndexes(visitors: readonly VisitorRecord[]): VisitorIndexes {
  const indexes: VisitorIndexes = { byId: new Map(), byPassToken: new Map(), byHostDay: new Map() }
  for (const visitor of visitors) {
    indexes.byId.set(visitor.id, visitor)
    indexes.byPassToken.set(visitor.qrCodePlaceholder, visitor)
    const key = hostDayKey(visitor.hostEmployeeId, visitor.expectedDate)
    const bookings = indexes.byHostDay.get(key)
    if (bookings) bookings.push(visitor)
    else indexes.byHostDay.set(key, [visitor])
  }
  return indexes
}

function indexesFor(visitors: readonly VisitorRecord[]): VisitorIndexes {
  let indexes = cache.get(visitors)
  if (!indexes) {
    indexes = buildIndexes(visitors)
    cache.set(visitors, indexes)
  }
  return indexes
}

export function findVisitor(visitors: readonly VisitorRecord[], id: string): VisitorRecord | undefined {
  return indexesFor(visitors).byId.get(id)
}

/** The visitor whose e-pass encodes `token`: what a QR scan at the desk resolves to. */
export function findVisitorByPassToken(visitors: readonly VisitorRecord[], token: string): VisitorRecord | undefined {
  return indexesFor(visitors).byPassToken.get(token.trim().toLowerCase())
}

/** A host's bookings on one day: the K records the daily-quota check reads. */
export function hostVisitsOn(visitors: readonly VisitorRecord[], hostId: string, day: IsoDate): readonly VisitorRecord[] {
  return indexesFor(visitors).byHostDay.get(hostDayKey(hostId, day)) ?? []
}
