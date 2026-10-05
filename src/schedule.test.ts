import { describe, expect, test } from 'bun:test'
import { MINUTES_PER_DAY, parseMeals } from './meals.js'
import { zonedNow } from './timezone.js'
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

  /** A resort with half a dozen outlets open at the same time. */
  const resort = parseMeals(`
    Breakfast | 07:00 | 12:00 | Main
    Coffee | 08:00 | 12:00 | Lobby
    Brunch | 09:00 | 13:00 | Terrace
    Pool grill | 10:00 | 17:00 | Poolside
    Lounge menu | 10:30 | 18:00 | Lounge
    Deli | 11:00 | 15:00 | Deli
    Afternoon tea | 15:00 | 17:30 | Drawing Room
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
    for (const meals of [busy, resort]) {
      for (let hour = 0; hour < 24; hour += 1) {
        const now = { minutes: hour * 60, weekday: WEDNESDAY }
        const full = scheduleFor(meals, now)
        const board = boardFor(full)

        for (const sitting of full) {
          if (sitting.status === 'serving' || sitting.status === 'next') {
            expect(board).toContainEqual(sitting)
          }
        }
      }
    }
  })
})

describe('what the board keeps when there is not room for everything', () => {
  /** A resort with half a dozen outlets open at the same time. */
  const resort = parseMeals(`
    Breakfast | 07:00 | 12:00 | Main
    Coffee | 08:00 | 12:00 | Lobby
    Brunch | 09:00 | 13:00 | Terrace
    Pool grill | 10:00 | 17:00 | Poolside
    Lounge menu | 10:30 | 18:00 | Lounge
    Deli | 11:00 | 15:00 | Deli
    Afternoon tea | 15:00 | 17:30 | Drawing Room
  `).meals

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

  test('keeps the next sitting when the outlets overlap past capacity', () => {
    // Six services open at once: dropping by position pushed the next sitting
    // off the end, because it starts last.
    const full = scheduleFor(resort, {
      minutes: 11 * 60 + 30,
      weekday: WEDNESDAY,
    })
    const board = boardFor(full)

    expect(full).toHaveLength(7)
    expect(board.map((sitting) => sitting.meal.name)).toContain('Afternoon tea')
    expect(board.find((sitting) => sitting.status === 'next')).toBeDefined()
  })

  test('more essential sittings than room keeps them all', () => {
    const board = boardFor(
      scheduleFor(resort, { minutes: 11 * 60 + 30, weekday: WEDNESDAY }),
      4,
    )

    expect(board).toHaveLength(7)
    expect(board.every((sitting) => sitting.status !== 'finished')).toBe(true)
  })

  test('the room left over goes to what is coming before what is over', () => {
    const full = scheduleFor(busy, { minutes: 14 * 60, weekday: WEDNESDAY })
    const board = boardFor(full, 4)

    const statuses = board.map((sitting) => sitting.status)
    expect(
      statuses.filter((status) => status === 'later').length,
    ).toBeGreaterThan(0)
    expect(board).toHaveLength(4)
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

  test('takes the room it is given', () => {
    // The board asks the layout how many rows fit before it fills them, so a
    // screen with less space than the default has to be honoured.
    const schedule = scheduleFor(HOTEL, {
      minutes: 9 * 60,
      weekday: WEDNESDAY,
    })

    expect(listFor(schedule, 2)).toHaveLength(2)
    expect(listFor(schedule, 1)).toHaveLength(1)
  })
})

describe('countdowns to another day', () => {
  const weekly = parseMeals(
    'Monday roast | 12:00 | 15:00 | Oak Room | Mon',
  ).meals

  test('a sitting most of a week out counts the whole way', () => {
    // From a Tuesday, Monday is six days ahead. Resolving it against the
    // nearest Monday found yesterday's instead and counted backwards.
    const instant = new Date('2026-06-09T10:00:00Z')
    const schedule = scheduleFor(weekly, zonedNow(instant, 'Europe/London'))

    expect(schedule[0]!.startsIn).toBe(6 * 24 * 60 + 60)
  })

  test('every day of the week it could fall on', () => {
    for (let day = 0; day < 7; day += 1) {
      const instant = new Date(Date.UTC(2026, 5, 8 + day, 10, 0, 0))
      const now = zonedNow(instant, 'Europe/London')
      const sitting = scheduleFor(weekly, now)[0]!
      const zoneless = scheduleFor(weekly, {
        minutes: now.minutes,
        weekday: now.weekday,
      })[0]!

      // June is a settled month in London, so the two have to agree.
      expect(sitting.startsIn).toBe(zoneless.startsIn)
      expect(sitting.startsIn).toBeGreaterThan(-MINUTES_PER_DAY)
    }
  })
})

describe('countdowns across a clock change', () => {
  const nightService = parseMeals('Night service | 00:00 | 03:00 | Bar').meals

  test('count the time that will actually elapse', () => {
    // London's clocks go forward at 01:00 on 29 March 2026, so the three hour
    // service runs for two.
    const at = new Date('2026-03-29T00:30:00Z')
    const board = scheduleFor(nightService, zonedNow(at, 'Europe/London'))

    expect(board[0]!.endsIn).toBe(90)
  })

  test('and when the clocks go back', () => {
    // 25 October 2026 repeats an hour, so the same service runs for four.
    // London is still on summer time at this point, so 00:30 local is 23:30Z.
    const at = new Date('2026-10-24T23:30:00Z')
    const board = scheduleFor(nightService, zonedNow(at, 'Europe/London'))

    expect(board[0]!.endsIn).toBe(210)
  })

  test('an ordinary day is unaffected', () => {
    const at = new Date('2026-03-22T00:30:00Z')
    const board = scheduleFor(nightService, zonedNow(at, 'Europe/London'))

    expect(board[0]!.endsIn).toBe(150)
  })

  test('a start is counted the same way', () => {
    const evening = parseMeals('Breakfast | 07:00 | 10:00').meals
    const at = new Date('2026-03-29T00:30:00Z')
    const board = scheduleFor(evening, zonedNow(at, 'Europe/London'))

    // 00:30 GMT to 07:00 BST is five and a half hours, not six and a half.
    expect(board[0]!.startsIn).toBe(330)
  })
})

describe('where a status changes', () => {
  const lunch = parseMeals('Lunch | 12:00 | 15:00 | Oak Room').meals
  const statusAt = (hour: number, minute: number, second: number) =>
    scheduleFor(
      lunch,
      zonedNow(new Date(Date.UTC(2026, 5, 10, hour, minute, second)), 'UTC'),
    )[0]!

  test('on the minute it was set to, not within half a minute of it', () => {
    // Rounding the countdown to whole minutes opened a sitting up to thirty
    // seconds early and closed it thirty seconds early too.
    expect(statusAt(11, 59, 31).status).toBe('next')
    expect(statusAt(11, 59, 59).status).toBe('next')
    expect(statusAt(12, 0, 0).status).toBe('serving')

    expect(statusAt(14, 59, 31).status).toBe('serving')
    expect(statusAt(14, 59, 59).status).toBe('serving')
    expect(statusAt(15, 0, 0).status).toBe('finished')
  })

  test('the countdown measures to the minute, seconds and all', () => {
    expect(statusAt(11, 59, 30).startsIn).toBeCloseTo(0.5, 5)
    expect(statusAt(11, 45, 0).startsIn).toBe(15)
  })

  test('the jump is found to the millisecond whenever it is asked about', () => {
    // London jumps at exactly 01:00:00Z. A bisection stopping a minute wide
    // answered with whatever second the question was asked at.
    const gapped = parseMeals('Night service | 00:00 | 01:30 | Bar').meals

    for (const second of [0, 7, 23, 41, 59]) {
      const at = new Date(Date.UTC(2026, 2, 29, 0, 45, second))
      const sitting = scheduleFor(gapped, zonedNow(at, 'Europe/London'))[0]!
      const endsAt = at.getTime() + sitting.endsIn * 60_000

      expect(endsAt).toBe(Date.UTC(2026, 2, 29, 1, 0, 0))
    }
  })
})

describe('a local time the clocks skip or repeat', () => {
  test('a time the clocks skip counts to the jump, never backwards', () => {
    // London goes from 01:00 to 02:00 on 29 March 2026, so 01:30 never
    // happens. At 00:45 the service is still being served and ends when the
    // clocks pass the time it was set to end at, a quarter of an hour later.
    const gapped = parseMeals('Night service | 00:00 | 01:30 | Bar').meals
    const instant = new Date('2026-03-29T00:45:00Z')
    const sitting = scheduleFor(gapped, zonedNow(instant, 'Europe/London'))[0]!

    expect(sitting.status).toBe('serving')
    expect(sitting.endsIn).toBe(15)
  })

  test('a sitting that starts in the gap counts forward too', () => {
    const gapped = parseMeals('Early start | 01:30 | 04:00 | Bar').meals
    const instant = new Date('2026-03-29T00:15:00Z')
    const sitting = scheduleFor(gapped, zonedNow(instant, 'Europe/London'))[0]!

    // 01:00Z is when the clocks jump, 45 minutes after 00:15Z.
    expect(sitting.startsIn).toBe(45)
    expect(sitting.endsIn).toBeGreaterThan(sitting.startsIn)
  })

  test('no countdown points backwards through the gap', () => {
    const gapped = parseMeals('Night service | 00:00 | 01:30 | Bar').meals

    for (let minute = 0; minute < 120; minute += 5) {
      const instant = new Date(Date.UTC(2026, 2, 29, 0, minute, 0))
      const now = zonedNow(instant, 'Europe/London')
      for (const sitting of scheduleFor(gapped, now)) {
        if (sitting.status === 'serving' || sitting.status === 'next') {
          expect(sitting.endsIn).toBeGreaterThanOrEqual(0)
        }
      }
    }
  })

  test('a service cannot open again when an hour repeats', () => {
    // London's clocks go back at 02:00 on 25 October 2026, so 01:00 to 01:59
    // local runs twice. A service ending at 01:30 was finished on the first
    // pass and serving again on the second.
    const gapped = parseMeals('Night service | 00:00 | 01:30 | Bar').meals
    const statusAt = (minute: number) =>
      scheduleFor(
        gapped,
        zonedNow(
          new Date(Date.UTC(2026, 9, 25, 0, minute, 0)),
          'Europe/London',
        ),
      ).find((sitting) => sitting.meal.name === 'Night service')?.status

    expect(statusAt(15)).toBe('serving')
    expect(statusAt(45)).toBe('finished')
    // 01:00Z is the repeated 01:00, an hour after the first one.
    expect(statusAt(60)).toBe('finished')
    expect(statusAt(75)).toBe('finished')
  })

  test('a countdown only ever runs down', () => {
    const gapped = parseMeals('Night service | 00:00 | 01:30 | Bar').meals
    let previous = Number.POSITIVE_INFINITY

    for (let minute = 0; minute <= 240; minute += 5) {
      const now = zonedNow(
        new Date(Date.UTC(2026, 9, 25, 0, minute, 0)),
        'Europe/London',
      )
      const sitting = scheduleFor(gapped, now).find(
        (entry) => entry.meal.name === 'Night service',
      )
      if (!sitting) {
        continue
      }

      expect(sitting.endsIn).toBeLessThan(previous)
      previous = sitting.endsIn
    }
  })
})
