import vm from 'node:vm'
import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  countBy,
  entries,
  every,
  filter,
  find,
  findLast,
  flatMap,
  forEach,
  forEachRight,
  groupBy,
  includes,
  isEmpty,
  keyBy,
  keys,
  map,
  maxBy,
  meanBy,
  minBy,
  orderBy,
  partition,
  reduce,
  reduceRight,
  reject,
  size,
  some,
  sortBy,
  sumBy,
  values
} from '../src/collections/index.ts'

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

describe('forEach and forEachRight', () => {
  it('pass (value, key, collection) for every entry', () => {
    const obj = { a: 1, b: 2 }
    const seen: unknown[] = []
    forEach(obj, (value, key, collection) => {
      seen.push([value, key, collection === obj])
    })
    expect(seen).toEqual([
      [1, 'a', true],
      [2, 'b', true]
    ])
  })

  it.each([false, true])('visit every entry when the callback returns %s', (result) => {
    const seen: number[] = []
    forEach([1, 2, 3], (value) => {
      seen.push(value)
      return result
    })
    expect(seen).toStrictEqual([1, 2, 3])
  })

  it('forEachRight walks from the end, holes skipped', () => {
    const seen: unknown[] = []
    forEachRight(sparse(3, { 0: 'a', 2: 'c' }), (value, key) => {
      seen.push([key, value])
    })
    expect(seen).toEqual([
      [2, 'c'],
      [0, 'a']
    ])
    const set: string[] = []
    forEachRight(new Set(['x', 'y']), (value) => {
      set.push(value)
    })
    expect(set).toEqual(['y', 'x'])
  })
})

describe('map and flatMap', () => {
  it('map collects one result per entry of any shape', () => {
    expect(map({ a: 1, b: 2 }, (value) => value * 2)).toEqual([2, 4])
    expect(map(new Map([['x', 1]]), (value, key) => `${key}=${value}`)).toEqual(['x=1'])
    expect(map('ab', (ch, i) => ch + i)).toEqual(['a0', 'b1'])
    expect(map(null, () => 1)).toEqual([])
  })

  it('flatMap spreads array results one level, as the native method does', () => {
    expect(flatMap({ a: 1, b: 2 }, (value, key) => [key, value])).toEqual(['a', 1, 'b', 2])
    expect(
      flatMap<number[], number | number[]>([1, 2], (value) => (value === 1 ? [[value]] : value))
    ).toEqual([[1], 2])
    expect(flatMap(new Set(['a']), () => 'abc')).toEqual(['abc'])
  })

  it('flatMap skips holes in an array result, as the native method does', () => {
    expect(flatMap([1], () => sparse(2 ** 32 - 1, { 0: 'a' }))).toEqual(['a'])
  })
})

describe('filter, reject, find and findLast', () => {
  it('filter and reject split the values', () => {
    const obj = { a: 1, b: 2, c: 3 }
    expect(filter(obj, (value) => value % 2 === 1)).toEqual([1, 3])
    expect(reject(obj, (value) => value % 2 === 1)).toEqual([2])
    expect(filter(new Map([['k', 'v']]), (_value, key) => key === 'k')).toEqual(['v'])
  })

  it('filter narrows with a type guard', () => {
    const mixed: (number | string)[] = [1, 'a', 2]
    const nums: number[] = filter(mixed, (value): value is number => typeof value === 'number')
    expect(nums).toEqual([1, 2])
  })

  it('find and findLast narrow with a type guard', () => {
    const mixed: (number | string)[] = ['a', 1, 2, 'b']
    const isNumber = (value: number | string): value is number => typeof value === 'number'
    const first: number | undefined = find(mixed, isNumber)
    const last: number | undefined = findLast(mixed, isNumber)
    expect(first).toBe(1)
    expect(last).toBe(2)
  })

  it('find stops at its match', () => {
    let reads = 0
    function* endless(): Generator<number> {
      for (;;) yield reads++
    }
    expect(find(endless(), (value) => value === 2)).toBe(2)
    expect(reads).toBe(3)
    expect(find({ a: 1 }, (value) => value > 5)).toBeUndefined()
  })

  it('findLast searches from the end', () => {
    expect(findLast([1, 2, 3], (value) => value < 3)).toBe(2)
    expect(findLast('abc', (ch) => ch < 'c')).toBe('b')
  })
})

describe('some and every', () => {
  it('stop at the first decisive entry', () => {
    const seen: number[] = []
    expect(
      some([1, 2, 3], (value) => {
        seen.push(value)
        return value === 2
      })
    ).toBe(true)
    expect(seen).toEqual([1, 2])
    let reads = 0
    function* endless(): Generator<number> {
      for (;;) yield reads++
    }
    expect(every(endless(), (value) => value < 2)).toBe(false)
    expect(reads).toBe(3)
  })

  it('every is true when every entry passes and false when one fails', () => {
    expect(every(new Set([2, 4]), (value) => value % 2 === 0)).toBe(true)
    expect(every({ a: 2, b: 3 }, (value) => value % 2 === 0)).toBe(false)
  })

  it('some counts a truthy non-boolean result as a pass', () => {
    expect(some(['', 'x'], (value) => value)).toBe(true)
  })

  it('answer false and true for an empty collection', () => {
    expect(some({}, () => true)).toBe(false)
    expect(every(null, () => false)).toBe(true)
  })
})

