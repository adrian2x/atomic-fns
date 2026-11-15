import { describe, expect, it, test } from 'vitest'
import { defaults, defaultsDeep, merge } from '../src/object/index.ts'
import { sparse } from './sparse.ts'

/** A source of `levels` levels where each object holds the one below at two keys. */
function sharedDag(levels: number): object {
  let dag: object = { leaf: 1 }
  for (let i = 0; i < levels; i++) dag = { a: dag, b: dag }
  return dag
}

describe('merge', () => {
  it('merges plain objects and arrays deeply and returns the target', () => {
    const target = { a: [{ b: 2 }, { d: 4 }], keep: 1 }
    expect(merge(target, { a: [{ c: 3 }, { e: 5 }] })).toBe(target)
    expect(target).toEqual({
      a: [
        { b: 2, c: 3 },
        { d: 4, e: 5 }
      ],
      keep: 1
    })
  })

  it('replaces other values and containers of the other kind', () => {
    const date = new Date(0)
    expect(merge({ a: { x: 1 } }, { a: date }).a).toBe(date)
    expect(merge({ a: { x: 1 } }, { a: [1] })).toEqual({ a: [1] })
    expect(merge({ a: [1] }, { a: { x: 1 } })).toEqual({ a: { x: 1 } })
    const map = new Map([[1, 2]])
    expect((merge({}, { map }) as { map: object }).map).toBe(map)
  })

  it('copies source containers, so the target never shares them', () => {
    const src = { nested: { x: 1 } }
    const out = merge({}, src) as { nested: { x: number } }
    out.nested.x = 99
    expect(src.nested.x).toBe(1)
    const shared = { z: 0 }
    const two = merge({}, { a: shared, b: shared }) as { a: object; b: object }
    expect(two.a).not.toBe(two.b)
    const routes = (merge({}, { routes: Object.create(null) as object }) as { routes: object })
      .routes
    expect(Object.getPrototypeOf(routes)).toBeNull()
  })

  it('skips an undefined source value only where the target has the key', () => {
    expect(merge({ a: 1 }, { a: undefined })).toEqual({ a: 1 })
    expect(Object.keys(merge({}, { a: undefined }))).toEqual(['a'])
    expect(merge({ a: [1, 2] }, { a: [undefined, 3] })).toEqual({ a: [1, 3] })
  })

  it('skips nullish and primitive sources and refuses a non-object target', () => {
    expect(merge({ a: 1 }, null, undefined, 5, 'x', { b: 2 })).toEqual({ a: 1, b: 2 })
    expect(() => merge(null as never, {})).toThrow(new TypeError('merge target must be an object'))
    expect(() => merge((() => 1) as never, { a: 1 })).toThrow(TypeError)
  })

  it('copies symbol keys and runs target setters', () => {
    const sym = Symbol('s')
    expect(merge({}, { [sym]: 1 })[sym as never]).toBe(1)
    const seen: number[] = []
    merge(
      {
        set x(v: number) {
          seen.push(v)
        }
      },
      { x: 2 }
    )
    expect(seen).toEqual([2])
  })

  it('leaves a read-only key alone when it merges into the object there', () => {
    const frozen = Object.freeze({ db: { host: 'a' } as Record<string, unknown> })
    expect(merge(frozen, { db: { port: 1 } }).db).toEqual({ host: 'a', port: 1 })
    expect(() => merge(frozen, { db: 1 })).toThrow(TypeError)
  })

  test.for(['__proto__', 'constructor', 'prototype'])('copies %s as own data', (key) => {
    const target = { nested: {} }
    const value = { x: 1 }

    merge(target, { [key]: value, nested: { [key]: value } })

    for (const obj of [target, target.nested]) {
      expect(Object.getPrototypeOf(obj)).toBe(Object.prototype)
      expect(Object.getOwnPropertyDescriptor(obj, key)).toStrictEqual({
        value: { x: 1 },
        writable: true,
        enumerable: true,
        configurable: true
      })
    }
  })

  it('keeps prototype-named keys from changing inherited data', () => {
    try {
      merge({}, JSON.parse('{"__proto__": {"polluted": 1}}'))
      merge({}, JSON.parse('{"constructor": {"prototype": {"polluted": 1}}}'))
      expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    } finally {
      Reflect.deleteProperty(Object.prototype, 'polluted')
    }
    class Config {}
    const withCtor = { constructor: Config }
    merge(withCtor, { constructor: { evil: true } })
    expect(withCtor.constructor).toBe(Config)
  })

  it('keeps a cycle the source has and merges a shared source into a target once', () => {
    const src: { a: unknown[] } = { a: [] }
    src.a.push(src.a)
    const out = merge({}, src) as { a: unknown[] }
    expect(out.a[0]).toBe(out.a)
    let reads = 0
    let shared: object = {
      get leaf() {
        reads++
        return 1
      }
    }
    for (let i = 0; i < 12; i++) shared = { a: shared, b: shared }
    const target = merge({}, { root: shared })
    reads = 0
    merge(target, { root: shared })
    expect(reads).toBe(2 ** 12)
  })

  it('refuses writes that grow an array past its end', () => {
    expect(() => merge([], { 4294967294: 1 })).toThrow(RangeError)
    expect(() => merge([], { length: 10 })).toThrow(RangeError)
    expect(merge([], { 0: 'a' })).toEqual(['a'])
    const holey = sparse(3, { 0: 1, 2: 3 })
    const out = merge({}, { a: holey }) as { a: unknown[] }
    expect(out.a).toHaveLength(3)
    expect(1 in out.a).toBe(false)
  })
})

