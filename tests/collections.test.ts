import vm from 'node:vm'
import { describe, it, expect, vi } from 'vitest'
import {
  compact,
  count,
  defaults,
  defineData,
  difference,
  filter,
  find,
  findIndex,
  findLast,
  findLastIndex,
  flatten,
  forEach,
  forEachRight,
  groupBy,
  groupByMap,
  indexOf,
  insert,
  intersection,
  lastIndexOf,
  map,
  merge,
  omit,
  pick,
  reject,
  remove,
  sortedUniq,
  symmetricDifference,
  union,
  uniq,
  without
} from '../src/collections/index.js'
import { isPlainObject } from '../src/collections/object.js'
import { ValueError } from '../src/globals/index.js'
import { budget, expectFast } from './helpers/perf.js'

describe('collections', () => {
  it('SPEC-R30 remove mutates and returns removed', () => {
    const a = [1, 2, 3, 4]
    expect(remove(a, (x) => x % 2 === 0)).toEqual([2, 4])
    expect(a).toEqual([1, 3])
    expect(remove([], () => true)).toEqual([])
    expect(() => remove({} as unknown as number[], () => true)).toThrow(TypeError)
  })

  it('SPEC-R30 reject pure by predicate', () => {
    const input = [1, 2, 3]
    expect(reject(input, (x) => x > 1)).toEqual([1])
    expect(input).toEqual([1, 2, 3])
  })

  it('SPEC-R30 without pure by values SameValueZero', () => {
    const input = [1, 2, 1, NaN]
    expect(without(input, 1, NaN)).toEqual([2])
    expect(input).toEqual([1, 2, 1, NaN])
    expect(without(['a', 'b'], 'a')).toEqual(['b'])
    expect(Object.is(without([-0, 1], 2)[0], -0)).toBe(false)
    expect(without([-0, 1], 2)).toEqual([0, 1])
  })

  it('SPEC-R34 difference symmetricDifference intersection union', () => {
    expect([...difference([2, 1], [2, 3])]).toEqual([1])
    expect([...difference([1, 2])]).toEqual([1, 2])
    expect([...symmetricDifference([2, 1], [2, 3])]).toEqual([1, 3])
    expect([...intersection([2, 1], [2, 3])]).toEqual([2])
    expect([...union([2], [1, 2])]).toEqual([2, 1])
  })

  it('SPEC-R35 uniq and sortedUniq', () => {
    expect(uniq([2.1, 1.2, 2.3], Math.floor)).toEqual([2.1, 1.2])
    expect(uniq([4, 7, 1, 1, 9, 4, 7], (x) => x * 2)).toEqual([4, 7, 1, 9])
    expect(sortedUniq([4, 7, 1, 1, 9, 4, 7])).toEqual([1, 4, 7, 9])
    expect(uniq([-0, 0])).toEqual([0])
    expect(Object.is(uniq([-0, 0])[0], -0)).toBe(false)
  })

  it('SPEC-R36 lastIndexOf default start', () => {
    expect(lastIndexOf([1, 2, 1, 2], 2)).toBe(3)
    expect(lastIndexOf([1, 2, 1, 2], 2, 2)).toBe(1)
  })

  it('SPEC-R38 count groupBy groupByMap edge keys', () => {
    expect(count(['a.b', 'a.b'], (x) => x)['a.b']).toBe(2)
    expect(
      Reflect.get(
        count(['toString'], (x) => x),
        'toString'
      )
    ).toBe(1)

    const g = groupBy(['__proto__', 'constructor'], (x: string) => x)
    expect(Object.hasOwn(g, '__proto__')).toBe(true)
    expect(Object.hasOwn(g, 'constructor')).toBe(true)
    expect(g.__proto__).toHaveLength(1)
    expect(g.constructor).toHaveLength(1)

    const gm = groupByMap(['10', '10'], (v: string) => parseInt(v, 10))
    expect([...gm.keys()]).toEqual([10])
    expect(gm.get(10)).toEqual(['10', '10'])
  })

  it('SPEC-R39 findLast on Set; forEach null', () => {
    expect(findLast(new Set([1, 2, 3]), (x) => x > 1)).toBe(3)
    const fn = vi.fn()
    forEach(null, fn)
    expect(fn).not.toHaveBeenCalled()
  })

  it('SPEC-R40 filter default and compact', () => {
    expect(filter([1, null, 2])).toEqual([1, 2])
    const c = compact([new Date(0), /x/, [], {}, 0, 1])
    expect(c).toHaveLength(3)
  })

  it('flattenArray single-output stack: 900-deep with 2500 leaves within budget', () => {
    // Pre-fix: quadratic output growth. Revert of 8c67194 fails this.
    const leaves = Array.from({ length: 2500 }, (_, i) => i)
    let nested: unknown = leaves
    for (let d = 0; d < 899; d++) nested = [nested]
    expectFast(() => {
      const out = flatten(nested as number[], true)
      expect(out).toEqual(leaves)
    }, 1000)
  })

  it('SPEC-R41 flatten depth holes and object leaves', () => {
    expect(flatten([[1, [2]]], -1)).toEqual([[1, [2]]])
    const d = new Date(0)
    const flat = flatten({ d }) as { d: Date }
    expect(flat.d).toBeInstanceOf(Date)
    expect(flat.d).toBe(d)

    const cyclic: { a?: object } = {}
    cyclic.a = cyclic
    expect(() => flatten(cyclic)).toThrow(/cyclic structure/)
  })

  it('flatten refuses to copy a huge sparse array at depth 0', { timeout: budget(5000) }, () => {
    const atLimit: unknown[] = []
    atLimit.length = 2 ** 24
    const huge: unknown[] = []
    huge.length = 2 ** 24 + 1

    expect(flatten(atLimit, 0)).toHaveLength(2 ** 24)
    expect(() => flatten(huge, 0)).toThrow(new RangeError('sparse array too large'))
  })

  it('flatten keeps an own __proto__ key as plain data', () => {
    const date = new Date(0)

    const fromNull = flatten(JSON.parse('{"__proto__":null,"a":1}') as object)
    const fromDate = flatten({ ['__proto__']: date })

    expect(Object.getPrototypeOf(fromNull)).toBe(Object.prototype)
    expect(Object.entries(fromNull)).toEqual([
      ['__proto__', null],
      ['a', 1]
    ])
    expect(Object.getPrototypeOf(fromDate)).toBe(Object.prototype)
    expect(Object.getOwnPropertyDescriptor(fromDate, '__proto__')?.value).toBe(date)
  })

  it('a length no array can have is not an array-like', () => {
    expect(indexOf(JSON.parse('{"length":1e15}') as never, 'x')).toBe(-1)
  })

  it('R13-D3: defaults refuses array index keys beyond length', () => {
    expect(() => defaults([], JSON.parse('{"4294967294":1}') as object)).toThrow(RangeError)
    expect(() => defaults([], JSON.parse('{"4294967294":1}') as object)).toThrow(
      'array index beyond length'
    )
    expect(defaults([] as unknown[], JSON.parse('{"0":1}') as object)).toEqual([1])
    expect(() => defaults([] as unknown[], { 0: 1, 2: 3 })).toThrow('array index beyond length')
  })

  it('defaults never assigns __proto__ as a prototype', () => {
    const opts = defaults(
      { name: undefined },
      JSON.parse('{"__proto__":{"isAdmin":true,"role":"root"},"name":"eve"}') as object
    ) as { name?: string; isAdmin?: boolean; role?: string; __proto__?: unknown }
    expect(Object.getPrototypeOf(opts)).toBe(Object.prototype)
    expect(Object.getOwnPropertyDescriptor(Object.prototype, 'isAdmin')).toBeUndefined()
    expect(Object.hasOwn(opts, '__proto__')).toBe(false)
    expect(opts.name).toBe('eve')

    const nullProto = defaults(
      Object.create(null) as object,
      JSON.parse('{"__proto__":{"isAdmin":true}}') as object
    ) as Record<string, unknown>
    expect(Object.getPrototypeOf(nullProto)).toBe(null)
    expect(Object.hasOwn(nullProto, '__proto__')).toBe(true)
    expect(Object.getOwnPropertyDescriptor(Object.prototype, 'isAdmin')).toBeUndefined()

    class Config {
      readonly secure = true
      check(): string {
        return 'ok'
      }
    }
    const cfg = defaults(new Config(), JSON.parse('{"__proto__":{"secure":false}}') as object)
    expect(cfg).toBeInstanceOf(Config)
    expect(Object.getPrototypeOf(cfg)).toBe(Config.prototype)
    expect(cfg.secure).toBe(true)
    expect(typeof cfg.check).toBe('function')
  })

  it('defaults fills only undefined or Object.prototype-inherited keys; setters run', () => {
    class Gate {
      greet() {
        return 'hi'
      }
      toString() {
        return 'Gate'
      }
    }
    Object.defineProperty(Gate.prototype, 'isAdmin', {
      get() {
        return false
      },
      configurable: true
    })
    const g = defaults(new Gate(), { isAdmin: true, greet: 'x', toString: 'ts' }) as Gate & {
      isAdmin: boolean
    }
    expect(g.isAdmin).toBe(false)
    expect(typeof g.greet).toBe('function')
    expect(g.toString()).toBe('Gate')

    const plain = defaults({}, { toString: 'ts' }) as { toString: string }
    expect(plain.toString).toBe('ts')

    class Srv {
      #port: number | undefined
      get port(): number | undefined {
        return this.#port
      }
      set port(v: number | undefined) {
        if (v === 22) throw new Error('port 22 blocked')
        this.#port = v
      }
    }
    expect(() => defaults(new Srv(), { port: 22 })).toThrow('port 22 blocked')
    const s = defaults(new Srv(), { port: 443 })
    expect(s.port).toBe(443)

    class GetterOnly {
      get x(): undefined {
        return undefined
      }
    }
    const go = new GetterOnly()
    expect(() => defaults(go, { x: 1 })).not.toThrow()
    expect(go.x).toBeUndefined()
    expect(Object.hasOwn(go, 'x')).toBe(false)

    class WithSetter {
      #y: number | undefined
      get y(): number | undefined {
        return this.#y
      }
      set y(v: number | undefined) {
        this.#y = v
      }
    }
    const ws = defaults(new WithSetter(), { y: 7 })
    expect(ws.y).toBe(7)
  })

  it('SPEC-R32 pick omit nested and pollution', () => {
    expect(pick({ a: 1 }, ['b'])).toEqual({})
    const picked = pick(JSON.parse('{"__proto__":{"x":1}}'), ['__proto__'])
    expect(Object.getPrototypeOf(picked)).toBe(Object.prototype)
    expect(Object.hasOwn(picked, '__proto__')).toBe(true)

    const src = { a: { b: 1, c: 2 } }
    expect(omit(src, ['a.b'])).toEqual({ a: { c: 2 } })
    expect(src).toEqual({ a: { b: 1, c: 2 } })

    expect(pick({ a: 1 }, ['a.b'])).toEqual({})
    expect(pick({ a: { b: 1, c: 2 } }, ['a.b'])).toEqual({ a: { b: 1 } })
  })

  it('pick copies each intermediate once (20k array paths)', () => {
    // Pre-fix: quadratic path copies (~256 ms POL-5). P/3 < load-safe floor -> correctness
    // asserts + hang guard. Revert of a9ccefa fails the length/value checks under hang.
    const n = 20_000
    const arr = Array.from({ length: n }, (_, i) => i)
    const src = { a: arr }
    const paths = Array.from({ length: n }, (_, i) => `a.${String(i)}`)
    const small = pick({ a: [1, 2, 3] }, ['a.0', 'a.2']) as { a: unknown[] }
    expect(small.a[0]).toBe(1)
    expect(small.a[2]).toBe(3)
    expect(1 in small.a).toBe(false)
    expectFast(() => {
      const out = pick(src, paths) as { a: number[] }
      expect(out.a.length).toBe(n)
      expect(out.a[0]).toBe(0)
      expect(out.a[n - 1]).toBe(n - 1)
    }, 5000)
  })

  it('pick skips child paths under an already-picked ancestor', () => {
    // Pre-fix quadratic; P/3 below load-safe floor -> correctness + hang guard.
    const subtree: Record<string, number> = {}
    for (let i = 0; i < 20_000; i++) subtree[`k${String(i)}`] = i
    const record = { a: subtree }
    const paths: string[] = []
    let bytes = 0
    for (let i = 0; bytes < 10_000; i++) {
      paths.push('a', `a.k${String(i)}`)
      bytes += 3 + 4 + String(i).length
    }
    expect(pick({ a: { k0: 1, k1: 2 } }, ['a', 'a.k0', 'a', 'a.k1'])).toEqual({
      a: { k0: 1, k1: 2 }
    })
    expectFast(() => {
      const out = pick(record, paths) as { a: Record<string, number> }
      expect(out.a).toEqual(subtree)
      expect(out.a).not.toBe(subtree)
    }, 5000)
  })

  it('pick ancestor check is linear for many object-valued sibling paths', () => {
    const o: Record<string, object> = {}
    const paths: string[] = []
    for (let i = 0; i < 10_000; i++) {
      o[`k${String(i)}`] = {}
      paths.push(`k${String(i)}`)
    }
    expectFast(() => {
      const out = pick(o, paths)
      expect(Object.keys(out)).toHaveLength(10_000)
    }, 5000)
  })

  it('POL-17 pick ancestor check is linear in total segments', () => {
    // Pre-fix: quadratic ancestor scan. Revert of e63cdbd / 9411191 fails this.
    expectFast(() => {
      expect(pick({}, ['.'.repeat(10_000)])).toEqual({})
    }, 5000)
    expectFast(() => {
      expect(pick({}, ['a.'.repeat(5000)])).toEqual({})
    }, 5000)
  })

  it('pick dedupe key uses JSON parts so NUL keys do not collide with dotted paths', () => {
    expect(pick({ a: { b: 2 } }, ['a\u0000b', ['a', 'b']])).toEqual({ a: { b: 2 } })
  })

  it('pick/omit: literal segment paths, array containers, no omitted getters', () => {
    expect(pick({ 'a.b': 1 }, [['a.b']])).toEqual({ 'a.b': 1 })
    expect(pick({ 'a.b': 1, a: { b: 2 } }, [['a.b']])).toEqual({ 'a.b': 1 })
    expect(omit({ 'a.b': 1, c: 2 }, [['a.b']])).toEqual({ c: 2 })

    const pickedArr = pick({ a: [1, 2, 3] }, ['a.1']) as { a: unknown }
    expect(Array.isArray(pickedArr.a)).toBe(true)
    expect((pickedArr.a as unknown[])[1]).toBe(2)

    const nestedSrc = { a: [1, 2, 3] }
    const nestedOmit = omit(nestedSrc, ['a.1']) as { a: unknown[] }
    expect(nestedSrc.a).toEqual([1, 2, 3])
    expect(nestedOmit.a).toHaveLength(3)
    expect(1 in nestedOmit.a).toBe(false)
    expect(nestedOmit.a[0]).toBe(1)
    expect(nestedOmit.a[2]).toBe(3)

    const rootArr = [1, 2, 3]
    const rootOmit = omit(rootArr, ['0']) as unknown as unknown[]
    expect(rootArr).toEqual([1, 2, 3])
    expect(rootOmit).toHaveLength(3)
    expect(0 in rootOmit).toBe(false)
    expect(rootOmit[1]).toBe(2)
    expect(rootOmit[2]).toBe(3)

    const d = new Date(0)
    expect(() => omit({ d }, ['d.x'])).toThrow(TypeError)
    expect(d.getTime()).toBe(0)

    const m = new Map([['k', 1]])
    expect(() => omit({ m }, ['m.k'])).toThrow(TypeError)
    expect(m.get('k')).toBe(1)

    class Box {
      x = 1
      y = 2
    }
    const box = new Box()
    const boxSrc = { box, z: 3 }
    expect(() => omit(boxSrc, ['box.x'])).toThrow(TypeError)
    expect(boxSrc.box).toBe(box)
    expect(box.x).toBe(1)

    class Entity {
      passwordHash = 'secret'
      name = 'ada'
      toJSON() {
        return { name: this.name }
      }
    }
    const entity = new Entity()
    const resp = { user: entity, ok: true }
    expect(() => omit(resp, ['user.email'])).toThrow(TypeError)
    expect(JSON.stringify(resp)).not.toContain('passwordHash')
    expect(entity.passwordHash).toBe('secret')

    // POL-11 / POL-15: top-level class instance with hiding toJSON must fail closed
    expect(JSON.stringify(entity)).toBe('{"name":"ada"}')
    expect(() => omit(entity, ['name'])).toThrow(TypeError)
    expect(() => omit(entity, ['name'])).toThrow(/omit requires a plain object or array/)

    const ta = new Uint8Array([1, 2, 3])
    expect(() => omit({ ta }, ['ta.0'])).toThrow(TypeError)
    expect(ta[0]).toBe(1)

    expect(
      omit(
        {
          a: 1,
          b: 2,
          get c() {
            throw new Error('C')
          }
        },
        ['c']
      )
    ).toEqual({ a: 1, b: 2 })
    class Inst {
      a = 1
      get d() {
        throw new Error('D')
      }
    }
    expect(() => omit(new Inst(), ['d'])).toThrow(/omit requires a plain object or array/)

    const n = 4000
    const big: Record<string, number> = {}
    const paths: string[] = []
    for (let i = 0; i < n; i++) {
      const key = `k${String(i)}`
      big[key] = i
      paths.push(key)
    }
    expectFast(() => {
      const omitted = omit(big, paths)
      expect(Object.keys(omitted)).toHaveLength(0)
    }, 1000)
  })

  it('legacy compact count smoke', () => {
    expect(compact([0, 1, false, 2, '', 3])).toEqual([1, 2, 3])
    expect(count(['one', 'two', 'three'], (x) => x.length)).toEqual({ '3': 2, '5': 1 })
  })

  it('find predicate matches property and object input', () => {
    const users = [
      { user: 'barney', age: 36, active: true },
      { user: 'fred', age: 40, active: false }
    ]
    expect(find(users, (o) => o.active)).toBe(users[0])
    expect(find(users, { active: false })).toBe(users[1])
    expect(find(users, 'active')).toBe(users[0])

    const usersObj = {
      '0': { user: 'barney', age: 36, active: true },
      '1': { user: 'fred', age: 40, active: false }
    }
    expect(find(usersObj, { active: false })).toBe(usersObj['1'])
  })

  it('findIndex predicate and shorthand', () => {
    const users = [
      { user: 'barney', active: false },
      { user: 'fred', active: false },
      { user: 'pebbles', active: true }
    ]
    expect(findIndex(users, (o) => o.user === 'barney')).toBe(0)
    expect(findIndex(users, { user: 'fred', active: false })).toBe(1)
    expect(findIndex(users, 'active')).toBe(2)
  })

  it('findLast matches shorthand', () => {
    const users = [
      { user: 'barney', age: 36, active: true },
      { user: 'fred', age: 40, active: false },
      { user: 'barney', age: 36, active: true }
    ]
    expect(findLast(users, { age: 36 })).toBe(users[2])
  })

  it('findLast property shorthand', () => {
    const users = [
      { user: 'barney', active: false },
      { user: 'fred', active: true },
      { user: 'pebbles', active: true }
    ]
    expect(findLast(users, 'active')).toBe(users[2])
  })

  it('filter property and matches shorthand', () => {
    const users = [
      { user: 'barney', age: 36, active: true },
      { user: 'fred', age: 40, active: false }
    ]
    expect(filter(users, 'active')).toEqual([users[0]])
    expect(filter(users, { age: 36 })).toEqual([users[0]])
  })

  it('forEach plain object key value and early exit', () => {
    const target = { user: 'fred', age: 40, active: false }
    const objs: [string | number, unknown][] = []
    forEach(target, (value, key) => {
      objs.push([key as string, value])
    })
    expect(objs).toEqual(Object.entries(target))

    const early: string[] = []
    forEach(target, (_value, key) => {
      early.push(String(key))
      if (key === 'user') return false
    })
    expect(early).toEqual(['user'])
  })

  it('map arrays objects and property shorthand', () => {
    const users = [
      { user: 'barney', age: 36, active: true },
      { user: 'fred', age: 40, active: false }
    ]
    const square = (x: number) => x * x
    expect(map([4, 8], square)).toEqual([16, 64])
    expect(map({ a: 4, b: 8 }, square)).toEqual([16, 64])
    expect(map(users, 'user')).toEqual(['barney', 'fred'])
  })

  it('flatten nested arrays shallow deep and object', () => {
    expect(flatten([1, 2, [3, 4], 5])).toEqual([1, 2, 3, 4, 5])
    expect(flatten([1, 2, [3, [4]], [5]], true)).toEqual([1, 2, 3, 4, 5])
    expect(
      flatten({
        dates: {
          expiry_date: '30 sep 2018',
          available: '30 sep 2017',
          min_contract_period: [{ id: 1, name: '1 month' }]
        },
        price: { currency: 'RM', value: 1500 }
      })
    ).toEqual({
      'dates.expiry_date': '30 sep 2018',
      'dates.available': '30 sep 2017',
      'dates.min_contract_period[0].id': 1,
      'dates.min_contract_period[0].name': '1 month',
      'price.currency': 'RM',
      'price.value': 1500
    })
  })

  it('POL-18 flatten rejects keys that alias paths', () => {
    expect(() => flatten(JSON.parse('{"profile.role":"admin"}') as object)).toThrow(
      /flatten cannot represent key/
    )
    expect(() => flatten(JSON.parse('{"":{"role":"admin"}}') as object)).toThrow(
      /flatten cannot represent key/
    )
    expect(() => flatten(JSON.parse('{"tags[0]":"admin"}') as object)).toThrow(
      /flatten cannot represent key/
    )
    expect(() => flatten(JSON.parse('{"a":{"b.c":1}}') as object)).toThrow(
      /flatten cannot represent key/
    )
    expect(() => flatten({ 'user.name': 'ada', 'user.role': 'admin' })).toThrow(
      /flatten cannot represent key/
    )
    const nestedFirst = JSON.parse('{"user":{"role":"user"},"user.role":"admin"}') as object
    expect(() => flatten(nestedFirst)).toThrow(/flatten cannot represent key/)
  })

  it('POL-22 flatten key error messages are truncated', () => {
    const huge = `h.\n${'F'.repeat(100_000)}`
    let msg = ''
    try {
      flatten({ [huge]: 1 })
    } catch (e) {
      msg = e instanceof Error ? e.message : String(e)
    }
    expect(msg.startsWith('flatten cannot represent key ')).toBe(true)
    expect(msg.length).toBeLessThan(80)
    expect(msg.includes('\nF')).toBe(false)
  })

  it('pick omit key lists and predicates', () => {
    const target = { user: 'fred', age: 40, active: false }
    expect(pick(target, ['user'])).toEqual({ user: 'fred' })
    expect(pick(target, (x) => typeof x === 'number' && x >= 40)).toEqual({ age: 40 })
    expect(omit(target, ['age', 'active'])).toEqual({ user: 'fred' })
    expect(omit(target, (x) => !x)).toEqual({ user: 'fred', age: 40 })
  })

  it('uniq originals with iteratee and sortedUniq', () => {
    expect(uniq([4, 7, 1, 1, 9, 4, 7])).toEqual([4, 7, 1, 9])
    expect(uniq([4, 7, 1, 1, 9, 4, 7], (x) => x * 2)).toEqual([4, 7, 1, 9])
    expect(sortedUniq([4, 7, 1, 9, 1, 7, 4])).toEqual([1, 4, 7, 9])
  })

  it('count and compact positive cases', () => {
    expect(compact([0, 1, false, 2, '', 3])).toEqual([1, 2, 3])
    expect(compact({ a: 1, b: undefined, c: false, d: [] })).toEqual({ a: 1 })
    const counters = count([0, 1, false, 2, '', 3], (x) => !!x)
    expect(counters.true).toBe(3)
    expect(counters.false).toBe(3)
    expect(count(['one', 'two', 'three'], (x) => x.length)).toEqual({ '3': 2, '5': 1 })
  })

  it('omit never walks inherited proto paths', () => {
    omit({}, ['__proto__.toString'])
    expect(typeof {}.toString).toBe('function')
    omit({ tags: [1] }, ['tags.__proto__.includes'])
    expect(typeof [].includes).toBe('function')
  })

  it('omit fails closed on paths into non-plain objects; top-level instance and off-path refs ok', async () => {
    const { Deque } = await import('../src/collections/deque.js')
    const { FrozenSet } = await import('../src/collections/frozenset.js')
    const { SortedMap } = await import('../src/collections/SortedMap.js')

    class P {
      a = 1
      b = 2
    }
    const p = new P()
    expect(() => omit(p, ['a'])).toThrow(/omit requires a plain object or array/)
    expect(p.a).toBe(1)

    const nested = { x: new P() }
    expect(() => omit(nested, ['x.a'])).toThrow(TypeError)
    expect(nested.x.a).toBe(1)

    const d = new Date(0)
    const m = new Map([['k', 1]])
    const fs = new FrozenSet(['a'])
    const q = new Deque([1, 2])
    const sm = new SortedMap([[1, 'x'] as [number, string]])
    const roles = new Map([['admin', true]])
    Object.defineProperty(roles, Symbol.toStringTag, { value: 'TaggedMap' })

    expect(() => omit({ d }, ['d.x'])).toThrow(/omit cannot descend into a non-plain object/)
    expect(() => omit({ m }, ['m.k'])).toThrow(TypeError)
    expect(() => omit({ fs }, ['fs.x'])).toThrow(TypeError)
    expect(() => omit({ q }, ['q.x'])).toThrow(TypeError)
    expect(() => omit({ sm }, ['sm.x'])).toThrow(TypeError)
    expect(() => omit({ roles }, ['roles.x'])).toThrow(TypeError)

    const kept = omit({ d, m, fs, q, sm, roles, n: 1 }, ['n'])
    expect(kept.d).toBe(d)
    expect(kept.m).toBe(m)
    expect(kept.fs).toBe(fs)
    expect(kept.q).toBe(q)
    expect(kept.sm).toBe(sm)
    expect(kept.roles).toBe(roles)
  })

  it('POL-21 omit refuses only callable or accessor toJSON', () => {
    const dataToJSON = JSON.parse('{"toJSON":"x","password":"p"}') as {
      toJSON: string
      password: string
    }
    expect(omit(dataToJSON, ['password'])).toEqual({ toJSON: 'x' })
    const nested = { u: JSON.parse('{"toJSON":1,"secret":"s"}') as Record<string, unknown> }
    expect(omit(nested, ['u.secret'])).toEqual({ u: { toJSON: 1 } })

    const accessor: { password: string } = { password: 'p' }
    Object.defineProperty(accessor, 'toJSON', {
      get: (): (() => Record<string, never>) => {
        return (): Record<string, never> => ({})
      },
      enumerable: true,
      configurable: true
    })
    expect(() => omit(accessor, ['password'])).toThrow(/omit requires a plain object or array/)
  })

  it('POL-23 omit copies kept values with normal reads', () => {
    const real = { password: 'hunter2', user: 'a' }
    const masked = new Proxy(real, {
      get(target, prop, receiver): unknown {
        if (prop === 'password') return '***'
        const value: unknown = Reflect.get(target, prop, receiver)
        return value
      }
    })
    const out = omit({ s: masked }, ['s.user']) as { s: { password: string } }
    expect(out.s.password).toBe('***')
    expect(JSON.stringify(out)).toContain('***')
    expect(JSON.stringify(out)).not.toContain('hunter2')
  })

  it('POL-16 omit fails closed on Array subclass, own toJSON array, and own toJSON object', () => {
    class RedactedList extends Array<string> {
      toJSON(): string[] {
        return this.map(() => '***')
      }
    }
    const rl = RedactedList.from(['pw1', 'pw2'])
    expect(() => omit({ list: rl }, ['list.9'])).toThrow(TypeError)
    expect(() => omit(rl, ['0'])).toThrow(/omit requires a plain object or array/)

    const arr: string[] & { toJSON(): string[] } = ['visible', 'hidden'] as string[] & {
      toJSON(): string[]
    }
    arr.toJSON = function (this: string[]): string[] {
      return [this[0]]
    }
    expect(() => omit({ list: arr }, ['list.1'])).toThrow(TypeError)
    expect(() => omit(arr, ['1'])).toThrow(/omit requires a plain object or array/)

    const withToJSON = {
      name: 'n',
      secret: 's',
      toJSON(): { name: string } {
        return { name: this.name }
      }
    }
    expect(() => omit({ u: withToJSON }, ['u.other'])).toThrow(TypeError)
    expect(() => omit(withToJSON, ['secret'])).toThrow(/omit requires a plain object or array/)

    const nullProto: Record<string, unknown> = Object.create(null) as Record<string, unknown>
    nullProto.name = 'n'
    nullProto.secret = 's'
    nullProto.toJSON = function (this: Record<string, unknown>): { name: unknown } {
      return { name: this.name }
    }
    expect(() => omit({ u: nullProto }, ['u.other'])).toThrow(TypeError)
    expect(() => omit(nullProto, ['secret'])).toThrow(/omit requires a plain object or array/)
  })

  it('pick never defines on objects reachable from a frozen source', () => {
    const deep = Object.freeze({
      a: Object.freeze({
        b: 1,
        get c() {
          return 2
        }
      })
    })
    expect(() => pick(deep, ['a', 'a.b'])).not.toThrow()
    const picked = pick(deep, ['a', 'a.b'])
    expect(picked).not.toBe(deep)
    expect(picked.a).not.toBe(deep.a)
    expect(picked.a?.b).toBe(1)
    expect(deep.a.b).toBe(1)
  })

  it('F-030 compact keeps class instances and non-plain objects', () => {
    class K {
      x = 1
    }
    expect(compact([new K()])).toHaveLength(1)
    expect(compact([Object.create({ p: 1 })])).toHaveLength(1)
    expect(compact([{}, []])).toEqual([])
  })

  it('SPEC-R40 compact keeps functions, Decimal, IntlDate, private-field instances', async () => {
    const { decimal } = await import('../src/decimal/index.js')
    const { IntlDate } = await import('../src/i18n/date/index.js')
    function authMiddleware() {
      return 'auth'
    }
    class Priv {
      #secret = 1
      value() {
        return this.#secret
      }
    }
    expect(compact([authMiddleware, false])).toEqual([authMiddleware])
    expect(compact([decimal(0)])).toHaveLength(1)
    expect(compact([new IntlDate()])).toHaveLength(1)
    expect(compact([new Priv()])).toHaveLength(1)
    expect(
      compact([false, 0, -0, 0n, '', null, undefined, NaN, [], {}, new Map(), new Set()])
    ).toEqual([])
    expect(compact([new Map([[1, 2]]), new Set([1]), { a: 1 }, [1], 'x', 1n, true])).toEqual([
      new Map([[1, 2]]),
      new Set([1]),
      { a: 1 },
      [1],
      'x',
      1n,
      true
    ])
  })

  it('compact and flattenObj resist __proto__ assignment', () => {
    const c = compact(JSON.parse('{"name":"u","__proto__":{"isAdmin":true}}') as object) as Record<
      string,
      unknown
    >
    expect(c.isAdmin).toBeUndefined()
    expect(Object.getPrototypeOf(c)).toBe(Object.prototype)
    expect(Object.hasOwn(c, 'name')).toBe(true)

    const f = flatten(JSON.parse('{"name":"u","__proto__":{"isAdmin":true}}') as object) as Record<
      string,
      unknown
    >
    expect(f.isAdmin).toBeUndefined()
    expect(Object.getPrototypeOf(f)).toBe(Object.prototype)
  })

  it('remove predicate sees the original array', () => {
    const arr = [1, 2, 3, 4]
    const removed = remove(arr, (_v, i, a) => i > 0 && (a as number[])[i - 1] === 1)
    expect(removed).toEqual([2])
    expect(arr).toEqual([1, 3, 4])
  })

  it('flatten preserves holes as undefined', () => {
    // eslint-disable-next-line no-sparse-arrays
    expect(flatten([1, , [2]])).toEqual([1, undefined, 2])
  })

  it('intersection keeps the first argument iteration order', () => {
    expect([...intersection([1, 2, 3, 4], [4, 3])]).toEqual([3, 4])
  })

  it('map and find iterate Map and Set', () => {
    expect(map(new Set([1, 2]), (x) => Number(x) * 2)).toEqual([2, 4])
    expect(
      map(new Map([['a', 1]]), (entry) => {
        const [k, v] = entry as [string, number]
        return `${k}:${String(v)}`
      })
    ).toEqual(['a:1'])
    expect(find(new Set([1, 2, 3]), (x) => Number(x) > 1)).toBe(2)
  })
})

