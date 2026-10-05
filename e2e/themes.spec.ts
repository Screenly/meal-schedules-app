import { test } from '@playwright/test'
import {
  createMockScreenlyForScreenshots,
  setupClockMock,
  setupScreenlyJsMock,
} from '@screenly/edge-apps/test/screenshots'
import fs from 'fs'
import path from 'path'

import { THEMES } from '../src/theme.js'

const OUTPUT_DIR = path.resolve(process.cwd(), 'theme-screenshots')

/** Mid morning on a Monday: breakfast being served, the business lunch next. */
const WHEN = new Date('2026-10-05T08:40:00Z')

const MEALS = `Breakfast | 06:30 | 10:30 | Garden Restaurant
Business lunch | 12:00 | 15:00 | Oak Room | Mon-Fri
Afternoon tea | 15:00 | 17:30 | Drawing Room
Dinner | 18:30 | 22:00 | Main Hall
Late bar | 22:00 | 01:00 | Library`

test.beforeAll(() => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
})

for (const theme of THEMES) {
  test(`@themes ${theme}`, async ({ browser }) => {
    const { screenlyJsContent } = createMockScreenlyForScreenshots(
      { coordinates: ['51.5074', '-0.1278'] as unknown as [number, number] },
      {
        venue_name: 'Hartwell House',
        board_theme: theme,
        clock_format: '24h',
        meals: MEALS,
      },
    )

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
    })
    const page = await context.newPage()

    await setupClockMock(page, WHEN)
    await setupScreenlyJsMock(page, screenlyJsContent)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(300)

    await page.screenshot({ path: path.join(OUTPUT_DIR, `${theme}.png`) })
    await context.close()
  })
}
