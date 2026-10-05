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
    const target = { minutes: 8 * 60 + 30, weekday: 6 }
    const landed = zonedNow(instantAt(reference, 'UTC', target), 'UTC')

    expect(landed).toEqual(target)
  })

  test('works backwards through the week as well', () => {
    const target = { minutes: 22 * 60, weekday: 0 }
    const landed = zonedNow(instantAt(reference, 'UTC', target), 'UTC')

    expect(landed).toEqual(target)
  })

  test('steps the short way round the week', () => {
    // From a Sunday, Saturday is yesterday, not six days off.
    const sunday = new Date('2026-10-04T12:00:00Z')
    const saturday = instantAt(sunday, 'UTC', {
      minutes: 12 * 60,
      weekday: 6,
    })

    expect(saturday.toISOString().slice(0, 10)).toBe('2026-10-03')
    expect(zonedNow(saturday, 'UTC').weekday).toBe(6)
  })

  test('and the other way across the same boundary', () => {
    const saturday = new Date('2026-10-10T12:00:00Z')
    const sunday = instantAt(saturday, 'UTC', {
      minutes: 12 * 60,
      weekday: 0,
    })

    expect(sunday.toISOString().slice(0, 10)).toBe('2026-10-11')
    expect(zonedNow(sunday, 'UTC').weekday).toBe(0)
  })

  test('never steps more than three days either way', () => {
    const reference = new Date('2026-10-07T12:00:00Z')

    for (let weekday = 0; weekday < 7; weekday += 1) {
      const landed = instantAt(reference, 'UTC', {
        minutes: 12 * 60,
        weekday,
      })
      const days = (landed.getTime() - reference.getTime()) / 86400000

      expect(Math.abs(days)).toBeLessThanOrEqual(3)
      expect(zonedNow(landed, 'UTC').weekday).toBe(weekday)
    }
  })

  test('holds in a timezone away from UTC', () => {
    const target = { minutes: 60, weekday: 5 }
    const landed = zonedNow(
      instantAt(reference, 'Asia/Dubai', target),
      'Asia/Dubai',
    )

    expect(landed).toEqual(target)
  })
})

describe('scrubbing across a clock change', () => {
  test('lands on the asked for time when the clocks go forward', () => {
    // London's clocks go forward in the small hours of Sunday 29 March 2026,
    // so that local day is 23 hours long.
    const saturday = new Date('2026-03-28T12:00:00Z')
    const target = { minutes: 12 * 60, weekday: 0 }
    const landed = zonedNow(
      instantAt(saturday, 'Europe/London', target),
      'Europe/London',
    )

    expect(landed).toEqual(target)
  })

  test('and when they go back', () => {
    // 25 October 2026 is 25 hours long in London.
    const saturday = new Date('2026-10-24T12:00:00Z')
    const target = { minutes: 12 * 60, weekday: 0 }
    const landed = zonedNow(
      instantAt(saturday, 'Europe/London', target),
      'Europe/London',
    )

    expect(landed).toEqual(target)
  })

  test('every weekday and hour of a transition week is reachable', () => {
    const reference = new Date('2026-03-25T12:00:00Z')

    for (let weekday = 0; weekday < 7; weekday += 1) {
      for (const hour of [0, 6, 12, 18, 23]) {
        const target = { minutes: hour * 60, weekday }
        const landed = zonedNow(
          instantAt(reference, 'Europe/London', target),
          'Europe/London',
        )

        // 01:00 on the Sunday does not exist; everything else is exact.
        if (!(weekday === 0 && hour === 0)) {
          expect(landed).toEqual(target)
        }
      }
    }
  })
})
