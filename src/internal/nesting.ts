/** Max structural nesting for deepEqual, clone, merge, matches, flatten, omit, and related walks. */
export const MAX_NESTING_DEPTH = 1000

/** Max nodes visited per top-level merge / matches / flatten call (shared-reference DAG bound). */
export const MAX_VISITED_NODES = 1_000_000

/**
 * Levels charged per nested collection hop (dispatch + hook body together).
 * Chosen so a 1500-deep collection walk hits this cap while >= 40% of the native stack remains
 * free under Node 24.22.2 with and without coverage instrumentation.
 * Effective self-nested collection limit: {@link MAX_NESTING_DEPTH} / hook cost (default 8 -> 125).
 */
let hookNestingCost = 8

/** Default / current levels charged per nested collection hop. */
export const HOOK_NESTING_COST = 8

/** Read the live hook nesting cost (may differ from {@link HOOK_NESTING_COST} when patched in tests). */
export function getHookNestingCost(): number {
  return hookNestingCost
}

/** Test-only: patch the live hook nesting cost (always restore after). */
export function setHookNestingCost(cost: number): void {
  hookNestingCost = cost
}

const NESTING_ERROR = 'nesting deeper than 1000 levels'
const VISIT_ERROR = 'input exceeds 1000000 nodes'

/** Shared across re-entrant deepEqual/clone/merge/matches (collection hooks continue the count). */
let currentDepth = 0

let visitCount = 0
let visitGuardDepth = 0

/**
 * Enter `cost` nesting levels (default 1). Throws `RangeError` past {@link MAX_NESTING_DEPTH}.
 * Pair with {@link exitNesting} using the same `cost` in a `try`/`finally` at the recursion site.
 */
export function enterNesting(cost = 1): void {
  currentDepth += cost
  if (currentDepth > MAX_NESTING_DEPTH) {
    currentDepth -= cost
    throw new RangeError(NESTING_ERROR)
  }
}

/** Leave `cost` nesting levels (default 1). Must match the paired {@link enterNesting}. */
export function exitNesting(cost = 1): void {
  currentDepth -= cost
}

/**
 * Run `fn` under half of {@link HOOK_NESTING_COST} (one of the two charges per collection hop).
 * Used at protocol dispatch and inside collection equals/clone hooks.
 */
export function withHookNesting<T>(fn: () => T): T {
  const half = hookNestingCost / 2
  enterNesting(half)
  try {
    return fn()
  } finally {
    exitNesting(half)
  }
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

/**
 * Run `fn` under a fresh visited-node budget of {@link MAX_VISITED_NODES}.
 * Re-entrant calls share the outer budget. Exceeding it throws
 * `RangeError('input exceeds 1000000 nodes')`.
 */
export function guardVisitBudget<T>(fn: () => T): T {
  if (visitGuardDepth === 0) visitCount = 0
  visitGuardDepth++
  try {
    return fn()
  } finally {
    visitGuardDepth--
    if (visitGuardDepth === 0) visitCount = 0
  }
}

/** Count one visited node against the active {@link guardVisitBudget} (no-op outside a guard). */
export function visitNode(): void {
  if (visitGuardDepth === 0) return
  visitCount++
  if (visitCount > MAX_VISITED_NODES) {
    throw new RangeError(VISIT_ERROR)
  }
}
