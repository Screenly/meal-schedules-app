/**
 * Turning a schedule into what the board shows right now.
 *
 * Everything is counted in minutes from the start of today, so a service that
 * began yesterday evening and is still running at one in the morning has a
 * negative start and still reads as being served.
 */

import { MINUTES_PER_DAY, type Meal } from './meals.js'
import { instantForLocal } from './timezone.js'

const DAY_MS = 86_400_000

/** Minutes until a local time measured from today's midnight actually arrives. */
function minutesUntil(localMinutes: number, now: Now): number {
  if (!now.instant || !now.timeZone) {
    return localMinutes - now.minutes
  }

  const dayShift = Math.floor(localMinutes / MINUTES_PER_DAY)
  // instantForLocal goes to the nearest weekday of that name, never more than
  // three days either way, so a sitting a week out would resolve to the one
  // just gone. Move the reference alongside it first: the shifted instant
  // always falls on the weekday being asked for, so the step from there is
  // none and only the time of day is left to settle.
  const reference = new Date(now.instant.getTime() + dayShift * DAY_MS)
  const instant = instantForLocal(
    reference,
    now.timeZone,
    {
      minutes: localMinutes - dayShift * MINUTES_PER_DAY,
      weekday: (now.weekday + dayShift + 7) % 7,
    },
    // A sitting starting or ending in an hour the clocks skipped does so when
    // they pass it, never in the hour before it, which has already gone.
    'forward',
  )

  return Math.round((instant.getTime() - now.instant.getTime()) / 60000)
}

export type MealStatus = 'serving' | 'next' | 'later' | 'finished'

export interface ScheduledMeal {
  meal: Meal
  status: MealStatus
  /** Minutes from the start of today; negative for a service that began yesterday. */
  start: number
  end: number
  /** Minutes until it starts, or until it ends once it has. */
  startsIn: number
  endsIn: number
}

export interface Now {
  /** Minutes since local midnight. */
  minutes: number
  /** Day of the week, Sunday first. */
  weekday: number
  /**
   * The instant those two describe, and the zone they are in. Given both, a
   * countdown is the time that will actually elapse rather than the difference
   * between two wall clock readings, which are not the same across a clock
   * change. Without them the two agree anyway.
   */
  instant?: Date
  timeZone?: string
}

function servedOn(meal: Meal, weekday: number): boolean {
  return meal.days === null || meal.days.has(weekday)
}

/** How far ahead to look for the next sitting when today has none left. */
const LOOKAHEAD_DAYS = 7

/** Every sitting from yesterday through the week ahead, in the frame of today. */
function occurrences(meals: Meal[], now: Now): ScheduledMeal[] {
  const all: ScheduledMeal[] = []

  for (let dayOffset = -1; dayOffset <= LOOKAHEAD_DAYS; dayOffset += 1) {
    const weekday = (now.weekday + dayOffset + 7) % 7
    const shift = dayOffset * MINUTES_PER_DAY

    for (const meal of meals) {
      if (!servedOn(meal, weekday)) {
        continue
      }
      const start = meal.start + shift
      const end = meal.end + shift
      all.push({
        meal,
        start,
        end,
        status: 'later',
        startsIn: minutesUntil(start, now),
        endsIn: minutesUntil(end, now),
      })
    }
  }

  return all.sort((a, b) => a.start - b.start)
}

/**
 * The day's board: today's sittings, anything from yesterday still being
 * served, and the next sitting within the week only when today has nothing
 * left to come, so a venue closed on Sundays still says when it reopens.
 */
export function scheduleFor(meals: Meal[], now: Now): ScheduledMeal[] {
  const all = occurrences(meals, now)

  const serving = (sitting: ScheduledMeal) =>
    sitting.start <= now.minutes && sitting.end > now.minutes
  const isToday = (sitting: ScheduledMeal) =>
    sitting.start >= 0 && sitting.start < MINUTES_PER_DAY

  const board = all.filter((sitting) => isToday(sitting) || serving(sitting))

  const somethingLeftToday = board.some(
    (sitting) => sitting.start > now.minutes,
  )
  if (!somethingLeftToday) {
    const tomorrow = all.find(
      (sitting) =>
        sitting.start >= MINUTES_PER_DAY && sitting.start > now.minutes,
    )
    if (tomorrow) {
      board.push(tomorrow)
    }
  }

  let nextTaken = false
  return board.map((sitting) => {
    if (serving(sitting)) {
      return { ...sitting, status: 'serving' as const }
    }
    if (sitting.end <= now.minutes) {
      return { ...sitting, status: 'finished' as const }
    }
    if (!nextTaken) {
      nextTaken = true
      return { ...sitting, status: 'next' as const }
    }
    return { ...sitting, status: 'later' as const }
  })
}

/** The sitting the headline is about: one being served, else the one to come. */
export function headlineSitting(
  schedule: ScheduledMeal[],
): ScheduledMeal | null {
  return (
    schedule.find((sitting) => sitting.status === 'serving') ??
    schedule.find((sitting) => sitting.status === 'next') ??
    null
  )
}

/**
 * How many rows stay readable from across a room. Derived from the space the
 * board gets once the masthead and banner have taken theirs, at a row size
 * that still carries.
 */
export const BOARD_CAPACITY = 6

/** A sitting the board must not drop whatever else has to go. */
function isEssential(sitting: ScheduledMeal): boolean {
  return sitting.status === 'serving' || sitting.status === 'next'
}

/**
 * Trim the board to what fits, by how much each sitting is worth keeping.
 *
 * A guest wants to know what is on now and what is coming, so anything being
 * served and the one coming next are never dropped. The room left over goes to
 * sittings still to come, soonest first, and then to finished ones, most recent
 * first: breakfast having ended four hours ago is the first thing worth losing.
 *
 * Dropping by position instead looks right while services run one after
 * another and fails where they overlap: a resort with six outlets open at once
 * pushed the next sitting off the end of the list.
 *
 * Such a resort can also have more essential sittings than the capacity. They
 * all stay and the rows shrink, which is the better failure of the two, since
 * a small row can be read and a missing one cannot.
 */
export function boardFor(
  schedule: ScheduledMeal[],
  capacity = BOARD_CAPACITY,
): ScheduledMeal[] {
  if (schedule.length <= capacity) {
    return schedule
  }

  const essential = schedule.filter(isEssential)
  const optional = schedule.filter((sitting) => !isEssential(sitting))
  const room = Math.max(0, capacity - essential.length)

  const keep = new Set([
    ...essential,
    ...[
      ...optional.filter((sitting) => sitting.status === 'later'),
      ...optional.filter((sitting) => sitting.status === 'finished').reverse(),
    ].slice(0, room),
  ])

  return schedule.filter((sitting) => keep.has(sitting))
}

/**
 * The list under the banner, which leaves out the sitting the banner is
 * already showing: repeating it directly below, in the same words, reads as a
 * mistake rather than as emphasis.
 */
export function listFor(
  schedule: ScheduledMeal[],
  capacity = BOARD_CAPACITY,
): ScheduledMeal[] {
  const featured = headlineSitting(schedule)
  return boardFor(
    schedule.filter((sitting) => sitting !== featured),
    capacity,
  )
}
