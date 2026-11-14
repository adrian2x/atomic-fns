/**
 * Timer waits shared by `fns/function` and `fns/async`.
 */

/** Inclusive max for `setTimeout` delays (signed 32-bit). */
export const MAX_TIMER_WAIT_MS = 2_147_483_647

/**
 * Checks a timer wait: throws `TypeError` for a non-number, `RangeError` for NaN, infinity or
 * values past the timer range, and clamps a negative wait to 0.
 */
export function timerWait(wait: number, name: string): number {
  if (typeof wait !== 'number') throw new TypeError(`${name} must be a number, got ${typeof wait}`)
  if (!Number.isFinite(wait) || wait > MAX_TIMER_WAIT_MS) {
    throw new RangeError(`${name} must be between 0 and ${MAX_TIMER_WAIT_MS} ms`)
  }
  return Math.max(wait, 0)
}
