import { describe, expect, test } from 'bun:test'
import { parseMeals } from './meals.js'
import { boardFor, headlineSitting, listFor, scheduleFor } from './schedule.js'

const HOTEL = parseMeals(`
  Breakfast | 06:30 | 10:30 | Garden Restaurant
  Lunch | 12:00 | 15:00
  Dinner | 18:30 | 22:00 | Main Hall
`).meals

/** Wednesday. */
const WEDNESDAY = 3

const at = (hours: number, minutes = 0, weekday = WEDNESDAY) =>
  scheduleFor(HOTEL, { minutes: hours * 60 + minutes, weekday })

describe('the board through a day', () => {
  test('before anything opens, breakfast is next', () => {
    const board = at(5)
    expect(board.map((sitting) => sitting.status)).toEqual([
      'next',
      'later',
      'later',
    ])
    expect(board[0]!.startsIn).toBe(90)
  })

  test('during breakfast it is being served and lunch is next', () => {
    const board = at(8)
    expect(board.map((sitting) => sitting.status)).toEqual([
      'serving',
      'next',
      'later',
    ])
    expect(board[0]!.endsIn).toBe(150)
  })

  test('between sittings the finished one stays on the board', () => {
    const board = at(11)
    expect(board.map((sitting) => sitting.status)).toEqual([
      'finished',
      'next',
      'later',
    ])
  })

  test('after the last sitting, tomorrow breakfast is next', () => {
    const board = at(23)
    expect(board.map((sitting) => sitting.status)).toEqual([
      'finished',
      'finished',
      'finished',
      'next',
    ])
    // 06:30 tomorrow, seven and a half hours away.
    expect(board[3]!.startsIn).toBe(450)
    expect(board[3]!.meal.name).toBe('Breakfast')
  })

  test('only ever one next', () => {
    for (let hour = 0; hour < 24; hour += 1) {
      const nexts = at(hour).filter((sitting) => sitting.status === 'next')
      expect(nexts.length).toBeLessThanOrEqual(1)
    }
  })
})

describe('services that cross midnight', () => {
  const meals = parseMeals(
    'Dinner | 18:00 | 22:00\nLate bar | 22:00 | 01:00',
  ).meals

  test('still being served after midnight', () => {
    const board = scheduleFor(meals, { minutes: 30, weekday: WEDNESDAY })
    const serving = board.filter((sitting) => sitting.status === 'serving')

    expect(serving).toHaveLength(1)
    expect(serving[0]!.meal.name).toBe('Late bar')
    // Began at 22:00 yesterday, ends in half an hour.
    expect(serving[0]!.start).toBe(-120)
    expect(serving[0]!.endsIn).toBe(30)
  })

  test('and listed again in its own right later the same day', () => {
    const board = scheduleFor(meals, { minutes: 30, weekday: WEDNESDAY })
    expect(
      board.filter((sitting) => sitting.meal.name === 'Late bar'),
    ).toHaveLength(2)
  })
})

describe('days of the week', () => {
  const meals = parseMeals(`
    Breakfast | 7 | 10
    Brunch | 10 | 14 | Terrace | Sat, Sun
    Business lunch | 12 | 15 | | Mon-Fri
  `).meals

  test('a weekday board leaves out the weekend sitting', () => {
    const names = scheduleFor(meals, { minutes: 9 * 60, weekday: 3 }).map(
      (sitting) => sitting.meal.name,
    )
    expect(names).toEqual(['Breakfast', 'Business lunch'])
  })

  test('a Sunday board leaves out the weekday sitting', () => {
    const names = scheduleFor(meals, { minutes: 9 * 60, weekday: 0 }).map(
      (sitting) => sitting.meal.name,
    )
    expect(names).toEqual(['Breakfast', 'Brunch'])
  })

  test('on Friday night the next sitting is the daily breakfast', () => {
    const board = scheduleFor(meals, { minutes: 23 * 60, weekday: 5 })
    const next = board.find((sitting) => sitting.status === 'next')
    // Saturday's brunch is on the board, but breakfast comes first.
    expect(next!.meal.name).toBe('Breakfast')
    expect(next!.startsIn).toBe(8 * 60)
  })

  test('on Saturday morning brunch is what follows breakfast', () => {
    const board = scheduleFor(meals, { minutes: 9 * 60, weekday: 6 })
    expect(board.map((sitting) => sitting.status)).toEqual(['serving', 'next'])
    expect(board[1]!.meal.name).toBe('Brunch')
  })
})