describe('pick with an empty path', () => {
  it('picks nothing, as Lodash does', () => {
    expect(pick({ a: 1 }, [[]])).toEqual({})
    expect(pick({ a: 1 }, [[], 'a'])).toEqual({ a: 1 })
  })
})

describe('collections edge coverage', () => {
  it('compact insert forEachRight index find groupBy', () => {
    expect(compact(null)).toEqual([])
    expect(compact({ a: 1, b: 0 })).toEqual({ a: 1 })
    expect(insert(null, 0, 1)).toBeNull()
    expect(insert([1, 3], 1, 2)).toEqual([1, 2, 3])
    const seen: number[] = []
    forEachRight([1, 2, 3], (v) => {
      seen.push(v)
      return v !== 2
    })
    expect(seen).toEqual([3, 2])
    const objSeen: string[] = []
    forEachRight({ a: 1, b: 2 }, (_v, k) => {
      objSeen.push(String(k))
    })
    expect(objSeen).toEqual(['b', 'a'])
    const setSeen: unknown[] = []
    forEachRight(new Set([1]), (v) => {
      setSeen.push(v)
      return false
    })
    expect(setSeen).toEqual([1])
    let nullCalls = 0
    forEachRight(null, () => {
      nullCalls++
      throw new Error('no')
    })
    expect(nullCalls).toBe(0)
    expect(findIndex(null, () => true)).toBe(-1)
    expect(findIndex([1, 2, 3], (x) => x === 2, -2)).toBe(1)
    expect(findIndex([], () => true)).toBe(-1)
    expect(findIndex([1], () => false)).toBe(-1)
    expect(indexOf(null, 1)).toBe(-1)
    expect(indexOf([1, 2, 3], 2, -2)).toBe(1)
    expect(indexOf([], 1)).toBe(-1)
    expect(indexOf([1], 9)).toBe(-1)
    expect(findLastIndex(null, () => true)).toBe(-1)
    expect(findLastIndex([1, 2, 3], (x) => x === 2)).toBe(1)
    expect(findLastIndex([], () => true)).toBe(-1)
    expect(findLastIndex([1], () => false)).toBe(-1)
    expect([...intersection()]).toEqual([])
    expect(groupBy({ x: 1, y: 2 }, (v) => v)).toEqual({ 1: [1], 2: [2] })
    expect(groupByMap({ x: '10' }, 'length').get(2)).toEqual(['10'])
    expect(map(new Date(), () => 1)).toEqual([])
    const lenRemoved = remove([1, 2, 3], 'length')
    expect(lenRemoved).toEqual([])
    const shapeArr = [{ a: 1 }, { a: 2 }]
    expect(remove(shapeArr, { a: 1 })).toEqual([{ a: 1 }])
    expect(shapeArr).toEqual([{ a: 2 }])
  })
})

