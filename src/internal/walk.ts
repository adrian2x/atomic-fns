/**
 * Depth and cycle guards shared by the deep walks (`isEqual`, `cloneDeep`, `merge`, `defaultsDeep`,
 * `omit`, `flattenObject`, `stableStringify`, `isMatch`, `matches`).
 */

/** Deepest nesting a walk follows before it throws. */
export const MAX_DEPTH = 1000

/** Message of the `RangeError` a walk throws past {@link MAX_DEPTH}. */
export const DEPTH_ERROR = `nesting deeper than ${String(MAX_DEPTH)} levels`

/** Shared by every running walk, so a walk that re-enters another one keeps counting. */
let depth = 0

/**
 * Go one level deeper. Throws `RangeError` past {@link MAX_DEPTH}. Pair it with {@link exitDepth}
 * in a `finally` at the recursion site.
 */
export function enterDepth(): void {
  if (depth >= MAX_DEPTH) throw new RangeError(DEPTH_ERROR)
  depth++
}

/** Come back up one level. Must follow its {@link enterDepth}. */
export function exitDepth(): void {
  depth--
}

function isStackOverflow(e: unknown): boolean {
  if (!(e instanceof Error)) return false
  if (e instanceof RangeError) return e.message.includes('Maximum call stack size exceeded')
  return e.name === 'InternalError' && e.message.includes('too much recursion')
}

/**
 * Run the outermost call of a walk. An engine stack overflow inside it, which a deep walk can still
 * hit on a small stack, becomes the same `RangeError` as {@link enterDepth} throws, and the depth
 * count is reset. A call made while another walk runs (a customizer that calls `isEqual`) just
 * runs `fn`.
 */
export function guardDepth<T>(fn: () => T): T {
  if (depth !== 0) return fn()
  try {
    return fn()
  } catch (e) {
    if (isStackOverflow(e)) throw new RangeError(DEPTH_ERROR, { cause: e })
    throw e
  } finally {
    depth = 0
  }
}

/**
 * The objects on the path from the root of a walk to where it is now, so a walk can tell a cycle
 * from an object that is merely shared.
 */
export class Ancestors {
  readonly #open = new Set<object>()

  /** Whether `obj` is on the current path. */
  has(obj: object): boolean {
    return this.#open.has(obj)
  }

  /** Step into `obj`, one level deeper; throws `RangeError` past {@link MAX_DEPTH}. */
  enter(obj: object): void {
    enterDepth()
    this.#open.add(obj)
  }

  /** Step back out of `obj`. */
  leave(obj: object): void {
    exitDepth()
    this.#open.delete(obj)
  }
}

/** Keys one work unit covers, so a wide container weighs what it copies. */
const KEYS_PER_WORK_UNIT = 16

/**
 * A budget for walks that expand shared containers again (`merge` copies a shared row once per
 * place it appears). A first expansion of a container is free; each later one costs one unit per
 * 16 keys, rounded up, and the walk throws `RangeError(message)` once it has spent more than
 * `limit` units.
 */
export class RevisitBudget {
  readonly #limit: number
  readonly #message: string
  readonly #seen = new WeakSet<object>()
  #spent = 0

  constructor(limit: number, message: string) {
    this.#limit = limit
    this.#message = message
  }

  /** Record that `obj`, holding `keys` own keys, is being expanded. */
  note(obj: object, keys: number): void {
    if (!this.#seen.has(obj)) {
      this.#seen.add(obj)
      return
    }
    this.#spent += Math.ceil(keys / KEYS_PER_WORK_UNIT)
    if (this.#spent > this.#limit) throw new RangeError(this.#message)
  }
}
