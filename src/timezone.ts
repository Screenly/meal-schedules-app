/**
 * Where the screen is in its own day: the minutes since local midnight and the
 * weekday, which is all the schedule needs.
 */

import type { Now } from './schedule.js'

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
  }
}
