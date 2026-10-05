/**
 * Reading the meal schedule out of the `meals` setting.
 *
 * The people who edit this are front of house staff typing into a settings
 * box, not developers, so the format is one meal per line with pipes between
 * the fields and everything after the name optional:
 *
 *   Breakfast | 06:30 | 10:30 | Garden Restaurant | Mon-Fri
 *   Lunch     | 12:00 | 15:00
 *   Dinner    | 18:30 | 22:00 | Main Hall
 *
 * Parsing is forgiving about how a time or a day is written, and reports what
 * it could not read instead of dropping it silently: a meal missing from a
 * board in a hotel lobby is worse than a visible complaint about one line.
 */

/** Minutes from local midnight. An end past midnight runs beyond 1440. */
export interface Meal {
  name: string
  start: number
  end: number
  location: string | null
  /** Weekdays it is served on, Sunday first. Null means every day. */
  days: Set<number> | null
}

export interface ParsedSchedule {
  meals: Meal[]
  /** One line per unreadable entry, for showing on screen. */
  problems: string[]
}

export const MINUTES_PER_DAY = 1440

const DAY_NAMES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]

const DAY_GROUPS: Record<string, number[]> = {
  daily: [0, 1, 2, 3, 4, 5, 6],
  everyday: [0, 1, 2, 3, 4, 5, 6],
  weekdays: [1, 2, 3, 4, 5],
  weekends: [0, 6],
}

function dayIndex(token: string): number | null {
  const cleaned = token.trim().toLowerCase()
  if (!cleaned) {
    return null
  }
  const index = DAY_NAMES.findIndex((day) => day.startsWith(cleaned))
  return index === -1 ? null : index
}

/**
 * "Mon-Fri", "Sat, Sun", "weekends", "daily". Returns null for an empty field,
 * meaning every day, and for anything it cannot read, which the caller reports.
 */
export function parseDays(text: string): Set<number> | null {
  const cleaned = text.trim().toLowerCase()
  if (!cleaned) {
    return null
  }

  const group = DAY_GROUPS[cleaned.replace(/\s+/g, '')]
  if (group) {
    return new Set(group)
  }

  const days = new Set<number>()
  for (const part of cleaned.split(/[,/]/)) {
    const range = part.split('-')
    if (range.length === 2) {
      const from = dayIndex(range[0]!)
      const to = dayIndex(range[1]!)
      if (from === null || to === null) {
        return null
      }
      // Ranges wrap, so Fri-Mon is four days rather than an error.
      for (let step = 0; step <= (to - from + 7) % 7; step += 1) {
        days.add((from + step) % 7)
      }
    } else {
      const day = dayIndex(part)
      if (day === null) {
        return null
      }
      days.add(day)
    }
  }

  return days.size > 0 ? days : null
}

/**
 * "7", "7:30", "7.30", "07:30", "7am", "7:30 PM", "19:30". Returns minutes from
 * midnight, or null if it is not a time.
 */
export function parseTimeOfDay(text: string): number | null {
  const cleaned = text.trim().toLowerCase().replace(/\s+/g, '')
  const match = cleaned.match(/^(\d{1,2})(?:[:.](\d{2}))?(am|pm)?$/)
  if (!match) {
    return null
  }

  let hours = Number(match[1])
  const minutes = match[2] ? Number(match[2]) : 0
  const meridiem = match[3]

  if (minutes > 59) {
    return null
  }

  if (meridiem) {
    if (hours < 1 || hours > 12) {
      return null
    }
    if (meridiem === 'am' && hours === 12) {
      hours = 0
    }
    if (meridiem === 'pm' && hours !== 12) {
      hours += 12
    }
  } else if (hours > 24) {
    return null
  }

  const total = hours * 60 + minutes
  return total > MINUTES_PER_DAY ? null : total
}

function parseLine(line: string): { meal?: Meal; problem?: string } {
  const [name, start, end, location, days] = line
    .split('|')
    .map((f) => f.trim())

  if (!name) {
    return { problem: `Missing a name: "${line.trim()}"` }
  }
  if (!start || !end) {
    return { problem: `${name} needs a start and an end time` }
  }

  const startMinutes = parseTimeOfDay(start)
  const endMinutes = parseTimeOfDay(end)
  if (startMinutes === null) {
    return { problem: `${name}: "${start}" is not a time` }
  }
  if (endMinutes === null) {
    return { problem: `${name}: "${end}" is not a time` }
  }
  // 24:00 is the end of a day, never the start of one.
  if (startMinutes === MINUTES_PER_DAY) {
    return { problem: `${name}: "${start}" cannot be a start time` }
  }

  const servedOn = days ? parseDays(days) : null
  if (days && servedOn === null) {
    return { problem: `${name}: "${days}" is not a day or a range of days` }
  }

  return {
    meal: {
      name,
      start: startMinutes,
      // An end at or before the start runs past midnight.
      end:
        endMinutes > startMinutes ? endMinutes : endMinutes + MINUTES_PER_DAY,
      location: location || null,
      days: servedOn,
    },
  }
}

/** Read the whole setting. Blank lines and lines starting with # are ignored. */
export function parseMeals(text: string): ParsedSchedule {
  const meals: Meal[] = []
  const problems: string[] = []

  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const { meal, problem } = parseLine(line)
    if (meal) {
      meals.push(meal)
    } else if (problem) {
      problems.push(problem)
    }
  }

  meals.sort((a, b) => a.start - b.start)
  return { meals, problems }
}