/** An array of `length` with holes everywhere `entries` does not name. */
function sparse(length: number, entries: Record<number, unknown> = {}): unknown[] {
  const arr: unknown[] = []
  arr.length = length
  for (const [index, value] of Object.entries(entries)) arr[Number(index)] = value
  return arr
}

/** Throws past `limit` element reads, so a walk that repeats work fails instead of hanging. */
function readLimited<T>(arr: T[], limit: number): T[] {
  let reads = 0
  const countRead = (key: string | symbol): void => {
    if (typeof key === 'string' && /^\d+$/.test(key) && ++reads > limit) {
      throw new Error(`read more than ${String(limit)} elements`)
    }
  }
  return new Proxy(arr, {
    has(target, key) {
      countRead(key)
      return Reflect.has(target, key)
    },
    get(target, key): unknown {
      countRead(key)
      return Reflect.get(target, key)
    }
  })
}

const argumentsOf = vm.runInNewContext('(function () { return arguments })') as (
  ...values: unknown[]
) => unknown

class Point {
  x = 1
  y = 0
}

describe('iteratee shorthands', () => {
  const users = [
    { u: 'a', active: true },
    { u: 'b', active: false }
  ]

  it('a missing or null iteratee is identity', () => {
    expect(map([1, 2])).toEqual([1, 2])
    expect(map([1, 2], null)).toEqual([1, 2])
    expect(find([0, 1])).toBe(1)
    expect(findLast([1, 0])).toBe(1)
    expect(findIndex([0, 1])).toBe(1)
    expect(findLastIndex([1, 0])).toBe(0)
    expect(reject([0, 1])).toEqual([0])
    expect(remove([0, 1])).toEqual([1])
    expect(filter([0, 1], null)).toEqual([1])
    expect(uniq([1, 1], null)).toEqual([1])
    expect(() => {
      forEach([1])
    }).not.toThrow()
  })

  it('[path, value] is matchesProperty', () => {
    expect(filter(users, ['active', false])).toEqual([users[1]])
    expect(find(users, ['u', 'b'])).toBe(users[1])
    expect(map(users, ['u', 'b'])).toEqual([false, true])
    expect(filter([{ a: { b: 1, c: 2 } }], ['a', { b: 1 }])).toHaveLength(1)
    expect(filter([{ a: undefined }, {}], ['a', undefined])).toEqual([{ a: undefined }])
  })

  it('any non-function object is a matches shape', () => {
    const when = new Date(0)
    expect(filter([when, new Date(1)], new Date(0))).toEqual([when])
    expect(filter([new Map([[1, 2]]), new Map()], new Map())).toHaveLength(1)
  })

  it('count and groupBy take the same shorthands', () => {
    expect(count([1, 1])).toEqual({ 1: 2 })
    expect(count([{ a: 1 }], 'a')).toEqual({ 1: 1 })
    expect(count([{ a: 1 }], { a: 1 })).toEqual({ true: 1 })
    expect(groupBy([1, 2])).toEqual({ 1: [1], 2: [2] })
    expect(groupBy([{ a: 1 }], { a: 1 })).toEqual({ true: [{ a: 1 }] })
    expect(groupBy([{ a: 1 }], ['a', 2])).toEqual({ false: [{ a: 1 }] })
    expect(groupByMap([{ a: 1 }], { a: 1 }).get(true)).toEqual([{ a: 1 }])
    expect(groupByMap([1]).get(1)).toEqual([1])
  })

  it('a key too deep to stringify throws the nesting error', () => {
    const deep: unknown = JSON.parse('['.repeat(1e5) + ']'.repeat(1e5))
    const nesting = new RangeError('nesting deeper than 1000 levels')
    expect(() => count([deep], (x) => x)).toThrow(nesting)
    expect(() => groupBy([deep], (x) => x as string)).toThrow(nesting)
  })
})

