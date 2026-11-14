import { describe, expect, it } from 'vitest'
import {
  arrayFromIterable,
  arrayFromIterableMap,
  forEachArrayElement,
  iteratesAsArray,
  requireIterable
} from '../../src/collections/internal/iterable.ts'

const notIterables = [undefined, null, 1, {}, { [Symbol.iterator]: 1 }]
const hugeSparse = (): number[] => new Array<number>(2 ** 24 + 2048)
const tooLarge = new RangeError('sparse array too large')

/** An array whose own `[Symbol.iterator]` yields `values` instead of its elements. */
function withIterator<T>(arr: T[], values: T[]): T[] {
  Object.defineProperty(arr, Symbol.iterator, {
    value: function* () {
      yield* values
    }
  })
  return arr
}

describe('iteratesAsArray', () => {
  it('is true only for arrays that use the built-in array iterator', () => {
    class Sub extends Array<number> {}
    class OwnIterator extends Array<number> {
      override *[Symbol.iterator](): ArrayIterator<number> {
        yield 1
      }
    }
    expect(iteratesAsArray([1])).toBe(true)
    expect(iteratesAsArray(Sub.from([1]))).toBe(true)
    expect(iteratesAsArray(new OwnIterator())).toBe(false)
    expect(iteratesAsArray(withIterator([1], [2]))).toBe(false)
    expect(iteratesAsArray({ length: 0, [Symbol.iterator]: Array.prototype.values })).toBe(false)
    expect(iteratesAsArray(new Set([1]))).toBe(false)
  })
})

describe('requireIterable', () => {
  it('returns iterables as they are and rejects everything else', () => {
    const set = new Set([1])
    expect(requireIterable(set)).toBe(set)
    expect(requireIterable('ab')).toBe('ab')
    for (const value of notIterables) {
      expect(() => requireIterable(value)).toThrow(new TypeError('expected an iterable'))
    }
  })
})

describe('arrayFromIterable', () => {
  it('copies arrays and iterables into a new array', () => {
    const arr = [1, 2]
    const copy = arrayFromIterable<number>(arr)
    expect(copy).toEqual([1, 2])
    expect(copy).not.toBe(arr)
    expect(arrayFromIterable(new Set([3, 4]))).toEqual([3, 4])
  })

  it('rejects non-iterables and huge sparse arrays', () => {
    for (const value of notIterables) expect(() => arrayFromIterable(value)).toThrow(TypeError)
    expect(() => arrayFromIterable(hugeSparse())).toThrow(tooLarge)
  })

  it('reads holes as undefined, as iteration does', () => {
    // biome-ignore lint/suspicious/noSparseArray: the hole is the point of the test
    const copy = arrayFromIterable<number | undefined>([1, , 3])
    expect(copy).toEqual([1, undefined, 3])
    expect(1 in copy).toBe(true)
  })

  it('returns a plain array whatever Symbol.species an Array subclass names', () => {
    let speciesCalls = 0
    class Hostile extends Array<number> {
      static override get [Symbol.species](): ArrayConstructor {
        speciesCalls++
        return Array
      }
    }
    const copy = arrayFromIterable<number>(Hostile.from([2, 1]))
    expect(Object.getPrototypeOf(copy)).toBe(Array.prototype)
    expect(copy).toEqual([2, 1])
    expect(speciesCalls).toBe(0)
  })

  it('follows an own or subclass Symbol.iterator instead of the elements', () => {
    expect(arrayFromIterable(withIterator([1, 2], [9]))).toEqual([9])
    class Doubled extends Array<number> {
      override *[Symbol.iterator](): ArrayIterator<number> {
        for (let i = 0; i < this.length; i++) yield this[i] * 2
      }
    }
    expect(arrayFromIterable(Doubled.from([1, 2]))).toEqual([2, 4])
  })

  it('leaves a huge sparse array with its own iterator to that iterator', () => {
    expect(arrayFromIterable(withIterator(hugeSparse(), [5]))).toEqual([5])
  })
})

describe('arrayFromIterableMap', () => {
  it('maps each item with its index', () => {
    expect(arrayFromIterableMap(new Set(['a', 'b']), (item, index) => `${item}${index}`)).toEqual([
      'a0',
      'b1'
    ])
  })

  it('rejects non-iterables and huge sparse arrays before mapping', () => {
    let calls = 0
    const mapFn = (): number => ++calls
    for (const value of notIterables) {
      expect(() => arrayFromIterableMap(value, mapFn)).toThrow(TypeError)
    }
    expect(() => arrayFromIterableMap(hugeSparse(), mapFn)).toThrow(tooLarge)
    expect(calls).toBe(0)
  })

  it('follows an own Symbol.iterator, even on a huge sparse array', () => {
    expect(arrayFromIterableMap(withIterator([1, 2], [9]), (item) => item)).toEqual([9])
    expect(arrayFromIterableMap(withIterator(hugeSparse(), [5]), (item) => item)).toEqual([5])
  })
})

describe('forEachArrayElement', () => {
  it('visits each value and each hole run once, at the start of the run', () => {
    const seen: [unknown, number][] = []
    // biome-ignore lint/suspicious/noSparseArray: the holes are the point of the test
    forEachArrayElement([1, , , 4], (value, index) => {
      seen.push([value, index])
      return undefined
    })
    expect(seen).toEqual([
      [1, 0],
      [undefined, 1],
      [4, 3]
    ])
  })

  it('stops when visit returns false', () => {
    const seen: number[] = []
    forEachArrayElement([1, 2, 3], (value) => {
      seen.push(value)
      return value < 2
    })
    expect(seen).toEqual([1, 2])
  })
})
