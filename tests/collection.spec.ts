import vm from 'node:vm'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { entries, includes, isEmpty, keys, size, values } from '../src/collections/index.ts'

function* gen(): Generator<string> {
  yield 'a'
  yield 'b'
}

function sparse(length: number, at: Record<number, unknown>): unknown[] {
  const arr: unknown[] = []
  arr.length = length
  for (const [k, v] of Object.entries(at)) arr[Number(k)] = v
  return arr
}

describe('keys, values, entries', () => {
  it('read a plain object by its own enumerable string keys', () => {
    const proto = { inherited: 1 }
    const obj = Object.create(proto) as Record<string | symbol, number>
    obj.b = 2
    obj.a = 1
    obj[Symbol('s')] = 3
    Object.defineProperty(obj, 'hidden', { value: 4, enumerable: false })
    expect(keys(obj)).toEqual(['b', 'a'])
    expect(values(obj)).toEqual([2, 1])
    expect(entries(obj)).toEqual([
      ['b', 2],
      ['a', 1]
    ])
  })

  it('read an array by index and skip holes', () => {
    const arr = sparse(4, { 0: 'a', 2: 'c' })
    expect(keys(arr)).toEqual([0, 2])
    expect(values(arr)).toEqual(['a', 'c'])
    expect(entries([undefined])).toEqual([[0, undefined]])
  })

  it('stay linear on a huge sparse array', () => {
    const arr = sparse(2 ** 32 - 1, { 1: 'a', 4000000000: 'b' })
    expect(entries(arr)).toEqual([
      [1, 'a'],
      [4_000_000_000, 'b']
    ])
  })

  it('read a typed array by index', () => {
    const bytes = new Uint8Array([7, 8])

    expect(entries(bytes)).toStrictEqual([
      [0, 7],
      [1, 8]
    ])
    expect(keys(bytes)).toStrictEqual([0, 1])
    expect(isEmpty(bytes)).toBe(false)
    expect(keys(new Uint8Array())).toStrictEqual([])
    expect(isEmpty(new Uint8Array())).toBe(true)
  })

  it('read a typed array through its slots, not its own methods', () => {
    class Bytes extends Uint8Array {
      override [Symbol.iterator](): ArrayIterator<number> {
        throw new Error('not called')
      }
    }
    expect(entries(new Bytes([7]))).toEqual([[0, 7]])
  })

  it('read a typed array with a detached buffer as empty', () => {
    const buffer = new ArrayBuffer(2)
    const bytes = new Uint8Array(buffer)
    buffer.transfer()
    expect(entries(bytes)).toEqual([])
    expect(size(bytes)).toBe(0)
  })

  it('read a string by code point', () => {
    expect(entries('a👍b')).toEqual([
      [0, 'a'],
      [1, '👍'],
      [2, 'b']
    ])
  })

  it('read a Map by key, a Set by member, in insertion order', () => {
    const key = {}
    const registry = new Map<unknown, number>([
      [key, 1],
      ['k', 2]
    ])

    expect(entries(registry)).toStrictEqual([
      [key, 1],
      ['k', 2]
    ])
    expect(keys(registry)).toStrictEqual([key, 'k'])
    expect(isEmpty(registry)).toBe(false)
    expect(keys(new Map())).toStrictEqual([])
    expect(isEmpty(new Map())).toBe(true)
    expect(keys(new Set(['x', 'y']))).toEqual(['x', 'y'])
    expect(values(new Set(['x', 'y']))).toEqual(['x', 'y'])
  })

  it('read Map and Set subclasses and other realms through their slots', () => {
    class Registry extends Map<string, number> {
      override entries(): MapIterator<[string, number]> {
        throw new Error('not called')
      }
      override [Symbol.iterator](): MapIterator<[string, number]> {
        throw new Error('not called')
      }
    }
    expect(entries(new Registry([['r', 1]]))).toEqual([['r', 1]])
    class Tags extends Set<string> {
      override values(): SetIterator<string> {
        throw new Error('not called')
      }
    }
    expect(values(new Tags(['t']))).toEqual(['t'])
    const foreign = vm.runInNewContext('new Map([[1, 2]])') as Map<number, number>
    expect(entries(foreign)).toEqual([[1, 2]])
  })

  it('read any other iterable by position', () => {
    expect(entries(gen())).toEqual([
      [0, 'a'],
      [1, 'b']
    ])
  })

  it('treat an array-like object as an object', () => {
    const arrayLike = { length: 1, 0: 'a' }
    const arrayLikeKeys: string[] = keys(arrayLike)
    const arrayLikeValues: (string | number)[] = values(arrayLike)
    expect(arrayLikeKeys).toEqual(['0', 'length'])
    expect(arrayLikeValues).toEqual(['a', 1])
    expect(includes(arrayLike, 1)).toBe(true)
  })

  it('type the values of an unknown object as unknown', () => {
    function holds(collection: object, value: unknown): boolean {
      return includes(collection, value)
    }
    const read = values({ a: 1 } as object)
    expectTypeOf(read).toEqualTypeOf<unknown[]>()
    expect(holds({ a: 1 }, 1)).toBe(true)
    expect(read).toEqual([1])
  })

  it('give nothing for null and undefined', () => {
    expect(keys(null)).toEqual([])
    expect(values(undefined)).toEqual([])
  })

  it('read other primitives as empty, as Object.keys does', () => {
    expect(keys(5 as never)).toEqual([])
    expect(values(true as never)).toEqual([])
    expect(entries(1n as never)).toEqual([])
    expect(size(Symbol('s') as never)).toBe(0)
    expect(isEmpty(0 as never)).toBe(true)
    expect(includes(5 as never, 5 as never)).toBe(false)
  })
})