describe('find and findLast fromIndex', () => {
  it('starts at fromIndex and counts a negative one from the end', () => {
    expect(find([1, 2, 3], () => true, 1)).toBe(2)
    expect(find([1, 2, 3], () => true, -1)).toBe(3)
    expect(find([1, 2, 3], () => true, 9)).toBeUndefined()
    expect(find({ a: 1, b: 2 }, () => true, 1)).toBe(2)
    expect(find(new Set([1, 2, 3]), () => true, 1)).toBe(2)
    expect(find(new Set([1, 2, 3]), () => true, -1)).toBe(3)
    expect(findLast([1, 2, 3], () => true, 1)).toBe(2)
    expect(findLast([1, 2, 3], () => true, -2)).toBe(2)
    expect(findLast({ a: 1, b: 2 }, () => true, 0)).toBe(1)
    expect(findLast(new Set([1, 2, 3]), () => true, 1)).toBe(2)
  })

  it('stops an endless iterable at the first hit', () => {
    function* naturals(): Generator<number> {
      for (let n = 0; ; n++) yield n
    }
    expect(find(naturals(), (n) => Number(n) > 2)).toBe(3)
    expect(find(naturals(), () => true, 5)).toBe(5)
  })
})

describe('search start', () => {
  const n = 5000
  const forward: [string, (list: number[], from: number) => number][] = [
    ['indexOf', (list, from) => indexOf(list, 7, from)],
    ['findIndex', (list, from) => findIndex(list, (x) => x === 7, from)]
  ]
  const backward: [string, (list: number[], from?: number) => number][] = [
    ['lastIndexOf', (list, from) => lastIndexOf(list, 7, from)],
    ['findLastIndex', (list, from) => findLastIndex(list, (x) => x === 7, from)]
  ]

  it.each(forward)('a %s find-all loop reads each element once', (_name, search) => {
    const list = readLimited(new Array<number>(n).fill(7), 2 * n)
    let hits = 0
    for (let i = search(list, 0); i !== -1; i = search(list, i + 1)) hits++
    expect(hits).toBe(n)
  })

  it.each(backward)('a %s find-all loop reads each element once', (_name, search) => {
    const list = readLimited(new Array<number>(n).fill(7), 2 * n)
    let hits = 0
    for (let i = search(list); i !== -1; i = i === 0 ? -1 : search(list, i - 1)) hits++
    expect(hits).toBe(n)
  })

  it.each(backward)('%s reads only the last element when it hits', (_name, search) => {
    expect(search(readLimited(new Array<number>(n).fill(7), 2))).toBe(n - 1)
  })

  it('a dense array above the huge sparse threshold still scans from start', () => {
    const big = new Array<number>(2 ** 24 + 1).fill(7)
    expect(indexOf(readLimited(big, 3), 7, 2 ** 24)).toBe(2 ** 24)
    expect(lastIndexOf(readLimited(big, 3), 7)).toBe(2 ** 24)
  })

  it('a negative start counts from the end on both sides', () => {
    expect(lastIndexOf([1, 2, 3], 3, -1)).toBe(2)
    expect(lastIndexOf([1, 2, 3], 2, -2)).toBe(1)
    expect(lastIndexOf([1, 2, 3], 3, -2)).toBe(-1)
    expect(lastIndexOf([1, 2, 3], 1, -9)).toBe(0)
    expect(findLastIndex([1, 2, 3], () => true, -1)).toBe(2)
    expect(findLastIndex([1, 2, 3], () => true, -9)).toBe(0)
    expect(indexOf([1, 2, 3], 1, '-1' as never)).toBe(-1)
  })

  it('start follows ToIntegerOrInfinity', () => {
    expect(indexOf([1, 2, 3], 2, 1.5)).toBe(1)
    expect(findIndex([1, 2, 3], () => true, 1.5)).toBe(1)
    expect(findIndex(sparse(3), () => true, 1.5)).toBe(1)
    expect(findLastIndex(sparse(3), () => true, 1.5)).toBe(1)
    expect(lastIndexOf([1, 2, 1], 1, NaN)).toBe(0)
    expect(lastIndexOf([1, 2, 1], 1, null as never)).toBe(0)
    expect(findLastIndex([1, 2, 1], (x) => x === 1, NaN)).toBe(0)
    expect(indexOf([1, 2], 1, -Infinity)).toBe(0)
    expect(indexOf([1, 2], 1, Infinity)).toBe(-1)
  })

  it('the predicate sees every index of a hole run', () => {
    expect(findIndex(sparse(4, { 3: 4 }), (_v, i) => i === 2)).toBe(2)
    expect(findLastIndex(sparse(4, { 3: 4 }), (_v, i) => i === 1)).toBe(1)
    const seen: unknown[] = []
    find(sparse(3), (_v, i) => {
      seen.push(i)
    })
    expect(seen).toEqual([0, 1, 2])
  })

  it('array-likes work and other non-iterables give -1', () => {
    const letters = { 0: 'a', 1: 'b', 2: 'a', length: 3 } as never
    expect(findIndex(letters, (x) => x === 'b')).toBe(1)
    expect(indexOf(letters, 'b')).toBe(1)
    expect(lastIndexOf(letters, 'a')).toBe(2)
    expect(findLastIndex(letters, (x) => x === 'a')).toBe(2)
    for (const value of [{}, 5, true, new Date(0), new Point()] as never[]) {
      expect(indexOf(value, 1)).toBe(-1)
      expect(lastIndexOf(value, 1)).toBe(-1)
      expect(findIndex(value, () => true)).toBe(-1)
      expect(findLastIndex(value, () => true)).toBe(-1)
    }
  })

  it('an array-like needs own keys to back its length', () => {
    const parsed = (json: string): never => readLimited(JSON.parse(json) as unknown[], 10) as never
    expect(indexOf(parsed('{"5":"x","length":6}'), 'x')).toBe(5)
    expect(indexOf(parsed('{"4294967294":"x","length":4294967295}'), 'x')).toBe(-1)
    expect(uniq(parsed('{"length":16777216}'))).toEqual([])
    expect(without(parsed('{"length":16777216}'), 1)).toEqual([])
    expect([...union(parsed('{"length":16777216}'))]).toEqual([])
    expect(compact(parsed('{"length":16777216}'))).toEqual({ length: 16777216 })
  })

  it('an object whose length no keys back stays an object', () => {
    class Plank {
      length = 5000
      width = 0
    }
    const plank = new Plank()
    expect(compact(plank)).toEqual({ length: 5000 })
    expect(flatten(plank)).toBe(plank)
  })
})