describe('the headline', () => {
  test('prefers what is being served', () => {
    expect(headlineSitting(at(8))!.meal.name).toBe('Breakfast')
  })

  test('falls back to what is next', () => {
    expect(headlineSitting(at(11))!.meal.name).toBe('Lunch')
  })

  test('is null when there is nothing at all', () => {
    expect(
      headlineSitting(scheduleFor([], { minutes: 0, weekday: 0 })),
    ).toBeNull()
  })
})

describe('trimming the board to what fits', () => {
  const busy = parseMeals(`
    Early riser coffee | 05:30 | 07:00 | Lobby
    Breakfast | 06:30 | 10:30 | Garden Restaurant
    Brunch | 10:00 | 13:00 | Terrace
    Business lunch | 12:00 | 15:00 | Oak Room
    Afternoon tea | 15:00 | 17:30 | Drawing Room
    Dinner | 18:30 | 22:00 | Main Hall
    Late bar | 22:00 | 01:00 | Library
    Night menu | 23:00 | 02:00 | Library
  `).meals

  test('a short schedule is left alone', () => {
    const board = scheduleFor(HOTEL, { minutes: 14 * 60, weekday: WEDNESDAY })
    expect(boardFor(board)).toEqual(board)
  })

  test('drops finished sittings oldest first', () => {
    const board = boardFor(
      scheduleFor(busy, { minutes: 14 * 60 + 49, weekday: WEDNESDAY }),
    )

    expect(board).toHaveLength(6)
    // Coffee and breakfast are long over; brunch only just ended.
    expect(board.map((sitting) => sitting.meal.name)).toEqual([
      'Brunch',
      'Business lunch',
      'Afternoon tea',
      'Dinner',
      'Late bar',
      'Night menu',
    ])
  })

  test('never drops what is being served or what is next', () => {
    for (let hour = 0; hour < 24; hour += 1) {
      const board = boardFor(
        scheduleFor(busy, { minutes: hour * 60, weekday: WEDNESDAY }),
      )
      const full = scheduleFor(busy, { minutes: hour * 60, weekday: WEDNESDAY })

      for (const sitting of full) {
        if (sitting.status === 'serving' || sitting.status === 'next') {
          expect(board).toContainEqual(sitting)
        }
      }
    }
  })

  test('keeps the soonest when everything is still to come', () => {
    const board = boardFor(
      scheduleFor(busy, { minutes: 4 * 60, weekday: WEDNESDAY }),
    )
    expect(board).toHaveLength(6)
    expect(board[0]!.meal.name).toBe('Early riser coffee')
  })
})

describe('the list under the banner', () => {
  test('leaves out the sitting the banner is showing', () => {
    const schedule = scheduleFor(HOTEL, {
      minutes: 8 * 60,
      weekday: WEDNESDAY,
    })
    const list = listFor(schedule)

    expect(headlineSitting(schedule)!.meal.name).toBe('Breakfast')
    expect(list.map((sitting) => sitting.meal.name)).toEqual([
      'Lunch',
      'Dinner',
    ])
  })

  test('the same holds when the banner is counting down to the next one', () => {
    const schedule = scheduleFor(HOTEL, {
      minutes: 11 * 60,
      weekday: WEDNESDAY,
    })
    const list = listFor(schedule)

    expect(headlineSitting(schedule)!.meal.name).toBe('Lunch')
    expect(list.map((sitting) => sitting.meal.name)).toEqual([
      'Breakfast',
      'Dinner',
    ])
  })

  test('nothing is ever shown twice', () => {
    for (let hour = 0; hour < 24; hour += 1) {
      const schedule = scheduleFor(HOTEL, {
        minutes: hour * 60,
        weekday: WEDNESDAY,
      })
      const featured = headlineSitting(schedule)
      expect(listFor(schedule)).not.toContain(featured)
    }
  })
})