describe('reduce and reduceRight', () => {
  it('fold with an initial value and the key', () => {
    expect(reduce({ a: 1, b: 2 }, (sum, value) => sum + value, 0)).toBe(3)
    expect(reduce(new Map([['x', 1]]), (out, value, key) => `${out}${key}${value}`, '')).toBe('x1')
    expect(reduceRight(['a', 'b', 'c'], (out, value) => out + value, '')).toBe('cba')
  })

  it('start from the first value without one', () => {
    expect(reduce([1, 2, 3], (sum, value) => sum + value)).toBe(6)
    expect(reduceRight([1, 2, 3], (out, value) => out - value)).toBe(0)
  })

  it('reduce reads each value when it reaches it, as the native method does', () => {
    const arr = [1, 2, 3]
    const total = reduce(
      arr,
      (sum, value, index) => {
        if (index === 0) arr[2] = 99
        return sum + value
      },
      0
    )
    expect(total).toBe(102)
  })

  it('throw on empty without an initial value, as the native method does', () => {
    const empty: number[] = []
    expect(() => reduceRight(empty, (a, b) => a + b)).toThrow(TypeError)
    expect(() => reduce(empty, (a, b) => a + b)).toThrow(TypeError)
    expect(reduce(empty, (a, b) => a + b, 5)).toBe(5)
  })

  it('an explicit undefined initial value counts', () => {
    expect(reduce([1], (acc: unknown) => acc, undefined)).toBeUndefined()
  })
})

describe('groupBy, countBy, keyBy and partition', () => {
  it('group values under their keys in a null-prototype object', () => {
    const groups = groupBy([6.1, 4.2, 6.3], (n) => Math.floor(n))
    expect(Object.getPrototypeOf(groups)).toBeNull()
    expect({ ...groups }).toEqual({ 4: [4.2], 6: [6.1, 6.3] })
    const named = groupBy(['__proto__', 'constructor'], (s) => s)
    expect(Object.keys(named)).toEqual(['__proto__', 'constructor'])
    expect(groupBy(new Map([['a', 1]]), (_v, key) => key).a).toEqual([1])
  })

  it('count values per key', () => {
    expect({ ...countBy(['one', 'two', 'three'], (s) => s.length) }).toEqual({ 3: 2, 5: 1 })
    const sym = Symbol('k')
    expect(countBy([1, 2], () => sym)[sym]).toBe(2)
    const named = countBy(['__proto__', 'toString', '__proto__'], (s) => s)
    expect(Object.getPrototypeOf(named)).toBeNull()
    expect(Object.keys(named)).toEqual(['__proto__', 'toString'])
    expect({ ...named }).toEqual({ ['__proto__']: 2, toString: 1 })
  })

  it('keyBy keeps the last value per key', () => {
    expect({
      ...keyBy(
        [
          { id: 'a', n: 1 },
          { id: 'a', n: 2 }
        ],
        (row) => row.id
      )
    }).toEqual({
      a: { id: 'a', n: 2 }
    })
  })

  it('keyBy keeps a __proto__ key as an own entry, not the prototype', () => {
    const rows: { id: string; isAdmin?: boolean }[] = JSON.parse(
      '[{"id":"__proto__","isAdmin":true},{"id":"bob"}]'
    )
    const index = keyBy(rows, (row) => row.id)
    expect(Object.getPrototypeOf(index)).toBeNull()
    expect(Object.keys(index)).toEqual(['__proto__', 'bob'])
    expect(Object.hasOwn(index, '__proto__')).toBe(true)
    expect((index as Record<string, unknown>).isAdmin).toBeUndefined()
  })

  it('partition splits into pass and fail', () => {
    expect(partition([1, 2, 3, 4], (n) => n % 2 === 0)).toEqual([
      [2, 4],
      [1, 3]
    ])
    expect(partition({ a: 1 }, () => false)).toEqual([[], [1]])
  })

  it('partition narrows with a type guard', () => {
    const mixed: (number | string)[] = [1, 'a', 2]
    const [strings, numbers]: [string[], number[]] = partition(
      mixed,
      (value): value is string => typeof value === 'string'
    )
    expect(strings).toEqual(['a'])
    expect(numbers).toEqual([1, 2])
  })
})

