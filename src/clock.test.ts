import { describe, expect, test } from 'bun:test'
import { instantAt, isClockOverridden, now, setClockOverride } from './clock.js'
import { zonedNow } from './timezone.js'

describe('the clock', () => {
  test('follows the system until it is overridden', () => {
    expect(isClockOverridden()).toBe(false)
    expect(Math.abs(now().getTime() - Date.now())).toBeLessThan(1000)

    setClockOverride(new Date('2026-10-07T09:00:00Z'))
    expect(isClockOverridden()).toBe(true)
    expect(now().toISOString()).toBe('2026-10-07T09:00:00.000Z')

    setClockOverride(null)
    expect(isClockOverridden()).toBe(false)
  })
})

describe('scrubbing to a weekday and time', () => {
  const reference = new Date('2026-10-07T12:00:00Z') // a Wednesday

  test('lands on the asked for weekday and time', () => {
    const current = zonedNow(reference, 'UTC')
    const target = { minutes: 8 * 60 + 30, weekday: 6 }
    const landed = zonedNow(instantAt(reference, current, target), 'UTC')

    expect(landed).toEqual(target)
  })

  test('works backwards through the week as well', () => {
    const current = zonedNow(reference, 'UTC')
    const target = { minutes: 22 * 60, weekday: 0 }
    const landed = zonedNow(instantAt(reference, current, target), 'UTC')

    expect(landed).toEqual(target)
  })

  test('steps the short way round the week', () => {
    // From a Sunday, Saturday is yesterday, not six days off.
    const sunday = new Date('2026-10-04T12:00:00Z')
    const current = zonedNow(sunday, 'UTC')
    const saturday = instantAt(sunday, current, {
      minutes: 12 * 60,
      weekday: 6,
    })

    expect(saturday.toISOString().slice(0, 10)).toBe('2026-10-03')
    expect(zonedNow(saturday, 'UTC').weekday).toBe(6)
  })

  test('and the other way across the same boundary', () => {
    const saturday = new Date('2026-10-10T12:00:00Z')
    const current = zonedNow(saturday, 'UTC')
    const sunday = instantAt(saturday, current, {
      minutes: 12 * 60,
      weekday: 0,
    })

    expect(sunday.toISOString().slice(0, 10)).toBe('2026-10-11')
    expect(zonedNow(sunday, 'UTC').weekday).toBe(0)
  })

  test('never steps more than three days either way', () => {
    const reference = new Date('2026-10-07T12:00:00Z')
    const current = zonedNow(reference, 'UTC')

    for (let weekday = 0; weekday < 7; weekday += 1) {
      const landed = instantAt(reference, current, {
        minutes: 12 * 60,
        weekday,
      })
      const days = (landed.getTime() - reference.getTime()) / 86400000

      expect(Math.abs(days)).toBeLessThanOrEqual(3)
      expect(zonedNow(landed, 'UTC').weekday).toBe(weekday)
    }
  })

  test('holds in a timezone away from UTC', () => {
    const current = zonedNow(reference, 'Asia/Dubai')
    const target = { minutes: 60, weekday: 5 }
    const landed = zonedNow(instantAt(reference, current, target), 'Asia/Dubai')

    expect(landed).toEqual(target)
  })
})
