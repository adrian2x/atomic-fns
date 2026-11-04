import { describe, it, expect, vi } from 'vitest'
import {
  compact,
  count,
  defaults,
  difference,
  filter,
  find,
  findIndex,
  findLast,
  flatten,
  forEach,
  groupBy,
  groupByMap,
  indexOf,
  intersection,
  lastIndexOf,
  map,
  matches,
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
import { expectFast } from './helpers/perf.js'

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
    }, 250)
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

  it('SPEC-R42 matches deep partial; null shape', () => {
    expect(filter([{ a: { b: 1, c: 2 } }], { a: { b: 1 } })).toHaveLength(1)
    expect(matches({ a: 1 })({ a: 2 })).toBe(false)
    expect(matches(null)({ a: 1 })).toBe(false)
  })

  it('matches: Date/Map/Set/RegExp by deepEqual; undefined keys; array subset; empty shape', () => {
    expect(matches({ d: new Date(0) })({ d: new Date(0) })).toBe(true)
    expect(matches({ m: new Map([[1, 1]]) })({ m: new Map([[1, 1]]) })).toBe(true)
    expect(matches({ s: new Set([1]) })({ s: new Set([1]) })).toBe(true)
    expect(matches({ r: /a/g })({ r: /a/g })).toBe(true)
    expect(filter([{ d: new Date(0) }], { d: new Date(0) })).toHaveLength(1)

    expect(matches({ a: undefined })({})).toBe(false)
    expect(matches({ a: undefined })({ a: undefined })).toBe(true)

    expect(matches({ tags: ['b'] })({ tags: ['a', 'b'] })).toBe(true)
    expect(matches({})(1)).toBe(true)
    expect(matches([])('x')).toBe(true)
  })

  it('nested empty shapes require the same kind', () => {
    expect(find([{ email: 'a', token: 't' }], { email: 'a', token: {} })).toBeUndefined()
    expect(find([{ email: 'a', token: { x: 1 } }], { email: 'a', token: {} })).toEqual({
      email: 'a',
      token: { x: 1 }
    })
    expect(find([{ email: 'a', token: [] }], { email: 'a', token: [] })).toEqual({
      email: 'a',
      token: []
    })
    expect(filter([{ email: 'a', token: 't' }], { token: [] })).toEqual([])
    expect(matches({ a: {} })({})).toBe(false)
    expect(matches({ a: {} })({ a: 'str' })).toBe(false)
    expect(matches({ a: {} })({ a: null })).toBe(false)
    expect(matches({ a: {} })({ a: [] })).toBe(false)
    expect(matches({ a: {} })({ a: { b: 1 } })).toBe(true)
    expect(matches({ a: [] })({ a: 'str' })).toBe(false)
    expect(matches({ a: [] })({ a: [1] })).toBe(true)
  })

  it('R15-E2: matches probe cases finish within budget', { timeout: 2000 }, () => {
    const cases: [unknown, unknown, number][] = [
      [[[0]], [[1]], 1600],
      [[[0]], [[1]], 800],
      [[{}], [1], 1400],
      [[[]], [{}], 1400],
      [['x'], ['y'], 1500],
      [{ a: [0] }, { a: [1] }, 1000]
    ]
    for (const [se, te, n] of cases) {
      const s = Array.from({ length: n }, () => structuredClone(se))
      const t = Array.from({ length: n }, () => structuredClone(te))
      t[n - 1] = structuredClone(se)
      expectFast(() => {
        expect(matches({ a: s })({ a: t })).toBe(true)
      }, 50)
    }
  })

  it('indexOf rejects length-driven array-likes before allocating', () => {
    const evil = JSON.parse('{"length":1e15}') as never
    expectFast(() => {
      expect(() => indexOf(evil, 'x')).toThrow(TypeError)
    }, 250)
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

  it('pick copies each intermediate once (20k array paths within budget)', () => {
    // Pre-fix: quadratic path copies. Revert of a9ccefa fails this.
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
    }, 250)
  })

  it('pick skips child paths under an already-picked ancestor', () => {
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
    }, 250)
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
    }, 250)
  })

  it('POL-17 pick ancestor check is linear in total segments', () => {
    // Pre-fix: quadratic ancestor scan. Revert of e63cdbd / 9411191 fails this.
    expectFast(() => {
      expect(pick({}, ['.'.repeat(10_000)])).toEqual({})
    }, 250)
    expectFast(() => {
      expect(pick({}, ['a.'.repeat(5000)])).toEqual({})
    }, 250)
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
    }, 250)
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
