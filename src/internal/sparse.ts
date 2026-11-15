/**
 * Sparse-array helpers for own enumerable indices, with hole-run events.
 */

/** ECMAScript canonical array index name (0 .. 2^32-2). */
export function isCanonicalArrayIndex(key: string): boolean {
  return /^(0|[1-9]\d*)$/.test(key) && Number(key) <= 0xffff_fffe
}

/** Own enumerable array indices at or after `start`, in `Object.keys` order. */
export function arrayIndicesFrom(arr: readonly unknown[], start: number): number[] {
  const indices: number[] = []
  for (const key of Object.keys(arr)) {
    if (!isCanonicalArrayIndex(key)) continue
    const index = Number(key)
    if (index >= start) indices.push(index)
  }
  return indices
}

/** A present index, or a contiguous hole run `[start, end)`. */
export type ArrayWalkEvent =
  | { readonly kind: 'value'; readonly index: number; readonly value: unknown }
  | { readonly kind: 'holeRun'; readonly start: number; readonly end: number }

export type ArrayIndexWalkEvent =
  | { readonly kind: 'index'; readonly index: number }
  | { readonly kind: 'holeRun'; readonly start: number; readonly end: number }

/** Holes a walk may visit one by one, beyond one per element seen, before it takes Object.keys. */
export const HOLE_STREAK_BEFORE_KEYS = 256

const isOwnEnumerable = Object.prototype.propertyIsEnumerable

/**
 * Walk the own enumerable indices of `arr` (the set `Object.keys` lists) without expanding huge
 * hole runs index-by-index. Inherited and non-enumerable indices are holes.
 * Dense indices are checked one by one. Once holes pass {@link HOLE_STREAK_BEFORE_KEYS} plus the
 * elements seen so far, take `Object.keys` once and continue over remaining canonical indices only,
 * so cost stays proportional to the elements however they are spaced.
 * Holes are reported as a single `holeRun` event (`end` exclusive).
 * Return `false` from `visit` to stop.
 */
export function walkArrayIndices(
  arr: readonly unknown[],
  visit: (event: ArrayIndexWalkEvent) => false | undefined
): void {
  const len = arr.length
  let i = 0
  let elements = 0
  let holes = 0
  while (i < len) {
    if (isOwnEnumerable.call(arr, i)) {
      if (visit({ kind: 'index', index: i }) === false) return
      i++
      elements++
      continue
    }
    const holeStart = i
    while (i < len && !isOwnEnumerable.call(arr, i) && holes < HOLE_STREAK_BEFORE_KEYS + elements) {
      i++
      holes++
    }
    if (holes >= HOLE_STREAK_BEFORE_KEYS + elements && i < len) {
      const rest = arrayIndicesFrom(arr, i)
      let cursor = holeStart
      for (const idx of rest) {
        if (idx > cursor && visit({ kind: 'holeRun', start: cursor, end: idx }) === false) return
        if (visit({ kind: 'index', index: idx }) === false) return
        cursor = idx + 1
      }
      if (cursor < len) visit({ kind: 'holeRun', start: cursor, end: len })
      return
    }
    if (visit({ kind: 'holeRun', start: holeStart, end: i }) === false) return
  }
}

/** Like {@link walkArrayIndices}, with the value at each index. */
export function walkArray(
  arr: readonly unknown[],
  visit: (event: ArrayWalkEvent) => false | undefined
): void {
  walkArrayIndices(arr, (event) =>
    visit(
      event.kind === 'index'
        ? { kind: 'value', index: event.index, value: arr[event.index] }
        : event
    )
  )
}

/** Absolute length below which per-index consumers never treat an array as huge-sparse. */
export const HUGE_SPARSE_MIN_LENGTH = 2 ** 24

/**
 * True when `arr.length` is above {@link HUGE_SPARSE_MIN_LENGTH} and also exceeds
 * `2 * ownIndexCount + 1024`, so a dense `0..length` walk would spend most of its time on holes.
 * Below {@link HUGE_SPARSE_MIN_LENGTH}, consumers walk with their existing hole semantics.
 * Counts through {@link walkArrayIndices}; a dense array stops as soon as its own indices prove
 * it cannot qualify.
 */
export function isHugeSparse(arr: readonly unknown[]): boolean {
  const len = arr.length
  if (len <= HUGE_SPARSE_MIN_LENGTH) return false
  // own > (len - 1024) / 2  =>  len < 2 * own + 1024, so the final test is false: stop there.
  const denseOwn = (len - 1024) / 2
  let own = 0
  walkArrayIndices(arr, (ev) => {
    if (ev.kind !== 'index') return
    own++
    if (own > denseOwn) return false
  })
  return len > 2 * own + 1024
}

/** Throw when `arr` is a huge sparse array that must not be expanded per-index. */
export function assertNotHugeSparse(arr: readonly unknown[]): void {
  if (isHugeSparse(arr)) {
    throw new RangeError('sparse array too large')
  }
}
