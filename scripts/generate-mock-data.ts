/**
 * Writes the `mock-data.yml` the dev server reads in place of a real player.
 *
 * A hotel in London, with a schedule that exercises the cases worth looking
 * at: a service that runs past midnight, and one that only happens at
 * weekends. An existing file is left alone unless `--force` is passed.
 */

import fs from 'fs'
import path from 'path'

const MOCK_DATA_PATH = path.resolve(process.cwd(), 'mock-data.yml')

const HOTEL = `---
metadata:
  coordinates:
    - '51.5074'
    - '-0.1278'
  location: Hartwell House, London
  screen_name: Lobby board
  hostname: dev-hostname
  screenly_version: development-server
  tags:
    - Development
settings:
  venue_name: Hartwell House
  board_theme: modern-dark
  clock_format: 24h
  meals: |
    Breakfast | 06:30 | 10:30 | Garden Restaurant
    Brunch | 10:00 | 13:00 | Terrace | Sat, Sun
    Business lunch | 12:00 | 15:00 | Oak Room | Mon-Fri
    Dinner | 18:30 | 22:00 | Main Hall
    Late bar | 22:00 | 01:00 | Library
`

if (fs.existsSync(MOCK_DATA_PATH) && !process.argv.includes('--force')) {
  console.log('mock-data.yml already exists, leaving it alone (--force to replace)')
} else {
  fs.writeFileSync(MOCK_DATA_PATH, HOTEL)
  console.log('Wrote mock-data.yml for a London hotel')
}
