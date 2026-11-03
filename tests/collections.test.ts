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

  it('defaults never assigns __proto__ as a prototype', () => {
    const opts = defaults(
      { name: undefined },
      JSON.parse('{"__proto__":{"isAdmin":true,"role":"root"},"name":"eve"}') as object
    ) as { name?: string; isAdmin?: boolean; role?: string; __proto__?: unknown }
    expect(Object.getPrototypeOf(opts)).toBe(Object.prototype)
    expect(Object.getOwnPropertyDescriptor(Object.prototype, 'isAdmin')).toBeUndefined()
    expect(Object.hasOwn(opts, '__proto__')).toBe(true)
    expect(opts.name).toBe('eve')

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
    const withDate = omit({ d }, ['d.x']) as { d: Date }
    expect(withDate.d).toBe(d)

    const m = new Map([['k', 1]])
    expect((omit({ m }, ['m.k']) as { m: Map<string, number> }).m).toBe(m)

    class Box {
      x = 1
      y = 2
    }
    const box = new Box()
    const throughBox = omit({ box, z: 3 }, ['box.x']) as { box: Box; z: number }
    expect(throughBox.box).toBe(box)
    expect(box.x).toBe(1)
    expect(throughBox.z).toBe(3)

    const ta = new Uint8Array([1, 2, 3])
    expect((omit({ ta }, ['ta.0']) as { ta: Uint8Array }).ta).toBe(ta)

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
    expect(omit(new Inst(), ['d'])).toEqual({ a: 1 })

    const n = 4000
    const big: Record<string, number> = {}
    const paths: string[] = []
    for (let i = 0; i < n; i++) {
      const key = `k${String(i)}`
      big[key] = i
      paths.push(key)
    }
    const t0 = performance.now()
    const omitted = omit(big, paths)
    expect(performance.now() - t0).toBeLessThan(50)
    expect(Object.keys(omitted)).toHaveLength(0)
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

  it('omit does not mutate class instances or nested non-plain values', () => {
    class P {
      a = 1
      b = 2
    }
    const p = new P()
    const out = omit(p, ['a'])
    expect(p.a).toBe(1)
    expect(out).toEqual({ b: 2 })
    expect(out).not.toBe(p)
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype)

    const nested = { x: new P() }
    const out2 = omit(nested, ['x.a']) as { x: P }
    expect(nested.x.a).toBe(1)
    expect(out2.x).toBe(nested.x)
    expect(out2.x.a).toBe(1)
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
