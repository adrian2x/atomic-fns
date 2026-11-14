import vm from 'node:vm'
import { describe, expect, expectTypeOf, it, test } from 'vitest'
import { get, has, omit, omitBy, pick, pickBy, set, unset } from '../src/object/index.ts'
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

  it.each([
    { path: 'constructor', make: () => ({}) },
    { path: 'prototype', make: () => ({}) },
    { path: 'a.constructor', make: () => ({}) },
    { path: 'a.prototype', make: () => ({}) },
    { path: 'a.prototype', make: () => ({ a: {} }) },
    { path: 'constructor', make: () => [] },
    { path: 'prototype', make: () => [] },
    { path: 'constructor', make: () => Object.create(null) as object },
    { path: 'constructor', make: () => vm.runInContext('({})', context) as object }
  ])('writes a terminal $path as own data: %#', ({ path, make }) => {
    const obj = make()
    const proto = Object.getPrototypeOf(obj)
    const constructor = Object.getOwnPropertyDescriptor(Object.prototype, 'constructor')

    expect(set(obj, path, 7)).toBe(obj)

    const container = path.startsWith('a.') ? get(obj, 'a') : obj
    expect(
      Object.getOwnPropertyDescriptor(container, path.split('.').at(-1) as string)
    ).toStrictEqual({
      value: 7,
      writable: true,
      enumerable: true,
      configurable: true
    })
    expect(Object.getPrototypeOf(obj)).toBe(proto)
    expect(Object.getOwnPropertyDescriptor(Object.prototype, 'constructor')).toStrictEqual(
      constructor
    )
  })

  it.each(['constructor', 'prototype'])('keeps the attributes of writable own %s data', (key) => {
    const obj = Object.defineProperty({}, key, { value: 1, writable: true })

    set(obj, key, 7)

    expect(Object.getOwnPropertyDescriptor(obj, key)).toStrictEqual({
      value: 7,
      writable: true,
      enumerable: false,
      configurable: false
    })
  })

  test.for([
    { path: '__proto__', key: '__proto__', make: () => ({}) },
    {
      path: 'constructor',
      key: 'constructor',
      make: () => Object.defineProperty({}, 'constructor', { get: () => 1, configurable: true })
    },
    {
      path: 'prototype',
      key: 'prototype',
      make: () => Object.defineProperty({}, 'prototype', { set() {}, configurable: true })
    },
    {
      path: 'constructor',
      key: 'constructor',
      make: () => Object.defineProperty({}, 'constructor', { value: 1, configurable: true })
    },
    {
      path: 'prototype',
      key: 'prototype',
      make: () => Object.defineProperty({}, 'prototype', { value: 1, configurable: true })
    },
    { path: 'constructor.prototype.x', key: 'constructor', make: () => ({}) },
    { path: 'prototype.x', key: 'prototype', make: () => ({}) },
    { path: 'a.__proto__.x', key: '__proto__', make: () => ({ a: {} }) },
    { path: 'a.constructor.x', key: 'constructor', make: () => ({}) },
    { path: 'a.prototype.x', key: 'prototype', make: () => ({}) }
  ])('refuses unsafe key writes: $path, %#', ({ path, key, make }) => {
    const obj = make()
    const descriptors = Object.entries(Object.getOwnPropertyDescriptors(obj))

    expect(() => set(obj, path, 7)).toThrowError(
      new TypeError(`refusing to write through "${key}"`)
    )

    expect(Object.entries(Object.getOwnPropertyDescriptors(obj))).toStrictEqual(descriptors)
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

describe('pick and omit types', () => {
  it('keeps literal key tuples precise', () => {
    const sym = Symbol('key')
    const obj = { foo: 1, bar: 'two', [sym]: true }
    const picked = pick(obj, ['foo'])
    const omitted = omit(obj, ['foo'])
    const keys = ['bar', sym] as const

    expectTypeOf(picked).toEqualTypeOf<Pick<typeof obj, 'foo'>>()
    expectTypeOf(omitted).toEqualTypeOf<Omit<typeof obj, 'foo'>>()
    expectTypeOf<Extract<'bar', keyof typeof picked>>().toBeNever()
    expectTypeOf<Extract<'foo', keyof typeof omitted>>().toBeNever()
    expectTypeOf(pick(obj, keys)).toEqualTypeOf<Pick<typeof obj, 'bar' | typeof sym>>()
    expectTypeOf(omit(obj, keys)).toEqualTypeOf<Omit<typeof obj, 'bar' | typeof sym>>()
    expectTypeOf(pick(obj, [])).toEqualTypeOf<Pick<typeof obj, never>>()
    expectTypeOf(omit(obj, [])).toEqualTypeOf<typeof obj>()
    const optional: { readonly foo: number; bar?: string; 7: boolean } = { foo: 1, 7: true }
    expectTypeOf(pick(optional, ['foo', 'bar', 7])).toEqualTypeOf<typeof optional>()
    expectTypeOf(omit(optional, ['foo'])).toEqualTypeOf<Omit<typeof optional, 'foo'>>()
  })

  it.each(['foo', 'bar'] as const)('keeps a union tuple key partial: %s', (key) => {
    const obj = { foo: 1, bar: 2, kept: true }
    const picked = pick(obj, [key])
    const omitted = omit(obj, [key])

    expectTypeOf(picked).toEqualTypeOf<Partial<typeof obj>>()
    expectTypeOf(omitted).toEqualTypeOf<Partial<typeof obj>>()
    expect(picked).toStrictEqual({ [key]: obj[key] })
    expect(omitted).toStrictEqual(key === 'foo' ? { bar: 2, kept: true } : { foo: 1, kept: true })
  })

  it('keeps numeric index signatures partial', () => {
    const obj: Record<number, string> = {}
    const picked = pick(obj, [0])
    const omitted = omit(obj, [0])

    expectTypeOf(picked).toEqualTypeOf<Partial<typeof obj>>()
    expectTypeOf(omitted).toEqualTypeOf<Partial<typeof obj>>()
    expectTypeOf(pick(obj, [])).toEqualTypeOf<Partial<typeof obj>>()
    expectTypeOf(omit(obj, [])).toEqualTypeOf<Partial<typeof obj>>()
    expect(picked).toStrictEqual({})
    expect(omitted).toStrictEqual({})
  })

  it('keeps symbol index signatures partial', () => {
    const key = Symbol('missing')
    const obj: Record<symbol, string> = {}
    const picked = pick(obj, [key])
    const omitted = omit(obj, [key])

    expectTypeOf(picked).toEqualTypeOf<Partial<typeof obj>>()
    expectTypeOf(omitted).toEqualTypeOf<Partial<typeof obj>>()
    expectTypeOf(pick(obj, [])).toEqualTypeOf<Partial<typeof obj>>()
    expectTypeOf(omit(obj, [])).toEqualTypeOf<Partial<typeof obj>>()
    expect(picked).toStrictEqual({})
    expect(omitted).toStrictEqual({})
  })

  it('keeps non-tuple key lists partial', () => {
    const obj = { foo: 1, bar: 'two', baz: true }
    const keys: ('foo' | 'bar')[] = ['foo']

    expectTypeOf(pick(obj, keys)).toEqualTypeOf<Partial<Pick<typeof obj, 'foo' | 'bar'>>>()
    expectTypeOf(omit(obj, keys)).toEqualTypeOf<Partial<Omit<typeof obj, 'foo' | 'bar'>>>()
  })

  it('keeps paths, nullable inputs, index signatures and arrays permissive', () => {
    const obj = { foo: 1, bar: 'two', nested: { x: 3 }, 'a.b': 4, 'x[y': 5, 'z]': 6 }
    const nullable = obj as typeof obj | null | undefined
    const record: Record<string, unknown> = { foo: 1 }
    const dynamic: string[] = ['foo']
    const array = [1, 2]
    const readonlyArray = [1, 2] as const

    expectTypeOf(pick(nullable, ['foo'])).toEqualTypeOf<Partial<typeof nullable>>()
    expectTypeOf(omit(nullable, ['foo'])).toEqualTypeOf<Partial<typeof obj>>()
    expectTypeOf(pick(record, ['foo'])).toEqualTypeOf<Partial<typeof record>>()
    expectTypeOf(omit(record, ['foo'])).toEqualTypeOf<Partial<typeof record>>()
    expectTypeOf(pick(record, [])).toEqualTypeOf<Partial<typeof record>>()
    expectTypeOf(omit(record, [])).toEqualTypeOf<Partial<typeof record>>()
    expectTypeOf(pick(obj, ['nested.x'])).toEqualTypeOf<Partial<typeof obj>>()
    expectTypeOf(omit(obj, ['nested.x'])).toEqualTypeOf<Partial<typeof obj>>()
    expectTypeOf(pick(obj, ['a.b'])).toEqualTypeOf<Partial<typeof obj>>()
    expectTypeOf(omit(obj, ['a.b'])).toEqualTypeOf<Partial<typeof obj>>()
    expectTypeOf(() => pick(obj, ['x[y'])).returns.toEqualTypeOf<Partial<typeof obj>>()
    expectTypeOf(() => omit(obj, ['x[y'])).returns.toEqualTypeOf<Partial<typeof obj>>()
    expectTypeOf(() => pick(obj, ['z]'])).returns.toEqualTypeOf<Partial<typeof obj>>()
    expectTypeOf(() => omit(obj, ['z]'])).returns.toEqualTypeOf<Partial<typeof obj>>()
    expectTypeOf(pick(obj, dynamic)).toEqualTypeOf<Partial<typeof obj>>()
    expectTypeOf(omit(obj, dynamic)).toEqualTypeOf<Partial<typeof obj>>()
    expectTypeOf(pick(array, ['0'])).toEqualTypeOf<Partial<typeof array>>()
    expectTypeOf(omit(array, ['0'])).toEqualTypeOf<Partial<typeof array>>()
    expectTypeOf(pick(array, [])).toEqualTypeOf<Partial<typeof array>>()
    expectTypeOf(omit(array, [])).toEqualTypeOf<Partial<typeof array>>()
    expectTypeOf(pick(readonlyArray, [])).toEqualTypeOf<Partial<typeof readonlyArray>>()
    expectTypeOf(omit(readonlyArray, [])).toEqualTypeOf<Partial<typeof readonlyArray>>()
  })
})

describe('pick', () => {
  it.each([
    { paths: ['a.b', 'a.c'], expected: { a: { b: 1, c: 2 } } },
    { paths: ['a.b', 'a.b', 'a.c'], expected: { a: { b: 1, c: 2 } } },
    { paths: ['a.absent', 'a.c'], expected: { a: { c: 2 } } }
  ])('combines shared paths for $paths', ({ paths, expected }) => {
    expect(pick({ a: { b: 1, c: 2 } }, paths)).toStrictEqual(expected)
  })

  it('leaves out paths beneath missing or undefined values', () => {
    expect(pick({}, ['a.b', 'a.c'])).toStrictEqual({})
    expect(pick({ a: undefined }, ['a.b', 'a.c'])).toStrictEqual({})
    expect(pick({ a: undefined }, ['a.b', 'a'])).toStrictEqual({ a: undefined })
  })

  it('copies the values at the paths into new containers', () => {
    expect(pick({ a: 1, b: 2, c: 3 }, ['a', 'c'])).toEqual({ a: 1, c: 3 })
    expect(pick({ a: { b: 1, c: 2 } }, 'a.b')).toEqual({ a: { b: 1 } })
    const out = pick({ list: [{ id: 1, x: 2 }] }, ['list[0].id'])
    expect(out).toEqual({ list: [{ id: 1 }] })
    expect(Array.isArray(out.list)).toBe(true)
    expect(pick({ a: { 0: 1 } }, ['a.0'])).toEqual({ a: { 0: 1 } })
  })

  it('leaves out missing, inherited and prototype-reaching paths', () => {
    expect(Object.keys(pick({ a: 1 }, ['a', 'b']))).toEqual(['a'])
    expect(pick({ a: undefined }, ['a'])).toStrictEqual({ a: undefined })
    expect(pick(Object.create({ a: 1 }), ['a'])).toEqual({})
    expect(pick({}, ['__proto__', 'constructor'])).toEqual({})
    expect(pick('abc', ['length'])).toEqual({ length: 3 })
  })

  it('never reads a prototype that is own data of a function', () => {
    function Fn(): void {}
    expect(pick(class {}, ['prototype'])).toEqual({})
    expect(pick({ f: Fn }, 'f.prototype')).toEqual({})
  })

  it('keeps __proto__ as an own data key', () => {
    const parsed = JSON.parse('{"__proto__": {"admin": true}, "a": 1}') as object
    const out = pick(parsed, ['__proto__', 'a'])
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype)
    expect(Object.keys(out)).toEqual(['__proto__', 'a'])
  })

  it('keeps the source values by reference', () => {
    const inner = { b: 1, c: 2 }
    const src = { a: inner }
    const out = pick(src, ['a', 'a.b']) as typeof src
    expect(out.a).toBe(inner)
    const reversed = pick(src, ['a.b', 'a']) as typeof src
    expect(reversed.a).toBe(inner)
    expect(inner).toStrictEqual({ b: 1, c: 2 })
  })

  it('takes single keys and key arrays in its list', () => {
    const sym = Symbol('s')
    expect(pick({ [sym]: 1, 'x.y': 2 }, [sym, ['x.y']])).toEqual({ [sym]: 1, 'x.y': 2 })
  })

  it('refuses a hole or a huge sparse list of paths', () => {
    expect(() => pick({ a: 1 }, sparse(3, { 0: 'a', 2: 'a' }) as never)).toThrow(TypeError)
    const holes = sparse(2 ** 25, { 0: 'a' }) as string[]
    expect(() => pick({}, holes)).toThrow(RangeError)
  })
})

describe('omit', () => {
  it.each([false, true])('never reads an omitted array element: nested=%s', (nested) => {
    const xs = [1, 2]
    let reads = 0
    Object.defineProperties(xs, {
      0: {
        get() {
          reads++
          return 1
        }
      },
      1: {
        get() {
          throw new Error('omitted element')
        }
      }
    })

    const out = nested ? omit({ xs }, 'xs.1').xs : omit(xs, ['1'])

    expect(out).toStrictEqual(sparse(2, { 0: 1 }))
    expect(out?.length).toBe(2)
    expect(1 in (out as number[])).toBe(false)
    expect(reads).toBe(1)
  })

  it.each([
    { array: false, nested: false },
    { array: false, nested: true },
    { array: true, nested: false },
    { array: true, nested: true }
  ])('keeps enumerable symbols: array=$array, nested=$nested', ({ array, nested }) => {
    const kept = Symbol('kept')
    const dropped = Symbol('dropped')
    const hidden = Symbol('hidden')
    const value = array ? Object.assign([1], { named: 'not an element' }) : { keep: 1 }
    let reads = 0
    Object.defineProperties(value, {
      [kept]: {
        enumerable: true,
        get() {
          reads++
          return 2
        }
      },
      [dropped]: {
        enumerable: true,
        get() {
          throw new Error('omitted symbol')
        }
      },
      [hidden]: {
        get() {
          throw new Error('hidden symbol')
        }
      }
    })

    const out = nested ? omit({ child: value }, [['child', dropped]]) : omit(value, [dropped])
    const expected = Object.assign(array ? [1] : { keep: 1 }, { [kept]: 2 })

    expect(out).toStrictEqual(nested ? { child: expected } : expected)
    expect(reads).toBe(1)
  })

  it.each([false, true])('copies nested paths beneath a symbol: array=%s', (array) => {
    const key = Symbol('child')
    const child = { keep: 1, drop: 2 }
    const obj = Object.assign(array ? [3] : {}, { [key]: child })

    const out = omit(obj, [[key, 'drop']])

    expect(out).toStrictEqual(Object.assign(array ? [3] : {}, { [key]: { keep: 1 } }))
    expect(child).toStrictEqual({ keep: 1, drop: 2 })
  })

  it('copies everything but the paths', () => {
    expect(omit({ a: 1, b: 2, c: 3 }, ['a', 'c'])).toEqual({ b: 2 })
    expect(omit({ user: { name: 'a', password: 'p' }, ok: true }, 'user.password')).toEqual({
      user: { name: 'a' },
      ok: true
    })
    expect(omit({ a: { b: 1 } }, 'a.b.c')).toEqual({ a: { b: 1 } })
    expect(omit(null, ['a'])).toEqual({})
  })

  it('never changes the source', () => {
    const src = { user: { name: 'a', password: 'p' }, ok: true }
    omit(src, 'user.password')
    expect(src).toEqual({ user: { name: 'a', password: 'p' }, ok: true })
  })

  it('keeps __proto__ as an own data key', () => {
    const parsed = JSON.parse('{"__proto__": {"role": "admin"}, "role": "user"}') as object
    const out = omit(parsed, ['role'])
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype)
    expect(Object.keys(out)).toEqual(['__proto__'])
    expect((out as { role?: string }).role).toBeUndefined()
  })

  it('keeps a null prototype', () => {
    const dict = Object.assign(Object.create(null) as Record<string, number>, { x: 1, y: 2 })
    const out = omit(dict, ['x'])
    expect(Object.getPrototypeOf(out)).toBeNull()
    expect(Object.keys(out)).toEqual(['y'])
  })

  it('copies arrays and plain objects from another realm', () => {
    const tags = omit(vm.runInContext('({ tags: ["a", "b"], x: 1 })', context) as object, [
      'tags[0]'
    ])
    expect(Object.keys(tags)).toEqual(['tags', 'x'])
    expect(0 in (tags as { tags: string[] }).tags).toBe(false)
    const list = omit(vm.runInContext('[1, 2]', context) as number[], ['0']) as number[]
    expect(0 in list).toBe(false)
    expect(list[1]).toBe(2)
  })

  it('refuses a hole or a huge sparse list of paths', () => {
    expect(() => omit({ a: 1 }, sparse(3, { 0: 'a', 2: 'a' }) as never)).toThrow(TypeError)
    const holes = sparse(2 ** 25, { 0: 'a' }) as string[]
    expect(() => omit({}, holes)).toThrow(RangeError)
  })

  it('keeps values off the paths by reference', () => {
    const kept = { x: 1 }
    const out = omit({ kept, drop: 1 }, ['drop']) as { kept: object }
    expect(out.kept).toBe(kept)
  })

  it('copies arrays along a path, leaving a hole where an index is omitted', () => {
    const out = omit({ list: [1, 2, 3] }, ['list[1]']) as { list: number[] }
    expect(out.list).toHaveLength(3)
    expect(1 in out.list).toBe(false)
    const arr = omit([1, 2], ['0']) as number[]
    expect(0 in arr).toBe(false)
    expect(arr[1]).toBe(2)
  })

  it('refuses objects it would have to copy into a plain object', () => {
    class Entity {
      secret = 's'
      toJSON(): object {
        return {}
      }
    }
    expect(() => omit(new Entity(), ['x'])).toThrow(TypeError)
    expect(() => omit({ e: new Entity() }, ['e.secret'])).toThrow(TypeError)
    expect(() => omit({ d: new Date(0) }, ['d.x'])).toThrow(TypeError)
    expect(omit({ d: new Date(0), x: 1 }, ['x'])).toEqual({ d: new Date(0) })
    class List extends Array<number> {}
    expect(() => omit(List.from([1]), ['0'])).toThrow(TypeError)
    expect(() => omit({ l: List.from([1]) }, ['l.0'])).toThrow(TypeError)
  })

  it('refuses a function a path walks into', () => {
    const handler = Object.assign(() => {}, { apiKey: 'k' })
    expect(() => omit({ handler }, ['handler.apiKey'])).toThrow(TypeError)
    expect(handler.apiKey).toBe('k')
  })

  it('refuses a plain object or array with its own toJSON function or accessor', () => {
    const user = { id: 1, passwordHash: 'H', note: 'n' }
    Object.defineProperty(user, 'toJSON', {
      value(this: typeof user) {
        return { id: this.id }
      }
    })
    expect(() => omit(user, 'note')).toThrow(TypeError)
    const rows = [{ id: 1, tmp: 0 }]
    Object.defineProperty(rows, 'toJSON', { value: () => [] })
    expect(() => omit({ rows }, 'rows[0].tmp')).toThrow(TypeError)
    const accessor = { password: 'p' }
    Object.defineProperty(accessor, 'toJSON', { get: () => () => ({}), enumerable: true })
    expect(() => omit({ a: accessor }, 'a.password')).toThrow(TypeError)
    const data = JSON.parse('{"toJSON": "x", "password": "p"}') as object
    expect(omit(data, ['password'])).toEqual({ toJSON: 'x' })
  })

  it('stops a path deeper than the nesting limit', () => {
    const path = Array.from({ length: 1200 }, () => 'a')
    let deep: Record<string, unknown> = {}
    for (let i = 0; i < 1200; i++) deep = { a: deep }
    expect(() => omit(deep, [path])).toThrow(RangeError)
  })
})

