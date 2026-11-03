/** Max structural nesting for deepEqual, clone, merge, matches, flatten, omit, and related walks. */
export const MAX_NESTING_DEPTH = 1000

const NESTING_ERROR = 'nesting deeper than 1000 levels'

/** Shared across re-entrant deepEqual/clone/merge/matches (collection hooks continue the count). */
let currentDepth = 0

/**
 * Enter one nesting level. Throws `RangeError` past {@link MAX_NESTING_DEPTH}.
 * Pair with {@link exitNesting} in a `try`/`finally` at the recursion site (no per-level closure).
 */
export function enterNesting(): void {
  currentDepth++
  if (currentDepth > MAX_NESTING_DEPTH) {
    currentDepth--
    throw new RangeError(NESTING_ERROR)
  }
}

/** Leave one nesting level. */
export function exitNesting(): void {
  currentDepth--
}

function isNativeStackOverflow(e: unknown): boolean {
  return (
    e instanceof RangeError &&
    typeof e.message === 'string' &&
    e.message.includes('Maximum call stack size exceeded')
  )
}

/**
 * Run `fn` as an outermost capped entry (counter at 0). Native stack overflow is rethrown as
 * `RangeError('nesting deeper than 1000 levels')` after the counter is reset. Re-entrant calls
 * (counter already above 0) run `fn` unchanged.
 */
export function guardNesting<T>(fn: () => T): T {
  if (currentDepth !== 0) return fn()
  try {
    return fn()
  } catch (e) {
    currentDepth = 0
    if (isNativeStackOverflow(e)) {
      throw new RangeError(NESTING_ERROR, { cause: e })
    }
    throw e
  }
}

/**
 * Throw when `depth` exceeds {@link MAX_NESTING_DEPTH} (1-based; depth 1000 is allowed).
 * Used by iterative walks that track depth locally; prefer {@link enterNesting} for recursive walks.
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
