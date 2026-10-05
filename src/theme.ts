/**
 * Which way round the board is drawn, and what colour the highlights are.
 *
 * The accent normally comes from the account's Screenly branding. A venue whose
 * brand is not the account's can override it per screen, and since the console
 * has no colour picker it arrives as typed text.
 */

/**
 * Two tones in two styles. Modern is flat and sans, for a city hotel or a
 * canteen. Classic sets the names in a serif over cream or deep brown, which
 * is where a palace hotel lives: see theleela.com, whose board would look
 * wrong in anything else.
 */
export const THEMES = [
  'modern-dark',
  'modern-light',
  'classic-dark',
  'classic-light',
] as const

export type Theme = (typeof THEMES)[number]

function isTheme(value: string): value is Theme {
  return (THEMES as readonly string[]).includes(value)
}

/**
 * One of the four, or `auto` to take the tone from the account's own theme
 * setting in the modern style. Anything unrecognised stays on the default.
 */
export function resolveTheme(
  setting: string,
  accountTheme: string | undefined,
): Theme {
  if (isTheme(setting)) {
    return setting
  }
  if (setting === 'auto') {
    return accountTheme === 'light' ? 'modern-light' : 'modern-dark'
  }
  return 'modern-dark'
}

/**
 * A hex colour someone typed into the settings box, with or without the hash
 * and in either the short or long form. Null for anything else, which leaves
 * the branding colour in place rather than painting the board an odd colour.
 */
export function parseAccentColor(text: string): string | null {
  const cleaned = text.trim().replace(/^#/, '')

  if (!/^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(cleaned)) {
    return null
  }

  const full =
    cleaned.length === 3
      ? cleaned
          .split('')
          .map((channel) => channel + channel)
          .join('')
      : cleaned

  return `#${full.toLowerCase()}`
}

/** Relative luminance, the sRGB part of the WCAG contrast definition. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })

  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!
}

/** WCAG contrast ratio between two colours, 1:1 to 21:1. */
function contrast(one: string, other: string): number {
  const [brighter, darker] = [luminance(one), luminance(other)].sort(
    (a, b) => b - a,
  )
  return (brighter! + 0.05) / (darker! + 0.05)
}

/**
 * The accent is only ever text at 36px bold or larger, which WCAG counts as
 * large and asks 3:1 of. Holding it to the 4.5:1 of body text would repaint
 * palettes that are fine: the classic bronze on cream is 4.11:1 and Screenly's
 * own purple on the dark board 3.76:1.
 */
const TEXT_CONTRAST = 3

/** Blend towards white or black, 0 for the colour itself and 1 for the target. */
function mix(hex: string, towards: string, amount: number): string {
  const channels = [1, 3, 5].map((offset) => {
    const from = parseInt(hex.slice(offset, offset + 2), 16)
    const to = parseInt(towards.slice(offset, offset + 2), 16)
    return Math.round(from + (to - from) * amount)
      .toString(16)
      .padStart(2, '0')
  })

  return `#${channels.join('')}`
}

/**
 * The accent, lightened or darkened until it can be read against the surface
 * behind it.
 *
 * The accent is a brand colour typed into a settings box, and nothing stops it
 * being the colour of the board it is written on: #0d1017 on the dark theme
 * leaves the banner's status label and the serving meal's name invisible.
 * Filling a shape with the accent is safe, so --accent is left alone and this
 * is used only where the accent is the text itself.
 */
export function accentText(accent: string, surface: string): string {
  const colour = parseAccentColor(accent)
  const behind = parseAccentColor(surface)
  if (!colour || !behind) {
    return accent
  }
  if (contrast(colour, behind) >= TEXT_CONTRAST) {
    return colour
  }

  // Away from the surface: towards white on a dark board, black on a light one.
  const towards = luminance(behind) > 0.18 ? '#000000' : '#ffffff'
  for (let amount = 0.05; amount < 1; amount += 0.05) {
    const candidate = mix(colour, towards, amount)
    if (contrast(candidate, behind) >= TEXT_CONTRAST) {
      return candidate
    }
  }

  return towards
}
