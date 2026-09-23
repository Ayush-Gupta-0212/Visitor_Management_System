import { differenceInMinutes, format, isSameDay, isToday, isTomorrow, isYesterday, parseISO } from 'date-fns'
import type { IsoDate, IsoDateTime } from '@/types/vms'

/*
 * Display formatting for dates, times and durations. Everything renders in the
 * browser's local time zone, which for a front-desk console is the site's own.
 */

type Instant = IsoDateTime | Date

const toDate = (instant: Instant) => (typeof instant === 'string' ? parseISO(instant) : instant)

/** Local calendar day, `2026-09-24`. */
export const toIsoDate = (date: Date): IsoDate => format(date, 'yyyy-MM-dd')

/** `9:05 AM` */
export const formatTime = (instant: Instant): string => format(toDate(instant), 'h:mm a')

/** `Thu 24 Sep` */
export const formatDay = (day: IsoDate | Date): string => format(toDate(day), 'EEE d MMM')

/** `Thu 24 Sep, 9:05 AM` */
export const formatDateTime = (instant: Instant): string => format(toDate(instant), 'EEE d MMM, h:mm a')

/** `9:05 AM` on the same day as `now`, otherwise `Wed 9:05 PM`. */
export function formatTimeWithDay(instant: Instant, now: Date): string {
  const date = toDate(instant)
  return format(date, isSameDay(date, now) ? 'h:mm a' : 'EEE h:mm a')
}

/** `Today`, `Tomorrow`, `Yesterday`, otherwise `Thu 24 Sep`. */
export function formatRelativeDay(instant: Instant): string {
  const date = toDate(instant)
  if (isToday(date)) return 'Today'
  if (isTomorrow(date)) return 'Tomorrow'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'EEE d MMM')
}

/** `10:00 AM – 12:00 PM`; the end gets its weekday when the window crosses midnight. */
export function formatWindow(start: Instant, end: Instant): string {
  const startsAt = toDate(start)
  const endsAt = toDate(end)
  return `${format(startsAt, 'h:mm a')} – ${format(endsAt, isSameDay(startsAt, endsAt) ? 'h:mm a' : 'EEE h:mm a')}`
}

/** `45m`, `2h`, `1h 12m`, `2d 4h`. */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes))
  if (total < 60) return `${total}m`
  const hours = Math.floor(total / 60)
  const rest = total % 60
  if (hours < 24) return rest ? `${hours}h ${rest}m` : `${hours}h`
  const days = Math.floor(hours / 24)
  return hours % 24 ? `${days}d ${hours % 24}h` : `${days}d`
}

/** Whole minutes from `from` to `to`; negative when `to` is earlier. */
export const minutesBetween = (from: Instant, to: Instant): number => differenceInMinutes(toDate(to), toDate(from))

/** `12m ago`, `in 1h 5m`, `just now`. */
export function formatRelative(instant: Instant, now: Date): string {
  const minutes = minutesBetween(now, instant)
  if (Math.abs(minutes) < 1) return 'just now'
  return minutes < 0 ? `${formatDuration(-minutes)} ago` : `in ${formatDuration(minutes)}`
}

/** `LM` for Lalita Mehta, `RV` for R. K. Verma. */
export function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const letters = words.length > 1 ? words[0][0] + words[words.length - 1][0] : words[0].slice(0, 2)
  return letters.toUpperCase()
}
