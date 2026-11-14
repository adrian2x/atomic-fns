import { describe, expect, it } from 'vitest'
import {
  binarySearch,
  bisect,
  bisectLeft,
  bisectRight,
  insort,
  insortLeft
} from '../../src/collections/index.ts'

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

describe('bisect', () => {
  it('matches Python bisect_left and bisect_right on every small sorted array', () => {
    for (const arr of sortedArrays(7, 2)) {
      for (let x = -1; x <= 3; x++) {
        expect(bisectRight(arr, x)).toBe(arr.filter((v) => v <= x).length)
        expect(bisectLeft(arr, x)).toBe(arr.filter((v) => v < x).length)
      }
    }
    expect(bisect).toBe(bisectRight)
  })

  it('takes a comparator, then lo and hi', () => {
    const desc = [9, 7, 7, 3]
    const byDesc = (a: number, b: number): number => b - a
    expect(bisectLeft(desc, 7, byDesc)).toBe(1)
    expect(bisectRight(desc, 7, byDesc)).toBe(3)
    expect(bisectLeft([1, 2, 3, 4], 4, undefined, 1, 2)).toBe(2)
    expect(bisectLeft([1, 2, 3, 4], 1, undefined, 2, 3)).toBe(2)
    const rows = [{ n: 1 }, { n: 3 }]
    expect(bisectLeft(rows, { n: 2 }, (a, b) => a.n - b.n)).toBe(1)
  })

  it('orders strings by code unit and bigints exactly against numbers by default', () => {
    expect(bisectLeft(['a', 'b', 'd'], 'c')).toBe(2)
    expect(bisectLeft(['Z', 'a'], 'b')).toBe(2)
    expect(bisectLeft([1, 2n, 3], 2)).toBe(1)
    expect(bisectRight([1, 2n, 3], 2)).toBe(2)
    expect(bisectLeft([2 ** 53, 2n ** 53n + 1n], 2n ** 53n + 1n)).toBe(1)
  })

  it('asks for a comparator instead of guessing an order', () => {
    expect(() => bisect([{ a: 1 }], { a: 2 })).toThrow(TypeError)
    expect(() => bisect([1], '1' as unknown as number)).toThrow(TypeError)
    expect(() => bisect([1, 2], NaN)).toThrow(RangeError)
    expect(() => bisect([null], null)).toThrow(/pass a comparator/)
  })

  it('clamps hi to the length and rejects a negative lo', () => {
    const arr = [1, 2, 3]
    expect(bisect(arr, 2, undefined, 0, 100)).toBe(2)
    expect(bisectLeft(arr, 2, undefined, 0, 100)).toBe(1)
    expect(bisect(arr, 2, undefined, 0, Infinity)).toBe(2)
    expect(bisect(arr, 2, undefined, 0, -Infinity)).toBe(0)
    expect(() => bisect(arr, 1, undefined, -1)).toThrow(RangeError)
    expect(() => bisectLeft(arr, 1, undefined, -1)).toThrow(RangeError)
  })

  it('rejects bounds that are not integers, as Python does', () => {
    const arr = [1, 2, 3, 4, 5]
    const notIntegers = ['1', NaN, 1.5, null, {}, Infinity] as number[]
    for (const lo of notIntegers) {
      const message = new TypeError('lo must be an integer')
      expect(() => bisect(arr, 3, bounded(ascending), lo)).toThrow(message)
      expect(() => bisectLeft(arr, 3, bounded(ascending), lo)).toThrow(message)
      expect(() => binarySearch(arr, 3, bounded(ascending), lo)).toThrow(message)
      expect(() => insort(arr.slice(), 3, bounded(ascending), lo)).toThrow(message)
      expect(() => insortLeft(arr.slice(), 3, bounded(ascending), lo)).toThrow(message)
    }
    let valueOfCalls = 0
    const infinityObject = {
      valueOf(): number {
        valueOfCalls++
        return Infinity
      }
    }
    for (const hi of [
      '3',
      NaN,
      2.5,
      {},
      null,
      'Infinity',
      [Infinity],
      infinityObject
    ] as number[]) {
      const message = new TypeError('hi must be an integer')
      expect(() => bisect(arr, 3, undefined, 0, hi)).toThrow(message)
      expect(() => binarySearch(arr, 3, undefined, 0, hi)).toThrow(message)
      expect(() => insort(arr.slice(), 3, undefined, 0, hi)).toThrow(message)
    }
    expect(valueOfCalls).toBe(0)
  })

  it('checks lo before hi in every function', () => {
    const arr = [1, 2, 3]
    const message = new TypeError('lo must be an integer')
    expect(() => bisect(arr, 2, undefined, NaN, NaN)).toThrow(message)
    expect(() => bisectLeft(arr, 2, undefined, NaN, NaN)).toThrow(message)
    expect(() => binarySearch(arr, 2, undefined, NaN, NaN)).toThrow(message)
    expect(() => insort(arr.slice(), 2, undefined, NaN, NaN)).toThrow(message)
    expect(() => insortLeft(arr.slice(), 2, undefined, NaN, NaN)).toThrow(message)
  })

  it('rejects array-likes whose length is not a non-negative safe integer', () => {
    const notIntegers = [Infinity, NaN, 2.5, '5', undefined] as unknown as number[]
    for (const length of notIntegers) {
      const message = new TypeError('array length must be an integer')
      const arrayLike = { length } as ArrayLike<number>
      expect(() => bisectLeft(arrayLike, 1, bounded(ascending))).toThrow(message)
      expect(() => bisectRight(arrayLike, 1, bounded(ascending))).toThrow(message)
      expect(() => bisect(arrayLike, 1, bounded(ascending))).toThrow(message)
      expect(() => binarySearch(arrayLike, 1, bounded(ascending))).toThrow(message)
    }
    for (const length of [-1, 2 ** 53, 2 ** 53 + 2]) {
      const message = new RangeError('array length must be a non-negative safe integer')
      const arrayLike = { length } as ArrayLike<number>
      expect(() => bisectLeft(arrayLike, 1, bounded(ascending))).toThrow(message)
      expect(() => bisectRight(arrayLike, 1, bounded(ascending))).toThrow(message)
      expect(() => binarySearch(arrayLike, 1, bounded(ascending))).toThrow(message)
    }
  })

  it('ends on array-likes as long as the largest safe integer', () => {
    const longest = { length: Number.MAX_SAFE_INTEGER } as ArrayLike<number>
    const relational = (x: number, y: number): number => (x > y ? 1 : x < y ? -1 : 0)
    expect(
      bisectRight(
        longest,
        5,
        bounded(() => 1)
      )
    ).toBe(Number.MAX_SAFE_INTEGER)
    expect(
      bisectLeft(
        longest,
        5,
        bounded(() => -1)
      )
    ).toBe(Number.MAX_SAFE_INTEGER)
    expect(bisectRight(longest, 5, bounded(relational))).toBe(Number.MAX_SAFE_INTEGER)
  })

  it('insort and insortLeft keep the array sorted', () => {
    for (const seed of [[], [1], [1, 3], [1, 1, 4, 7, 9]]) {
      for (const x of [0, 1, 2, 5, 7, 10]) {
        const right = seed.slice()
        const left = seed.slice()
        expect(insort(right, x)).toBe(right)
        expect(insortLeft(left, x)).toBe(left)
        expect(right).toStrictEqual(seed.concat(x).toSorted(ascending))
        expect(left).toStrictEqual(seed.concat(x).toSorted(ascending))
      }
    }
    const a = { n: 1 }
    const b = { n: 1 }
    const byN = (x: { n: number }, y: { n: number }): number => x.n - y.n
    expect(insort([a], b, byN)).toEqual([a, b])
    expect(insort([a], b, byN)[1]).toBe(b)
    expect(insortLeft([a], b, byN)[0]).toBe(b)
  })

  it('binarySearch encodes a miss as -(insertion index) - 1', () => {
    const arr = [1, 3, 5, 7]
    expect(binarySearch(arr, 3)).toBe(1)
    expect(binarySearch(arr, 1)).toBe(0)
    expect(binarySearch(arr, 7)).toBe(3)
    expect(binarySearch(arr, 0)).toBe(-1)
    expect(binarySearch(arr, 2)).toBe(-2)
    expect(binarySearch(arr, 8)).toBe(-5)
    expect(-binarySearch(arr, 4) - 1).toBe(bisectLeft(arr, 4))
    expect(binarySearch(arr, 5, undefined, 0, 2)).toBe(-3)
  })

  it('finds the midpoint of arrays past 2^31 elements', () => {
    const huge = new Array<number>(2 ** 32 - 1)
    expect(
      bisectLeft(
        huge,
        5,
        bounded(() => -1)
      )
    ).toBe(2 ** 32 - 1)
    expect(
      bisect(
        huge,
        5,
        bounded(() => 1)
      )
    ).toBe(2 ** 32 - 1)
  })

  it('works on typed arrays', () => {
    expect(bisectLeft(new Float64Array([0.5, 1.5, 2.5]), 2)).toBe(2)
  })

  it('both insorts refuse huge sparse arrays', () => {
    const sparse = (): number[] => new Array<number>(2 ** 24 + 2048)
    const tooLarge = new RangeError('sparse array too large')
    expect(() => insort(sparse(), 1)).toThrow(tooLarge)
    expect(() => insortLeft(sparse(), 1)).toThrow(tooLarge)
  })

  it('both insorts report bad bounds before walking a huge array', () => {
    const sparse = (): number[] => new Array<number>(2 ** 24 + 2048)
    const negative = new RangeError('lo must be non-negative')
    expect(() => insort(sparse(), 1, undefined, -1)).toThrow(negative)
    expect(() => insortLeft(sparse(), 1, undefined, -1)).toThrow(negative)
  })

  it('both insorts accept sparse arrays below the huge-sparse length', () => {
    const right = insort(new Array<number>(2000), 1, () => 1)
    expect(right).toHaveLength(2001)
    expect(right[2000]).toBe(1)
    const left = insortLeft(new Array<number>(2000), 1, () => -1)
    expect(left).toHaveLength(2001)
    expect(left[2000]).toBe(1)
  })
})
