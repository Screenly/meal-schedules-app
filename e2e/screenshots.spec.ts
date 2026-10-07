import { test } from '@playwright/test'
import {
  captureScreenshot,
  createMockScreenlyForScreenshots,
  RESOLUTIONS,
} from '@screenly/edge-apps/test/screenshots'

const MEALS = `Breakfast | 06:30 | 10:30 | Garden Restaurant
Business lunch | 12:00 | 15:00 | Oak Room | Mon-Fri
Afternoon tea | 15:00 | 17:30 | Drawing Room
Dinner | 18:30 | 22:00 | Main Hall
Late bar | 22:00 | 01:00 | Library`

const { screenlyJsContent } = createMockScreenlyForScreenshots(
  {
    coordinates: ['51.5074', '-0.1278'] as unknown as [number, number],
    location: 'London, UK',
  },
  {
    venue_name: 'Hartwell House',
    board_theme: 'modern-dark',
    clock_format: '24h',
    meals: MEALS,
  },
)

for (const { width, height } of RESOLUTIONS) {
  test(`screenshot ${width}x${height}`, async ({ browser }) => {
    await captureScreenshot(browser, {
      width,
      height,
      filenamePrefix: 'meal-schedules-app',
      screenlyJsContent,
    })
  })
}
