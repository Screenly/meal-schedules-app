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

const MINUTES_PER_WEEK = 7 * 24 * 60

/**
 * How far the local time at an instant is from a local weekday and time, in
 * minutes, taking the short way round the week so either side of it is signed.
 */
function minutesFromTarget(
  instant: Date,
  timeZone: string,
  target: { minutes: number; weekday: number },
): number {
  const landed = zonedNow(instant, timeZone)
  const difference =
    landed.weekday * 24 * 60 +
    landed.minutes -
    (target.weekday * 24 * 60 + target.minutes)

  return (
    ((difference + MINUTES_PER_WEEK * 1.5) % MINUTES_PER_WEEK) -
    MINUTES_PER_WEEK / 2
  )
}

/** Wide enough to hold any clock change on either side of the gap. */
const SEARCH_WINDOW = 4 * 60 * MS_PER_MINUTE

/**
 * The first instant whose local time has reached a local time that does not
 * exist, which is the moment of the jump that skipped it.
 */
function firstInstantReaching(
  near: Date,
  timeZone: string,
  target: { minutes: number; weekday: number },
): Date {
  const reached = (time: number) =>
    minutesFromTarget(new Date(time), timeZone, target) >= 0

  let before = near.getTime() - SEARCH_WINDOW
  let after = near.getTime() + SEARCH_WINDOW
  if (reached(before) || !reached(after)) {
    return near
  }

  while (after - before > MS_PER_MINUTE) {
    const middle = before + Math.floor((after - before) / 2)
    if (reached(middle)) {
      after = middle
    } else {
      before = middle
    }
  }

  return new Date(after)
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
 * clocks change lands an hour out.
 *
 * A time a forward change skips does not exist, and `whenSkipped` says what to
 * do about it. The scrubber takes the nearest real instant, which reads as the
 * hour before the jump. A countdown cannot: an end time inside the gap would
 * resolve to an instant already gone and count backwards, so it asks for the
 * first instant the clocks reach at or after it, which is the jump itself.
 */
export function instantForLocal(
  reference: Date,
  timeZone: string,
  target: { minutes: number; weekday: number },
  whenSkipped: 'nearest' | 'forward' = 'nearest',
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

  // Nothing landed on it, so the local time is one the clocks skipped.
  return whenSkipped === 'forward'
    ? firstInstantReaching(instant, timeZone, target)
    : instant
}
