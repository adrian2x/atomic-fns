/** Max structural nesting for deepEqual, clone, merge, matches, flatten, omit, and related walks. */
export const MAX_NESTING_DEPTH = 1000

/** Work units one merge call may spend expanding containers again; see {@link noteExpanded}. */
const MAX_SHARED_WORK = 500_000

/** Keys in one container that cost one extra work unit, so a wide row weighs what it copies. */
const KEYS_PER_WORK_UNIT = 16

/** The same allowance for flatten, lower than merge's: each repeated leaf emits an output key. */
const MAX_FLATTEN_SHARED_WORK = 250_000

/**
 * Levels charged per nested collection hop (dispatch + hook body together).
 * Chosen so a 1500-deep collection walk hits this cap while >= 40% of the native stack remains
 * free under Node 24.22.2 with and without coverage instrumentation.
 * Effective self-nested collection limit: {@link MAX_NESTING_DEPTH} / hook cost (default 8 -> 125).
 */
export const HOOK_NESTING_COST = 8

const NESTING_ERROR = 'nesting deeper than 1000 levels'
const SHARED_REVISIT_ERROR = 'input repeats shared objects beyond 500000 copied nodes'
const FLATTEN_SHARED_REVISIT_ERROR = 'input repeats shared objects beyond 250000 containers'

/** Shared across re-entrant deepEqual/clone/merge/matches (collection hooks continue the count). */
let currentDepth = 0

/** Sessions of the running walk, keyed by the factory that built them. */
const walkSessions = new Map<() => object, object>()

/**
 * The session `create` built for the running walk, built on first use. Collection hooks re-enter
 * `clone` mid-walk, so every hop of one top-level call sees the same session. It is dropped when
 * the nesting count returns to 0.
 */
export function walkSession<T extends object>(create: () => T): T {
  let session = walkSessions.get(create) as T | undefined
  if (session === undefined) {
    session = create()
    walkSessions.set(create, session)
  }
  return session
}

let sharedWork = 0
let freeRepeats = 0
let revisitGuardDepth = 0
let sharedWorkLimit = MAX_SHARED_WORK
let sharedWorkError = SHARED_REVISIT_ERROR
let expanded = new WeakSet<object>()

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
  const half = HOOK_NESTING_COST / 2
  enterNesting(half)
  try {
    return fn()
  } finally {
    exitNesting(half)
    if (currentDepth === 0) walkSessions.clear()
  }
}

function isNativeStackOverflow(e: unknown): boolean {
  if (!(e instanceof Error)) return false
  if (e instanceof RangeError) return e.message.includes('Maximum call stack size exceeded')
  return e.name === 'InternalError' && e.message.includes('too much recursion')
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
  } finally {
    walkSessions.clear()
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

function withRevisitGuard<T>(fn: () => T, limit: number, error: string): T {
  if (revisitGuardDepth === 0) {
    sharedWork = 0
    freeRepeats = 0
    sharedWorkLimit = limit
    sharedWorkError = error
    expanded = new WeakSet<object>()
  }
  revisitGuardDepth++
  try {
    return fn()
  } finally {
    revisitGuardDepth--
  }
}

/**
 * Run `fn` under a fresh expanded-container set and a shared-work budget of
 * {@link MAX_SHARED_WORK}. Re-entrant calls share the outer set and budget.
 */
export function guardSharedRevisits<T>(fn: () => T): T {
  return withRevisitGuard(fn, MAX_SHARED_WORK, SHARED_REVISIT_ERROR)
}

/**
 * Run `fn` under a fresh expanded-container set and a shared-work budget of
 * {@link MAX_FLATTEN_SHARED_WORK}.
 */
export function guardFlattenSharedRevisits<T>(fn: () => T): T {
  return withRevisitGuard(fn, MAX_FLATTEN_SHARED_WORK, FLATTEN_SHARED_REVISIT_ERROR)
}

/**
 * Record that container `obj`, holding `keys` own keys, is being expanded under the active
 * revisit guard. A first expansion is free, and each of its keys pays for one later expansion, so
 * a walk linear in the input never trips. Any other expansion costs one unit, whatever led there,
 * so a cycle pays like a shared row. Every repeat costs one more unit per
 * {@link KEYS_PER_WORK_UNIT} keys, so a wide shared row pays for what it copies.
 */
export function noteExpanded(obj: object, keys: number): void {
  if (!expanded.has(obj)) {
    expanded.add(obj)
    freeRepeats += keys
    return
  }
  if (freeRepeats > 0) freeRepeats--
  else sharedWork++
  sharedWork += Math.floor(keys / KEYS_PER_WORK_UNIT)
  if (sharedWork > sharedWorkLimit) {
    throw new RangeError(sharedWorkError)
  }
}
