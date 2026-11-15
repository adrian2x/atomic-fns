import vm from 'node:vm'
import { describe, expect, it, test } from 'vitest'
import { get, has, set, unset } from '../src/object/index.ts'
import { sparse } from './sparse.ts'

const context = vm.createContext()

describe('path syntax', () => {
  it('splits dots, index brackets and quoted brackets', () => {
    const obj = { a: [{ b: { 'c.d': 1, "q'x": 2 } }] }
    expect(get(obj, 'a[0].b')).toEqual({ 'c.d': 1, "q'x": 2 })
    expect(get(obj, "a[0].b['c.d']")).toBe(1)
    expect(get(obj, 'a[0].b["c.d"]')).toBe(1)
    expect(get(obj, "a[0].b['q\\'x']")).toBe(2)
    expect(get({ 0: { 1: 'x' } }, '[0][1]')).toBe('x')
  })

  it('takes an array of keys literally', () => {
    const sym = Symbol('s')
    expect(get({ 'a.b': 1 }, ['a.b'])).toBe(1)
    expect(get({ a: [5] }, ['a', 0])).toBe(5)
    expect(get({ [sym]: 2 }, [sym])).toBe(2)
  })

  it('reads a number segment as its string, so it indexes an array', () => {
    expect(set({}, ['list', 0], 'x')).toEqual({ list: ['x'] })
    expect(() => set({}, ['a', 3], 1)).toThrow(RangeError)
  })

  it('treats an empty path as naming no property', () => {
    const obj = { undefined: 1 }
    expect(get(obj, [])).toBeUndefined()
    expect(get(obj, [], 'dflt')).toBe('dflt')
    expect(has(obj, [])).toBe(false)
    expect(set(obj, [], 2)).toBe(obj)
    expect(set([], [], 2)).toEqual([])
    expect(unset(obj, [])).toBe(true)
    expect(obj).toEqual({ undefined: 1 })
  })

  it('refuses malformed paths and odd segments', () => {
    for (const path of ['a[b]', 'a[0]b', 'a]', "a['x]", "a['x'b", 'a[01]']) {
      expect(() => get({}, path)).toThrow(TypeError)
    }
    expect(() => get({}, [true] as never)).toThrow(TypeError)
    expect(() => get({}, 5 as never)).toThrow(TypeError)
  })

  it('bounds the path it reads', () => {
    expect(() => get({}, 'a'.repeat(2 ** 20 + 1))).toThrow(RangeError)
    const holes = sparse(2 ** 25, { 0: 'a' }) as string[]
    expect(() => get({}, holes)).toThrow(RangeError)
  })
})

describe('get', () => {
  it('reads own and inherited values', () => {
    expect(get({ a: 1 }, 'a')).toBe(1)
    expect(get(Object.create({ a: 1 }), 'a')).toBe(1)
    expect(get('abc', 'length')).toBe(3)
    expect(get(new Map([[1, 2]]), 'size')).toBe(1)
  })

  it('returns the default for a miss or undefined', () => {
    expect(get({ a: undefined }, 'a', 'dflt')).toBe('dflt')
    expect(get({ a: null }, 'a', 'dflt')).toBeNull()
    expect(get({ a: null }, 'a.b', 'dflt')).toBe('dflt')
    expect(get(null, 'a')).toBeUndefined()
  })

  it('never reaches a prototype through __proto__, constructor or prototype', () => {
    expect(get({}, '__proto__')).toBeUndefined()
    expect(get({}, 'constructor.prototype')).toBeUndefined()
    expect(get(class {}, 'prototype')).toBeUndefined()
    expect(get(new (class Point {})(), 'constructor')).toBeUndefined()
  })

  it('reads those keys when they are own data', () => {
    const parsed = JSON.parse('{"__proto__": {"x": 1}, "constructor": 2}') as object
    expect(get(parsed, '__proto__.x')).toBe(1)
    expect(get(parsed, 'constructor')).toBe(2)
  })

  it('lets getter errors through', () => {
    const obj = {
      get boom(): number {
        throw new Error('boom')
      }
    }
    expect(() => get(obj, 'boom')).toThrow('boom')
  })
})

describe('has', () => {
  it.each(['x', 'a.x'])('never reads the terminal value at %s', (path) => {
    let reads = 0
    const terminal = {
      get x() {
        throw new Error('terminal getter')
      }
    }
    const nested = {
      get a() {
        reads++
        return terminal
      }
    }

    expect(has(path === 'x' ? terminal : nested, path)).toBe(true)
    expect(reads).toBe(path === 'x' ? 0 : 1)
    expect(has(terminal, 'absent')).toBe(false)
  })

  it('checks own properties at every step', () => {
    expect(has({ a: { b: undefined } }, 'a.b')).toBe(true)
    expect(has({ a: [1] }, 'a[0]')).toBe(true)
    expect(has({ a: [1] }, 'a[1]')).toBe(false)
    expect(has(Object.create({ a: 1 }), 'a')).toBe(false)
    expect(has({}, 'toString')).toBe(false)
    expect(has('abc', 'length')).toBe(true)
    expect(has(null, 'a')).toBe(false)
  })

  it('does not count prototype-reaching segments', () => {
    expect(has({}, '__proto__')).toBe(false)
    expect(has(function f() {}, 'prototype')).toBe(false)
    expect(has(JSON.parse('{"__proto__": 1}') as object, '__proto__')).toBe(true)
  })
})

