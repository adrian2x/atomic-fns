/** Max structural nesting for deepEqual, clone, merge, matches, flatten, omit, and related walks. */
export const MAX_NESTING_DEPTH = 1000

/**
 * Max shared-object work units per top-level merge call.
 * Each re-expansion of an already-expanded container charges that container's subtree
 * size (see {@link subtreeContainerCount}, cached per source node for the call). First visits
 * are free.
 */
export const MAX_SHARED_WORK = 500_000

/** Keys in one container that cost one extra work unit, so a wide row weighs what it copies. */
const KEYS_PER_WORK_UNIT = 16

/**
 * Max shared-object work units per top-level flatten call (lower than merge: each re-expanded
 * leaf emits an output key string).
 */
export const MAX_FLATTEN_SHARED_WORK = 250_000

/**
 * Levels charged per nested collection hop (dispatch + hook body together).
 * Chosen so a 1500-deep collection walk hits this cap while >= 40% of the native stack remains
 * free under Node 24.22.2 with and without coverage instrumentation.
 * Effective self-nested collection limit: {@link MAX_NESTING_DEPTH} / hook cost (default 8 -> 125).
 */
export const HOOK_NESTING_COST = 8

const NESTING_ERROR = 'nesting deeper than 1000 levels'
const SHARED_REVISIT_ERROR = 'input repeats shared objects beyond 500000 copied nodes'
const FLATTEN_SHARED_REVISIT_ERROR = 'input repeats shared objects beyond 250000 output keys'

/** Shared across re-entrant deepEqual/clone/merge/matches (collection hooks continue the count). */
let currentDepth = 0

/** Sessions of the running walk, keyed by the factory that built them. */
const walkSessions = new Map<() => object, object>()

/**
 * The session `create` built for the running walk, built on first use. Collection hooks re-enter
 * `clone` and `deepEqual` mid-walk, so every hop of one top-level call sees the same session. It
 * is dropped when the nesting count returns to 0.
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
let lastSharedWork = 0
let revisitGuardDepth = 0
let sharedWorkLimit = MAX_SHARED_WORK
let sharedWorkError = SHARED_REVISIT_ERROR
let expanded = new WeakSet<object>()
let subtreeCache = new WeakMap<object, number>()

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

function isExpandableContainer(v: unknown): v is object {
  if (v === null || typeof v !== 'object') return false
  if (Array.isArray(v)) return true
  const proto: unknown = Object.getPrototypeOf(v)
  return proto === Object.prototype || proto === null
}

/**
 * Tree-multiplicity count of plain objects / arrays under `obj` (shared children counted once
 * per edge), each weighing one unit plus one per {@link KEYS_PER_WORK_UNIT} keys. Cached for the
 * active revisit guard. Not a public API.
 */
export function subtreeContainerCount(obj: object): number {
  const hit = subtreeCache.get(obj)
  if (hit !== undefined) return hit
  return computeSubtreeCount(obj, new Set<object>())
}

function computeSubtreeCount(obj: object, stack: Set<object>): number {
  const hit = subtreeCache.get(obj)
  if (hit !== undefined) return hit
  if (stack.has(obj)) return 0
  stack.add(obj)
  const keys = Object.keys(obj)
  let n = 1 + Math.floor(keys.length / KEYS_PER_WORK_UNIT)
  const rec = obj as Record<string, unknown>
  for (const key of keys) {
    const v = rec[key]
    if (isExpandableContainer(v)) n += computeSubtreeCount(v, stack)
  }
  for (const sym of Object.getOwnPropertySymbols(obj)) {
    const desc = Object.getOwnPropertyDescriptor(obj, sym)
    if (!desc?.enumerable) continue
    const v = (obj as Record<symbol, unknown>)[sym]
    if (isExpandableContainer(v)) n += computeSubtreeCount(v, stack)
  }
  stack.delete(obj)
  subtreeCache.set(obj, n)
  return n
}

function withRevisitGuard<T>(fn: () => T, limit: number, error: string): T {
  if (revisitGuardDepth === 0) {
    sharedWork = 0
    sharedWorkLimit = limit
    sharedWorkError = error
    expanded = new WeakSet<object>()
    subtreeCache = new WeakMap<object, number>()
  }
  revisitGuardDepth++
  try {
    return fn()
  } finally {
    revisitGuardDepth--
    if (revisitGuardDepth === 0) {
      sharedWork = 0
      sharedWorkLimit = MAX_SHARED_WORK
      sharedWorkError = SHARED_REVISIT_ERROR
      expanded = new WeakSet<object>()
      subtreeCache = new WeakMap<object, number>()
    }
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
 * Work charged against the budget at the last budget trip (or the running total snapshotted
 * on the last charge). Survives guard cleanup so tests can assert after a throw. Not exported
 * from any public barrel.
 */
export function getSharedWorkCharged(): number {
  return lastSharedWork
}

/**
 * Record that container `obj` is being expanded under the active revisit guard
 * (no-op outside a guard). The first expansion is free. Each later expansion charges the
 * subtree container count of `obj` against the active guard's budget
 * ({@link MAX_SHARED_WORK} or {@link MAX_FLATTEN_SHARED_WORK}), unless `prepaid` is set
 * because an ancestor already paid for this subtree on the current walk.
 *
 * @returns `true` when this call charged a subtree (descendants on this walk are prepaid).
 */
export function noteExpanded(obj: object, prepaid = false): boolean {
  if (revisitGuardDepth === 0) return false
  if (prepaid) return false
  if (!expanded.has(obj)) {
    expanded.add(obj)
    return false
  }
  const cost = subtreeContainerCount(obj)
  sharedWork += cost
  lastSharedWork = sharedWork
  if (sharedWork > sharedWorkLimit) {
    throw new RangeError(sharedWorkError)
  }
  return true
}

/**
 * Charge `cost` units against the active shared-work budget (no-op outside a revisit guard).
 * Used by walks that count distinct nodes rather than re-expansions (e.g. matches leaf-key index).
 */
export function chargeSharedWork(cost = 1): void {
  if (revisitGuardDepth === 0) return
  sharedWork += cost
  lastSharedWork = sharedWork
  if (sharedWork > sharedWorkLimit) {
    throw new RangeError(sharedWorkError)
  }
}
