import { describe, expect, it } from 'vitest'
import { chunk, dropWhile, range, remove, takeWhile, zip } from '../src/array/index.ts'
import { sparse } from './sparse.ts'

describe('chunk', () => {
  it('splits into pieces of size, the last holding the rest', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunk([], 3)).toEqual([])
  })

  it('refuses a size that is not a positive integer', () => {
    for (const size of [0, -1, 1.5, NaN, Infinity]) {
      expect(() => chunk([1], size)).toThrow(RangeError)
    }
  })

  it('refuses a huge sparse array instead of expanding its holes', () => {
    expect(() => chunk(sparse(2 ** 32 - 1, { 0: 'x' }), 1)).toThrow(
      new RangeError('sparse array too large')
    )
  })
})

describe('zip', () => {
  it('builds rows as long as the longest input', () => {
    expect(zip(['a', 'b'], [1, 2])).toEqual([
      ['a', 1],
      ['b', 2]
    ])
    expect(zip(['a'], [1, 2])).toEqual([
      ['a', 1],
      [undefined, 2]
    ])
    expect(zip()).toEqual([])
  })

  it('undoes itself', () => {
    const rows = zip(['a', 'b'], [1, 2])
    expect(zip(...rows)).toEqual([
      ['a', 'b'],
      [1, 2]
    ])
  })

  it('infers widened row types', () => {
    const rows = zip(['a'], [1])
    rows.push(['b', 2])
    expect(rows).toEqual([
      ['a', 1],
      ['b', 2]
    ])
  })

  it('refuses a huge sparse input instead of expanding its holes', () => {
    expect(() => zip(['a'], sparse(2 ** 32 - 1, { 0: 'x' }))).toThrow(
      new RangeError('sparse array too large')
    )
    expect(() => zip({ length: 2 ** 32 - 1 } as never)).toThrow(
      new RangeError('sparse array too large')
    )
  })
})

describe('range', () => {
  it('follows Python bounds', () => {
    expect(range(4)).toEqual([0, 1, 2, 3])
    expect(range(1, 4)).toEqual([1, 2, 3])
    expect(range(1, 10, 3)).toEqual([1, 4, 7])
    expect(range(3, 0, -1)).toEqual([3, 2, 1])
    expect(range(5, 1)).toEqual([])
    expect(range(0)).toEqual([])
  })

  it('computes each element from start, so fractional steps do not drift', () => {
    expect(range(0, 1, 0.1)).toHaveLength(10)
    expect(range(0, 1, 0.1)[9]).toBe(0.9)
    expect(range(0, 0.3, 0.1)).toEqual([0, 0.1, 0.2])
  })

  it('stops before stop when rounding overcounts', () => {
    expect(range(0, 3 * 0.1, 0.1)).toEqual([0, 0.1, 0.2])
  })

  it('refuses bad bounds and steps', () => {
    expect(() => range(0, 1, 0)).toThrow(RangeError)
    expect(() => range(0, 0, 0)).toThrow(RangeError)
    expect(() => range(5, 1, 0)).toThrow(RangeError)
    expect(() => range(NaN)).toThrow(RangeError)
    expect(() => range(0, Infinity)).toThrow(RangeError)
    expect(() => range(0, 1, Infinity)).toThrow(RangeError)
    expect(() => range('3' as never)).toThrow(TypeError)
  })

  it('refuses more numbers than an array can hold', () => {
    expect(() => range(0, 2 ** 40)).toThrow(RangeError)
  })
})

