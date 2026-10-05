/**
 * Turning a schedule into what the board shows right now.
 *
 * Everything is counted in minutes from the start of today, so a service that
 * began yesterday evening and is still running at one in the morning has a
 * negative start and still reads as being served.
 */

import { MINUTES_PER_DAY, type Meal } from './meals.js'

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
        startsIn: start - now.minutes,
        endsIn: end - now.minutes,
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

/**
 * Trim the board to what fits, dropping finished sittings oldest first.
 *
 * A guest wants to know what is on now and what is coming. Breakfast having
 * ended four hours ago is the first thing worth losing, and losing it keeps
 * the remaining rows large enough to read from the far side of a lobby.
 */
export function boardFor(
  schedule: ScheduledMeal[],
  capacity = BOARD_CAPACITY,
): ScheduledMeal[] {
  if (schedule.length <= capacity) {
    return schedule
  }

  const trimmed = [...schedule]
  while (trimmed.length > capacity) {
    const finished = trimmed.findIndex(
      (sitting) => sitting.status === 'finished',
    )
    if (finished === -1) {
      break
    }
    trimmed.splice(finished, 1)
  }

  // Still too many sittings still to come: keep the soonest.
  return trimmed.slice(0, capacity)
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
