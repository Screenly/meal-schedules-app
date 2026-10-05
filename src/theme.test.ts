import { describe, expect, test } from 'bun:test'
import { accentText, parseAccentColor, resolveTheme, THEMES } from './theme.js'

describe('choosing a theme', () => {
  test('a named theme is taken as it stands', () => {
    for (const theme of THEMES) {
      expect(resolveTheme(theme, 'light')).toBe(theme)
    }
  })

  test('auto takes the tone from the account, in the modern style', () => {
    expect(resolveTheme('auto', 'light')).toBe('modern-light')
    expect(resolveTheme('auto', 'dark')).toBe('modern-dark')
    expect(resolveTheme('auto', undefined)).toBe('modern-dark')
  })

  test('anything unrecognised stays on the default', () => {
    expect(resolveTheme('', 'light')).toBe('modern-dark')
    expect(resolveTheme('nonsense', undefined)).toBe('modern-dark')
  })
})

describe('reading a typed colour', () => {
  test('the ways people write a hex colour', () => {
    expect(parseAccentColor('#ffb43a')).toBe('#ffb43a')
    expect(parseAccentColor('ffb43a')).toBe('#ffb43a')
    expect(parseAccentColor('  #FFB43A  ')).toBe('#ffb43a')
    expect(parseAccentColor('#fb3')).toBe('#ffbb33')
  })

  test('leaves the branding colour alone for anything else', () => {
    for (const text of ['', 'orange', '#12345', 'rgb(1,2,3)', '#gggggg']) {
      expect(parseAccentColor(text)).toBeNull()
    }
  })
})

describe('the accent used as text', () => {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map((offset) => {
      const value = parseInt(hex.slice(offset, offset + 2), 16) / 255
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!
  }
  const contrast = (a: string, b: string) => {
    const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (high! + 0.05) / (low! + 0.05)
  }

  /** The surfaces the four themes paint behind it. */
  const SURFACES = ['#0d1017', '#f6f7f9', '#fbf8f1', '#1a1611']

  test('the themes keep the accents they ship with', () => {
    // 10.73:1, 3.65:1, 4.11:1 and 7.44:1 against their own surfaces. None is
    // body text, so none of them is touched.
    expect(accentText('#ffb43a', '#0d1017')).toBe('#ffb43a')
    expect(accentText('#b8700a', '#f6f7f9')).toBe('#b8700a')
    expect(accentText('#a06e47', '#fbf8f1')).toBe('#a06e47')
    expect(accentText('#c9a227', '#1a1611')).toBe('#c9a227')
  })

  test('and so does the Screenly branding purple', () => {
    expect(accentText('#972eff', '#0d1017')).toBe('#972eff')
  })

  test('an accent the colour of the board is pulled off it', () => {
    // The dark theme's own surface as the accent: 1:1, and invisible.
    const text = accentText('#0d1017', '#0d1017')

    expect(text).not.toBe('#0d1017')
    expect(contrast(text, '#0d1017')).toBeGreaterThanOrEqual(3)
  })

  test('readable on every theme whatever the accent', () => {
    const accents = [
      '#000000',
      '#333333',
      '#777777',
      '#999999',
      '#bbbbbb',
      '#ffffff',
      '#972eff',
      '#a06e47',
      '#c9a227',
      '#ffb43a',
      '#0d1017',
      '#1a1611',
      '#f6f7f9',
    ]

    for (const surface of SURFACES) {
      for (const accent of accents) {
        expect(
          contrast(accentText(accent, surface), surface),
        ).toBeGreaterThanOrEqual(3)
      }
    }
  })

  test('moves the colour no further than it has to', () => {
    // A dark red on the dark board goes lighter rather than straight to white.
    const text = accentText('#7a1f1f', '#0d1017')

    expect(text).not.toBe('#ffffff')
    expect(contrast(text, '#0d1017')).toBeGreaterThanOrEqual(3)
  })

  test('leaves a colour it cannot read alone', () => {
    expect(accentText('nonsense', '#0d1017')).toBe('nonsense')
    expect(accentText('#ffb43a', 'nonsense')).toBe('#ffb43a')
  })
})
