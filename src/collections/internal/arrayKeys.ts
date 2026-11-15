import {
  arrayIndicesFrom,
  type ArrayWalkEvent,
  HOLE_STREAK_BEFORE_KEYS,
  HUGE_SPARSE_MIN_LENGTH
} from '../../internal/sparse.ts'

/**
 * Walk `arr` without expanding huge hole runs index-by-index.
 * Dense indices use `i in arr`. Once holes pass {@link HOLE_STREAK_BEFORE_KEYS} plus the elements
 * seen so far, take `Object.keys` once and continue over remaining canonical indices only, so
 * cost stays proportional to the elements however they are spaced.
 * Holes are reported as a single `holeRun` event (`end` exclusive).
 * Return `false` from `visit` to stop.
 */
export function walkArray(arr: unknown[], visit: (event: ArrayWalkEvent) => unknown): void {
  const len = arr.length
  let i = 0
  let elements = 0
  let holes = 0
  while (i < len) {
    if (i in arr) {
      if (visit({ kind: 'value', index: i, value: arr[i] }) === false) return
      i++
      elements++
      continue
    }
    const holeStart = i
    while (i < len && !(i in arr) && holes < HOLE_STREAK_BEFORE_KEYS + elements) {
      i++
      holes++
    }
    if (holes >= HOLE_STREAK_BEFORE_KEYS + elements && i < len) {
      const rest = arrayIndicesFrom(arr, i)
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
 * True when `arr.length` is above {@link HUGE_SPARSE_MIN_LENGTH} and also exceeds
 * `2 * visitedIndexCount + 1024`, so a dense `0..length` walk would spend most of its time on holes.
 * Below {@link HUGE_SPARSE_MIN_LENGTH}, consumers walk with their existing hole semantics.
 * Counts the values visited by {@link walkArray}; dense arrays exit early once they cannot qualify.
 */
export function isHugeSparse(arr: unknown[]): boolean {
  const len = arr.length
  if (len <= HUGE_SPARSE_MIN_LENGTH) return false
  let own = 0
  walkArray(arr, (event) => {
    if (event.kind !== 'value') return
    own++
    if (len <= 2 * own + 1024) return false
  })
  return len > 2 * own + 1024
}

/** Throw when `arr` is a huge sparse array that must not be expanded per-index. */
export function assertNotHugeSparse(arr: unknown[]): void {
  if (isHugeSparse(arr)) {
    throw new RangeError('sparse array too large')
  }
}
