import { describe, expect, test } from 'bun:test'
import {
  displayLocale,
  formatClock,
  formatDuration,
  formatRange,
} from './format.js'

describe('clock times', () => {
  test('24 hour pads the hour', () => {
    expect(formatClock(390, 'en-GB', false)).toBe('06:30')
    expect(formatClock(0, 'en-GB', false)).toBe('00:00')
  })

  test('12 hour keeps am and pm', () => {
    expect(formatClock(390, 'en-US', true)).toMatch(/6:30\s*AM/)
    expect(formatClock(1140, 'en-US', true)).toMatch(/7:00\s*PM/)
  })

  test('a service running past midnight wraps', () => {
    expect(formatClock(1500, 'en-GB', false)).toBe('01:00')
  })
})

describe('ranges', () => {
  test('both ends on a 24 hour clock', () => {
    expect(formatRange(390, 630, 'en-GB', false)).toMatch(/06:30.*10:30/)
  })

  test('crossing midnight shows times, never dates', () => {
    const range = formatRange(1320, 1500, 'en-GB', false)
    expect(range).toMatch(/22:00.*01:00/)
    expect(range).not.toMatch(/\d{4}|\/|Jan/)
  })

  test('a 12 hour range keeps both meridiems', () => {
    expect(formatRange(390, 630, 'en-US', true)).toMatch(
      /6:30\s*AM.*10:30\s*AM/,
    )
  })
})

describe('durations', () => {
  test('under an hour', () => {
    expect(formatDuration(40)).toBe('40 min')
    expect(formatDuration(1)).toBe('1 min')
    expect(formatDuration(0)).toBe('0 min')
  })

  test('an hour and over', () => {
    expect(formatDuration(60)).toBe('1 h')
    expect(formatDuration(135)).toBe('2 h 15')
    expect(formatDuration(65)).toBe('1 h 05')
  })

  test('never goes negative', () => {
    expect(formatDuration(-10)).toBe('0 min')
  })
})

describe('locale', () => {
  test('the setting picks the conventions', () => {
    expect(displayLocale('12h')).toBe('en-US')
    expect(displayLocale('24h')).toBe('en-GB')
    expect(displayLocale('')).toBe('en-GB')
  })
})
