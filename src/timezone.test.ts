import { describe, expect, test } from 'bun:test'
import { zonedNow } from './timezone.js'

describe('the local moment', () => {
  test('minutes since midnight in the screen timezone', () => {
    const instant = new Date('2026-10-04T12:00:00Z')
    expect(zonedNow(instant, 'UTC').minutes).toBe(12 * 60)
    expect(zonedNow(instant, 'Europe/Berlin').minutes).toBe(14 * 60)
    expect(zonedNow(instant, 'America/New_York').minutes).toBe(8 * 60)
  })

  test('the weekday follows the timezone across midnight', () => {
    // Sunday 23:00 in New York is already Monday in London.
    const instant = new Date('2026-10-05T03:00:00Z')
    expect(zonedNow(instant, 'America/New_York').weekday).toBe(0)
    expect(zonedNow(instant, 'Europe/London').weekday).toBe(1)
  })

  test('midnight reads as zero, not as the end of the day', () => {
    const instant = new Date('2026-10-04T00:00:00Z')
    expect(zonedNow(instant, 'UTC').minutes).toBe(0)
  })

  test('every day of the week maps to its own index', () => {
    const seen = new Set<number>()
    for (let day = 4; day <= 10; day += 1) {
      const date = String(day).padStart(2, '0')
      seen.add(zonedNow(new Date(`2026-10-${date}T12:00:00Z`), 'UTC').weekday)
    }
    expect(seen.size).toBe(7)
    // 4 October 2026 is a Sunday.
    expect(zonedNow(new Date('2026-10-04T12:00:00Z'), 'UTC').weekday).toBe(0)
  })
})
