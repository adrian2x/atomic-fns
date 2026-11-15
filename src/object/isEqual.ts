import { enumerableKeys, isEnumerable } from '../internal/keys.ts'
import {
  bytesOf,
  type ContentKind,
  contentKindOf,
  isFloatView,
  sameClass,
  unbox
} from '../internal/kind.ts'
import { walkArrayIndices } from '../internal/sparse.ts'
import { enterDepth, exitDepth, guardDepth } from '../internal/walk.ts'

/**
 * Decides one pair for {@link isEqualWith}: `true` or `false` to answer, `undefined` to let
 * `isEqualWith` compare the pair itself. `key` is the key, index or Map key the pair was found
 * under, and `undefined` for the two values passed in.
 */
export type EqualityCustomizer = (a: unknown, b: unknown, key: unknown) => boolean | undefined

/** Past this many tracked objects, or pairs with a customizer, a comparison throws `RangeError`. */
const MAX_TRACKED = 2 ** 24

const getTime = Date.prototype.getTime

/** Location keys JavaScriptCore puts on every error as own enumerable properties, like `stack`. */
const ERROR_LOCATION_KEYS: ReadonlySet<PropertyKey> = new Set(['line', 'column', 'sourceURL'])

/**
 * The pairs one comparison has taken to be equal, so shared and cyclic structures are not walked
 * again. A difference anywhere ends the whole comparison, so an assumption never needs undoing.
 */
interface Assumptions {
  /** Whether `a` and `b` were already taken to be equal; if not, takes them to be from now on. */
  assumed(a: object, b: object): boolean
}

/**
 * Equal pairs as a union-find over the objects met. `isEqual`'s own rules are an equivalence, so a
 * pair in one class is equal without a walk, and each object is walked once.
 */
class EqualClasses implements Assumptions {
  readonly #ids = new Map<object, number>()
  readonly #parent: number[] = []

  assumed(a: object, b: object): boolean {
    const [rx, ry] = [this.#root(this.#id(a)), this.#root(this.#id(b))]
    if (rx === ry) return true
    this.#parent[rx] = ry
    return false
  }

  #id(value: object): number {
    let id = this.#ids.get(value)
    if (id === undefined) {
      if (this.#ids.size >= MAX_TRACKED) {
        throw new RangeError(`comparing more than ${String(MAX_TRACKED)} objects`)
      }
      id = this.#parent.length
      this.#ids.set(value, id)
      this.#parent.push(id)
    }
    return id
  }

  #root(id: number): number {
    let root = id
    while (this.#parent[root] !== root) root = this.#parent[root]
    while (this.#parent[id] !== root) [this.#parent[id], id] = [root, this.#parent[id]]
    return root
  }
}

/**
 * Equal pairs exactly as walked. A customizer need not be transitive (`a` near `b` and `b` near `c`
 * says nothing of `a` and `c`), so only a pair already walked is equal without a walk.
 */
class EqualPairs implements Assumptions {
  readonly #partners = new Map<object, Set<object>>()
  #size = 0

  assumed(a: object, b: object): boolean {
    const partners = this.#partners.get(a)
    if (partners?.has(b)) return true
    if (this.#size >= MAX_TRACKED) {
      throw new RangeError(`comparing more than ${String(MAX_TRACKED)} pairs`)
    }
    this.#size++
    if (partners === undefined) this.#partners.set(a, new Set([b]))
    else partners.add(b)
    return false
  }
}

/** One comparison: its customizer, if any, and the pairs it has taken to be equal. */
class Session {
  readonly customizer: EqualityCustomizer | undefined
  readonly #assumptions: Assumptions

  constructor(customizer?: EqualityCustomizer) {
    this.customizer = customizer
    this.#assumptions = customizer === undefined ? new EqualClasses() : new EqualPairs()
  }

