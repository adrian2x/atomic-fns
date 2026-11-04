/**
 * Total-order compare and derived relations.
 */

import { isDate, unbox } from '../globals/brand.js'
import { assertSameCurrency, isRank1, NUMERIC_COMPARE } from '../internal/rank1.js'
import { hasMethod, protocol } from './protocol.js'

/** User comparator; `compare` itself always returns `-1 | 0 | 1`. */
export type Comparer<T = unknown> = (x: T, y: T) => number

/** How much of an array ordering reads, so every call does bounded work. */
const ARRAY_ORDER_ELEMENTS = 32
const ARRAY_ORDER_LEVELS = 2

const seq = new WeakMap<object | symbol, number>()
let nextSeq = 1

function seqId(v: object | symbol): number {
  let n = seq.get(v)
  if (n === undefined) {
    n = nextSeq++
    seq.set(v, n)
  }
  return n
}

const cmp3 = <T>(a: T, b: T): -1 | 0 | 1 => (a < b ? -1 : a > b ? 1 : 0)

function seqCompare(a: object | symbol, b: object | symbol): -1 | 0 | 1 {
  return cmp3(seqId(a), seqId(b))
}

function rankOf(v: unknown): number {
  const t = typeof v
  if (t === 'number') return Number.isNaN(v) ? 8 : 1
  if (t === 'bigint') return 1
  if (t === 'string') return 2
  if (t === 'boolean') return 3
  if (t === 'symbol') return 4
  if (t === 'undefined') return 9
  if (v === null) return 7
  if (hasMethod(v, protocol.compare)) {
    const r = (v as { [protocol.rank]?: unknown })[protocol.rank]
    return r === 1 || r === 5 || r === 6 ? r : 6
  }
  if (isDate(v)) return 5
  return 6
}

function sameKind(x: unknown, y: unknown): boolean {
  return (
    typeof x === typeof y &&
    (typeof x !== 'object' || Object.getPrototypeOf(x) === Object.getPrototypeOf(y))
  )
}

function kind(v: unknown): number {
  const t = typeof v
  if (t === 'number') return 0
  if (t === 'bigint') return 1
  if (t === 'string') return 2
  if (t === 'boolean') return 3
  if (t === 'symbol') return 4
  if (hasMethod(v, protocol.compare)) return 7
  if (isDate(v)) return 5
  return 6
}

function constructorName(v: unknown): string {
  const proto = Object.getPrototypeOf(v) as { constructor?: { name?: unknown } } | null
  const name = proto?.constructor?.name
  return typeof name === 'string' ? name : ''
}

function kindTieBreak(x: unknown, y: unknown): -1 | 0 | 1 {
  const kx = kind(x)
  const ky = kind(y)
  if (kx !== ky) return kx < ky ? -1 : 1
  if (kx === 7) {
    const nx = constructorName(x)
    const ny = constructorName(y)
    if (nx < ny) return -1
    if (nx > ny) return 1
    return seqCompare(x as object, y as object)
  }
  return seqCompare(x as object | symbol, y as object | symbol)
}

/** Symbols by key, then description; `undefined` when those cannot tell them apart. */
function symbolOrder(x: symbol, y: symbol): -1 | 0 | 1 | undefined {
  const kx = Symbol.keyFor(x)
  const ky = Symbol.keyFor(y)
  if (kx !== undefined && ky !== undefined) {
    return cmp3(kx, ky)
  }
  if (kx !== undefined) return -1
  if (ky !== undefined) return 1
  const dx = x.description
  const dy = y.description
  if (dx === undefined && dy !== undefined) return -1
  if (dx !== undefined && dy === undefined) return 1
  if (dx !== undefined && dy !== undefined && dx !== dy) {
    return cmp3(dx, dy)
  }
  return undefined
}

const timeOf = (date: Date): number => Date.prototype.getTime.call(date)