describe('pickBy and omitBy', () => {
  it('keep the own enumerable string keys a predicate chooses', () => {
    expect(pickBy({ a: 1, b: '2', c: 3 }, (value) => typeof value === 'number')).toEqual({
      a: 1,
      c: 3
    })
    expect(omitBy({ a: 1, b: undefined }, (value) => value === undefined)).toStrictEqual({ a: 1 })
    expect(pickBy({ a: 1, b: 2 }, (_value, key) => key === 'b')).toEqual({ b: 2 })
    expect(pickBy(Object.create({ a: 1 }), () => true)).toEqual({})
    expect(pickBy(null, () => true)).toEqual({})
  })

  it('pass the object as the third argument', () => {
    const row = { a: 1, b: 2, fallback: 2 }
    expect(pickBy(row, (value, key, all) => key !== 'fallback' && value !== all.fallback)).toEqual({
      a: 1
    })
    expect(omitBy(row, (value, key, all) => key !== 'fallback' && value === all.fallback)).toEqual({
      a: 1,
      fallback: 2
    })
  })

  it('return a plain object for an array, typed by index key', () => {
    const picked: Record<string, number> = pickBy([1, 2, 3], (value) => value !== 2)
    expect(picked).toEqual({ 0: 1, 2: 3 })
    expect(Array.isArray(picked)).toBe(false)
    const omitted: Record<string, string> = omitBy(['a', 'b'], (value) => value === 'a')
    expect(omitted).toEqual({ 1: 'b' })
  })

  it('keep __proto__ as an own data key', () => {
    const parsed = JSON.parse('{"__proto__": {"role": "admin"}, "role": "user"}') as object
    for (const out of [
      pickBy(parsed, (_v, k) => k === '__proto__'),
      omitBy(parsed, (_v, k) => k === 'role')
    ]) {
      expect(Object.getPrototypeOf(out)).toBe(Object.prototype)
      expect(Object.keys(out)).toEqual(['__proto__'])
      expect((out as { role?: string }).role).toBeUndefined()
    }
  })
})
