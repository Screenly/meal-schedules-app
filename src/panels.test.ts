import { beforeEach, describe, expect, test } from 'bun:test'
import { JSDOM } from 'jsdom'
import { readFileSync } from 'node:fs'

import { parseMeals } from './meals.js'
import {
  headlineText,
  renderBoard,
  renderFailure,
  renderHeadline,
  renderNotice,
  type Display,
} from './panels.js'
import { scheduleFor } from './schedule.js'
import { zonedNow } from './timezone.js'

/** The real markup, so a renamed data attribute fails the tests. */
const template = readFileSync(new URL('../index.html', import.meta.url), 'utf8')

const DISPLAY: Display = { locale: 'en-GB', hour12: false }
const WEDNESDAY = 3

const HOTEL = parseMeals(`
  Breakfast | 06:30 | 10:30 | Garden Restaurant
  Lunch | 12:00 | 15:00
  Dinner | 18:30 | 22:00 | Main Hall
`).meals

const boardAt = (hour: number) =>
  scheduleFor(HOTEL, { minutes: hour * 60, weekday: WEDNESDAY })

function mountPage(): void {
  globalThis.document = new JSDOM(template).window.document
}

const text = (selector: string) =>
  document.querySelector(selector)?.textContent?.trim() ?? ''

describe('the banner', () => {
  beforeEach(mountPage)

  test('names what is being served and how long is left', () => {
    renderHeadline(boardAt(8), DISPLAY)

    expect(text('[data-headline-status]')).toBe('Serving now')
    expect(text('[data-headline-name]')).toBe('Breakfast')
    expect(text('[data-headline-detail]')).toBe(
      'Garden Restaurant · Until 10:30 · 2 h 30 left',
    )
  })

  test('shows a progress bar only while something is being served', () => {
    renderHeadline(boardAt(8), DISPLAY)
    expect(
      document.querySelector<HTMLElement>('[data-headline-track]')!.hidden,
    ).toBe(false)

    mountPage()
    renderHeadline(boardAt(11), DISPLAY)
    expect(
      document.querySelector<HTMLElement>('[data-headline-track]')!.hidden,
    ).toBe(true)
  })

  test('counts down to the next sitting when nothing is on', () => {
    renderHeadline(boardAt(11), DISPLAY)

    expect(text('[data-headline-status]')).toBe('Next')
    expect(text('[data-headline-name]')).toBe('Lunch')
    // Lunch has nowhere named, so the detail starts with the time.
    expect(text('[data-headline-detail]')).toBe('From 12:00 · in 1 h')
  })

  test('is hidden when there is nothing to say', () => {
    renderHeadline([], DISPLAY)
    expect(document.querySelector<HTMLElement>('[data-headline]')!.hidden).toBe(
      true,
    )
  })

  test('the progress runs from nothing to full across a sitting', () => {
    const atStart = headlineText(boardAt(7)[0]!, DISPLAY).progress
    const atEnd = headlineText(boardAt(10)[0]!, DISPLAY).progress

    expect(atStart).toBeGreaterThan(0)
    expect(atStart).toBeLessThan(0.3)
    expect(atEnd).toBeGreaterThan(0.85)
    expect(atEnd).toBeLessThanOrEqual(1)
  })

  test('the bar agrees with the time beside it across a clock change', () => {
    // London goes forward at 01:00 on 29 March 2026, so a 00:00 to 03:00
    // service runs for two hours. At 00:30 a quarter of it has gone, though
    // the clock times either side of it still read three hours apart.
    const night = parseMeals('Night service | 00:00 | 03:00 | Bar').meals
    const instant = new Date('2026-03-29T00:30:00Z')
    const sitting = scheduleFor(night, zonedNow(instant, 'Europe/London'))[0]!
    const { progress, detail } = headlineText(sitting, DISPLAY)

    expect(sitting.status).toBe('serving')
    expect(progress).toBeCloseTo(0.25, 2)
    expect(detail).toContain('1 h 30 left')
  })
})