describe('sortBy and orderBy', () => {
  const rows = [
    { name: 'b', age: 2 },
    { name: 'a', age: 3 },
    { name: 'b', age: 1 }
  ]

  it('sort stably by one key or several in turn', () => {
    expect(sortBy(rows, (r) => r.name).map((r) => r.age)).toEqual([3, 2, 1])
    expect(sortBy(rows, [(r) => r.name, (r) => r.age]).map((r) => r.age)).toEqual([3, 1, 2])
    expect(sortBy({ x: 'b', y: 'a' }, (v) => v)).toEqual(['a', 'b'])
  })

  it('orderBy takes a direction per key and keeps nullish keys last', () => {
    expect(orderBy(rows, [(r) => r.name, (r) => r.age], ['desc', 'asc']).map((r) => r.age)).toEqual(
      [1, 2, 3]
    )
    const withNil = [{ n: 1 }, { n: undefined }, { n: 3 }, { n: null }]
    expect(orderBy(withNil, [(r) => r.n], ['desc']).map((r) => r.n)).toEqual([
      3,
      1,
      undefined,
      null
    ])
    expect(sortBy(withNil, (r) => r.n).map((r) => r.n)).toEqual([1, 3, undefined, null])
    expect(() => orderBy(rows, [(r) => r.age], ['up' as never])).toThrow(TypeError)
  })

  it('orderBy checks its orders before calling any key function', () => {
    let calls = 0
    const counted = (r: { age: number }) => {
      calls++
      return r.age
    }
    expect(() => orderBy(rows, [counted], ['up' as never])).toThrow('unknown sort order up')
    expect(() => orderBy(rows, [counted], ['asc', 'dsc' as never])).toThrow(TypeError)
    expect(() => orderBy(rows, [counted], ['asc', 'desc'])).toThrow(
      '2 sort orders given for 1 key functions'
    )
    expect(() => orderBy(rows, [counted], 'desc' as never)).toThrow(
      'orders must be an array of sort orders'
    )
    expect(() => orderBy(rows, counted as never, ['desc'])).toThrow(
      'keyOf must be an array of key functions'
    )
    expect(calls).toBe(0)
  })

  it('order numbers and bigints exactly, strings by code units', () => {
    expect(sortBy([2n, 1.5, 1n, 2 ** 53, 2n ** 53n + 1n], (n) => n)).toEqual([
      1n,
      1.5,
      2n,
      2 ** 53,
      2n ** 53n + 1n
    ])
    expect(sortBy(['b', 'B', 'a'], (s) => s)).toEqual(['B', 'a', 'b'])
  })

  it('refuse keys the default order cannot compare', () => {
    expect(() => sortBy([1, 2], () => NaN)).toThrow(RangeError)
    expect(() => maxBy([1, 2], () => NaN)).toThrow(RangeError)
    expect(() => sortBy([1, 'a'], (v) => v)).toThrow(TypeError)
    expect(() => sortBy([{}, {}], (v) => v as never)).toThrow(TypeError)
    expect(() => sortBy([true, false], (v) => v as never)).toThrow(TypeError)
  })

  it('refuse a bad key whether or not it is ever compared', () => {
    expect(() => sortBy([1], () => NaN)).toThrow(RangeError)
    expect(() => sortBy([{ n: NaN }, { n: null }], (r) => r.n)).toThrow(RangeError)
    expect(() => sortBy([{}], (v) => v as never)).toThrow(TypeError)
    const untied = [
      { a: 1, b: NaN },
      { a: 2, b: 0 }
    ]
    expect(() => sortBy(untied, [(r) => r.a, (r) => r.b])).toThrow(RangeError)
    const mixed: { a: number; b: number | string }[] = [
      { a: 1, b: 'x' },
      { a: 2, b: 3 }
    ]
    expect(() => sortBy(mixed, [(r) => r.a, (r) => r.b])).toThrow(TypeError)
    expect(() => minBy([{ n: NaN }, { n: null }], (r) => r.n)).toThrow(RangeError)
    expect(() => maxBy([{}], (v) => v as never)).toThrow(TypeError)
  })
})

describe('minBy, maxBy, sumBy and meanBy', () => {
  it('find the extremes, skipping nullish keys, first on a tie', () => {
    const a = { n: 1 }
    const b = { n: 1 }
    expect(minBy([{ n: 2 }, a, b], (r) => r.n)).toBe(a)
    const firstMax = { n: 7 }
    const lastMax = { n: 7 }
    expect(maxBy({ x: { n: 3 }, y: firstMax, z: lastMax }, (r) => r.n)).toBe(firstMax)
    expect(minBy([{ n: undefined }, { n: 5 }], (r) => r.n)).toEqual({ n: 5 })
    expect(maxBy([{ n: 5 }, { n: null }], (r) => r.n)).toEqual({ n: 5 })
    expect(maxBy([{ n: 1 }, { n: undefined }], (r) => r.n)).toEqual({ n: 1 })
    expect(minBy([{ n: null }], (r) => r.n)).toBeUndefined()
    expect(maxBy([], (n: number) => n)).toBeUndefined()
  })

  it('add and average numbers', () => {
    expect(sumBy([{ n: 4 }, { n: 2 }], (r) => r.n)).toBe(6)
    expect(sumBy(null, () => 1)).toBe(0)
    expect(meanBy(new Set([1, 2, 3]), (n) => n)).toBe(2)
    expect(meanBy([], (n: number) => n)).toBeNaN()
    expect(() => sumBy(['1'], (s) => s as never)).toThrow(TypeError)
  })
})
