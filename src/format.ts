/**
 * Formatting for a board read from the other side of a room: short words,
 * no seconds, nothing that needs a second look.
 */

/** British English puts the day first and runs a 24 hour clock; American does not. */
const TWENTY_FOUR_HOUR_LOCALE = 'en-GB'
const TWELVE_HOUR_LOCALE = 'en-US'

export function displayLocale(clockFormat: string): string {
  return clockFormat === '12h' ? TWELVE_HOUR_LOCALE : TWENTY_FOUR_HOUR_LOCALE
}

const clockFormatters = new Map<string, Intl.DateTimeFormat>()

/** Hours and minutes only. Cached: the board asks for one per row every draw. */
export function clockFormatter(
  locale: string,
  hour12: boolean,
  timeZone = 'UTC',
): Intl.DateTimeFormat {
  const key = `${locale}|${hour12}|${timeZone}`
  let existing = clockFormatters.get(key)
  if (!existing) {
    existing = new Intl.DateTimeFormat(locale, {
      timeZone,
      hour12,
      hour: hour12 ? 'numeric' : '2-digit',
      minute: '2-digit',
    })
    clockFormatters.set(key, existing)
  }
  return existing
}

/**
 * Minutes from midnight as a clock time. Minutes past 1440 wrap, so a service
 * ending at 01:00 tomorrow reads as 01:00.
 */
export function formatClock(
  minutes: number,
  locale: string,
  hour12: boolean,
): string {
  const date = new Date(Date.UTC(2001, 0, 1, 0, Math.round(minutes)))
  return clockFormatter(locale, hour12).format(date)
}

/**
 * "06:30 – 10:30". Each end is formatted on its own rather than with
 * `formatRange`, which would notice that a service ending after midnight falls
 * on the next day and put the dates on the board.
 */
export function formatRange(
  start: number,
  end: number,
  locale: string,
  hour12: boolean,
): string {
  const from = formatClock(start, locale, hour12)
  const to = formatClock(end, locale, hour12)
  return `${from} \u2013 ${to}`
}

/** "40 min", "2 h 15", "1 h", "2 d 3 h". Short enough to read at a glance. */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes))
  const days = Math.floor(total / 1440)
  const hours = Math.floor((total % 1440) / 60)
  const rest = total % 60

  if (days > 0) {
    return hours === 0 ? `${days} d` : `${days} d ${hours} h`
  }
  if (hours === 0) {
    return `${total} min`
  }
  return rest === 0
    ? `${hours} h`
    : `${hours} h ${String(rest).padStart(2, '0')}`
}

/** "Wednesday 4 October", in whichever order the locale writes it. */
export function formatLongDate(
  date: Date,
  locale: string,
  timeZone: string,
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date)
}