describe('remove', () => {
  it('returns removed elements and updates the array in place', () => {
    const xs = [1, 2, 3, 4]
    expect(remove(xs, (n) => n % 2 === 0)).toStrictEqual([2, 4])
    expect(xs).toEqual([1, 3])
    expect(remove(xs, () => false)).toStrictEqual([])
    expect(xs).toEqual([1, 3])
  })

  it('narrows the removed elements with a type guard', () => {
    const xs: (number | string)[] = [1, 'a', 2]
    const numbers: number[] = remove(xs, (x): x is number => typeof x === 'number')
    expect(numbers).toEqual([1, 2])
    expect(xs).toEqual(['a'])
  })

  it('keeps every element the predicate kept when the predicate edits the array', () => {
    const xs = ['a', 'b', 'c', 'd']
    const removed = remove(xs, (_value, index, array) => {
      if (index === 1) delete array[0]
      return index === 0
    })
    expect(removed).toEqual(['a'])
    expect(xs).toEqual(['b', 'c', 'd'])
  })

  it('passes (value, index, array) with the original indices', () => {
    const xs = ['a', 'b', 'c']
    const seen: [string, number][] = []
    remove(xs, (value, index, array) => {
      seen.push([value, index])
      return array === xs && index === 0
    })
    expect(seen).toEqual([
      ['a', 0],
      ['b', 1],
      ['c', 2]
    ])
    expect(xs).toEqual(['b', 'c'])
  })

  it('skips holes', () => {
    const seen: number[] = []
    remove(sparse(4, { 0: 1, 2: 3, 3: 4 }), (_value, index) => {
      seen.push(index)
      return false
    })
    expect(seen).toEqual([0, 2, 3])
  })

  it('keeps holes next to their neighbours', () => {
    const xs = sparse(4, { 0: 1, 2: 3, 3: 4 })
    expect(remove(xs, (_value, index) => index === 0)).toEqual([1])
    expect(xs).toHaveLength(3)
    expect(0 in xs).toBe(false)
    expect(xs.slice(1)).toEqual([3, 4])
  })

  it('stays linear on a huge sparse array', () => {
    const xs = sparse(2 ** 32 - 1, { 0: 'x', 4000000000: 'y' })
    expect(remove(xs, (value) => value === 'x')).toEqual(['x'])
    expect(xs).toHaveLength(2 ** 32 - 2)
    expect(xs[3_999_999_999]).toBe('y')
  })
})

describe('dropWhile and takeWhile', () => {
  it('split at the first element that fails', () => {
    expect(dropWhile([1, 2, 3, 1], (n) => n < 3)).toEqual([3, 1])
    expect(takeWhile([1, 2, 3, 1], (n) => n < 3)).toEqual([1, 2])
    expect(dropWhile([1, 2], () => true)).toEqual([])
    expect(takeWhile([1, 2], () => true)).toEqual([1, 2])
  })

  it('pass the index and the array', () => {
    const xs = ['a', 'b', 'c']
    expect(takeWhile(xs, (_v, i, arr) => arr === xs && i < 2)).toEqual(['a', 'b'])
    expect(dropWhile(xs, (_v, i, arr) => arr === xs && i < 2)).toEqual(['c'])
  })

  it('skip holes', () => {
    const seen: number[] = []
    takeWhile(sparse(4, { 0: 1, 2: 3, 3: 4 }), (_value, index) => {
      seen.push(index)
      return true
    })
    expect(seen).toEqual([0, 2, 3])
  })

  it('leave a hole before the first failing element in the taken part', () => {
    const xs = sparse(4, { 0: 1, 2: 3, 3: 4 })
    const taken = takeWhile(xs, (n) => n === 1)
    expect(taken).toHaveLength(2)
    expect(1 in taken).toBe(false)
    expect(taken[0]).toBe(1)
    expect(dropWhile(xs, (n) => n === 1)).toEqual([3, 4])
  })

  it('narrow takeWhile with a type guard', () => {
    const xs: (number | string)[] = [1, 2, 'a', 3]
    const numbers: number[] = takeWhile(xs, (x): x is number => typeof x === 'number')
    expect(numbers).toEqual([1, 2])
  })

  it('stay linear on a huge sparse array', () => {
    const xs = sparse(2 ** 32 - 1, { 0: 1, 4000000000: 2 })
    const taken = takeWhile(xs, () => true)
    expect(taken).toHaveLength(2 ** 32 - 1)
    expect(taken[4_000_000_000]).toBe(2)
    const dropped = dropWhile(xs, (n) => n === 1)
    expect(dropped).toHaveLength(2 ** 32 - 1 - 4_000_000_000)
    expect(dropped[0]).toBe(2)
  })
})
