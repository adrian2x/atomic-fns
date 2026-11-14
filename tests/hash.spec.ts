import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import { digest, hash, hashString, stableStringify } from '../src/hash/index.ts'
import { DEPTH_ERROR } from '../src/internal/walk.ts'
import { isEqual } from '../src/object/isEqual.ts'
import { sparse } from './sparse.ts'

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
    expectUnsignedHash(wide)
    expectUnsignedHash(sparse(4_294_967_294, { 4e9: 1 }))
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

describe('stableStringify', () => {
  it('sorts keys at every level', () => {
    expect(stableStringify({ b: 1, a: [true, { d: 2, c: 3 }] })).toBe(
      '{"a":[true,{"c":3,"d":2}],"b":1}'
    )
    expect(stableStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}')
    expect(stableStringify({ a: 2, b: 1 })).toBe('{"a":2,"b":1}')
  })

  it('follows JSON.stringify for everything else', () => {
    const sample = {
      date: new Date(0),
      text: 'é"\n',
      inf: Infinity,
      nil: null,
      box: Object('s'),
      symbolBox: Object(Symbol('x')),
      fnWithToJSON: Object.assign(() => {}, { toJSON: () => 'f' }),
      list: [undefined, () => {}, Symbol('x'), NaN],
      skip: undefined,
      fn: () => {},
      nested: { toJSON: () => ({ z: 1, y: 2 }) }
    }
    expect(stableStringify(sample)).toBe(
      JSON.stringify({
        box: 's',
        date: new Date(0),
        fnWithToJSON: 'f',
        inf: null,
        list: [null, null, null, null],
        nested: { y: 2, z: 1 },
        nil: null,
        symbolBox: {},
        text: 'é"\n'
      })
    )
    expect(stableStringify(undefined)).toBeUndefined()
    expect(stableStringify(() => {})).toBeUndefined()
    expect(stableStringify('a')).toBe('"a"')
    expect(stableStringify(new Map([[1, 2]]))).toBe('{}')
    // biome-ignore lint/suspicious/noSparseArray: a hole is the value under test
    expect(stableStringify([, 1])).toBe('[null,1]')
    expect(stableStringify([Object(Symbol('x'))])).toBe('[{}]')
  })

  it('calls toJSON with the key it is written under', () => {
    const echoKey = { toJSON: (key: string) => key }
    expect(stableStringify({ a: echoKey, b: [echoKey] })).toBe('{"a":"a","b":["0"]}')
    expect(stableStringify(echoKey)).toBe('""')
  })

  it('writes a bigint through BigInt.prototype.toJSON when one is installed', () => {
    const prototype = BigInt.prototype as { toJSON?: () => string }
    prototype.toJSON = function (this: bigint) {
      return this.toString()
    }
    try {
      expect(stableStringify({ n: 1n })).toBe('{"n":"1"}')
    } finally {
      delete prototype.toJSON
    }
  })

  it('reads an array length once, as JSON does', () => {
    const grows: unknown[] = []
    grows.push({
      toJSON() {
        grows.push(0)
        return 1
      }
    })
    expect(stableStringify(grows)).toBe('[1]')
    const huge: unknown[] = []
    huge.push({
      toJSON() {
        huge.length = 2 ** 25
        return 0
      }
    })
    expect(stableStringify(huge)).toBe('[0]')
  })

  it('throws TypeError on cycles and bigints, and RangeError past 1000 levels', () => {
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    expect(() => stableStringify(cyclic)).toThrow(TypeError)
    expect(() => stableStringify({ n: 1n })).toThrow(TypeError)
    let deep: unknown[] = []
    for (let i = 0; i < 1001; i++) deep = [deep]
    expect(() => stableStringify(deep)).toThrow(new RangeError('nesting deeper than 1000 levels'))
  })

  it('writes an object shared by two branches twice', () => {
    const shared = { a: 1 }
    expect(stableStringify([shared, shared])).toBe('[{"a":1},{"a":1}]')
  })

  it('turns an engine stack overflow into the depth RangeError and keeps working after it', () => {
    const overflow = {
      toJSON() {
        throw new RangeError('Maximum call stack size exceeded')
      }
    }
    expect(() => stableStringify([[overflow]])).toThrow(new RangeError(DEPTH_ERROR))
    let deep: unknown[] = []
    for (let i = 0; i < 999; i++) deep = [deep]
    expect(stableStringify(deep)).toBe(`${'['.repeat(1000)}${']'.repeat(1000)}`)
  })

  it('refuses a huge sparse array instead of writing its holes', () => {
    expect(() => stableStringify(sparse(4_294_967_294, {}))).toThrow(
      new RangeError('sparse array too large')
    )
  })
})

describe('digest', () => {
  it('hashes strings as UTF-8 and bytes as given', async () => {
    expect(await digest('SHA-256', 'abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    )
    expect(await digest('SHA-1', new Uint8Array([0x61, 0x62, 0x63]))).toBe(
      'a9993e364706816aba3e25717850c26c9cd0d89d'
    )
    expect(await digest('SHA-256', new Uint8Array([0, 0x61, 0x62, 0x63]).subarray(1))).toBe(
      await digest('SHA-256', 'abc')
    )
  })

  it('hashes an ArrayBuffer from any realm, and bytes on shared memory', async () => {
    const abc = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    expect(await digest('SHA-256', new TextEncoder().encode('abc').buffer)).toBe(abc)
    expect(
      await digest('SHA-256', runInNewContext('new Uint8Array([0x61, 0x62, 0x63]).buffer'))
    ).toBe(abc)
    const shared = new Uint8Array(new SharedArrayBuffer(4))
    shared.set([0, 0x61, 0x62, 0x63])
    expect(await digest('SHA-256', shared.subarray(1))).toBe(abc)
    expect(await digest('SHA-256', shared.buffer)).toBe(await digest('SHA-256', shared))
  })

  it('rejects with TypeError where crypto.subtle is missing', async () => {
    vi.stubGlobal('crypto', undefined)
    try {
      await expect(digest('SHA-256', 'abc')).rejects.toThrow(
        new TypeError('crypto.subtle is not available')
      )
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('rejects data that is not bytes or a string', async () => {
    const notBytes = new TypeError('expected a string, an ArrayBuffer or a typed array')
    await expect(digest('SHA-256', 1 as never)).rejects.toThrow(notBytes)
    const arrayLike = JSON.parse('{"length":2147483648,"0":97}') as never
    await expect(digest('SHA-256', arrayLike)).rejects.toThrow(notBytes)
  })
})
