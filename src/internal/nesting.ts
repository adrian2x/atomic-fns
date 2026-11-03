/** Max structural nesting for deepEqual, clone, merge, matches, flatten, and related walks. */
export const MAX_NESTING_DEPTH = 1000

const NESTING_ERROR = 'nesting deeper than 1000 levels'

/** Shared across re-entrant deepEqual/clone/merge/matches (collection hooks continue the count). */
let currentDepth = 0

/**
 * Run `fn` one nesting level deeper. Throws `RangeError` past {@link MAX_NESTING_DEPTH}.
 * Re-entrant calls (protocol.equals / protocol.clone) continue the same counter.
 */
export function withNesting<T>(fn: () => T): T {
  currentDepth++
  try {
    if (currentDepth > MAX_NESTING_DEPTH) {
      throw new RangeError(NESTING_ERROR)
    }
    return fn()
  } finally {
    currentDepth--
  }
}

/**
 * Throw when `depth` exceeds {@link MAX_NESTING_DEPTH} (1-based; depth 1000 is allowed).
 * Used by iterative walks that track depth locally; prefer {@link withNesting} for recursive walks.
 */
export function assertNestingDepth(depth: number): void {
  if (depth > MAX_NESTING_DEPTH) {
    throw new RangeError(NESTING_ERROR)
  }
}

/** Current shared nesting depth (0 when no walk is active). */
export function getNestingDepth(): number {
  return currentDepth
}
