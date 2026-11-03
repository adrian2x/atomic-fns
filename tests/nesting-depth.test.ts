import { describe, expect, it } from 'vitest'
import { clone, Deque, flatten, FrozenSet, matches, merge } from '../src/collections/index.js'
import { getNestingDepth } from '../src/internal/nesting.js'
import { deepEqual } from '../src/operators/index.js'

function nestArray(depth: number): unknown {
  return JSON.parse('['.repeat(depth) + ']'.repeat(depth))
}

function nestObject(depth: number): unknown {
  return JSON.parse('{"a":'.repeat(depth) + '1' + '}'.repeat(depth))
}

describe('MAX_NESTING_DEPTH = 1000', () => {
  it('deepEqual: depth 1000 works, 1001 throws', () => {
    const a1000 = nestArray(1000)
    expect(deepEqual(a1000, nestArray(1000))).toBe(true)
    expect(() => deepEqual(nestArray(1001), nestArray(1001))).toThrow(RangeError)
    expect(() => deepEqual(nestArray(1001), nestArray(1001))).toThrow(
      /nesting deeper than 1000 levels/
    )
  })

  it('clone deep: depth 1000 works, 1001 throws', () => {
    expect(clone(nestArray(1000), true)).toEqual(nestArray(1000))
    expect(() => clone(nestArray(1001), true)).toThrow(RangeError)
  })

  it('merge: depth 1000 works, 1001 throws', () => {
    expect(merge({}, nestObject(1000) as object)).toEqual(nestObject(1000))
    expect(() => merge({}, nestObject(1001) as object)).toThrow(RangeError)
  })

  it('matches: depth 1000 works, 1001 throws', () => {
    const s1000 = nestObject(1000)
    expect(matches(s1000)(nestObject(1000))).toBe(true)
    expect(() => matches(nestObject(1001))(nestObject(1001))).toThrow(RangeError)
  })

  it('flatten: depth 1000 works, 1001 throws', () => {
    expect(flatten(nestArray(1000) as unknown[], true)).toEqual([])
    expect(() => flatten(nestArray(1001) as unknown[], true)).toThrow(RangeError)
    expect(flatten(nestObject(1000) as object)).toEqual({
      ['a.'.repeat(999) + 'a']: 1
    })
    expect(() => flatten(nestObject(1001) as object)).toThrow(RangeError)
  })

  it('5000-deep probe throws RangeError under 50ms', () => {
    const deep = nestArray(5000)
    for (const fn of [
      () => deepEqual(deep, nestArray(5000)),
      () => clone(deep, true),
      () => merge({}, { x: deep }),
      () => matches({ x: deep })({ x: nestArray(5000) }),
      () => flatten(deep as unknown[], true)
    ]) {
      const start = performance.now()
      expect(fn).toThrow(RangeError)
      expect(performance.now() - start).toBeLessThan(50)
    }
  })

  it('nesting depth survives collection hook re-entry', () => {
    function nestDeque(depth: number): Deque<unknown> {
      let d = new Deque<unknown>([0])
      for (let i = 1; i < depth; i++) d = new Deque<unknown>([d])
      return d
    }
    function nestFrozen(depth: number): FrozenSet {
      let s: FrozenSet = new FrozenSet([0])
      for (let i = 1; i < depth; i++) s = new FrozenSet([s])
      return s
    }
    expect(() => deepEqual(nestDeque(1500), nestDeque(1500))).toThrow(RangeError)
    expect(getNestingDepth()).toBe(0)
    expect(deepEqual(1, 1)).toBe(true)
    expect(() => clone(nestFrozen(1500), true)).toThrow(RangeError)
    expect(getNestingDepth()).toBe(0)
    expect(deepEqual([1], [1])).toBe(true)
  })
})
