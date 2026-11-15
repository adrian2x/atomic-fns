import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import { hash, hashString } from '../src/hash/index.ts'
import { isEqual } from '../src/object/isEqual.ts'

/** FNV-1a over the bytes `TextEncoder` writes, as an oracle independent of `hashString`. */
const fnv1aOfUtf8 = (str: string): number =>
  new TextEncoder().encode(str).reduce((h, byte) => Math.imul(h ^ byte, 0x01000193), 0x811c9dc5) >>>
  0

describe('hashString', () => {
  it('is FNV-1a over UTF-8 bytes', () => {
    expect(hashString('')).toBe(0x811c9dc5)
    expect(hashString('a')).toBe(0xe40c292c)
    expect(hashString('foobar')).toBe(0xbf9cf968)
    for (const str of [
      '\u00e9',
      '\u0100',
      '\u20ac',
      '\u{1f600}',
      'a\ud800b',
      '\udc00',
      'x\ud83d'
    ]) {
      expect(hashString(str)).toBe(fnv1aOfUtf8(str))
    }
    expect(hashString('😀')).not.toBe(hashString('\ud83d'))
    expect(hashString('\ud83d')).toBe(hashString('�'))
  })

  it('needs a string', () => {
    expect(() => hashString(1 as never)).toThrow(TypeError)
  })
})

const argumentsOf = function (..._rest: unknown[]) {
  // biome-ignore lint/complexity/noArguments: the arguments object is the value under test
  return arguments
}

