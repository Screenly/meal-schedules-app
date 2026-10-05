/**
 * A development panel for driving the board: every setting, plus the clock.
 *
 * It lives in a shadow root. The board is themed down to its type and colour
 * through custom properties on the document, and a panel sitting in the same
 * tree would inherit all of it and bleed its own styles back. A shadow root
 * keeps the two apart, which is the whole reason to reach for one here.
 *
 * Settings are written straight into `screenly.settings`, the same object the
 * app reads, so changing one here is exactly what changing it in the console
 * would do. Mounted only by the dev server; the production bundle has none of
 * this in it.
 */

import { instantAt, isClockOverridden, setClockOverride } from './clock.js'
import { THEMES } from './theme.js'
import type { Now } from './schedule.js'

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

const STYLES = `
  :host {
    position: fixed;
    z-index: 2147483000;
    right: 16px;
    bottom: 16px;
    width: 330px;
    color: #e9edf5;
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    font-size: 12px;
    line-height: 1.4;
  }

  .shell {
    display: flex;
    flex-direction: column;
    gap: 10px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 10px;
    background: rgba(10, 13, 20, 0.94);
    padding: 12px;
    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(14px);
  }

  /* Collapsed, only the title bar is left, still on its own dark ground. */
  :host([hidden-panel]) .body {
    display: none;
  }

  :host([hidden-panel]) {
    width: auto;
  }

  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .footer {
    padding-top: 2px;
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .title {
    color: rgba(233, 237, 245, 0.5);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
  }

  button {
    border: 1px solid rgba(255, 255, 255, 0.22);
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.06);
    padding: 4px 10px;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }

  button:hover {
    background: rgba(255, 255, 255, 0.14);
  }

  button.on {
    border-color: rgba(126, 231, 135, 0.6);
    background: rgba(126, 231, 135, 0.18);
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    color: rgba(233, 237, 245, 0.56);
  }

  input,
  select,
  textarea {
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.05);
    padding: 5px 7px;
    color: #e9edf5;
    font: inherit;
    color-scheme: dark;
  }

  textarea {
    min-height: 92px;
    resize: vertical;
    white-space: pre;
  }

  .row {
    display: grid;
    gap: 8px;
    grid-template-columns: 1fr 1fr;
  }

  .when {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .when input[type='range'] {
    flex: 1;
    padding: 0;
    accent-color: #7ee787;
  }

  .readout {
    min-width: 54px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
`

const TEMPLATE = `
  <div class="shell">
    <div class="bar">
      <span class="title">Settings</span>
      <button data-toggle></button>
    </div>
    <div class="body">
    <label>
      Theme
      <select data-setting="board_theme">
        ${THEMES.map((theme) => `<option value="${theme}">${theme}</option>`).join('')}
        <option value="auto">auto</option>
      </select>
    </label>

    <div class="row">
      <label>
        Clock
        <select data-setting="clock_format">
          <option value="24h">24h</option>
          <option value="12h">12h</option>
        </select>
      </label>
      <label>
        Accent
        <input data-setting="accent_color" placeholder="#a06e47" />
      </label>
    </div>

    <label>
      Venue
      <input data-setting="venue_name" />
    </label>

    <label>
      Meals
      <textarea data-setting="meals" spellcheck="false"></textarea>
    </label>

    <label>
      Day
      <select data-weekday>
        ${WEEKDAYS.map((day, index) => `<option value="${index}">${day}</option>`).join('')}
      </select>
    </label>

    <label>
      Time
      <span class="when">
        <input type="range" min="0" max="1439" step="5" data-minutes />
        <span class="readout" data-readout></span>
      </span>
    </label>

    <div class="bar footer">
      <button data-live>Live</button>
      <button data-reload>Reload</button>
    </div>
    </div>
  </div>
`

export interface DevSettingsOptions {
  /** The moment the board is drawing, for seeding the day and time controls. */
  current: () => { instant: Date; local: Now }
  /** Redraw after a setting or the clock has changed. */
  onChange: () => void
}

export class DevSettings extends HTMLElement {
  private readonly options: DevSettingsOptions
  private readonly root: ShadowRoot
  private collapsed = false

  constructor(options: DevSettingsOptions) {
    super()
    this.options = options
    this.root = this.attachShadow({ mode: 'open' })
    this.root.innerHTML = `<style>${STYLES}</style>${TEMPLATE}`

    this.seed()
    this.wire()
  }

  /** Fill the controls from the settings and the clock as they stand. */
  private seed(): void {
    const settings = window.screenly?.settings ?? {}

    for (const field of this.fields()) {
      const name = field.dataset.setting!
      field.value = String(settings[name] ?? '')
    }

    const { local } = this.options.current()
    this.weekday.value = String(local.weekday)
    this.minutes.value = String(local.minutes)
    this.paint()
  }

  private wire(): void {
    for (const field of this.fields()) {
      const event = field.tagName === 'SELECT' ? 'change' : 'input'
      field.addEventListener(event, () => {
        const settings = window.screenly?.settings
        if (settings) {
          settings[field.dataset.setting!] = field.value
        }
        this.options.onChange()
      })
    }

    const scrub = () => {
      const { instant, local } = this.options.current()
      setClockOverride(
        instantAt(instant, local, {
          minutes: Number(this.minutes.value),
          weekday: Number(this.weekday.value),
        }),
      )
      this.options.onChange()
      this.paint()
    }

    this.minutes.addEventListener('input', scrub)
    this.weekday.addEventListener('change', scrub)

    this.button('[data-live]').addEventListener('click', () => {
      setClockOverride(null)
      this.options.onChange()
      this.seed()
    })

    this.button('[data-reload]').addEventListener('click', () => {
      window.location.reload()
    })

    this.button('[data-toggle]').addEventListener('click', () => {
      this.collapsed = !this.collapsed
      this.toggleAttribute('hidden-panel', this.collapsed)
      this.paint()
    })
  }

  /** Refresh the readout and the button labels. */
  private paint(): void {
    const minutes = Number(this.minutes.value)
    const hours = String(Math.floor(minutes / 60)).padStart(2, '0')
    const rest = String(minutes % 60).padStart(2, '0')
    this.readout.textContent = `${hours}:${rest}`

    this.button('[data-toggle]').textContent = this.collapsed ? 'Show' : 'Hide'
    this.button('[data-live]').classList.toggle('on', !isClockOverridden())
  }

  private fields(): HTMLInputElement[] {
    return Array.from(
      this.root.querySelectorAll<HTMLInputElement>('[data-setting]'),
    )
  }

  private get minutes(): HTMLInputElement {
    return this.root.querySelector<HTMLInputElement>('[data-minutes]')!
  }

  private get weekday(): HTMLSelectElement {
    return this.root.querySelector<HTMLSelectElement>('[data-weekday]')!
  }

  private get readout(): HTMLElement {
    return this.root.querySelector<HTMLElement>('[data-readout]')!
  }

  private button(selector: string): HTMLButtonElement {
    return this.root.querySelector<HTMLButtonElement>(selector)!
  }
}

export function mountDevSettings(options: DevSettingsOptions): DevSettings {
  if (!customElements.get('meal-dev-settings')) {
    customElements.define('meal-dev-settings', DevSettings)
  }

  const panel = new DevSettings(options)
  document.body.appendChild(panel)
  return panel
}
