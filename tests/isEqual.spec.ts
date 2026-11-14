import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import { DEPTH_ERROR } from '../src/internal/walk.ts'
import { isEqual, isEqualWith } from '../src/object/isEqual.ts'
import { omit } from '../src/object/pick.ts'
import { sparse } from './sparse.ts'

const overflow = () => new RangeError('Maximum call stack size exceeded')

class Point {
  x: number
  y: number
  constructor(x: number, y: number) {
    this.x = x
    this.y = y
  }
}

function ring(length: number): object {
  const first: { next?: unknown } = {}
  let node = first
  for (let i = 1; i < length; i++) node = node.next = {} as { next?: unknown }
  node.next = first
  return first
}

function diamond(levels: number): object {
  let value: object = { leaf: true }
  for (let i = 0; i < levels; i++) value = { a: value, b: value }
  return value
}

function nest(depth: number): unknown[] {
  let value: unknown[] = []
  for (let i = 1; i < depth; i++) value = [value]
  return value
}

describe('isEqual', () => {
  it('compares primitives by SameValueZero', () => {
    expect(isEqual(NaN, NaN)).toBe(true)
    expect(isEqual(0, -0)).toBe(true)
    expect(isEqual('a', 'a')).toBe(true)
    expect(isEqual(1, 1n)).toBe(false)
    expect(isEqual(1, '1')).toBe(false)
    expect(isEqual(null, undefined)).toBe(false)
    expect(isEqual(Symbol.for('a'), Symbol.for('a'))).toBe(true)
  })

  it('compares plain objects by own enumerable keys, symbols included', () => {
    const tag = Symbol('tag')
    expect(isEqual({ a: 1, b: { c: [2] } }, { b: { c: [2] }, a: 1 })).toBe(true)
    expect(isEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false)
    expect(isEqual({ a: undefined }, { b: undefined })).toBe(false)
    expect(isEqual({ [tag]: 1 }, { [tag]: 1 })).toBe(true)
    expect(isEqual({ [tag]: 1 }, { [tag]: 2 })).toBe(false)
    const hidden = Object.defineProperty({ a: 1 }, 'b', { value: 2, enumerable: false })
    expect(isEqual(hidden, { a: 1 })).toBe(true)
    const hiddenSymbol = Object.defineProperty({ a: 1 }, tag, { value: 2, enumerable: false })
    expect(isEqual(hiddenSymbol, { a: 1 })).toBe(true)
    expect(isEqual(Object.create(null), {})).toBe(true)
    expect(isEqual(runInNewContext('({ a: [1] })'), { a: [1] })).toBe(true)
  })

  it('compares arrays by index, a hole equal to undefined', () => {
    expect(isEqual([1, [2, 3]], [1, [2, 3]])).toBe(true)
    expect(isEqual([1, 2], [1, 2, 3])).toBe(false)
    // biome-ignore lint/suspicious/noSparseArray: a hole is the value under test
    expect(isEqual([, 1], [undefined, 1])).toBe(true)
    // biome-ignore lint/suspicious/noSparseArray: a hole is the value under test
    expect(isEqual([, 1], [2, 1])).toBe(false)
    // biome-ignore lint/suspicious/noSparseArray: a hole is the value under test
    expect(isEqual([2, 1], [, 1])).toBe(false)
    // biome-ignore lint/suspicious/noSparseArray: a hole is the value under test
    expect(isEqual([1, , 3], [1, 2, 3])).toBe(false)
    expect(isEqual(Object.assign([1], { extra: true }), [1])).toBe(true)
    expect(isEqual([], {})).toBe(false)
    expect(isEqual([1], { 0: 1, length: 1 })).toBe(false)
  })

  it('walks huge sparse arrays by their own elements', () => {
    const make = (last: string) => sparse(4_294_967_294, { 0: 'x', 4e9: last })
    expect(isEqual(make('y'), make('y'))).toBe(true)
    expect(isEqual(make('y'), make('z'))).toBe(false)
  })

  it('compares Maps by key membership, then value', () => {
    const key = {}
    expect(isEqual(new Map([[1, { a: 1 }]]), new Map([[1, { a: 1 }]]))).toBe(true)
    expect(isEqual(new Map([[NaN, 1]]), new Map([[NaN, 1]]))).toBe(true)
    expect(isEqual(new Map([[key, 1]]), new Map([[key, 1]]))).toBe(true)
    expect(isEqual(new Map([[{}, 1]]), new Map([[{}, 1]]))).toBe(false)
    expect(isEqual(new Map([[1, 1]]), new Map([[1, 2]]))).toBe(false)
    expect(isEqual(new Map([[1, 1]]), new Map([[2, 1]]))).toBe(false)
    const pair = new Map([
      [1, 1],
      [2, 2]
    ])
    expect(isEqual(new Map([[1, 1]]), pair)).toBe(false)
    expect(isEqual(pair, new Map([[1, 1]]))).toBe(false)
    expect(
      isEqual(
        new Map([
          [1, 1],
          [2, 2]
        ]),
        new Map([
          [2, 2],
          [1, 1]
        ])
      )
    ).toBe(true)
  })

  it('compares Sets by membership', () => {
    const member = {}
    expect(isEqual(new Set([1, 2]), new Set([2, 1]))).toBe(true)
    expect(isEqual(new Set([member]), new Set([member]))).toBe(true)
    expect(isEqual(new Set([{}]), new Set([{}]))).toBe(false)
    expect(isEqual(new Set([1]), new Set([1, 2]))).toBe(false)
    expect(isEqual(new Set([0]), new Set([-0]))).toBe(true)
  })

  it('compares Dates, RegExps, buffers, views and boxes by content', () => {
    expect(isEqual(new Date(1), new Date(1))).toBe(true)
    expect(isEqual(new Date(1), new Date(2))).toBe(false)
    expect(isEqual(new Date(NaN), new Date(NaN))).toBe(true)
    expect(isEqual(/a/g, /a/g)).toBe(true)
    expect(isEqual(/a/g, /a/i)).toBe(false)
    expect(isEqual(/a/, /b/)).toBe(false)
    expect(isEqual(/a/g, /a/)).toBe(false)
    expect(isEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true)
    expect(isEqual(new Uint8Array([1]), new Int8Array([1]))).toBe(false)
    expect(isEqual(new Uint8Array([1]), new Uint8Array([1, 0]))).toBe(false)
    expect(isEqual(new Float64Array([0, NaN]), new Float64Array([-0, NaN]))).toBe(true)
    expect(isEqual(new Float64Array([1]), new Float64Array([1, 2]))).toBe(false)
    const [left, right] = [new Float64Array([1, 2]), new Float64Array([9, 9])]
    expect(isEqual(left, right)).toBe(false)
    expect(isEqual(new ArrayBuffer(2), new ArrayBuffer(2))).toBe(true)
    expect(isEqual(new Uint8Array([1]).buffer, new ArrayBuffer(1))).toBe(false)
    expect(
      isEqual(new DataView(new Uint8Array([1]).buffer), new DataView(new ArrayBuffer(1)))
    ).toBe(false)
    expect(isEqual(Object(1), Object(1))).toBe(true)
    expect(isEqual(Object(1), Object(2))).toBe(false)
    expect(isEqual(Object('a'), 'a')).toBe(false)
    expect(isEqual(runInNewContext('new Date(5)'), new Date(5))).toBe(true)
  })

  describe.each(['g', 'y', ''])('RegExp flags "%s"', (flags) => {
    it.each([
      { left: 1000, right: 0, equal: false },
      { left: 1000, right: 1000, equal: true },
      { left: NaN, right: NaN, equal: true },
      { left: NaN, right: 0, equal: false },
      { left: 0, right: -0, equal: true }
    ])('isEqual compares RegExp lastIndex: $left vs $right', ({ left, right, equal }) => {
      const a = new RegExp('foo', flags)
      const b = new RegExp('foo', flags)
      a.lastIndex = left
      b.lastIndex = right

      expect(isEqual(a, b)).toBe(equal)
    })
  })

  it('compares every other object by identity', () => {
    const fn = () => {}
    expect(isEqual(new Point(1, 2), new Point(1, 2))).toBe(false)
    const point = new Point(1, 2)
    expect(isEqual(point, point)).toBe(true)
    expect(isEqual(fn, fn)).toBe(true)
    expect(
      isEqual(
        () => {},
        () => {}
      )
    ).toBe(false)
    expect(isEqual(Promise.resolve(1), Promise.resolve(1))).toBe(false)
    expect(isEqual(new URL('https://a.example'), new URL('https://a.example'))).toBe(false)
    expect(isEqual({ [Symbol.toStringTag]: 'X' }, { [Symbol.toStringTag]: 'X' })).toBe(false)
    expect(isEqual({ p: new Point(1, 2) }, { p: new Point(1, 2) })).toBe(false)
  })

  it('compares errors by name, message, cause, errors and own enumerable properties', () => {
    expect(isEqual(new Error('x'), new Error('x'))).toBe(true)
    expect(isEqual(new Error('x'), new Error('y'))).toBe(false)
    expect(isEqual(new TypeError('x'), new Error('x'))).toBe(false)
    expect(isEqual(new Error('x', { cause: [1] }), new Error('x', { cause: [1] }))).toBe(true)
    expect(isEqual(new Error('x', { cause: 1 }), new Error('x', { cause: 2 }))).toBe(false)
    expect(isEqual(new Error('x', { cause: undefined }), new Error('x'))).toBe(false)
    expect(
      isEqual(
        Object.assign(new Error('x'), { code: 1 }),
        Object.assign(new Error('x'), { code: 1 })
      )
    ).toBe(true)
    expect(isEqual(Object.assign(new Error('x'), { code: 1 }), new Error('x'))).toBe(false)
    expect(isEqual(new AggregateError([1], 'x'), new AggregateError([1], 'x'))).toBe(true)
    expect(isEqual(new AggregateError([1], 'x'), new AggregateError([2], 'x'))).toBe(false)
    expect(
      isEqual(
        Object.assign(new Error('x'), { line: 1, column: 2, sourceURL: 'a.js' }),
        Object.assign(new Error('x'), { line: 3, column: 4, sourceURL: 'b.js' })
      )
    ).toBe(true)
    expect(isEqual(runInNewContext('new RangeError("x")'), new RangeError('x'))).toBe(true)
    const renamed = new Error('x')
    renamed.name = 'Custom'
    expect(isEqual(renamed, new Error('x'))).toBe(false)
    const cyclic = new Error('x')
    const twin = new Error('x')
    Object.assign(cyclic, { cause: cyclic })
    Object.assign(twin, { cause: twin })
    expect(isEqual(cyclic, twin)).toBe(true)
  })

  it('compares arguments objects like arrays', () => {
    const args = function (..._rest: unknown[]) {
      // biome-ignore lint/complexity/noArguments: the arguments object is the value under test
      return arguments
    }
    expect(isEqual(args(1, [2]), args(1, [2]))).toBe(true)
    expect(isEqual(args(1), args(1, 2))).toBe(false)
    expect(isEqual(args(1), [1])).toBe(false)
    expect(isEqual(args(1), { 0: 1 })).toBe(false)
  })

  it('needs one class on both sides', () => {
    class MyMap<K, V> extends Map<K, V> {}
    class MyArray<T> extends Array<T> {}
    expect(isEqual(new MyMap([[1, 1]]), new MyMap([[1, 1]]))).toBe(true)
    expect(isEqual(new MyMap(), new Map())).toBe(false)
    expect(isEqual(MyArray.from([1]), [1])).toBe(false)
  })

  it('calls no method of the values it compares', () => {
    const spy = vi.fn(() => true)
    const odd = { equals: spy, valueOf: spy, toJSON: spy, [Symbol.iterator]: spy }
    expect(isEqual(odd, { ...odd })).toBe(true)
    class Weird<K, V> extends Map<K, V> {
      override has(_key: K): boolean {
        return spy()
      }
      override entries(): MapIterator<[K, V]> {
        spy()
        return super.entries()
      }
    }
    expect(isEqual(new Weird([[1, 1]]), new Weird([[1, 2]]))).toBe(false)
    class WeirdSet<T> extends Set<T> {
      override has(_value: T): boolean {
        return spy()
      }
      override values(): SetIterator<T> {
        spy()
        return super.values()
      }
      override [Symbol.iterator](): SetIterator<T> {
        spy()
        return super[Symbol.iterator]()
      }
    }
    expect(isEqual(new WeirdSet([1]), new WeirdSet([2]))).toBe(false)
    class WeirdDate extends Date {
      override getTime(): number {
        spy()
        return 0
      }
    }
    expect(isEqual(new WeirdDate(1), new WeirdDate(2))).toBe(false)
    class WeirdRegExp extends RegExp {}
    expect(isEqual(new WeirdRegExp('a', 'g'), new WeirdRegExp('a', 'g'))).toBe(true)
    expect(isEqual(new WeirdRegExp('a', 'g'), new WeirdRegExp('b', 'g'))).toBe(false)
    class WeirdFloats extends Float64Array {}
    expect(isEqual(new WeirdFloats([1, 2]), new WeirdFloats([9, 9]))).toBe(false)
    expect(spy).not.toHaveBeenCalled()
  })

  it('compares shared and cyclic structures once each', () => {
    const left = { x: 1 }
    const right = { x: 1 }
    expect(isEqual({ a: left, b: left }, { a: right, b: right })).toBe(true)
    const a: unknown[] = [1]
    a.push(a)
    const b: unknown[] = [1]
    b.push(b)
    expect(isEqual(a, b)).toBe(true)
    expect(isEqual(ring(31), ring(37))).toBe(true)
    expect(isEqual(diamond(60), diamond(60))).toBe(true)
  })

  it('stops at 1000 levels of nesting', () => {
    expect(isEqual(nest(1000), nest(1000))).toBe(true)
    expect(() => isEqual(nest(1001), nest(1001))).toThrow(
      new RangeError('nesting deeper than 1000 levels')
    )
    expect(isEqual(nest(5), nest(5))).toBe(true)
  })

  it('turns an engine stack overflow into the depth RangeError', () => {
    const deep = {
      get a(): never {
        throw overflow()
      }
    }
    expect(() => isEqual([deep], [{ a: 1 }])).toThrow(new RangeError(DEPTH_ERROR))
    expect(isEqual(nest(1000), nest(1000))).toBe(true)
  })
})

