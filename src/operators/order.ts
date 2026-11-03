/**
 * Total-order compare and derived relations.
 */

import { hasMethod, protocol } from './protocol.js'

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
 */
export function compare(x: unknown, y: unknown): -1 | 0 | 1 {
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

/** `compare(x, y) < 0` */
export function lt(x: unknown, y: unknown): boolean {
  return compare(x, y) < 0
}

/** `compare(x, y) <= 0` */
export function lte(x: unknown, y: unknown): boolean {
  return compare(x, y) <= 0
}

/** `compare(x, y) > 0` */
export function gt(x: unknown, y: unknown): boolean {
  return compare(x, y) > 0
}

/** `compare(x, y) >= 0` */
export function gte(x: unknown, y: unknown): boolean {
  return compare(x, y) >= 0
}
