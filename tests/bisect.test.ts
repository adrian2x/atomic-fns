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

  /** A comparator that stops a search that would never end. */
  function bounded(result: (x: number, y: number) => number): (x: number, y: number) => number {
    let calls = 0
    return (x, y) => {
      calls++
      if (calls > 64) throw new Error('the search did not end')
      return result(x, y)
    }
  }
  const ascending = (x: number, y: number): number => x - y

  it('rejects bounds that are not integers, as Python does', () => {
    const arr = [1, 2, 3, 4, 5]
    const notIntegers = ['1', NaN, 1.5, null, {}, Infinity] as number[]
    for (const lo of notIntegers) {
      const message = new TypeError('lo must be an integer')
      expect(() => bisect(arr, 3, lo, undefined, bounded(ascending))).toThrow(message)
      expect(() => bisectLeft(arr, 3, lo, undefined, bounded(ascending))).toThrow(message)
      expect(() => binarySearch(arr, 3, lo, undefined, bounded(ascending))).toThrow(message)
      expect(() => insort(arr.slice(), 3, lo, undefined, bounded(ascending))).toThrow(message)
      expect(() => insortLeft(arr.slice(), 3, lo, undefined, bounded(ascending))).toThrow(message)
    }
    const badHi = ['3', NaN, 2.5, {}] as number[]
    for (const hi of badHi) {
      const message = new TypeError('hi must be an integer')
      expect(() => bisect(arr, 3, 0, hi)).toThrow(message)
      expect(() => binarySearch(arr, 3, 0, hi)).toThrow(message)
      expect(() => insort(arr.slice(), 3, 0, hi)).toThrow(message)
    }
  })

  it('null and undefined hi mean the length, Infinity clamps to it', () => {
    const arr = [1, 2, 3]
    expect(bisect(arr, 2, 0, null)).toBe(2)
    expect(bisectLeft(arr, 2, 0, undefined)).toBe(1)
    expect(binarySearch(arr, 2, 0, null)).toBe(1)
    expect(insort([1, 2, 3], 9, 0, null)).toEqual([1, 2, 3, 9])
    expect(bisect(arr, 2, 0, Infinity)).toBe(2)
    expect(bisect(arr, 2, 0, -Infinity)).toBe(0)
  })

  it('finds the midpoint of arrays past 2^31 elements', () => {
    const huge = new Array<number>(2 ** 32 - 1)
    const end = bisectLeft(
      huge,
      5,
      0,
      undefined,
      bounded(() => -1)
    )
    expect(end).toBe(2 ** 32 - 1)
    expect(
      bisect(
        huge,
        5,
        0,
        undefined,
        bounded(() => 1)
      )
    ).toBe(2 ** 32 - 1)
  })

  it('both insorts refuse huge sparse arrays', () => {
    const sparse = (): number[] => new Array<number>(2 ** 24 + 2048)
    const tooLarge = new RangeError('sparse array too large')
    expect(() => insort(sparse(), 1)).toThrow(tooLarge)
    expect(() => insortLeft(sparse(), 1)).toThrow(tooLarge)
  })
})
