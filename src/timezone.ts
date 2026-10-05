/**
 * Where the screen is in its own day: the minutes since local midnight and the
 * weekday, which is all the schedule needs.
 */

import type { Now } from './schedule.js'

const MS_PER_DAY = 86400000
const MS_PER_MINUTE = 60000

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatter(timeZone: string): Intl.DateTimeFormat {
  let existing = formatters.get(timeZone)
  if (!existing) {
    existing = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
    })
    formatters.set(timeZone, existing)
  }
  return existing
}

export function zonedNow(date: Date, timeZone: string): Now {
  const parts = formatter(timeZone).formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''

  const weekday = WEEKDAYS.indexOf(value('weekday'))

  return {
    minutes: Number(value('hour')) * 60 + Number(value('minute')),
    weekday: weekday === -1 ? date.getUTCDay() : weekday,
    instant: date,
    timeZone,
  }
}

/**
 * The instant at a given weekday and time of day, nearest the real one. Used by
 * the development panel, which scrubs in local terms rather than in instants.
 *
 * The weekday step is the short way round: from a Sunday, Saturday is yesterday
 * rather than six days off. The board only reads the weekday and the time, so
 * either would show the same sittings, but the date on screen should be the
 * near one.
 *
 * A local day is not always 24 elapsed hours, so the first jump is measured
 * against the zone and corrected. Without that, scrubbing across the night the
 * clocks change lands an hour out. A time that a forward change skips does not
 * exist at all, and the nearest real instant is returned instead.
 */
export function instantForLocal(
  reference: Date,
  timeZone: string,
  target: { minutes: number; weekday: number },
): Date {
  const shortWayRound = (from: number, to: number) => {
    const forward = (to - from + 7) % 7
    return forward > 3 ? forward - 7 : forward
  }

  const current = zonedNow(reference, timeZone)
  let instant = new Date(
    reference.getTime() +
      shortWayRound(current.weekday, target.weekday) * MS_PER_DAY +
      (target.minutes - current.minutes) * MS_PER_MINUTE,
  )

  for (let pass = 0; pass < 3; pass += 1) {
    const landed = zonedNow(instant, timeZone)
    if (
      landed.weekday === target.weekday &&
      landed.minutes === target.minutes
    ) {
      return instant
    }

    instant = new Date(
      instant.getTime() +
        shortWayRound(landed.weekday, target.weekday) * MS_PER_DAY +
        (target.minutes - landed.minutes) * MS_PER_MINUTE,
    )
  }

  return instant
}
