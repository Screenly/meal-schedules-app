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

/** Text that stays legible on top of a filled accent. */
const DARK_INK = '#0d1017'
const LIGHT_INK = '#ffffff'

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

/**
 * Ink for text sitting on the accent, picked so the filled chip stays readable
 * whether the brand colour is a pale yellow or a deep purple.
 */
export function inkOnAccent(accent: string): string {
  const colour = parseAccentColor(accent)
  if (!colour) {
    return DARK_INK
  }
  return luminance(colour) > 0.42 ? DARK_INK : LIGHT_INK
}
