import { describe, it, expect } from 'vitest'
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

    const withFn = merge({ constructor: function C() {} }, { constructor: 'x' })
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
    expect(merge({ a: 1 }, null as unknown as object, undefined as unknown as object).a).toBe(1)
    const frozen = Object.freeze({ a: 1 }) as { a: number; b?: number }
    expect(() => merge(frozen, { b: 2 })).toThrow(TypeError)
  })
})
