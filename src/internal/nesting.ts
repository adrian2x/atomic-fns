/** Max structural nesting for deepEqual, clone, merge, matches, flatten, and related walks. */
export const MAX_NESTING_DEPTH = 1000

const NESTING_ERROR = 'nesting deeper than 1000 levels'

/** Throw when `depth` exceeds {@link MAX_NESTING_DEPTH} (1-based; depth 1000 is allowed). */
export function assertNestingDepth(depth: number): void {
  if (depth > MAX_NESTING_DEPTH) {
    throw new RangeError(NESTING_ERROR)
  }
}