describe('hole rules', () => {
  const holey = (): unknown[] => sparse(3, { 0: 1, 2: 3 })

  it('a helper named after a native method follows it', () => {
    const visited = (run: (visit: (value: unknown, index?: PropertyKey) => void) => void) => {
      const indices: unknown[] = []
      run((_value, index) => {
        indices.push(index)
      })
      return indices
    }
    expect(visited((visit) => find(holey(), visit))).toEqual([0, 1, 2])
    expect(visited((visit) => findLast(holey(), visit))).toEqual([2, 1, 0])
    expect(visited((visit) => findIndex(holey(), visit))).toEqual([0, 1, 2])
    expect(visited((visit) => findLastIndex(holey(), visit))).toEqual([2, 1, 0])
    expect(
      visited((visit) => {
        forEach(holey(), visit)
      })
    ).toEqual([0, 2])
    expect(visited((visit) => filter(holey(), visit))).toEqual([0, 2])
    expect(indexOf(holey(), undefined)).toBe(-1)
    expect(lastIndexOf(holey(), undefined)).toBe(-1)
    expect(1 in map(holey(), (x) => x)).toBe(false)
  })

  it('reject, forEachRight and count follow filter and forEach', () => {
    expect(reject(holey(), (x) => x === 1)).toEqual([3])
    const seen: unknown[] = []
    forEachRight(holey(), (_v, i) => {
      seen.push(i)
    })
    expect(seen).toEqual([2, 0])
    expect(count(holey(), (x) => x)).toEqual({ 1: 1, 3: 1 })
  })

  it('set-style helpers read a hole as undefined, as new Set does', () => {
    expect(uniq(holey())).toHaveLength(3)
    expect(sortedUniq(holey())).toHaveLength(3)
    expect(without(holey(), 3)).toHaveLength(2)
    expect(without(holey(), undefined)).toEqual([1, 3])
    expect([...union(holey())]).toHaveLength(3)
    expect([...difference(holey(), [1])]).toHaveLength(2)
    expect([...intersection(holey(), [undefined])]).toHaveLength(1)
    expect([...symmetricDifference(holey(), [1])]).toHaveLength(2)
  })

  it('a huge sparse array keeps own-element walks', () => {
    const huge = (): unknown[] =>
      readLimited(sparse(2 ** 32 - 1, { 0: 'x', 4000000000: 'y' }), 2000)
    expect(filter(huge(), () => true)).toEqual(['x', 'y'])
    expect(uniq(huge())).toEqual(['x', 'y'])
    expect(without(huge(), 'x')).toEqual(['y'])
    expect([...union(huge())]).toEqual(['x', 'y'])
    expect(indexOf(huge(), undefined)).toBe(-1)
    expect(lastIndexOf(huge(), undefined)).toBe(-1)
    expect(findIndex(huge(), (x) => x === undefined)).toBe(1)
    expect(findLastIndex(huge(), (x) => x === undefined)).toBe(2 ** 32 - 2)
    expect(findIndex(huge(), (x) => x === 'y', 5)).toBe(4000000000)
    expect(findLastIndex(huge(), (x) => x === 'x', 5)).toBe(0)
  })
})

