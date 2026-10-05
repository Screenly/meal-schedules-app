import { describe, expect, test } from 'bun:test'
import { inkOnAccent, parseAccentColor, resolveTheme, THEMES } from './theme.js'

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

describe('ink on the accent', () => {
  test('dark text on a pale accent', () => {
    expect(inkOnAccent('#ffb43a')).toBe('#0d1017')
    expect(inkOnAccent('#ffffff')).toBe('#0d1017')
  })

  test('white text on a deep accent', () => {
    // Screenly's own brand purple, which dark text does not survive.
    expect(inkOnAccent('#972eff')).toBe('#ffffff')
    expect(inkOnAccent('#000000')).toBe('#ffffff')
  })

  test('falls back to dark ink when the colour is unreadable', () => {
    expect(inkOnAccent('nonsense')).toBe('#0d1017')
  })
})