/** Order of two same-rank values by content, or `undefined` when content cannot order them. */
function nativeOrder(x: unknown, y: unknown, rank: number): -1 | 0 | 1 | undefined {
  switch (rank) {
    case 1: {
      if (typeof x === typeof y) {
        return cmp3(x as number | bigint, y as number | bigint)
      }
      const c = cmp3(x as number | bigint, y as number | bigint)
      return c !== 0 ? c : typeof x === 'number' ? -1 : 1
    }
    case 2:
      return cmp3(x as string, y as string)
    case 3:
      return cmp3(x as boolean, y as boolean)
    case 4:
      return symbolOrder(x as symbol, y as symbol)
    case 5:
      return compare(timeOf(x as Date), timeOf(y as Date))
    case 6:
      return undefined
    default:
      return 0
  }
}

/** Lexicographic over the first elements, then length. */
function arrayOrder<Order extends number>(
  x: unknown[],
  y: unknown[],
  element: (a: unknown, b: unknown) => Order
): Order | -1 | 0 | 1 {
  const shared = Math.min(x.length, y.length, ARRAY_ORDER_ELEMENTS)
  for (let i = 0; i < shared; i++) {
    const order = element(x[i], y[i])
    if (order !== 0) return order
  }
  return cmp3(x.length, y.length)
}

/** Arrays before other objects, by content. Only the outermost level breaks a tie by identity. */
function objectOrder(x: object, y: object, level: number): -1 | 0 | 1 {
  if (x === y) return 0
  if (!Array.isArray(x)) return Array.isArray(y) ? 1 : seqCompare(x, y)
  if (!Array.isArray(y)) return -1
  if (level > ARRAY_ORDER_LEVELS) return 0
  const order = arrayOrder(x, y, (a, b) => compareSlow(a, b, level + 1))
  return order !== 0 || level > 1 ? order : seqCompare(x, y)
}

function assertCompareResult(r: unknown): asserts r is number | undefined {
  if (r !== undefined && (typeof r !== 'number' || !Number.isFinite(r))) {
    throw new TypeError('compare protocol must return a finite number or undefined')
  }
}

/** Sign of the `method` hook on `x`, else reflected from `y`; `undefined` when it declines. */
function hookOrder(x: unknown, y: unknown, method: symbol): -1 | 0 | 1 | undefined {
  let r: unknown
  if (hasMethod(x, method)) r = x[method](y)
  else if (hasMethod(y, method)) {
    const flipped = y[method](x)
    assertCompareResult(flipped)
    r = flipped === undefined ? undefined : -flipped
  }
  assertCompareResult(r)
  return r === undefined ? undefined : cmp3(r, 0)
}

/**
 * Total order over all values: `-1`, `0`, or `1`.
 * Antisymmetric and transitive; never applies `<`/`>` to objects.
 * Dates order by time, so equal instants compare `0`, whether Date or IntlDate.
 * Arrays order by content (the first 32 elements, two levels deep, then length), before other
 * objects; a content tie between distinct arrays breaks by identity. Other objects, typed arrays
 * included, order by identity.
 * Same-type non-NaN numbers and same-type strings take a cheap path before rank logic;
 * the total order is identical to the slow path.
 * @throws {TypeError} when a `protocol.compare` hook returns a non-finite number or a non-number.
 * Hooks are user code and may throw on their own.
 */
export function compare(x: unknown, y: unknown): -1 | 0 | 1 {
  if (typeof x === 'number' && typeof y === 'number') {
    if (!Number.isNaN(x) && !Number.isNaN(y)) {
      return x < y ? -1 : x > y ? 1 : 0
    }
  } else if (typeof x === 'string' && typeof y === 'string') {
    return x < y ? -1 : x > y ? 1 : 0
  }
  return compareSlow(x, y)
}

/**
 * Rank/protocol path used when the number/string fast path does not apply.
 * Exported for tests that the fast path agrees with this order.
 */
export function compareSlow(x: unknown, y: unknown, level = 1): -1 | 0 | 1 {
  const rx = rankOf(x)
  const ry = rankOf(y)
  if (rx !== ry) return rx < ry ? -1 : 1

  if (hasMethod(x, protocol.compare) || hasMethod(y, protocol.compare)) {
    const order = hookOrder(x, y, protocol.compare)
    if (order === -1 || order === 1) return order
    if (order === 0 && (rx === 5 || sameKind(x, y))) return 0
    return kindTieBreak(x, y)
  }
  if (rx === 6) return objectOrder(x as object, y as object, level)
  return nativeOrder(x, y, rx) ?? seqCompare(x as symbol, y as symbol)
}

