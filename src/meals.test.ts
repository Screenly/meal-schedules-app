import { describe, expect, test } from 'bun:test'
import { parseDays, parseMeals, parseTimeOfDay } from './meals.js'

describe('reading a time', () => {
  test('the ways people write a 24 hour time', () => {
    expect(parseTimeOfDay('7')).toBe(420)
    expect(parseTimeOfDay('07:00')).toBe(420)
    expect(parseTimeOfDay('7:30')).toBe(450)
    expect(parseTimeOfDay('7.30')).toBe(450)
    expect(parseTimeOfDay(' 19:45 ')).toBe(1185)
    expect(parseTimeOfDay('00:00')).toBe(0)
    expect(parseTimeOfDay('24:00')).toBe(1440)
  })

  test('the ways people write a 12 hour time', () => {
    expect(parseTimeOfDay('7am')).toBe(420)
    expect(parseTimeOfDay('7 AM')).toBe(420)
    expect(parseTimeOfDay('7:30pm')).toBe(1170)
    expect(parseTimeOfDay('12am')).toBe(0)
    expect(parseTimeOfDay('12pm')).toBe(720)
    expect(parseTimeOfDay('12:30am')).toBe(30)
  })

  test('rejects what is not a time', () => {
    for (const text of ['', 'noon', '25:00', '7:60', '13pm', '0pm', '7:5']) {
      expect(parseTimeOfDay(text)).toBeNull()
    }
  })
})

describe('reading days', () => {
  test('names and abbreviations', () => {
    expect(parseDays('Mon')).toEqual(new Set([1]))
    expect(parseDays('monday')).toEqual(new Set([1]))
    expect(parseDays('Sat, Sun')).toEqual(new Set([6, 0]))
    expect(parseDays('Mon,Wed,Fri')).toEqual(new Set([1, 3, 5]))
  })

  test('ranges, including ones that wrap the week', () => {
    expect(parseDays('Mon-Fri')).toEqual(new Set([1, 2, 3, 4, 5]))
    expect(parseDays('Fri-Mon')).toEqual(new Set([5, 6, 0, 1]))
    expect(parseDays('Sun-Sat')).toEqual(new Set([0, 1, 2, 3, 4, 5, 6]))
  })

  test('the words people actually use', () => {
    expect(parseDays('daily')).toEqual(new Set([0, 1, 2, 3, 4, 5, 6]))
    expect(parseDays('Weekdays')).toEqual(new Set([1, 2, 3, 4, 5]))
    expect(parseDays('weekends')).toEqual(new Set([0, 6]))
  })

  test('nothing readable means every day', () => {
    expect(parseDays('')).toBeNull()
    expect(parseDays('   ')).toBeNull()
    expect(parseDays('whenever')).toBeNull()
  })
})

describe('reading a schedule', () => {
  test('a typical hotel board', () => {
    const { meals, problems } = parseMeals(`
      Breakfast | 06:30 | 10:30 | Garden Restaurant
      Lunch | 12:00 | 15:00
      Dinner | 18:30 | 22:00 | Main Hall
    `)

    expect(problems).toEqual([])
    expect(meals).toHaveLength(3)
    expect(meals[0]).toMatchObject({
      name: 'Breakfast',
      start: 390,
      end: 630,
      location: 'Garden Restaurant',
      days: null,
    })
    expect(meals[1]!.location).toBeNull()
  })

  test('sorts by start time whatever order they are written in', () => {
    const { meals } = parseMeals('Dinner|18:00|22:00\nBreakfast|7:00|10:00')
    expect(meals.map((meal) => meal.name)).toEqual(['Breakfast', 'Dinner'])
  })

  test('a service running past midnight ends the next day', () => {
    const { meals } = parseMeals('Late bar | 22:00 | 01:00')
    expect(meals[0]!.start).toBe(1320)
    expect(meals[0]!.end).toBe(1500)
  })

  test('skips blank lines and comments', () => {
    const { meals, problems } = parseMeals(
      '# winter times\n\nBrunch | 9 | 13\n\n',
    )
    expect(meals).toHaveLength(1)
    expect(problems).toEqual([])
  })

  test('reports bad lines rather than dropping them', () => {
    const { meals, problems } = parseMeals(
      'Breakfast | 7:00 | 10:00\nLunch | noon | 3pm\nDinner | 18:00\n| 1 | 2',
    )

    expect(meals.map((meal) => meal.name)).toEqual(['Breakfast'])
    expect(problems).toHaveLength(3)
    expect(problems[0]).toContain('not a time')
    expect(problems[1]).toContain('needs a start and an end')
    expect(problems[2]).toContain('Missing a name')
  })

  test('an extra pipe is reported, not quietly dropped', () => {
    // The days would otherwise be lost and the meal served every day.
    const { meals, problems } = parseMeals(
      'Lunch | 12 | 15 | Oak Room | | Mon-Fri',
    )

    expect(meals).toHaveLength(0)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('too many fields')
  })

  test('a full five field line is still accepted', () => {
    const { meals, problems } = parseMeals(
      'Lunch | 12 | 15 | Oak Room | Mon-Fri',
    )

    expect(problems).toEqual([])
    expect(meals[0]!.days).toEqual(new Set([1, 2, 3, 4, 5]))
  })

  test('days limit a meal to part of the week', () => {
    const { meals } = parseMeals('Brunch | 9 | 13 | Terrace | Sat, Sun')
    expect(meals[0]!.days).toEqual(new Set([6, 0]))
  })
})
