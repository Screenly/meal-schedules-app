import { test } from '@playwright/test'
import {
  captureScreenshot,
  createMockScreenlyForScreenshots,
  RESOLUTIONS,
} from '@screenly/edge-apps/test/screenshots'

import { THEMES, type Theme } from '../src/theme.js'

const MEALS = `Breakfast | 06:30 | 10:30 | Garden Restaurant
Business lunch | 12:00 | 15:00 | Oak Room | Mon-Fri
Afternoon tea | 15:00 | 17:30 | Drawing Room
Dinner | 18:30 | 22:00 | Main Hall
Late bar | 22:00 | 01:00 | Library`

const THEME_RESOLUTIONS = [
  { width: 1920, height: 1080 },
  { width: 1080, height: 1920 },
] as const

function screenlyJsFor(theme: Theme): string {
  return createMockScreenlyForScreenshots(
    {
      coordinates: ['51.5074', '-0.1278'] as unknown as [number, number],
      location: 'London, UK',
    },
    {
      venue_name: 'Hartwell House',
      board_theme: theme,
      clock_format: '24h',
      meals: MEALS,
    },
  ).screenlyJsContent
}

for (const { width, height } of RESOLUTIONS) {
  test(`screenshot ${width}x${height}`, async ({ browser }) => {
    await captureScreenshot(browser, {
      width,
      height,
      filenamePrefix: 'meal-schedules-app',
      screenlyJsContent: screenlyJsFor('modern-dark'),
    })
  })
}

for (const theme of THEMES) {
  for (const { width, height } of THEME_RESOLUTIONS) {
    test(`screenshot ${theme} ${width}x${height}`, async ({ browser }) => {
      await captureScreenshot(browser, {
        width,
        height,
        filenamePrefix: `meal-schedules-app-${theme}`,
        screenlyJsContent: screenlyJsFor(theme),
      })
    })
  }
}