describe('the board', () => {
  beforeEach(mountPage)

  test('the leader for a menu card is there for the classic themes to use', () => {
    renderBoard(boardAt(8), DISPLAY)
    expect(document.querySelectorAll('.sitting-leader')).toHaveLength(3)
  })

  test('rows carry no badge: the banner says what is being served', () => {
    renderBoard(boardAt(8), DISPLAY)
    expect(document.querySelectorAll('.sitting-chip')).toHaveLength(0)
    expect(text('.sitting')).not.toContain('Serving')
  })

  test('a row for each sitting, with its times and where it is', () => {
    renderBoard(boardAt(8), DISPLAY)

    expect(document.querySelectorAll('.sitting')).toHaveLength(3)
    expect(text('.sitting .sitting-name')).toBe('Breakfast')
    expect(text('.sitting .sitting-time')).toBe('06:30 – 10:30')
    expect(text('.sitting .sitting-location')).toBe('Garden Restaurant')
  })

  test('marks what is being served, what is next and what is done', () => {
    renderBoard(boardAt(8), DISPLAY)
    const classes = [...document.querySelectorAll('.sitting')].map(
      (row) => row.className,
    )

    expect(classes[0]).toContain('is-serving')
    expect(classes[1]).toContain('is-next')
    expect(classes[2]).toContain('is-later')
  })

  test('a sitting with nowhere named leaves the line out', () => {
    renderBoard(boardAt(13), DISPLAY)
    const lunch = document.querySelectorAll('.sitting')[1]!
    expect(lunch.querySelector('.sitting-location')).toBeNull()
  })

  test('says so when nothing is set up', () => {
    renderBoard([], DISPLAY)
    expect(text('.empty-title')).toContain('No meals')
    expect(document.querySelectorAll('.sitting')).toHaveLength(0)
  })

  test('escapes what someone typed into the settings', () => {
    const { meals } = parseMeals('<script>alert(1)</script> | 7 | 8')
    renderBoard(
      scheduleFor(meals, { minutes: 450, weekday: WEDNESDAY }),
      DISPLAY,
    )

    expect(document.querySelector('[data-board]')!.innerHTML).not.toContain(
      '<script>',
    )
    expect(text('.sitting-name')).toContain('alert(1)')
  })
})

describe('the notice', () => {
  beforeEach(mountPage)

  test('stays out of the way when the schedule reads cleanly', () => {
    renderNotice([])
    expect(document.querySelector<HTMLElement>('[data-notice]')!.hidden).toBe(
      true,
    )
  })

  test('shows what could not be read', () => {
    renderNotice(['Lunch: "noon" is not a time'])
    expect(document.querySelector<HTMLElement>('[data-notice]')!.hidden).toBe(
      false,
    )
    expect(text('[data-notice]')).toContain('not a time')
  })
})

describe('when the app cannot start', () => {
  beforeEach(mountPage)

  test('says so on the screen rather than coming up blank', () => {
    renderFailure(new Error('Unknown timezone: Mars/Olympus'))

    expect(text('.empty-title')).toContain('could not start')
    expect(text('.empty-hint')).toContain('Mars/Olympus')
    expect(document.querySelector<HTMLElement>('[data-headline]')!.hidden).toBe(
      true,
    )
    expect(document.querySelector<HTMLElement>('[data-notice]')!.hidden).toBe(
      false,
    )
  })

  test('copes with something thrown that is not an Error', () => {
    renderFailure('settings unreadable')
    expect(text('.empty-hint')).toContain('settings unreadable')
  })

  test('escapes whatever the message happens to contain', () => {
    renderFailure(new Error('<img onerror=alert(1)>'))
    expect(document.querySelector('[data-board]')!.innerHTML).not.toContain(
      '<img',
    )
  })
})
