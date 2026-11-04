import { afterEach, describe, it, expect } from 'vitest'
import { merge } from '../src/collections/index.js'

describe('merge', () => {
  it('SPEC-R31 pollution payloads top-level nested and array-nested', () => {
    const a = merge({}, JSON.parse('{"__proto__":{"p":1}}') as object) as Record<string, object>
    expect(Object.hasOwn(a, '__proto__')).toBe(true)
    expect(({} as { p?: number }).p).toBeUndefined()
    expect((Object.prototype as { p?: number }).p).toBeUndefined()

    const b = merge({}, JSON.parse('{"a":{"__proto__":{"p":1}}}') as object) as {
      a: Record<string, object>
    }
    expect(Object.hasOwn(b.a, '__proto__')).toBe(true)
    expect(({} as { p?: number }).p).toBeUndefined()

    const c = merge({}, JSON.parse('{"items":[{"__proto__":{"p":1}}]}') as object) as {
      items: Record<string, object>[]
    }
    expect(Object.hasOwn(c.items[0], '__proto__')).toBe(true)
    expect(({} as { p?: number }).p).toBeUndefined()
  })

  it('SPEC-R31 Map Set Date undefined and aliasing', () => {
    const m = new Map([[1, 2]])
    const merged = merge({}, { m }) as { m: Map<number, number> }
    expect(merged.m.get(1)).toBe(2)
    expect(merged.m).toBe(m)

    const d = new Date(0)
    expect(merge({ a: { x: 1 } }, { a: d }).a).toBe(d)
    expect(merge({ a: { x: 1 } }, { a: d }).a instanceof Date).toBe(true)

    expect(merge({ a: 1 }, { a: undefined }).a).toBe(1)

    const src = { nested: { x: 1 } }
    const out = merge({}, src) as { nested: { x: number } }
    out.nested.x = 99
    expect(src.nested.x).toBe(1)
  })

  it('SPEC-R31 constructor and prototype data keys', () => {
    const r = merge({}, { constructor: 'Ford', prototype: 'p' }) as {
      constructor: string
      prototype: string
    }
    expect(r.constructor).toBe('Ford')
    expect(r.prototype).toBe('p')

    const withFn = merge(
      {
        constructor: function C() {
          return undefined
        }
      },
      { constructor: 'x' }
    )
    expect(typeof withFn.constructor).toBe('function')
  })

  it('SPEC-R31 cycle preserved via seen', () => {
    const src: { self?: object; a: number } = { a: 1 }
    src.self = src
    const out = merge({}, src) as { self: { self: object }; a: number }
    expect(out.self.self).toBe(out.self)
    expect(out.a).toBe(1)
  })

  it('SPEC-R31 null target throws; null source skipped; frozen target propagates', () => {
    expect(() => merge(null as unknown as object, { a: 1 })).toThrow(TypeError)
    expect(merge({ a: 1 }, null, undefined).a).toBe(1)
    const frozen = Object.freeze({ a: 1 }) as { a: number; b?: number }
    expect(() => merge(frozen, { b: 2 })).toThrow(TypeError)
  })

  it('shared source object is not aliased across distinct keys', () => {
    const s = { y: 2 }
    const result = merge({ a: { x: 1 } }, { a: s, b: s }) as {
      a: { x: number; y: number }
      b: { y: number }
    }
    expect(result.b).toEqual({ y: 2 })
    expect(result.a).toEqual({ x: 1, y: 2 })
    expect(result.a).not.toBe(result.b)

    const cyclic: { self?: object; n: number } = { n: 1 }
    cyclic.self = cyclic
    const cyc = merge({}, cyclic) as { self: { self: object }; n: number }
    expect(cyc.self.self).toBe(cyc.self)
  })

  it('merge copies enumerable symbols; array vs plain object replaces', () => {
    const s = Symbol('s')
    const withSym = merge({}, { [s]: 1, a: 1 }) as { a: number; [k: symbol]: number }
    expect(withSym[s]).toBe(1)
    expect(withSym.a).toBe(1)

    expect(merge({ a: [1, 2] }, { a: { 0: 'x' } })).toEqual({ a: { 0: 'x' } })
    expect(merge({ a: { 0: 'x', b: 1 } }, { a: [1] })).toEqual({ a: [1] })
    expect(merge({ a: [1, 2] }, { a: [null] })).toEqual({ a: [null, 2] })
  })

  it('R13-A: re-applied source after an override is not skipped by the pair cache', () => {
    const a = { x: 1 }
    expect((merge({}, a, { x: 2 }, a) as { x: number }).x).toBe(1)

    const common = { timeout: 30 }
    const out = merge({}, { http: common }, { http: { timeout: 5 } }, { http: common }) as {
      http: { timeout: number }
    }
    expect(out.http.timeout).toBe(30)
  })

  it('R13-D3: merge refuses array index keys beyond length', () => {
    expect(() => merge([], JSON.parse('{"4294967294":1}') as object)).toThrow(RangeError)
    expect(() => merge([], JSON.parse('{"4294967294":1}') as object)).toThrow(
      'array index beyond length'
    )
    expect(merge([], JSON.parse('{"0":1}') as object)).toEqual([1])
  })

  it.each([
    ['number', { length: 2 ** 32 - 1 }],
    ['numeric string', { length: '4294967295' }],
    ['array', { length: [2 ** 32 - 1] }],
    ['object with valueOf', { length: { valueOf: () => 2 ** 32 - 1 } }],
    ['object coercing in range', { length: [0] }],
    ['one past the end', { length: 1 }]
  ])(
    'merge refuses a source length that could grow an array target: %s',
    { timeout: 1000 },
    (_kind, source) => {
      const target: unknown[] = []

      expect(() => merge(target, source)).toThrow(new RangeError('array index beyond length'))
      expect(target.length).toBe(0)
    }
  )

  it.each([
    ['matching the indices just written', [], { 0: 'a', 1: 'b', length: 2 }, ['a', 'b']],
    ['shrinking the target', ['a', 'b', 'c'], { length: 1 }, ['a']],
    ['shrinking the target by numeric string', ['a', 'b', 'c'], { length: '1' }, ['a']]
  ])('merge applies a source length %s', (_case, target, source, expected) => {
    expect(merge(target, source)).toEqual(expected)
  })

  it('POL-26: merge copies holey source arrays without throwing', () => {
    const holey = [1]
    holey.length = 3
    holey[2] = 3
    const intoEmpty = merge({}, { a: holey }) as { a: unknown[] }
    expect(intoEmpty.a).toHaveLength(3)
    expect(0 in intoEmpty.a).toBe(true)
    expect(1 in intoEmpty.a).toBe(false)
    expect(2 in intoEmpty.a).toBe(true)
    expect(intoEmpty.a[0]).toBe(1)
    expect(intoEmpty.a[2]).toBe(3)

    const holey2 = [1]
    holey2.length = 3
    holey2[2] = 3
    const intoExisting = merge({ a: [9] }, { a: holey2 }) as { a: unknown[] }
    expect(intoExisting.a).toHaveLength(3)
    expect(1 in intoExisting.a).toBe(false)
    expect(intoExisting.a[0]).toBe(1)
    expect(intoExisting.a[2]).toBe(3)

    const byId: unknown[] = []
    byId[3] = 'x'
    const nested = merge({}, { byId }) as { byId: unknown[] }
    expect(nested.byId).toHaveLength(4)
    expect(0 in nested.byId).toBe(false)
    expect(3 in nested.byId).toBe(true)
    expect(nested.byId[3]).toBe('x')

    expect(() => merge([], JSON.parse('{"4294967294":1}') as object)).toThrow(
      'array index beyond length'
    )
  })

  it('POL-27: merge refuses huge sparse source arrays without mutating target', () => {
    const huge: unknown[] = []
    huge.length = 4294967295
    huge[0] = 'x'
    const target = { items: ['keep-me'] as unknown[] }
    expect(() => merge(target, { items: huge })).toThrow(RangeError)
    expect(() => merge(target, { items: huge })).toThrow('sparse array too large')
    expect(target.items).toEqual(['keep-me'])
    expect(target.items.length).toBe(1)

    const byId: unknown[] = []
    byId[3] = 'x'
    const nested = merge({}, { byId }) as { byId: unknown[] }
    expect(nested.byId).toHaveLength(4)
    expect(3 in nested.byId).toBe(true)
    expect(nested.byId[3]).toBe('x')

    const holey: unknown[] = [1]
    holey.length = 3
    holey[2] = 3
    const out = merge({}, { a: holey }) as { a: unknown[] }
    expect(out.a).toHaveLength(3)
    expect(1 in out.a).toBe(false)
    expect(out.a[0]).toBe(1)
    expect(out.a[2]).toBe(3)
  })

  describe('prototype targets', () => {
    afterEach(() => {
      Reflect.deleteProperty(Object.prototype, 'polluted')
      Reflect.deleteProperty(Function.prototype, 'polluted')
    })

    it.each([
      ['as the target', Object.prototype, { polluted: 1 }],
      ['through a target property', { nested: Object.prototype }, { nested: { polluted: 1 } }]
    ])('merge never writes to Object.prototype reached %s', (_how, target, source) => {
      merge(target, source)

      expect(Object.hasOwn(Object.prototype, 'polluted')).toBe(false)
    })

    it('merge refuses Function.prototype as the target', () => {
      expect(() => merge(Function.prototype, { polluted: 1 })).toThrow(
        new TypeError('merge target must be an object')
      )
      expect(Object.hasOwn(Function.prototype, 'polluted')).toBe(false)
    })
  })
})