describe('remove', () => {
  it('keeps hole offsets and returns matched holes, as Lodash', () => {
    const untouched = sparse(3, { 0: 1, 2: 3 })
    expect(remove(untouched, () => false)).toEqual([])
    expect(untouched).toHaveLength(3)
    expect(1 in untouched).toBe(false)
    expect(untouched[2]).toBe(3)

    const shifted = sparse(3, { 0: 1, 2: 3 })
    expect(remove(shifted, (x) => x === 1)).toEqual([1])
    expect(shifted).toHaveLength(2)
    expect(0 in shifted).toBe(false)
    expect(shifted[1]).toBe(3)

    const matched = sparse(3, { 0: 1, 2: 3 })
    const removed = remove(matched, (x) => x === undefined)
    expect(removed).toHaveLength(1)
    expect(removed[0]).toBeUndefined()
    expect(matched).toEqual([1, 3])

    const byIndex = sparse(5, { 2: 1 })
    expect(remove(byIndex, (_v, i) => i === 1)).toEqual([undefined])
    expect(byIndex).toHaveLength(4)
    expect(byIndex[1]).toBe(1)
  })

  it('shifts own elements of a huge sparse array in own-element time', () => {
    const huge = sparse(2 ** 32 - 1, { 0: 'x', 4000000000: 'y' })
    expect(remove(readLimited(huge, 2000), (x) => x === 'x')).toEqual(['x'])
    expect(huge).toHaveLength(2 ** 32 - 2)
    expect(huge[3999999999]).toBe('y')
  })

  it('refuses anything else that is not an array', () => {
    expect(() => remove({ length: 0 } as never, () => true)).toThrow(
      new TypeError('remove expects an array')
    )
  })
})