describe('set', () => {
  it('creates plain objects, and arrays before index segments', () => {
    expect(set({}, 'a.b', 1)).toEqual({ a: { b: 1 } })
    expect(set({}, 'list[0]', 'x')).toEqual({ list: ['x'] })
    expect(set({}, ['list', '0', 'id'], 7)).toEqual({ list: [{ id: 7 }] })
    expect(set({ a: 5 }, 'a.b', 1)).toEqual({ a: { b: 1 } })
  })

  it('assigns, so setters run', () => {
    const seen: number[] = []
    const obj = {
      set x(v: number) {
        seen.push(v)
      }
    }
    set(obj, 'x', 3)
    expect(seen).toEqual([3])
  })

  it('returns the object', () => {
    const obj = { a: { b: 1 } }
    expect(set(obj, 'a.b', 2)).toBe(obj)
  })

  it('returns a primitive or nullish root as it is', () => {
    expect(set(null, 'a', 1)).toBeNull()
    expect(set(5, 'a', 1)).toBe(5)
  })

  it('refuses to write toward a prototype', () => {
    try {
      expect(() => set({}, '__proto__.polluted', 1)).toThrow(TypeError)
      expect(() => set({}, 'constructor.prototype.polluted', 1)).toThrow(TypeError)
      expect(() => set({}, ['__proto__', 'polluted'], 1)).toThrow(TypeError)
      expect(() => set(Object.create({ inherited: {} }), 'inherited.x', 1)).toThrow(TypeError)
      expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    } finally {
      Reflect.deleteProperty(Object.prototype, 'polluted')
    }
    const parsed = JSON.parse('{"__proto__": {}}') as Record<string, Record<string, unknown>>
    set(parsed, '__proto__.x', 1)
    expect(Object.getOwnPropertyDescriptor(parsed, '__proto__')?.value.x).toBe(1)
  })

  it('refuses a prototype-reaching last segment', () => {
    const target = { a: {} as Record<string, unknown> }
    expect(() => set({}, '__proto__', { isAdmin: true })).toThrow(TypeError)
    expect(() => set({}, 'a.__proto__', { isAdmin: true })).toThrow(TypeError)
    expect(() => set(target, 'a.__proto__', { isAdmin: true })).toThrow(TypeError)
    expect(target.a.isAdmin).toBeUndefined()
  })

  it("refuses to write through a function's own prototype", () => {
    class Victim {}
    expect(() => set({ cls: Victim }, 'cls.prototype.isAdmin', true)).toThrow(TypeError)
    expect(Object.hasOwn(Victim.prototype, 'isAdmin')).toBe(false)
  })

  it('refuses an index past the end of an array, so a short path allocates nothing big', () => {
    expect(() => set([], '4294967294', 1)).toThrow(RangeError)
    expect(() => set({}, 'a[3]', 1)).toThrow(RangeError)
    expect(() => set([1], 'length', 10)).toThrow('array length can only shrink')
    let calls = 0
    const length = {
      valueOf: () => {
        calls++
        return 0
      }
    }
    expect(() => set([1], 'length', length)).toThrow(RangeError)
    expect(calls).toBe(0)
    expect(set([1, 2], 'length', 1)).toEqual([1])
    expect(set([1], '1', 2)).toEqual([1, 2])
  })

  it('writes and deletes own __proto__ data from another realm', () => {
    const parsed = vm.runInContext(`JSON.parse('{"__proto__": {}}')`, context) as Record<
      string,
      Record<string, unknown>
    >
    set(parsed, '__proto__.x', 1)
    expect(Object.getOwnPropertyDescriptor(parsed, '__proto__')?.value.x).toBe(1)
    expect(unset(parsed, '__proto__')).toBe(true)
    expect(Object.hasOwn(parsed, '__proto__')).toBe(false)
  })
})

describe('unset', () => {
  it('deletes the property at the path', () => {
    const obj = { a: { b: 1, c: 2 } }
    expect(unset(obj, 'a.b')).toBe(true)
    expect(obj).toEqual({ a: { c: 2 } })
    expect(unset(obj, 'x.y')).toBe(true)
    expect(unset(null, 'a')).toBe(true)
    expect(unset({ a: 5 }, 'a.b.c')).toBe(true)
  })

  it('reports a property it cannot delete', () => {
    const frozen = Object.freeze({ a: 1 })
    expect(unset(frozen, 'a')).toBe(false)
  })

  test.for(['__proto__', 'constructor', 'prototype'])('refuses %s at every position', (key) => {
    const target = { a: {} }

    expect(unset(target, [key])).toBe(false)
    expect(unset(target, [key, 'x'])).toBe(false)
    expect(unset(target, ['a', key])).toBe(false)
    expect(unset(target, ['a', key, 'x'])).toBe(false)
    expect(target).toStrictEqual({ a: {} })
  })

  it('never deletes through a prototype-reaching or inherited step', () => {
    expect(unset({}, '__proto__.toString')).toBe(false)
    expect(unset({}, 'constructor.prototype.toString')).toBe(false)
    expect(unset(Object.create({ a: { b: 1 } }), 'a.b')).toBe(false)
    expect(typeof Object.prototype.toString).toBe('function')
  })

  it("never deletes through a function's own prototype", () => {
    class Victim {
      m(): number {
        return 1
      }
    }
    expect(unset({ c: Victim }, 'c.prototype.m')).toBe(false)
    expect(typeof Victim.prototype.m).toBe('function')
  })

  it('refuses a prototype-reaching last segment', () => {
    class Base {}
    class Derived extends Base {}
    expect(unset({ a: Derived.prototype }, 'a.constructor')).toBe(false)
    expect(Object.hasOwn(Derived.prototype, 'constructor')).toBe(true)
    const point = new (class Point {})()
    expect(unset(point, 'constructor')).toBe(false)
  })
})
