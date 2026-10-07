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

/** Wide enough to hold any clock change on either side of the time asked for. */
const SEARCH_WINDOW = 4 * 60 * MS_PER_MINUTE

/** The zone's offset at an instant, folded so that two can be compared. */
function offsetMinutes(instant: Date, timeZone: string): number {
  const local = zonedNow(instant, timeZone).minutes
  const utc = instant.getUTCHours() * 60 + instant.getUTCMinutes()

  return ((local - utc + 2160) % 1440) - 720
}

/** Whether the clocks changed in the window a resolution searches. */
function clocksChangedNearby(instant: Date, timeZone: string): boolean {
  const before = new Date(instant.getTime() - SEARCH_WINDOW)

  return offsetMinutes(instant, timeZone) !== offsetMinutes(before, timeZone)
}

/**
 * The first instant at which the clocks have reached a local time.
 *
 * For a time a forward change skipped this is the moment of the jump. For one
 * a backward change repeats it is the earlier of the two passes, which is what
 * makes it an answer about the time itself rather than about whereabouts in
 * the repeated hour the question was asked.
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

  // To the millisecond. A minute of slack here is a minute of slack in every
  // status and countdown that crosses the change, and this runs only when one
  // is nearby.
  while (after - before > 1) {
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
 * The night the clocks change, a local time can happen twice or not at all,
 * and `whenDoubtful` says which answer is wanted. The scrubber takes the
 * nearest real instant to where it already is, which is what scrubbing means.
 *
 * A countdown cannot use that. An end time inside a gap resolves to an instant
 * already gone and counts backwards, and a time in a repeated hour resolves to
 * whichever pass the question was asked in, so a service that has finished
 * starts again when the hour comes round a second time. Asking for `first`
 * pins the time to an instant that does not depend on when it was asked.
 */
export function instantForLocal(
  reference: Date,
  timeZone: string,
  target: { minutes: number; weekday: number },
  whenDoubtful: 'nearest' | 'first' = 'nearest',
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

  let landedOnIt = false
  for (let pass = 0; pass < 3 && !landedOnIt; pass += 1) {
    const landed = zonedNow(instant, timeZone)
    landedOnIt =
      landed.weekday === target.weekday && landed.minutes === target.minutes

    if (!landedOnIt) {
      instant = new Date(
        instant.getTime() +
          shortWayRound(landed.weekday, target.weekday) * MS_PER_DAY +
          (target.minutes - landed.minutes) * MS_PER_MINUTE,
      )
    }
  }

  if (whenDoubtful === 'nearest') {
    return instant
  }

  // Away from a clock change the arithmetic above is already the only answer,
  // which is worth knowing: the search below costs a couple of dozen reads of
  // the zone and every sitting on the board resolves two of these.
  return landedOnIt && !clocksChangedNearby(instant, timeZone)
    ? instant
    : firstInstantReaching(instant, timeZone, target)
}