describe('defaults', () => {
  it('fills keys that read undefined, first source first', () => {
    expect(defaults({ a: 1 }, { a: 3, b: 2 }, { b: 4, c: 5 })).toEqual({ a: 1, b: 2, c: 5 })
    expect(defaults({ a: undefined }, { a: 1 })).toEqual({ a: 1 })
    expect(defaults({ a: null }, { a: 1 })).toEqual({ a: null })
  })

  it('treats keys only Object.prototype has as missing, but not class members', () => {
    expect(defaults({}, { toString: 1 })).toEqual({ toString: 1 })
    class Config {
      get secure(): boolean {
        return true
      }
      check(): string {
        return 'ok'
      }
    }
    const cfg = defaults(new Config(), { secure: false, check: 'no' })
    expect(cfg.secure).toBe(true)
    expect(cfg.check()).toBe('ok')
  })

  it('leaves a key the target has only a getter for alone', () => {
    class Entity {
      get id(): undefined {
        return undefined
      }
    }
    const rec = defaults(new Entity(), { id: 1 })
    expect(rec.id).toBeUndefined()
    expect(Object.hasOwn(rec, 'id')).toBe(false)
  })

  it('never fills __proto__ on an ordinary target', () => {
    const opts = defaults({}, JSON.parse('{"__proto__": {"isAdmin": true}}')) as Record<
      string,
      unknown
    >
    expect(Object.getPrototypeOf(opts)).toBe(Object.prototype)
    expect(opts.isAdmin).toBeUndefined()
    const bare = defaults(Object.create(null) as object, JSON.parse('{"__proto__": 1}'))
    expect(Object.hasOwn(bare, '__proto__')).toBe(true)
  })

  it('skips nullish sources, refuses a non-object target and indices past the end', () => {
    expect(defaults({ a: 1 }, null, undefined)).toEqual({ a: 1 })
    expect(() => defaults(5 as never, {})).toThrow(TypeError)
    expect(() => defaults([], { 2: 1 })).toThrow(RangeError)
  })
})

describe.each([
  { name: 'defaults', fill: defaults },
  { name: 'defaultsDeep', fill: defaultsDeep }
])('$name symbol keys', ({ fill }) => {
  it.each([
    { kind: 'object', make: () => ({}) },
    { kind: 'array', make: () => [] }
  ])('fills own enumerable symbols on an $kind', ({ make }) => {
    const added = Symbol('added')
    const kept = Symbol('kept')
    const hidden = Symbol('hidden')
    const source = Object.assign(make(), { [added]: 3, [kept]: 9 })
    Object.defineProperty(source, hidden, { value: 4 })
    const target = Object.assign(make(), { [kept]: 2 })

    const out = fill(target, source)

    expect(out).toBe(target)
    expect(out).toStrictEqual(Object.assign(make(), { [kept]: 2, [added]: 3 }))
  })

  it.each([false, true])(
    'preserves a writable symbol descriptor with enumerable=%s',
    (enumerable) => {
      const key = Symbol('default')
      const target = Object.defineProperty({}, key, {
        value: undefined,
        writable: true,
        enumerable
      })

      expect(fill(target, { [key]: 7 })).toBe(target)

      expect(Object.getOwnPropertyDescriptor(target, key)).toStrictEqual({
        value: 7,
        writable: true,
        enumerable,
        configurable: false
      })
    }
  )

  it('leaves a getter-only target symbol alone', () => {
    const key = Symbol('readonly')
    const target = {
      get [key]() {
        return undefined
      }
    }

    expect(fill(target, { [key]: 1 })).toBe(target)
    expect(target[key]).toBeUndefined()
  })

  it('keeps symbol values inherited from Object.prototype', () => {
    const key = Symbol('inherited')
    Object.defineProperty(Object.prototype, key, { value: 2, configurable: true })
    try {
      const target = {}

      const out = fill(target, { [key]: 3 })

      expect(Reflect.get(out, key)).toBe(2)
      expect(Object.hasOwn(out, key)).toBe(false)
    } finally {
      Reflect.deleteProperty(Object.prototype, key)
    }
  })
})