describe('hash', () => {
  function expectUnsignedHash(value: unknown): void {
    const h = hash(value)
    expect(Number.isInteger(h) && h >= 0 && h < 2 ** 32).toBe(true)
  }

  const pairs: [unknown, unknown][] = [
    [0, -0],
    [NaN, Number.NaN],
    ['a', 'a'],
    [
      { a: 1, b: [1, 2] },
      { b: [1, 2], a: 1 }
    ],
    [Object.create(null), {}],
    [
      // biome-ignore lint/suspicious/noSparseArray: a hole is the value under test
      [, 1],
      [undefined, 1]
    ],
    [new Map([[1, { a: NaN }]]), new Map([[1, { a: NaN }]])],
    [new Set([1, 'a']), new Set(['a', 1])],
    [new Date(5), runInNewContext('new Date(5)')],
    [new Date(NaN), new Date(NaN)],
    [/a/g, /a/g],
    [new Uint8Array([1, 2]), new Uint8Array([1, 2])],
    [new Float32Array([0, NaN]), new Float32Array([-0, NaN])],
    [new ArrayBuffer(4), new ArrayBuffer(4)],
    [Object(1), Object(1)],
    [{ [Symbol.for('k')]: 1 }, { [Symbol.for('k')]: 1 }],
    [runInNewContext('({ a: [1, { b: 2 }] })'), { a: [1, { b: 2 }] }],
    [new Error('x', { cause: [1] }), new Error('x', { cause: [1] })],
    [
      Object.assign(new TypeError('x'), { code: 1 }),
      Object.assign(new TypeError('x'), { code: 1 })
    ],
    [argumentsOf(1, [2]), argumentsOf(1, [2])]
  ]

  it('agrees with isEqual', () => {
    for (const [a, b] of pairs) {
      expect(isEqual(a, b)).toBe(true)
      expect(hash(a)).toBe(hash(b))
    }
  })

  it.each([1, 2, undefined])('agrees with isEqual on non-enumerable array indices: %s', (value) => {
    const hidden = Object.defineProperty([], '0', { value: 1, enumerable: false })
    const withHole = Object.defineProperty(Array(4), '0', { value: 1, enumerable: false })
    withHole[1] = 3
    withHole[3] = 2

    expect(isEqual(hidden, [1])).toBe(true)
    expect(hash(hidden)).toBe(hash([1]))
    expect(isEqual(withHole, [1, 3, undefined, 2])).toBe(true)
    expect(hash(withHole)).toBe(hash([1, 3, undefined, 2]))
    expect(hash(hidden)).not.toBe(hash(Array(1)))

    const hiddenAfterHole = Object.defineProperty(Array(2), '1', { value: 1 })
    const dense = [undefined, value]

    expect(isEqual(hiddenAfterHole, dense)).toBe(value === undefined)
    expect(isEqual(dense, hiddenAfterHole)).toBe(value === undefined)
    expect(hash(hiddenAfterHole) === hash(dense)).toBe(value === undefined)
  })

  it('tells common differences apart', () => {
    const key = Symbol('k')
    const differing: [unknown, unknown][] = [
      [new Set([1]), new Set([2])],
      [new Map([[1, 1]]), new Map([[1, 2]])],
      [new Map([[1, 1]]), new Map([[2, 1]])],
      [new Date(1), new Date(2)],
      [/a/, /b/],
      [/a/, /a/g],
      [new Uint8Array([1]), new Uint8Array([2])],
      [new Uint8Array([1]), new Int8Array([1])],
      [new Float64Array([1]), new Float64Array([2])],
      [new Uint8Array([1]).buffer, new Uint8Array([2]).buffer],
      [Object(1), Object(2)],
      [{ [key]: 1 }, { [key]: 2 }],
      [new Error('x'), new TypeError('x')],
      [Object.assign(new Error('x'), { code: 1 }), Object.assign(new Error('x'), { code: 2 })],
      [argumentsOf(1), argumentsOf(2)]
    ]
    for (const [a, b] of differing) expect(hash(a)).not.toBe(hash(b))

    const distinct = [
      1,
      2,
      '1',
      1n,
      true,
      null,
      undefined,
      [],
      {},
      [1],
      { a: 1 },
      { a: 2 },
      [1, 2],
      [2, 1]
    ]
    const hashes = new Set(distinct.map(hash))
    expect(hashes.size).toBe(distinct.length)
    expect(hash(new Error('x'))).not.toBe(hash(new Error('y')))
    expect(hash(new Error('x', { cause: 1 }))).not.toBe(hash(new Error('x')))
  })

  it('hashes class instances by identity', () => {
    class Point {}
    const point = new Point()
    expect(hash(point)).toBe(hash(point))
    expect(hash(new Point())).not.toBe(hash(new Point()))
  })

  it('hashes Map keys or Set members that are objects by identity', () => {
    const key = {}
    expect(hash(new Map([[key, 1]]))).toBe(hash(new Map([[key, 1]])))
    expect(hash(new Set([key]))).toBe(hash(new Set([key])))
    expect(hash(new Map([[{}, 1]]))).not.toBe(hash(new Map([[{}, 1]])))
    expect(hash(new Set([{}]))).not.toBe(hash(new Set([{}])))
  })

  it('hashes unregistered symbols by identity', () => {
    const unregistered = Symbol('s')
    expect(hash(unregistered)).toBe(hash(unregistered))
    expect(hash(Symbol('s'))).not.toBe(hash(Symbol('s')))
  })

  it('agrees with isEqual on cycles of different lengths', () => {
    const ring = (length: number) => {
      const first: { next?: unknown } = {}
      let node = first
      for (let i = 1; i < length; i++) node = node.next = {} as { next?: unknown }
      node.next = first
      return first
    }
    expect(isEqual(ring(31), ring(37))).toBe(true)
    expect(hash(ring(31))).toBe(hash(ring(37)))
  })

  it('never throws on deep, shared or huge sparse input', () => {
    let deep: unknown[] = []
    for (let i = 0; i < 5000; i++) deep = [deep]
    expectUnsignedHash(deep)
    let wide: unknown = { leaf: 1 }
    for (let i = 0; i < 200; i++) wide = Array(64).fill(wide)
    expect(typeof hash(wide)).toBe('number')
    const sparse: unknown[] = []
    sparse.length = 4_294_967_294
    sparse[4e9] = 1
    expect(typeof hash(sparse)).toBe('number')
  })

  it('never throws on cyclic Maps, errors or arguments', () => {
    const map = new Map<number, unknown>()
    map.set(1, map)
    expectUnsignedHash(map)
    const error = new Error('x')
    error.cause = error
    expectUnsignedHash(error)
    const args = argumentsOf(0)
    args[0] = args
    expectUnsignedHash(args)
  })

  it('never throws on a view over a detached buffer', () => {
    const floats = new Float64Array([1, 2])
    structuredClone(floats.buffer, { transfer: [floats.buffer] })
    expect(isEqual(floats, new Float64Array(0))).toBe(true)
    expect(hash(floats)).toBe(hash(new Float64Array(0)))
  })

  it('leaves out the location keys JavaScriptCore puts on errors, as isEqual does', () => {
    const [a, b] = [new Error('x'), new Error('x')]
    Object.assign(a, { line: 1, column: 2, sourceURL: 'a.js' })
    Object.assign(b, { line: 3, column: 4, sourceURL: 'b.js' })
    expect(isEqual(a, b)).toBe(true)
    expect(hash(a)).toBe(hash(b))
  })

  it('returns an unsigned 32-bit integer', () => {
    for (const value of [1, 'a', { a: 1 }, [1, 2], new Map([[1, 2]])]) {
      expectUnsignedHash(value)
    }
  })

  it('calls no method of the value', () => {
    const spy = vi.fn()
    const value = { toJSON: spy, valueOf: spy, equals: spy }
    hash(value)
    const floats = new Float64Array([1])
    floats[Symbol.iterator] = spy as never
    hash(floats)
    expect(spy).not.toHaveBeenCalled()
  })
})
