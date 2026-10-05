import './style.css'
import '@screenly/edge-apps/components'
import {
  getMetadata,
  getSetting,
  getSettingWithDefault,
  getTimeZone,
  setupErrorHandling,
  setupTheme,
  signalReady,
} from '@screenly/edge-apps'

import { now } from './clock.js'
import { displayLocale, formatLongDate } from './format.js'
import { parseMeals } from './meals.js'
import {
  fitDynamicText,
  renderBoard,
  renderFailure,
  renderHeadline,
  renderNotice,
  renderToday,
  rowCapacity,
  type Display,
} from './panels.js'
import { listFor, scheduleFor } from './schedule.js'
import { inkOnAccent, parseAccentColor, resolveTheme } from './theme.js'
import { zonedNow } from './timezone.js'

/**
 * How often the board is redrawn. The countdowns are in whole minutes, so this
 * only has to be fine enough that one never looks stale.
 */
const REFRESH_MS = 15000

/**
 * Pick the theme, then the accent.
 *
 * `accent_color` always wins. Failing that the account's branding colour is
 * used in the modern themes, which are deliberately neutral and take a brand
 * well. The classic themes keep their own bronze or gold: someone choosing one
 * has picked a palette, and dropping an unrelated brand colour into it undoes
 * the thing they chose it for.
 */
function applyAppearance(brandingAccent: string | undefined): void {
  const root = document.documentElement

  // The account's own light/dark lives in `theme`, which the library reads for
  // its branding colours, so this app's own choice is `board_theme`.
  const theme = resolveTheme(
    getSettingWithDefault<string>('board_theme', 'modern-dark'),
    getSetting<string>('theme'),
  )
  root.dataset.theme = theme

  // The library's setupTheme() swaps a missing accent for Screenly purple, so
  // the raw setting is read instead: absent means the theme keeps its own.
  const branding = theme.startsWith('modern') ? brandingAccent : undefined
  const accent =
    parseAccentColor(getSettingWithDefault<string>('accent_color', '')) ??
    (branding ? parseAccentColor(branding) : null)

  // Clear first: without this an accent set for one theme survives a switch to
  // another and shadows the palette that theme brings.
  root.style.removeProperty('--accent')
  root.style.removeProperty('--accent-ink')

  if (accent) {
    root.style.setProperty('--accent', accent)
    root.style.setProperty('--accent-ink', inkOnAccent(accent))
  }
}

interface Settings {
  venue: string
  timeZone: string
  display: Display
  meals: string
}

function readSettings(timeZone: string): Settings {
  const clockFormat = getSettingWithDefault<string>('clock_format', '24h')
  const venue = getSettingWithDefault<string>('venue_name', '').trim()

  return {
    venue: venue || getMetadata().location?.split(',')[0]?.trim() || '',
    timeZone,
    display: {
      locale: displayLocale(clockFormat),
      hour12: clockFormat === '12h',
    },
    // The sample day lives in screenly.yml as the setting's default.
    meals: getSettingWithDefault<string>('meals', ''),
  }
}

function render(settings: Settings): void {
  const instant = now()
  const { meals, problems } = parseMeals(settings.meals)
  const schedule = scheduleFor(meals, zonedNow(instant, settings.timeZone))

  renderToday(
    instant,
    settings.venue,
    settings.timeZone,
    settings.display,
    formatLongDate(instant, settings.display.locale, settings.timeZone),
  )
  renderHeadline(schedule, settings.display)
  // The banner is drawn first: what is left over decides how many rows fit.
  renderBoard(
    listFor(schedule, rowCapacity()),
    settings.display,
    meals.length > 0,
  )
  renderNotice(problems)

  fitDynamicText()
  // Once after layout, and again when the fonts land: their metrics decide the
  // row heights the board is being fitted to.
  requestAnimationFrame(fitDynamicText)
  document.fonts?.ready.then(fitDynamicText)
}

document.addEventListener('DOMContentLoaded', async () => {
  setupErrorHandling()
  setupTheme()
  const brandingAccent = () => getSetting<string>('screenly_color_accent')
  applyAppearance(brandingAccent())

  try {
    const timeZone = await getTimeZone()
    // Re-read on every draw so the development panel's edits take effect.
    const draw = () => {
      applyAppearance(brandingAccent())
      render(readSettings(timeZone))
    }

    draw()
    setInterval(draw, REFRESH_MS)

    if (import.meta.env.DEV) {
      const { mountDevSettings } = await import('./dev-settings.js')
      mountDevSettings({
        current: () => {
          const instant = now()
          return { instant, local: zonedNow(instant, timeZone), timeZone }
        },
        onChange: draw,
      })
    }

    let resizeTimer: number | undefined
    window.addEventListener('resize', () => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(draw, 150)
    })
  } catch (error) {
    // Say so on the screen before calling it ready. A board that comes up blank
    // and reports itself fine is a deployment that looks healthy and is not.
    console.error('Failed to initialize Meal Schedules', error)
    renderFailure(error)
  }

  signalReady()
})