describe('isEqualWith', () => {
  const byFields = (a: unknown, b: unknown) =>
    a instanceof Point && b instanceof Point ? a.x === b.x && a.y === b.y : undefined

  it('lets a customizer decide pairs and fall through with undefined', () => {
    expect(isEqualWith([new Point(1, 2)], [new Point(1, 2)], byFields)).toBe(true)
    expect(isEqualWith({ p: new Point(1, 2) }, { p: new Point(1, 3) }, byFields)).toBe(false)
    expect(isEqualWith({ a: 1 }, { a: 1 }, () => undefined)).toBe(true)
    expect(isEqualWith(1, 2, () => true)).toBe(true)
  })

  it.each([
    { value: 1, equal: true },
    { value: 2, equal: false }
  ])('can omit a missing key by deciding the parent pair: $value', ({ value, equal }) => {
    const a = { value: 1, creation: 100 }
    const b = { value }

    const result = isEqualWith(a, b, (left, right, key) =>
      key === undefined &&
      typeof left === 'object' &&
      left !== null &&
      typeof right === 'object' &&
      right !== null
        ? isEqual(omit(left, ['creation']), omit(right, ['creation']))
        : undefined
    )

    expect(result).toBe(equal)
  })

  it('leaves Set members and Map keys to SameValueZero', () => {
    const points = (...xs: number[]) => new Set(xs.map((x) => new Point(x, 0)))
    expect(isEqualWith(points(1), points(1), byFields)).toBe(false)
    const bySetFields = (a: unknown, b: unknown) =>
      a instanceof Set && b instanceof Set
        ? a.size === b.size && [...a].every((p) => [...b].some((q) => byFields(p, q) === true))
        : undefined
    expect(isEqualWith(points(1, 2), points(2, 1), bySetFields)).toBe(true)
    expect(isEqualWith(points(1), points(2), bySetFields)).toBe(false)
  })

  it('does not take a customizer to be transitive', () => {
    const near = (a: unknown, b: unknown) =>
      typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) <= 1 : undefined
    const [a, b, c] = [{ v: 0 }, { v: 1 }, { v: 2 }]
    expect(isEqualWith(a, b, near)).toBe(true)
    expect(isEqualWith(a, c, near)).toBe(false)
    expect(isEqualWith([a, b, a], [b, c, c], near)).toBe(false)
    const [p, q, r, s] = [{ v: 1 }, { v: 3 }, { v: 2 }, { v: 4 }]
    expect(isEqualWith([p, q, q, p], [r, r, s, s], near)).toBe(false)
  })

  it('compares shared and cyclic structures once per pair', () => {
    const fallThrough = () => undefined
    const a: unknown[] = [1]
    a.push(a)
    const b: unknown[] = [1]
    b.push(b)
    expect(isEqualWith(a, b, fallThrough)).toBe(true)
    expect(isEqualWith(ring(2), ring(3), fallThrough)).toBe(true)
    expect(isEqualWith(diamond(60), diamond(60), fallThrough)).toBe(true)
  })

  it('passes the key each pair was found under', () => {
    const seen: unknown[] = []
    isEqualWith({ a: [1] }, { a: [1] }, (_a, _b, key) => {
      seen.push(key)
      return undefined
    })
    expect(seen).toEqual([undefined, 'a', 0])
    const mapKeys: unknown[] = []
    isEqualWith(new Map([['k', 1]]), new Map([['k', 1]]), (_a, _b, key) => {
      mapKeys.push(key)
      return undefined
    })
    expect(mapKeys).toEqual([undefined, 'k'])
  })

  it('can call isEqual from the customizer', () => {
    const nested = (a: unknown, b: unknown) =>
      a instanceof Point && b instanceof Point ? isEqual({ ...a }, { ...b }) : undefined
    expect(isEqualWith([new Point(1, 2)], [new Point(1, 2)], nested)).toBe(true)
  })

  it('turns an engine stack overflow in the customizer into the depth RangeError', () => {
    const customizer = (a: unknown) => {
      if (a === 'deep') throw overflow()
      return undefined
    }
    expect(() => isEqualWith([['deep']], [['deep']], customizer)).toThrow(
      new RangeError(DEPTH_ERROR)
    )
    expect(isEqualWith(nest(1000), nest(1000), () => undefined)).toBe(true)
  })

  it('needs a function', () => {
    expect(() => isEqualWith(1, 1, null as never)).toThrow(TypeError)
    expect(() => isEqualWith(1, 1, undefined as never)).toThrow(
      new TypeError('customizer must be a function')
    )
  })
})
