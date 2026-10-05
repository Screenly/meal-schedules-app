/**
 * Drawing the board. Every function takes the schedule for one instant, so a
 * redraw is a straight overwrite.
 */

import { escapeText } from './escape.js'
import { fitToWidth } from './fit-text.js'
import {
  clockFormatter,
  formatClock,
  formatDuration,
  formatRange,
} from './format.js'
import {
  BOARD_CAPACITY,
  headlineSitting,
  type ScheduledMeal,
} from './schedule.js'

/**
 * The floors the fitter will not shrink past. The size it starts from is read
 * from the stylesheet, so a theme that sets its own stays in charge of it.
 */
const VENUE_MIN_SIZE = 34
const HEADLINE_MIN_SIZE = 56

export interface Display {
  locale: string
  hour12: boolean
}

export function element<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector)
  if (!found) {
    throw new Error(`Missing element: ${selector}`)
  }
  return found
}

/** The banner: what is being served, or what is coming and when. */
export function headlineText(
  sitting: ScheduledMeal | null,
  display: Display,
): { status: string; name: string; detail: string; progress: number | null } {
  if (!sitting) {
    return { status: '', name: '', detail: '', progress: null }
  }

  const { meal, status, start, end, startsIn, endsIn } = sitting
  const clock = (minutes: number) =>
    formatClock(minutes, display.locale, display.hour12)
  // Where to go is the next thing a guest needs after what and when.
  const where = meal.location ? `${meal.location} · ` : ''

  if (status === 'serving') {
    // Both ends of the bar come from the countdowns rather than the clock
    // times beside it: the wall clock span of a service running through a
    // clock change is not the time that passes during it.
    const total = endsIn - startsIn
    const elapsed = total > 0 ? -startsIn / total : 1
    return {
      status: 'Serving now',
      name: meal.name,
      detail: `${where}Until ${clock(end)} · ${formatDuration(endsIn)} left`,
      progress: Math.min(Math.max(elapsed, 0), 1),
    }
  }

  return {
    status: 'Next',
    name: meal.name,
    detail: `${where}From ${clock(start)} · in ${formatDuration(startsIn)}`,
    progress: null,
  }
}

export function renderHeadline(
  schedule: ScheduledMeal[],
  display: Display,
): void {
  const banner = element<HTMLElement>('[data-headline]')
  const sitting = headlineSitting(schedule)

  banner.hidden = sitting === null
  if (!sitting) {
    return
  }

  const { status, name, detail, progress } = headlineText(sitting, display)
  element('[data-headline-status]').textContent = status
  element('[data-headline-name]').textContent = name
  element('[data-headline-detail]').textContent = detail

  const track = element<HTMLElement>('[data-headline-track]')
  track.hidden = progress === null
  if (progress !== null) {
    element<HTMLElement>('[data-headline-progress]').style.width =
      `${(progress * 100).toFixed(1)}%`
  }
}

function sittingRow(sitting: ScheduledMeal, display: Display): string {
  const { meal, status, start, end } = sitting
  const location = meal.location
    ? `<div class="sitting-location">${escapeText(meal.location)}</div>`
    : ''

  // No badge: the banner above says what is being served and what is next.
  // Nothing in the list is picked out except that what is over fades.
  return `
    <div class="sitting is-${status}">
      <div class="sitting-title">
        <div class="sitting-name">${escapeText(meal.name)}</div>
        ${location}
      </div>
      <div class="sitting-leader" aria-hidden="true"></div>
      <div class="sitting-time">${escapeText(
        formatRange(start, end, display.locale, display.hour12),
      )}</div>
    </div>
  `
}

/**
 * `configured` says whether any meals are set up at all: an empty list on a
 * day with no sittings is not a reason to ask for the schedule to be typed in.
 */
export function renderBoard(
  schedule: ScheduledMeal[],
  display: Display,
  configured = false,
): void {
  const board = element<HTMLElement>('[data-board]')

  if (schedule.length === 0 && configured) {
    board.innerHTML = ''
    return
  }

  if (schedule.length === 0) {
    board.innerHTML = `
      <div class="empty">
        <div class="empty-title">No meals set up yet</div>
        <div class="empty-hint">
          Add them in the app settings, one per line:<br />
          Breakfast | 06:30 | 10:30 | Garden Restaurant
        </div>
      </div>
    `
    return
  }

  board.innerHTML = `<div class="board-rows" data-board-rows>${schedule
    .map((sitting) => sittingRow(sitting, display))
    .join('')}</div>`
}

/** Anything the schedule could not read, shown rather than swallowed. */
export function renderNotice(problems: string[]): void {
  const notice = element<HTMLElement>('[data-notice]')
  notice.hidden = problems.length === 0
  notice.textContent = problems.join(' · ')
}

export function renderToday(
  now: Date,
  venue: string,
  timeZone: string,
  display: Display,
  longDate: string,
): void {
  element('[data-venue]').textContent = venue
  element('[data-clock]').textContent = clockFormatter(
    display.locale,
    display.hour12,
    timeZone,
  ).format(now)
  element('[data-date]').textContent = longDate
}

