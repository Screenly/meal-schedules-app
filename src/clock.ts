/**
 * The instant the board is drawing.
 *
 * In production this is the system clock. The development panel overrides it so
 * every state (mid service, between sittings, a weekend brunch, a bar running
 * past midnight) can be reached without waiting for the day to come round.
 */

let override: Date | null = null

export function setClockOverride(instant: Date | null): void {
  override = instant
}

export function isClockOverridden(): boolean {
  return override !== null
}

export function now(): Date {
  return override ? new Date(override.getTime()) : new Date()
}

/**
 * The instant at a given weekday and time of day, nearest the real one. Used by
 * the development panel, which scrubs in local terms rather than in instants.
 *
 * The weekday step is the short way round: from a Sunday, Saturday is yesterday
 * rather than six days off. The board only reads the weekday and the time, so
 * either would show the same sittings, but the date on screen should be the
 * near one.
 */
export function instantAt(
  reference: Date,
  current: { minutes: number; weekday: number },
  target: { minutes: number; weekday: number },
): Date {
  const forward = (target.weekday - current.weekday + 7) % 7
  const days = forward > 3 ? forward - 7 : forward
  const minutes = target.minutes - current.minutes
  return new Date(reference.getTime() + days * 86400000 + minutes * 60000)
}