describe('defaultsDeep', () => {
  it.each([1, null, new Date(0)])('keeps an existing value of %s', (value) => {
    expect(defaultsDeep({ a: value }, { a: { b: 2 } })).toStrictEqual({ a: value })
  })

  it.each([
    { kind: 'object', make: () => ({}) },
    { kind: 'array', make: () => [] }
  ])('fills nested symbols in an existing or copied $kind', ({ make }) => {
    const key = Symbol('nested')
    const value = Symbol('value')
    const source = Object.assign(make(), { [key]: { [value]: 3 } })
    const target = Object.assign(make(), { [key]: {} })

    const out = defaultsDeep({ existing: target }, { existing: source, copied: source })

    expect(out).toStrictEqual({
      existing: Object.assign(make(), { [key]: { [value]: 3 } }),
      copied: Object.assign(make(), { [key]: { [value]: 3 } })
    })
    expect(target[key]).not.toBe(source[key])
  })

  it('fills missing keys inside nested plain objects and arrays', () => {
    expect(defaultsDeep({ a: { b: 2 } }, { a: { b: 1, c: 3 } })).toEqual({ a: { b: 2, c: 3 } })
    expect(defaultsDeep({ list: [1] }, { list: [9, 2] })).toEqual({ list: [1, 2] })
    expect(defaultsDeep({ a: 1 }, { a: { b: 1 } })).toEqual({ a: 1 })
  })

  it('copies holey arrays and arrays holding undefined to their full length', () => {
    expect(defaultsDeep({}, { list: [1, undefined, 3] })).toEqual({ list: [1, undefined, 3] })
    const holey = defaultsDeep({}, { list: sparse(3, { 0: 1, 2: 3 }) }) as { list: unknown[] }
    expect(holey.list).toHaveLength(3)
    expect(1 in holey.list).toBe(false)
    expect((defaultsDeep({}, { list: [1, undefined] }) as { list: unknown[] }).list).toHaveLength(2)
    expect(defaultsDeep({ list: [1] }, { list: sparse(3, { 0: 9, 2: 3 }) })).toEqual({
      list: [1, undefined, 3]
    })
  })

  it('copies what it fills', () => {
    const src = { a: { b: 1 } }
    const out = defaultsDeep({}, src) as typeof src
    expect(out.a).toEqual({ b: 1 })
    expect(out.a).not.toBe(src.a)
    const bare = defaultsDeep({}, { routes: Object.create(null) as object }) as { routes: object }
    expect(Object.getPrototypeOf(bare.routes)).toBeNull()
  })

  it('keeps a cycle the source has and stops past the nesting limit', () => {
    const cyclic: Record<string, unknown> = { x: 1 }
    cyclic.self = cyclic
    const out = defaultsDeep({}, cyclic) as Record<string, unknown>
    expect(out.self).toBe(out)
    const into = defaultsDeep({ self: {} }, cyclic) as { self: Record<string, unknown> }
    expect(into.self.x).toBe(1)
    let deep: object = {}
    for (let i = 0; i < 1500; i++) deep = { a: deep }
    expect(() => defaultsDeep({}, deep)).toThrow(RangeError)
  })

  it('stops shared objects copied past its budget and fills a shared target once', () => {
    expect(() => defaultsDeep({}, { dag: sharedDag(24) })).toThrow(
      new RangeError('input repeats shared objects past 500000 units of work')
    )
    let reads = 0
    const source = {
      get leaf() {
        reads++
        return 1
      }
    }
    const node = {}
    defaultsDeep({ a: node, b: node }, { a: source, b: source })
    expect(reads).toBe(1)
    expect(node).toEqual({ leaf: 1 })
    const t: Record<string, unknown> = {}
    t.self = t
    const s: Record<string, unknown> = { x: 1 }
    s.self = s
    expect(defaultsDeep(t, s)).toEqual(t)
    expect(t.x).toBe(1)
  })

  it('refuses a huge sparse source array', () => {
    expect(() => defaultsDeep({ a: [] }, { a: sparse(2 ** 32 - 1, { 0: 1 }) })).toThrow(
      new RangeError('sparse array too large')
    )
  })

  it('skips __proto__ on an ordinary target', () => {
    try {
      defaultsDeep({}, JSON.parse('{"__proto__": {"polluted": 1}}'))
      expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    } finally {
      Reflect.deleteProperty(Object.prototype, 'polluted')
    }
  })

  test.for(['constructor', 'prototype'])('fills %s as own data', (key) => {
    const target = { nested: {} }
    const value = { x: 1 }

    defaultsDeep(target, { [key]: value, nested: { [key]: value } })

    for (const obj of [target, target.nested]) {
      expect(Object.getPrototypeOf(obj)).toBe(Object.prototype)
      expect(Object.getOwnPropertyDescriptor(obj, key)).toStrictEqual({
        value: { x: 1 },
        writable: true,
        enumerable: true,
        configurable: true
      })
    }
  })

  it('fills __proto__ as own data on a null-prototype target', () => {
    const target = Object.create(null) as object

    defaultsDeep(target, JSON.parse('{"__proto__": {"x": 1}}'))

    expect(Object.getPrototypeOf(target)).toBeNull()
    expect(Object.getOwnPropertyDescriptor(target, '__proto__')?.value).toStrictEqual({ x: 1 })
  })
})