describe('reject', () => {
  it('passes the real key or index, as filter does', () => {
    expect(reject({ a: 1, b: 2 }, (_v, k) => k === 'a')).toEqual([2])
    expect(reject(sparse(4, { 0: 1, 2: 3, 3: 4 }), (_v, i) => i === 2)).toEqual([1, 4])
  })
})

describe('list input', () => {
  const letters = { 0: 'a', 1: 'b', 2: 'a', length: 3 } as never

  it('nullish input is empty', () => {
    expect(uniq(null)).toEqual([])
    expect(uniq(undefined)).toEqual([])
    expect(sortedUniq(undefined)).toEqual([])
    expect(without(null, 1)).toEqual([])
    expect(remove(null, () => true)).toEqual([])
    expect([...intersection(null, [1])]).toEqual([])
    expect([...intersection([1], undefined)]).toEqual([])
    expect([...symmetricDifference(null, [1])]).toEqual([1])
    expect([...union(null, [1])]).toEqual([1])
    expect([...difference(null, [1])]).toEqual([])
  })

  it('the set helpers accept array-likes and ignore other non-iterables', () => {
    expect(uniq(letters)).toEqual(['a', 'b'])
    expect(sortedUniq(letters)).toEqual(['a', 'b'])
    expect(without(letters, 'a')).toEqual(['b'])
    expect([...union(letters, ['c'])]).toEqual(['a', 'b', 'c'])
    expect([...difference(letters, ['a'])]).toEqual(['b'])
    expect([...intersection(letters, ['b'])]).toEqual(['b'])
    expect([...symmetricDifference(letters, ['a', 'c'])]).toEqual(['b', 'c'])
    expect(uniq(5 as never)).toEqual([])
    expect(without({} as never, 1)).toEqual([])
    expect([...union([1], 5 as never, { a: 1 } as never)]).toEqual([1])
    expect([...difference([1, 2], new Point() as never)]).toEqual([1, 2])
  })
})

describe('set helpers', () => {
  /** Elements the native Set methods copied, the work an accumulating fold repeats per input. */
  function setCopyWork(run: () => void): number {
    const spies = [vi.spyOn(Set.prototype, 'union'), vi.spyOn(Set.prototype, 'difference')]
    run()
    const receivers = spies.flatMap((spy) => spy.mock.contexts as Set<unknown>[])
    const copied = receivers.reduce((sum, set) => sum + set.size, 0)
    for (const spy of spies) spy.mockRestore()
    return copied
  }

  it('union and difference do not copy the result per input', () => {
    const inputs = Array.from({ length: 2000 }, (_, i) => [i])
    expect(
      setCopyWork(() => {
        expect([...union(...inputs)]).toHaveLength(2000)
      })
    ).toBeLessThan(2000)
    expect(
      setCopyWork(() => {
        expect([...difference(inputs.flat(), ...inputs)]).toHaveLength(0)
      })
    ).toBeLessThan(2000)
  })

  it('intersection normalizes -0 and reads its first input at the call', () => {
    expect(Object.is([...intersection([-0], [0])][0], 0)).toBe(true)
    const first = [1]
    const result = intersection(first, [1, 2])
    first.push(2)
    expect([...result]).toEqual([1])
  })

  it('symmetricDifference keeps what exactly one input holds, across any number of inputs', () => {
    expect([...symmetricDifference([1], [2], [3])]).toEqual([1, 2, 3])
    expect([...symmetricDifference([1, 2], [2, 3], [3, 4])]).toEqual([1, 4])
    expect([...symmetricDifference([1], [1], [1])]).toEqual([])
    expect([...symmetricDifference([1, 1], [2])]).toEqual([1, 2])
    expect([...symmetricDifference()]).toEqual([])
  })
})

describe('flatten input', () => {
  it('nullish gives [], and array-likes and strings spread', () => {
    expect(flatten(null)).toEqual([])
    expect(flatten(undefined)).toEqual([])
    expect(flatten('ab')).toEqual(['a', 'b'])
    expect(flatten(new Uint8Array([1, 2]))).toEqual([1, 2])
    expect(flatten(argumentsOf(1, [2]) as never)).toEqual([1, 2])
  })

  it('a non-plain root returns unchanged', () => {
    for (const root of [new Point(), new Date(0), new Map(), new Set([1]), 5] as never[]) {
      expect(flatten(root)).toBe(root)
    }
  })

  it('a plain object stays an object even with a length key', () => {
    expect(flatten({ length: 2, a: { b: 1 } })).toEqual({ length: 2, 'a.b': 1 })
  })

  it('a fractional depth truncates', () => {
    expect(flatten([[[1]]], 1.5)).toEqual([[1]])
    expect(flatten([[1]], 0.5)).toEqual([[1]])
  })
})

describe('flatten cycles and budgets', () => {
  const cyclic = new ValueError('cyclic structure')

  it('a cyclic array throws at any depth', () => {
    const twice: unknown[] = []
    twice.push(twice, twice)
    expect(() => flatten(twice, 10)).toThrow(cyclic)
    expect(() => flatten(twice, true)).toThrow(cyclic)
    const inner: unknown[] = []
    const outer = [inner]
    inner.push(outer)
    expect(() => flatten(outer, 5)).toThrow(cyclic)
  })

  it('a depth that stops short of the cycle never meets it', () => {
    const inner: unknown[] = []
    const outer = [inner]
    inner.push(outer)
    expect(flatten(outer, 1)).toEqual([outer])
  })

  it('the same array twice is not a cycle', () => {
    const shared = [1]
    expect(flatten([shared, [shared]], true)).toEqual([1, 1])
  })

  it('linear input passes however often it repeats a container', () => {
    const rows = Array.from({ length: 300_000 }, () => [1])
    expect(flatten([rows, rows])).toHaveLength(600_000)
    expect(flatten(new Array<number[]>(300_000).fill([]))).toEqual([])
    expect(flatten(new Array<number[]>(300_000).fill([0]))).toHaveLength(300_000)
  })

  it('a wide row shared many times trips the budget', { timeout: 60_000 }, () => {
    const repeated = new RangeError('input repeats shared objects beyond 250000 containers')
    const row = Array.from({ length: 20_000 }, (_, i) => i)
    const wide = Object.fromEntries(row.map((i) => [`k${String(i)}`, i]))
    expect(() => flatten(new Array<number[]>(2000).fill(row))).toThrow(repeated)
    expect(() => flatten({ rows: new Array<object>(2000).fill(wide) })).toThrow(repeated)
  })

  /** One long prefix over `count` children, every output key the same length. */
  function longPrefixed(prefixLength: number, count: number): object {
    const children = Array.from({ length: count }, (_, i): [string, number] => [
      `c${String(10_000 + i)}`,
      1
    ])
    return { ['k'.repeat(prefixLength)]: Object.fromEntries(children) }
  }

  it('output key characters are capped', () => {
    const capped = new RangeError('flatten output keys exceed 134217728 characters')
    expect(() => flatten(longPrefixed(16_000, 8400))).toThrow(capped)
    expect(Object.keys(flatten(longPrefixed(16_000, 8300)))).toHaveLength(8300)
  })

  it('keys too long for V8 to hash cost 16 times their length', () => {
    let reads = 0
    const row: Record<string, number> = {}
    for (let i = 0; i < 600; i++) {
      Object.defineProperty(row, `c${String(10_000 + i)}`, {
        enumerable: true,
        get() {
          reads++
          return 1
        }
      })
    }
    expect(() => flatten({ ['k'.repeat(16_400)]: row })).toThrow(
      new RangeError('flatten output keys exceed 134217728 characters')
    )
    expect(reads).toBeLessThan(600)
  })
})