  /** Whether `a` and `b` were already taken to be equal; if not, takes them to be from now on. */
  assumed(a: object, b: object): boolean {
    return this.#assumptions.assumed(a, b)
  }
}

function sameValueZero(a: unknown, b: unknown): boolean {
  return a === b || (a !== a && b !== b)
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

function viewsEqual(a: ArrayBufferView, b: ArrayBufferView): boolean {
  if (!isFloatView(a)) return bytesEqual(bytesOf(a), bytesOf(b))
  const other = b as Float64Array
  const length = a.length
  if (length !== other.length) return false
  for (let i = 0; i < length; i++) if (!sameValueZero(a[i], other[i])) return false
  return true
}

function recordsEqual(
  a: object,
  b: object,
  session: Session,
  ignored?: ReadonlySet<PropertyKey>
): boolean {
  const keysOf = (value: object) => {
    const keys = enumerableKeys(value)
    return ignored === undefined ? keys : keys.filter((key) => !ignored.has(key))
  }
  const keys = keysOf(a)
  if (keys.length !== keysOf(b).length) return false
  const [x, y] = [a as Record<PropertyKey, unknown>, b as Record<PropertyKey, unknown>]
  return keys.every((key) => isEnumerable(b, key) && equalValues(x[key], y[key], key, session))
}

/** Own elements from `from` on, so holes cost nothing and read as `undefined`. */
function sparseArraysEqual(a: unknown[], b: unknown[], from: number, session: Session): boolean {
  const ownEqual = (array: unknown[], skip?: unknown[]): boolean => {
    let equal = true
    walkArrayIndices(array, (ev) => {
      if (
        ev.kind !== 'index' ||
        ev.index < from ||
        (skip !== undefined && isEnumerable(skip, ev.index))
      )
        return
      equal = equalValues(
        isEnumerable(a, ev.index) ? a[ev.index] : undefined,
        isEnumerable(b, ev.index) ? b[ev.index] : undefined,
        ev.index,
        session
      )
      return equal ? undefined : false
    })
    return equal
  }
  return ownEqual(a) && ownEqual(b, a)
}

function arraysEqual(a: unknown[], b: unknown[], session: Session): boolean {
  if (a.length !== b.length) return false
  let i = 0
  for (; i < a.length && i in a && i in b; i++) {
    if (!equalValues(a[i], b[i], i, session)) return false
  }
  return i === a.length || sparseArraysEqual(a, b, i, session)
}

function mapsEqual(a: Map<unknown, unknown>, b: Map<unknown, unknown>, session: Session): boolean {
  if (a.size !== b.size) return false
  for (const [key, value] of Map.prototype.entries.call(a)) {
    if (!Map.prototype.has.call(b, key)) return false
    if (!equalValues(value, Map.prototype.get.call(b, key), key, session)) return false
  }
  return true
}

function setsEqual(a: Set<unknown>, b: Set<unknown>): boolean {
  if (a.size !== b.size) return false
  for (const value of Set.prototype.values.call(a)) {
    if (!Set.prototype.has.call(b, value)) return false
  }
  return true
}

/**
 * Name, message, an own `cause` and `errors`, and own enumerable properties but the location keys
 * an engine adds, as `isDeepStrictEqual` reads them.
 */
function errorsEqual(a: Error, b: Error, session: Session): boolean {
  if (!equalValues(a.name, b.name, 'name', session)) return false
  if (!equalValues(a.message, b.message, 'message', session)) return false
  const [x, y] = [a as unknown as Record<string, unknown>, b as unknown as Record<string, unknown>]
  for (const key of ['cause', 'errors']) {
    const has = Object.hasOwn(a, key)
    if (has !== Object.hasOwn(b, key)) return false
    if (has && !equalValues(x[key], y[key], key, session)) return false
  }
  return recordsEqual(a, b, session, ERROR_LOCATION_KEYS)
}

function regExpsEqual(a: RegExp, b: RegExp): boolean {
  return a.source === b.source && a.flags === b.flags && sameValueZero(a.lastIndex, b.lastIndex)
}

function contentEqual(a: object, b: object, kind: ContentKind, session: Session): boolean {
  switch (kind) {
    case 'boxed':
      return sameValueZero(unbox(a), unbox(b))
    case 'date':
      return sameValueZero(getTime.call(a), getTime.call(b))
    case 'regexp':
      return regExpsEqual(a as RegExp, b as RegExp)
    case 'buffer':
      return bytesEqual(bytesOf(a as ArrayBuffer), bytesOf(b as ArrayBuffer))
    case 'view':
      return viewsEqual(a as ArrayBufferView, b as ArrayBufferView)
    case 'array':
    case 'arguments':
      return arraysEqual(a as unknown[], b as unknown[], session)
    case 'error':
      return errorsEqual(a as Error, b as Error, session)
    case 'map':
      return mapsEqual(a as Map<unknown, unknown>, b as Map<unknown, unknown>, session)
    case 'set':
      return setsEqual(a as Set<unknown>, b as Set<unknown>)
    default:
      return recordsEqual(a, b, session)
  }
}

function equalValues(a: unknown, b: unknown, key: unknown, session: Session): boolean {
  if (session.customizer !== undefined) {
    const answer = session.customizer(a, b, key)
    if (answer !== undefined) return Boolean(answer)
  }
  if (sameValueZero(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  const kind = contentKindOf(a)
  if (kind === 'other' || kind !== contentKindOf(b) || !sameClass(a, b)) return false
  if (session.assumed(a, b)) return true
  enterDepth()
  try {
    return contentEqual(a, b, kind, session)
  } finally {
    exitDepth()
  }
}

/**
 * Deep structural equality, lodash's `isEqual` with the platform's rules. Primitives compare by
 * SameValueZero, so `NaN` equals `NaN`, `0` equals `-0`, and `1` does not equal `1n`. Plain objects
 * compare by own enumerable keys (symbols included), arrays by index (a hole equals `undefined`;
 * other keys are ignored), `Map` by key membership and then value, `Set` by membership, Dates by
 * time, RegExps by source, flags and `lastIndex` (SameValueZero), typed arrays, `DataView` and
 * `ArrayBuffer` by content, boxed primitives by their primitive, `arguments` like an array, and
 * errors by name, message, own `cause` and `errors` and own enumerable properties (not `stack`,
 * nor JavaScriptCore's `line`, `column` and `sourceURL`), as Node's `isDeepStrictEqual` does.
 * Both sides must be of one class,
 * or its twin from another realm. Any other object (a class instance, a function, a promise) equals
 * only itself; use {@link isEqualWith} to compare such types.
 *
 * Cycles and shared objects are compared once each. Nesting past 1000 levels, or more than 2^24
 * objects in one comparison, throws `RangeError`.
 * @param a Any value.
 * @param b Any value.
 * @returns Whether `a` and `b` are structurally equal.
 * @example
 * ```ts
 * class Point {
 *   constructor(public x: number, public y: number) {}
 * }
 * isEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }) // true
 * isEqual(new Map([[1, NaN]]), new Map([[1, NaN]])) // true
 * isEqual(new Set([{}]), new Set([{}])) // false: members are matched by SameValueZero
 * isEqual(new Point(1, 2), new Point(1, 2)) // false: class instances compare by identity
 * ```
 */
export function isEqual(a: unknown, b: unknown): boolean {
  return guardDepth(() => equalValues(a, b, undefined, new Session()))
}

/**
 * {@link isEqual} with a `customizer` that may decide any pair first. It sees the two values passed
 * in, then every nested pair with the key it was found under; returning `true` or `false` answers
 * that pair, and `undefined` leaves it to `isEqual`'s rules. This is how to compare class instances
 * by their fields, or values of a type like `Decimal` by its own `equals`. Set members and Map keys
 * still match by SameValueZero and never reach the customizer; to compare those by content, decide
 * the Set or Map pair itself.
 *
 * The customizer need not be transitive (a tolerance such as `Math.abs(a - b) <= 1` works), so each
 * pair of objects is remembered as walked rather than joined into a class: a shared pair is walked
 * once, and two cycles of different lengths are walked until they line up, which counts toward the
 * nesting limit. Nesting past 1000 levels, or more than 2^24 pairs in one comparison, throws
 * `RangeError`.
 * @param a Any value.
 * @param b Any value.
 * @param customizer Decides a pair, or returns `undefined` to fall through.
 * @returns Whether `a` and `b` are equal under `customizer`.
 * @example
 * ```ts
 * class Point {
 *   constructor(public x: number, public y: number) {}
 * }
 * const byFields = (a: unknown, b: unknown) =>
 *   a instanceof Point && b instanceof Point ? a.x === b.x && a.y === b.y : undefined
 * isEqualWith([new Point(1, 2)], [new Point(1, 2)], byFields) // true
 * ```
 */
export function isEqualWith(a: unknown, b: unknown, customizer: EqualityCustomizer): boolean {
  if (typeof customizer !== 'function') throw new TypeError('customizer must be a function')
  return guardDepth(() => equalValues(a, b, undefined, new Session(customizer)))
}
