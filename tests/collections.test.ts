import { describe, it, expect, vi } from 'vitest'
import {
  compact,
  count,
  difference,
  filter,
  findLast,
  flatten,
  forEach,
  groupBy,
  groupByMap,
  intersection,
  lastIndexOf,
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
  })

  it('SPEC-R36 lastIndexOf default start', () => {
    expect(lastIndexOf([1, 2, 1, 2], 2)).toBe(3)
    expect(lastIndexOf([1, 2, 1, 2], 2, 2)).toBe(1)
  })

  it('SPEC-R38 count groupBy groupByMap edge keys', () => {
    expect(count(['a.b', 'a.b'], (x) => x)['a.b']).toBe(2)
    expect(count(['toString'], (x) => x).toString).toBe(1)

    const g = groupBy(['__proto__', 'constructor'], (x: string) => x)
    expect(Object.hasOwn(g, '__proto__')).toBe(true)
    expect(Object.hasOwn(g, 'constructor')).toBe(true)
    expect(g['__proto__']).toHaveLength(1)
    expect(g.constructor).toHaveLength(1)

    const gm = groupByMap(['10', '10'], (v: string) => parseInt(v, 10))
    expect([...gm.keys()]).toEqual([10])
    expect(gm.get(10)).toEqual(['10', '10'])
  })

  it('SPEC-R39 findLast on Set; forEach null', () => {
    expect(findLast(new Set([1, 2, 3]), (x) => x > 1)).toBe(3)
    const fn = vi.fn()
    forEach(null as unknown as never, fn)
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

  it('legacy compact count smoke', () => {
    expect(compact([0, 1, false, 2, '', 3])).toEqual([1, 2, 3])
    expect(count(['one', 'two', 'three'], (x) => x.length)).toEqual({ '3': 2, '5': 1 })
  })
})
