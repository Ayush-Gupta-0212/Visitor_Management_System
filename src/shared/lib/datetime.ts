/**
 * Date/time helpers.
 *
 * Timestamps are stored as epoch milliseconds (numbers) everywhere in the app.
 * Numbers compare and sort in O(1) with no allocation, which matters when the
 * table sorts 50,000 rows; `Date` objects are created only at the edge, for
 * formatting.
 */

const MS_PER_MINUTE = 60_000;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;

/** Local-time "YYYY-MM-DD". Used as the key of the per-day bucket index. */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/** Midnight at the start of the local day containing `ts`. */
export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** One millisecond before the next midnight - the inclusive end of the day. */
export function endOfDay(ts: number): number {
  return startOfDay(ts) + MS_PER_DAY - 1;
}

/** Parses the "YYYY-MM-DD" value produced by `<input type="date">`. */
export function parseDayKey(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

/** Minutes since local midnight - the value behind `<input type="time">`. */
export function minutesSinceMidnight(ts: number): number {
  return Math.floor((ts - startOfDay(ts)) / MS_PER_MINUTE);
}

/** "07:00 pm" */
export function formatTime(ts: number | undefined): string {
  if (!ts) return '--';
  return new Date(ts)
    .toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    .toLowerCase();
}

/** "Feb 10 2025" */
export function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.toLocaleString('en-US', { month: 'short' })} ${d.getDate()} ${d.getFullYear()}`;
}

/** "Mon, Feb 10, 12:21 AM" */
export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "2h 15m" - used for visit duration and overstay amounts. */
export function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const totalMinutes = Math.floor(ms / MS_PER_MINUTE);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

/** Converts "HH:MM" from a time input into an absolute timestamp on `dayTs`. */
export function combineDateAndTime(dayTs: number, time: string): number {
  const [h, m] = time.split(':').map(Number);
  return startOfDay(dayTs) + h * MS_PER_HOUR + m * MS_PER_MINUTE;
}

/** "HH:MM" for a time input, from an absolute timestamp. */
export function toTimeInput(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "YYYY-MM-DD" for a date input. */
export function toDateInput(ts: number): string {
  return dayKey(ts);
}