/** SameValueZero equality. */
export function sameValueZero(x: unknown, y: unknown): boolean {
  return x === y || (x !== x && y !== y)
}

/**
 * Semantic equality: protocol.equals, else compare===0 when either has compare, else SameValueZero.
 */
export function eq(x: unknown, y: unknown): boolean {
  if (hasMethod(x, protocol.equals)) return Boolean(x[protocol.equals](y))
  if (hasMethod(y, protocol.equals)) return Boolean(y[protocol.equals](x))
  if (hasMethod(x, protocol.compare) || hasMethod(y, protocol.compare)) {
    return compare(x, y) === 0
  }
  return sameValueZero(x, y)
}

function isNumericPrimitive(v: unknown): v is number | bigint {
  return typeof v === 'number' || typeof v === 'bigint'
}

/** Numeric order of two rank-1 values with no kind or unit tie-break, when they have one. */
function rank1Compare(x: unknown, y: unknown): -1 | 0 | 1 | undefined {
  if (isNumericPrimitive(x) && isNumericPrimitive(y)) return cmp3(x, y)
  const method =
    hasMethod(x, NUMERIC_COMPARE) || hasMethod(y, NUMERIC_COMPARE)
      ? NUMERIC_COMPARE
      : protocol.compare
  return hookOrder(x, y, method)
}

/** Order of two values with no identity tie-break, or `undefined` when they have none. */
function contentOrder(x: unknown, y: unknown, level: number): number | undefined {
  const rank = rankOf(x)
  if (rank !== rankOf(y)) return undefined
  if (hasMethod(x, protocol.compare) || hasMethod(y, protocol.compare)) {
    return hookOrder(x, y, protocol.compare)
  }
  if (Array.isArray(x) && Array.isArray(y) && level <= ARRAY_ORDER_LEVELS) {
    return arrayOrder(x, y, (a, b) => relationalCompare(a, b, level + 1))
  }
  return nativeOrder(x, y, rank)
}

/**
 * `-1`, `0`, or `1`; `NaN` for operands that do not relate, which makes every check false.
 * Identical values are equal. Rank-1 values compare numerically. NaN and Invalid Dates relate to
 * nothing else. Everything else compares by content, and a pair with no order relates only when
 * `eq` says so.
 * @throws {ValueError} when both operands carry different unit codes.
 */
function relationalCompare(x: unknown, y: unknown, level = 1): number {
  if (x === y) return 0
  assertSameCurrency(x, y)
  const [a, b] = isDate(x) && isDate(y) ? [timeOf(x), timeOf(y)] : [unbox(x), unbox(y)]
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.NaN
  if (isRank1(a) && isRank1(b)) return rank1Compare(a, b) ?? compare(a, b)
  return contentOrder(a, b, level) ?? (eq(a, b) ? 0 : Number.NaN)
}

/**
 * Strict less-than, with `<` semantics that do not coerce. Rank-1 values compare numerically only
 * (equal kinds/units are equal). Dates compare by time, strings, booleans and symbols within their
 * kind, arrays by content (see {@link compare}, with no identity tie-break), wrapper objects as
 * their primitive, and values with a `protocol.compare` hook by that hook. NaN makes all four
 * checks false, and so does an Invalid Date against anything but itself. Operands of different
 * kinds, or with no order such as plain objects, are incomparable: {@link lt} and {@link gt} are
 * false, {@link lte} and {@link gte} equal `eq`.
 * @throws {ValueError} when both operands carry different unit codes.
 */
export function lt(x: unknown, y: unknown): boolean {
  return relationalCompare(x, y) < 0
}

/**
 * Less-than or equal. See {@link lt}.
 * @throws {ValueError} when both operands carry different unit codes.
 */
export function lte(x: unknown, y: unknown): boolean {
  return relationalCompare(x, y) <= 0
}

/**
 * Strict greater-than. See {@link lt}.
 * @throws {ValueError} when both operands carry different unit codes.
 */
export function gt(x: unknown, y: unknown): boolean {
  return relationalCompare(x, y) > 0
}

/**
 * Greater-than or equal. See {@link lt}.
 * @throws {ValueError} when both operands carry different unit codes.
 */
export function gte(x: unknown, y: unknown): boolean {
  return relationalCompare(x, y) >= 0
}