describe('compact', () => {
  it('nullish gives [] and array-likes give arrays', () => {
    expect(compact(undefined)).toEqual([])
    expect(compact('a')).toEqual(['a'])
    expect(compact(new Uint8Array([0, 1]))).toEqual([1])
    expect(compact(argumentsOf(0, 1))).toEqual([1])
    expect(compact(new Set([0, 1]))).toEqual([1])
    expect(compact(5)).toEqual([])
  })

  it('other objects compact their own enumerable values into a plain object', () => {
    expect(compact({ a: 0, b: 1 })).toEqual({ b: 1 })
    expect(compact({ length: 0, a: 1 })).toEqual({ a: 1 })
    expect(compact(new Point())).toEqual({ x: 1 })
    expect(compact(new Point())).not.toBeInstanceOf(Point)
  })
})

describe('object-like collections', () => {
  class Tagged {
    readonly [Symbol.toStringTag] = 'Tagged'
    a = 1
  }
  const withOwnKey: [string, () => object][] = [
    ['function', () => Object.assign(() => undefined, { a: 1 })],
    ['Error', () => Object.assign(new Error('x'), { a: 1 })],
    ['tagged class', () => new Tagged()]
  ]

  it.each(withOwnKey)('every helper visits the own keys of a %s', (_name, make) => {
    const value = make()
    expect(filter(value, () => true)).toEqual([1])
    expect(map(value, (x) => x)).toEqual([1])
    expect(find(value, () => true)).toBe(1)
    expect(findLast(value, () => true)).toBe(1)
    const keys: unknown[] = []
    forEachRight(value, (_v, k) => {
      keys.push(k)
    })
    expect(keys).toEqual(['a'])
  })
})

describe('defaults input', () => {
  it('skips nullish sources', () => {
    expect(defaults({ a: 1 }, undefined)).toEqual({ a: 1 })
    expect(defaults({ a: 1 }, null, { b: 2 })).toEqual({ a: 1, b: 2 })
  })

  it('a target that is no object throws the named error', () => {
    const named = new TypeError('defaults target must be an object')
    expect(() => defaults(null as never, { a: 1 })).toThrow(named)
    expect(() => defaults(undefined as never, { a: 1 })).toThrow(named)
    expect(() => defaults(5 as never, { a: 1 })).toThrow(named)
  })
})

describe('defineData', () => {
  const dataDescriptor = { value: 1, enumerable: true, writable: true, configurable: true }

  it('defines a data property whatever the target has at that key', () => {
    let writes = 0
    const accessor = {
      set x(_v: number) {
        writes++
      }
    }
    defineData(accessor, 'x', 1)
    expect(writes).toBe(0)
    expect(Object.getOwnPropertyDescriptor(accessor, 'x')).toEqual(dataDescriptor)

    const hidden = Object.defineProperty({}, 'x', { value: 0, writable: true, configurable: true })
    defineData(hidden, 'x', 1)
    expect(Object.getOwnPropertyDescriptor(hidden, 'x')).toEqual(dataDescriptor)

    const child = Object.create(Object.freeze({ x: 0 })) as object
    defineData(child, 'x', 1)
    expect(Object.getOwnPropertyDescriptor(child, 'x')).toEqual(dataDescriptor)
  })
})

describe('isPlainObject', () => {
  it('needs an object tag', () => {
    expect(isPlainObject(Math)).toBe(false)
    expect(isPlainObject(JSON)).toBe(false)
    expect(isPlainObject(Reflect)).toBe(false)
    expect(isPlainObject(argumentsOf(1))).toBe(false)
  })

  it('accepts a plain object from another realm, and nothing that only looks like one', () => {
    expect(isPlainObject(vm.runInNewContext('({ a: 1 })'))).toBe(true)
    expect(isPlainObject(vm.runInNewContext('Object.create(null)'))).toBe(true)
    expect(isPlainObject(vm.runInNewContext('new (class A {})()'))).toBe(false)
    expect(isPlainObject(Object.create(Object.create(null) as object))).toBe(false)
    expect(isPlainObject(Object.create({ constructor: Object }) as object)).toBe(false)
  })
})

describe('values from another realm', () => {
  const foreign = (): { a: { b: number }; r: unknown[] } =>
    vm.runInNewContext('({ a: { b: 1 }, r: [1, { c: 2 }] })') as { a: { b: number }; r: unknown[] }

  it('are plain to omit, flatten and merge', () => {
    const value = foreign()
    expect(Object.keys(omit(value, ['a']))).toEqual(['r'])
    expect(Object.keys(omit({ r: value.r }, ['r.0']).r as object)).toEqual(['1'])
    expect(flatten(value)).toEqual({ 'a.b': 1, 'r[0]': 1, 'r[1].c': 2 })
    const merged = merge({}, { x: value }) as { x: unknown }
    expect(merged.x).not.toBe(value)
  })
})

describe('pick and omit paths', () => {
  const s = Symbol('s')
  const other = Symbol('other')
  const named = new TypeError('path segments must be strings, numbers or symbols')

  it('take one path', () => {
    expect(pick({ name: 'x', n: 1, a: 2 }, 'name')).toEqual({ name: 'x' })
    expect(omit({ name: 'x', n: 1 }, 'name')).toEqual({ n: 1 })
    expect(pick({ a: { b: 1, c: 2 } }, 'a.b')).toEqual({ a: { b: 1 } })
    expect(pick({ 0: 'a', 1: 'b' }, 1)).toEqual({ 1: 'b' })
    expect(pick({ [s]: 1, a: 2 }, s)).toEqual({ [s]: 1 })
  })

  it('take numbers and symbols in a list', () => {
    expect(pick({ 0: 'a', 1: 'b' }, [0])).toEqual({ 0: 'a' })
    expect(pick({ a: [1] }, [['a', 0]])).toEqual({ a: [1] })
    expect(omit({ 0: 'a', b: 1 }, [0])).toEqual({ b: 1 })
    expect(1 in omit(['x', 'y'], [1])).toBe(false)
    expect(pick({ [s]: 1, [other]: 2 }, [s, other])).toEqual({ [s]: 1, [other]: 2 })
    expect(omit({ [s]: 1, b: 2 }, [s])).toEqual({ b: 2 })
  })

  it('take a Set of paths', () => {
    expect(pick({ a: 1, b: 2 }, new Set(['a']))).toEqual({ a: 1 })
    expect(omit({ a: 1, b: 2 }, new Set(['a']))).toEqual({ b: 2 })
  })

  it('name the error for anything else', () => {
    for (const paths of [undefined, null, {}, true] as never[]) {
      expect(() => pick({ a: 1 }, paths)).toThrow(named)
      expect(() => omit({ a: 1 }, paths)).toThrow(named)
    }
    for (const path of [null, {}, true] as never[]) {
      expect(() => pick({ a: 1 }, [path])).toThrow(named)
      expect(() => omit({ a: 1 }, [path])).toThrow(named)
    }
  })

  it('pick is own-only', () => {
    class User {
      first = 'a'
      get full(): string {
        return this.first
      }
    }
    expect(pick(new User(), ['full', 'first'])).toEqual({ first: 'a' })
  })

  it('a function value counts as a picked ancestor', () => {
    const f = Object.assign(() => undefined, { x: 1 })
    expect(pick({ f }, ['f', 'f.x']).f).toBe(f)
  })

  it('pick builds an object when the next segment is not an index', () => {
    expect(pick({ a: [1, 2] }, ['a.length'])).toEqual({ a: { length: 2 } })
    expect(Array.isArray(pick({ a: [1, 2] }, ['a.1']).a)).toBe(true)
  })
})