describe('size and isEmpty', () => {
  it('count the entries of every shape', () => {
    expect(size({ a: 1, b: 2 })).toBe(2)
    expect(size(sparse(3, { 1: 'x' }))).toBe(1)
    expect(size('👍🏽')).toBe(2)
    expect(size(new Map([[1, 1]]))).toBe(1)
    expect(size(new Set([1, 2, 3]))).toBe(3)
    expect(size(new Float64Array(4))).toBe(4)
    expect(size(gen())).toBe(2)
    expect(size(null)).toBe(0)
  })

  it('isEmpty follows size', () => {
    expect(isEmpty({})).toBe(true)
    expect(isEmpty(sparse(5, {}))).toBe(true)
    expect(isEmpty('')).toBe(true)
    expect(isEmpty(new Set())).toBe(true)
    expect(isEmpty(new Uint8Array(0))).toBe(true)
    expect(isEmpty(undefined)).toBe(true)
    expect(isEmpty({ a: undefined })).toBe(false)
  })

  it('isEmpty reads an iterable only to its first element', () => {
    let reads = 0
    function* endless(): Generator<number> {
      for (;;) yield reads++
    }
    expect(isEmpty(endless())).toBe(false)
    expect(reads).toBe(1)
  })
})

describe('includes', () => {
  it('compares values with SameValueZero', () => {
    expect(includes([NaN], NaN)).toBe(true)
    expect(includes([-0], 0)).toBe(true)
    expect(includes({ a: 1 }, 1)).toBe(true)
    expect(includes({ a: 1 }, 'a' as never)).toBe(false)
    expect(includes(new Map([['k', NaN]]), NaN)).toBe(true)
    expect(includes(new Map([['k', 1]]), 'k' as never)).toBe(false)
    expect(includes(new Set([{}]), {})).toBe(false)
  })

  it('searches a string for a substring', () => {
    expect(includes('hello', 'ell')).toBe(true)
    expect(includes('hello', 'x')).toBe(false)
  })

  it('stops at the first match of an iterable', () => {
    let reads = 0
    function* endless(): Generator<number> {
      for (;;) yield reads++
    }
    expect(includes(endless(), 3)).toBe(true)
    expect(reads).toBe(4)
  })
})
