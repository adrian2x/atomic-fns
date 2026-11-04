/**
 * Sparse-array helpers: one walker for every array consumer, with hole-run events.
 */

/** ECMAScript canonical array index name (0 .. 2^32-2). */
export function isCanonicalArrayIndex(key: string): boolean {
  if (!/^(0|[1-9]\d*)$/.test(key)) return false
  const n = Number(key)
  return n <= 0xffff_fffe && String(n) === key
}

/** A present index, or a contiguous hole run `[start, end)`. */
export type ArrayWalkEvent =
  | { readonly kind: 'value'; readonly index: number; readonly value: unknown }
  | { readonly kind: 'holeRun'; readonly start: number; readonly end: number }

/** Switch to Object.keys after this many consecutive holes (keeps 1023-spaced walks own-element). */
const HOLE_STREAK_BEFORE_KEYS = 256

/**
 * Walk `arr` without expanding huge hole runs index-by-index.
 * Dense indices use `i in arr`; after {@link HOLE_STREAK_BEFORE_KEYS} consecutive misses,
 * take `Object.keys` once and continue over remaining canonical indices only.
 * Holes are reported as a single `holeRun` event (`end` exclusive).
 * Return `false` from `visit` to stop.
 */
export function walkArray(
  arr: unknown[],
  visit: (event: ArrayWalkEvent) => boolean | undefined
): void {
  const len = arr.length
  let i = 0
  while (i < len) {
    if (i in arr) {
      if (visit({ kind: 'value', index: i, value: arr[i] }) === false) return
      i++
      continue
    }
    const holeStart = i
    let streak = 0
    while (i < len && !(i in arr) && streak < HOLE_STREAK_BEFORE_KEYS) {
      i++
      streak++
    }
    if (streak >= HOLE_STREAK_BEFORE_KEYS && i < len) {
      const rest: number[] = []
      for (const key of Object.keys(arr)) {
        if (!isCanonicalArrayIndex(key)) continue
        const n = Number(key)
        if (n >= i) rest.push(n)
      }
      rest.sort((a, b) => a - b)
      const holeEnd = rest.length > 0 ? rest[0] : len
      if (visit({ kind: 'holeRun', start: holeStart, end: holeEnd }) === false) return
      for (let k = 0; k < rest.length; k++) {
        const idx = rest[k]
        if (k > 0) {
          const prev = rest[k - 1]
          if (idx > prev + 1) {
            if (visit({ kind: 'holeRun', start: prev + 1, end: idx }) === false) return
          }
        }
        if (visit({ kind: 'value', index: idx, value: arr[idx] }) === false) return
      }
      if (rest.length > 0) {
        const last = rest[rest.length - 1]
        if (last + 1 < len) {
          if (visit({ kind: 'holeRun', start: last + 1, end: len }) === false) return
        }
      }
      return
    }
    if (visit({ kind: 'holeRun', start: holeStart, end: i }) === false) return
  }
}

/**
 * Own canonical index keys of `arr`, sorted numerically.
 * Prefer {@link walkArray} for consumers that need values or hole semantics.
 */
export function arrayOwnIndices(arr: unknown[]): string[] {
  const out: string[] = []
  walkArray(arr, (ev) => {
    if (ev.kind === 'value') out.push(String(ev.index))
  })
  return out
}

/** Absolute length below which per-index consumers never treat an array as huge-sparse. */
export const HUGE_SPARSE_MIN_LENGTH = 2 ** 24

/**
 * True when `arr.length` is above {@link HUGE_SPARSE_MIN_LENGTH} and also exceeds
 * `2 * ownIndexCount + 1024`, so a dense `0..length` walk would spend most of its time on holes.
 * Below {@link HUGE_SPARSE_MIN_LENGTH}, consumers walk with their existing hole semantics.
 * Dense arrays exit early once own indices prove they cannot qualify (pay only `in` checks).
 */
export function isHugeSparse(arr: unknown[]): boolean {
  const len = arr.length
  if (len <= HUGE_SPARSE_MIN_LENGTH) return false
  // own > (len - 1024) / 2  =>  not huge sparse. Exit as soon as that holds.
  const denseOwn = (len - 1024) / 2
  let own = 0
  const flag = { dense: false }
  walkArray(arr, (ev) => {
    if (ev.kind !== 'value') return
    own++
    if (own > denseOwn) {
      flag.dense = true
      return false
    }
  })
  if (flag.dense) return false
  return len > 2 * own + 1024
}

/** Throw when `arr` is a huge sparse array that must not be expanded per-index. */
export function assertNotHugeSparse(arr: unknown[]): void {
  if (isHugeSparse(arr)) {
    throw new RangeError('sparse array too large')
  }
}