/**
 * Floors for the text inside a row. A name too long for its column is shrunk
 * rather than wrapped, so that the row keeps the height the board counted on.
 */
const ROW_NAME_MIN_SIZE = 30
const ROW_LOCATION_MIN_SIZE = 20

/**
 * A row at full size, in reference pixels, as the stylesheet lays it out. The
 * line boxes are fixed to these, so a row is this tall whatever it says.
 */
const ROW = { padding: 26, name: 68, time: 64, location: 34, gap: 6 }
const ROW_HEIGHT =
  ROW.padding * 2 + ROW.name * 1.1 + ROW.gap + ROW.location * 1.2 + 2
/** Below this the board stops being readable from across the room. */
const MIN_ROW_SCALE = 0.55

/**
 * How many rows the space left for the board can hold at the smallest size
 * still worth reading.
 *
 * Trimming to a fixed number and hoping it fits does not work: the board is
 * centred, so rows that overrun spill upwards into the banner as well as off
 * the bottom. Ask the layout instead, before the rows are drawn.
 */
export function rowCapacity(): number {
  const height = element<HTMLElement>('[data-board]').clientHeight
  if (!height) {
    return BOARD_CAPACITY
  }

  return Math.max(1, Math.floor(height / (ROW_HEIGHT * MIN_ROW_SCALE)))
}

/**
 * Size the rows to the space left for them.
 *
 * A board is three sittings at one hotel and eight at the next, and the rows
 * have to fit either way: the board is centred, so content taller than its box
 * overflows upwards as well as down and runs over the banner.
 */
export function fitBoardRows(): void {
  const board = element<HTMLElement>('[data-board]')
  const list = board.querySelector<HTMLElement>('[data-board-rows]')
  const rows = list?.querySelectorAll('.sitting').length ?? 0
  if (!list || rows === 0 || !board.clientHeight) {
    return
  }

  const apply = (scale: number) => {
    board.style.setProperty(
      '--row-padding',
      `${(ROW.padding * scale).toFixed(1)}px`,
    )
    board.style.setProperty('--row-name', `${(ROW.name * scale).toFixed(1)}px`)
    board.style.setProperty('--row-time', `${(ROW.time * scale).toFixed(1)}px`)
    board.style.setProperty(
      '--row-location',
      `${(ROW.location * scale).toFixed(1)}px`,
    )
    board.style.setProperty('--row-gap', `${(ROW.gap * scale).toFixed(1)}px`)
  }

  // Rows are separated by a hairline each, which the row height does not cover.
  const available = board.clientHeight - (rows - 1)
  let scale = Math.min(
    1,
    Math.max(MIN_ROW_SCALE, available / rows / ROW_HEIGHT),
  )
  apply(scale)

  // Line heights and borders round in ways the estimate above does not model,
  // so measure what landed and close the gap.
  // The board centres its rows, and a centred overflow spills above the box as
  // well as below it, where scrollHeight cannot see it. Measure the rows.
  for (let pass = 0; pass < 4; pass += 1) {
    const overflow = list.offsetHeight - board.clientHeight
    if (overflow <= 0 || scale <= MIN_ROW_SCALE) {
      return
    }
    scale = Math.max(
      MIN_ROW_SCALE,
      scale * (board.clientHeight / list.offsetHeight),
    )
    apply(scale)
  }
}

/** Shrink any name or location too long for its column onto one line. */
function fitRowText(): void {
  const fit = (selector: string, minimum: number) => {
    document
      .querySelectorAll<HTMLElement>(selector)
      .forEach((field) => fitToWidth(field, minimum))
  }

  fit('.sitting-name', ROW_NAME_MIN_SIZE)
  fit('.sitting-location', ROW_LOCATION_MIN_SIZE)
}

/**
 * Scale the parts that vary with the content. Run after the board is drawn and
 * again on the next frame: the first render happens before <auto-scaler> has
 * sized its box, and an unconstrained element reports no overflow to correct.
 */
export function fitDynamicText(): void {
  fitToWidth(element<HTMLElement>('[data-venue]'), VENUE_MIN_SIZE)
  fitToWidth(element<HTMLElement>('[data-headline-name]'), HEADLINE_MIN_SIZE)
  fitBoardRows()
  // After the rows are scaled, not before: what a name has to fit into is the
  // column at the size the fitter just settled on.
  fitRowText()
}

/**
 * What the screen says when the app could not start at all: the operator needs
 * to see that something is wrong, not a board that happens to be empty.
 */
export function renderFailure(error: unknown): void {
  const reason = error instanceof Error ? error.message : String(error)

  element<HTMLElement>('[data-headline]').hidden = true
  element<HTMLElement>('[data-board]').innerHTML = `
    <div class="empty">
      <div class="empty-title">Meal Schedules could not start</div>
      <div class="empty-hint">${escapeText(reason)}</div>
    </div>
  `
  renderNotice(['Check the app settings for this screen'])
}
