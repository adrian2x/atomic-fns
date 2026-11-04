import { describe, it, expect } from 'vitest'
import { binarySearch, bisect, bisectLeft, insort, insortLeft } from '../src/collections/index.js'

function pyBisectLeft(a: number[], x: number, lo = 0, hi = a.length): number {
  if (lo < 0) throw new RangeError('lo must be non-negative')
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (a[mid] < x) lo = mid + 1
    else hi = mid
  }
  return lo
}

function pyBisectRight(a: number[], x: number, lo = 0, hi = a.length): number {
  if (lo < 0) throw new RangeError('lo must be non-negative')
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (x < a[mid]) hi = mid
    else lo = mid + 1
  }
  return lo
}

function* sortedArrays(maxLen: number, maxVal: number): Generator<number[]> {
  yield []
  function* combos(len: number, start: number, prefix: number[]): Generator<number[]> {
    if (prefix.length === len) {
      yield prefix.slice()
      return
    }
    for (let v = start; v <= maxVal; v++) {
      prefix.push(v)
      yield* combos(len, v, prefix)
      prefix.pop()
    }
  }
  for (let len = 1; len <= maxLen; len++) {
    yield* combos(len, 0, [])
  }
}

describe('bisect', () => {
  it(
    'SPEC-R33 bisect matches Python bisect_right on exhaustive small arrays',
    { timeout: 60_000 },
    () => {
      for (const arr of sortedArrays(8, 9)) {
        for (let x = -1; x <= 10; x++) {
          expect(bisect(arr, x)).toBe(pyBisectRight(arr, x))
          expect(bisectLeft(arr, x)).toBe(pyBisectLeft(arr, x))
        }
      }
    }
  )

  it('SPEC-R33 bisectLeft / bisect hi clamp and lo RangeError', () => {
    const arr = [1, 2, 3]
    expect(bisect(arr, 2, 0, 100)).toBe(2)
    expect(bisectLeft(arr, 2, 0, 100)).toBe(1)
    expect(() => bisect(arr, 1, -1)).toThrow(RangeError)
    expect(() => bisectLeft(arr, 1, -1)).toThrow(RangeError)
  })

  it('SPEC-R33 insort keeps sortedness', () => {
    for (const seed of [[], [1], [1, 3], [1, 1, 4, 7, 9]]) {
      const arr = seed.slice()
      for (const x of [0, 1, 2, 5, 7, 10]) {
        const copy = arr.slice()
        insort(copy, x)
        for (let i = 1; i < copy.length; i++) {
          expect(copy[i]).toBeGreaterThanOrEqual(copy[i - 1])
        }
        const left = arr.slice()
        insortLeft(left, x)
        for (let i = 1; i < left.length; i++) {
          expect(left[i]).toBeGreaterThanOrEqual(left[i - 1])
        }
      }
    }
  })

  it('SPEC-R33 binarySearch not-found encoding', () => {
    const arr = [1, 3, 5, 7]
    expect(binarySearch(arr, 3)).toBe(1)
    expect(binarySearch(arr, 1)).toBe(0)
    expect(binarySearch(arr, 7)).toBe(3)
    expect(binarySearch(arr, 0)).toBe(-1)
    expect(binarySearch(arr, 2)).toBe(-2)
    expect(binarySearch(arr, 8)).toBe(-5)
    const i = binarySearch(arr, 4)
    expect(i).toBeLessThan(0)
    expect(-i - 1).toBe(bisectLeft(arr, 4))
  })
})
