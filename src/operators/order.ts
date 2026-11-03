/**
 * Total-order compare and derived relations.
 */

import { assertSameCurrency, isRank1 } from '../internal/rank1.js'
import { hasMethod, protocol } from './protocol.js'

type Rank1NumericCompare = (x: unknown, y: unknown) => -1 | 0 | 1 | undefined

let rank1NumericCompare: Rank1NumericCompare | undefined

/**
 * Wired by the Decimal module so rank-1 relational ops stay numeric without `order` importing
 * `decimal` (that import cycle costs nesting headroom in deepEqual).
 */
export function registerRank1NumericCompare(fn: Rank1NumericCompare): void {
  rank1NumericCompare = fn
}

/** User comparator; `compare` itself always returns `-1 | 0 | 1`. */
export type Comparer<T = unknown> = (x: T, y: T) => number

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
  if (Object.prototype.toString.call(v) === '[object Date]') return 5
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
  if (Object.prototype.toString.call(v) === '[object Date]') return 5
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

function compareSymbols(x: symbol, y: symbol): -1 | 0 | 1 {
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
  return seqCompare(x, y)
}

function nativeCompare(x: unknown, y: unknown, rank: number): -1 | 0 | 1 {
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
      return x === y ? 0 : x ? 1 : -1
    case 4:
      return compareSymbols(x as symbol, y as symbol)
    case 5: {
      const tx = (x as Date).getTime()
      const ty = (y as Date).getTime()
      const nx = Number.isNaN(tx)
      const ny = Number.isNaN(ty)
      if (nx !== ny) return nx ? 1 : -1
      if (!nx && tx !== ty) return cmp3(tx, ty)
      return x === y ? 0 : seqCompare(x as object, y as object)
    }
    case 6:
      return x === y ? 0 : seqCompare(x as object, y as object)
    default:
      return 0
  }
}

function assertCompareResult(r: unknown): asserts r is number | undefined {
  if (r !== undefined && (typeof r !== 'number' || !Number.isFinite(r))) {
    throw new TypeError('compare protocol must return a finite number or undefined')
  }
}

/**
 * Total order over all values: `-1`, `0`, or `1`.
 * Antisymmetric and transitive; never applies `<`/`>` to objects.
 * Same-type non-NaN numbers and same-type strings take a cheap path before rank logic;
 * the total order is identical to the slow path.
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
export function compareSlow(x: unknown, y: unknown): -1 | 0 | 1 {
  const rx = rankOf(x)
  const ry = rankOf(y)
  if (rx !== ry) return rx < ry ? -1 : 1

  let r: unknown
  if (hasMethod(x, protocol.compare)) {
    r = x[protocol.compare](y)
  } else if (hasMethod(y, protocol.compare)) {
    const r0 = y[protocol.compare](x)
    assertCompareResult(r0)
    r = r0 === undefined ? undefined : -r0
  } else {
    return nativeCompare(x, y, rx)
  }

  assertCompareResult(r)
  if (typeof r === 'number' && r < 0) return -1
  if (typeof r === 'number' && r > 0) return 1
  if (r === 0 && sameKind(x, y)) return 0
  return kindTieBreak(x, y)
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

/**
 * Relational compare: numeric-only for rank-1 values; otherwise the total-order `compare`.
 * @throws {ValueError} when both operands carry different unit codes.
 */
function relationalCompare(x: unknown, y: unknown): -1 | 0 | 1 {
  assertSameCurrency(x, y)
  if (isRank1(x) && isRank1(y)) {
    const n = rank1NumericCompare?.(x, y)
    if (n !== undefined) return n
    if (
      (typeof x === 'number' || typeof x === 'bigint') &&
      (typeof y === 'number' || typeof y === 'bigint')
    ) {
      return x < y ? -1 : x > y ? 1 : 0
    }
  }
  return compare(x, y)
}

/**
 * Strict less-than. Rank-1 values compare numerically only (equal kinds/units are equal).
 * @throws {ValueError} when both operands carry different unit codes.
 */
export function lt(x: unknown, y: unknown): boolean {
  return relationalCompare(x, y) < 0
}

/**
 * Less-than or equal. Rank-1 values compare numerically only.
 * @throws {ValueError} when both operands carry different unit codes.
 */
export function lte(x: unknown, y: unknown): boolean {
  return relationalCompare(x, y) <= 0
}

/**
 * Strict greater-than. Rank-1 values compare numerically only.
 * @throws {ValueError} when both operands carry different unit codes.
 */
export function gt(x: unknown, y: unknown): boolean {
  return relationalCompare(x, y) > 0
}

/**
 * Greater-than or equal. Rank-1 values compare numerically only.
 * @throws {ValueError} when both operands carry different unit codes.
 */
export function gte(x: unknown, y: unknown): boolean {
  return relationalCompare(x, y) >= 0
}
