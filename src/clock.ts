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
