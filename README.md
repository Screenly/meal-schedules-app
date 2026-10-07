# Meal Schedules

A board of meal service times for a hotel lobby or a restaurant window, sized
to be read from the other side of the room.

It answers the question a guest actually has, which is not "what are the hours"
but "can I eat now". The banner across the top names what is being served and
how long is left, or what is coming and when, and the list underneath carries
the rest of the day.

## What it shows

The sitting in progress is the largest thing on the screen, with a bar running
down as the service does. When nothing is being served the banner counts down to
the next sitting instead.

Below that, the rest of the day's sittings with their times and where they are.
Whatever the banner is showing is left out of the list rather than repeated in
it, and anything finished fades back. A service that runs past midnight stays on
the board into the small hours.

Different days can have different sittings, so a weekday business lunch and a
weekend brunch both appear only when they are on.

## Setting it up

The schedule is one meal per line in the `meals` setting:

```
Breakfast | 06:30 | 10:30 | Garden Restaurant
Business lunch | 12:00 | 15:00 | Oak Room | Mon-Fri
Brunch | 09:00 | 13:00 | Terrace | Sat, Sun
Late bar | 22:00 | 01:00
```

Name, start and end are needed; where it is served and which days are optional.
Times can be written as `7`, `07:00`, `7:30` or `7:30pm`. Days can be a list
(`Sat, Sun`), a range (`Mon-Fri`), or one of `daily`, `weekdays`, `weekends`. A
line starting with `#` is ignored, which is a convenient way to park the winter
times without losing them.

A line that cannot be read is reported along the bottom of the board rather than
dropped, because a missing meal is worse than a visible complaint about a typo.

## Configuration

| Setting             | Description                                                              | Required | Default                                         |
| ------------------- | ------------------------------------------------------------------------ | -------- | ----------------------------------------------- |
| `meals`             | The schedule, one meal per line                                          | No       | A sample day                                    |
| `venue_name`        | Shown at the top, e.g. `Hartwell House`                                  | No       | Screen's own location                           |
| `board_theme`       | `modern-dark`, `modern-light`, `classic-dark`, `classic-light` or `auto` | No       | `modern-dark`                                   |
| `accent_color`      | Hex colour for the highlights, e.g. `#a06e47`                            | No       | Branding on modern themes, else the theme's own |
| `clock_format`      | `24h` or `12h`                                                           | No       | `24h`                                           |
| `override_timezone` | IANA timezone, e.g. `Europe/London`                                      | No       | From coordinates                                |

## Reading it from a distance

The board is drawn on a 1920x1080 canvas and scaled to the screen, so the sizes
here are in those units. The banner runs up to 118px and the rows up to 68px,
which carries across a lobby on a 55 inch screen.

Because a hotel might list three services and another eight, the rows are
measured against the space left for them and scaled to fit. Past six sittings
the finished ones are dropped, oldest first: a guest at three in the afternoon
does not need to be told that breakfast ended at half past ten, and the rows
that remain stay large enough to read.

## Getting started

```bash
bun install
bun run dev
```

That writes a `mock-data.yml` for a London hotel if you do not have one, with a
schedule covering the cases worth looking at: a service that runs past midnight,
and sittings that only happen on some days. Write it again with
`bun run generate-mock-data -- --force`.

### The settings panel

The dev server mounts a panel in the corner carrying every setting (theme,
clock, accent, venue, the schedule itself) plus a day and time scrubber, so the
board can be put into any state without waiting for the day to come round or
editing a file. Changes are written into the same `screenly.settings` object the
app reads, so they behave exactly as the real ones do.

It lives in a shadow root. The board is themed down to its type and colour
through custom properties on the document, and a panel in the same tree would
inherit all of it and bleed its own styles back.

Hide collapses it to a chip in the corner, Live returns to the real clock, and
Reload starts again from `mock-data.yml`. It is loaded behind
`import.meta.env.DEV` and is absent from a production build.

## Tests

```bash
bun test src/
```

The schedule is checked hour by hour through a day, across a week, and either
side of midnight. The board is rendered against the real `index.html`, so a
renamed data attribute fails the tests rather than the screen.

## Build and deploy

Locally:

```bash
bun run build
screenly edge-app create --name meal-schedules-app --in-place
bun run deploy
```

In CI, `Update Edge App` deploys every push to `master` to stage, and a `v*`
tag to production. To release, tag the commit on `master` and push the tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Restrict the GitHub `production` environment to tags matching `v*` (Settings,
Environments, Deployment branches and tags) so only a tagged release can reach
it.

The Edge App id is passed to the action rather than written into
`screenly.yml`, so this repository's manifest carries no `id`. Set it per
environment as a repository variable, `STAGE_EDGE_APP_ID` and
`PRODUCTION_EDGE_APP_ID`, or as an `EDGE_APP_ID` secret scoped to a GitHub
environment, which takes precedence. `Initialize Edge App` runs once by hand to
create the app in an environment.
