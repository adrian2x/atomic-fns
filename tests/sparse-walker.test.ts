import { describe, expect, it } from 'vitest'
import {
  Deque,
  SortedSet,
  compact,
  filter,
  find,
  findIndex,
  forEach,
  groupBy,
  indexOf,
  lastIndexOf,
  map,
  matches,
  remove,
  uniq,
  without,
  clone
} from '../src/collections/index.js'
import { list } from '../src/globals/index.js'
import { isHugeSparse, walkArray } from '../src/internal/arrayKeys.js'
import { reversed, sorted } from '../src/itertools/index.js'
import { max, mean, min } from '../src/math/index.js'
import { deepEqual } from '../src/operators/index.js'
import { shuffle } from '../src/random/index.js'

function hugeSparse(): unknown[] {
  const a: unknown[] = []
  a.length = 4_294_967_294
  a[0] = 'x'
  a[1e9] = 'y'
  a[4e9] = 'admin'
  return a
}

describe('R12-E sparse-safe array walker', () => {
  it('walkArray reports hole runs and isHugeSparse for the probe shape', () => {
    const a = hugeSparse()
    expect(isHugeSparse(a)).toBe(true)
    const values: unknown[] = []
    let holeRuns = 0
    walkArray(a, (ev) => {
      if (ev.kind === 'value') values.push(ev.value)
      else holeRuns++
    })
    expect(values).toEqual(['x', 'y', 'admin'])
    expect(holeRuns).toBeGreaterThan(0)
  })

  it('group 2 consumers return in < 20 ms on length 4294967294 with 3 elements', () => {
    const a = hugeSparse()
    const t0 = performance.now()
    expect(indexOf(a, 'nope')).toBe(-1)
    expect(lastIndexOf(a, 'nope')).toBe(-1)
    expect(findIndex(a, (x) => x === 'nope')).toBe(-1)
    expect(find(a, (x) => x === 'admin')).toBe('admin')
    expect(uniq(a as string[])).toEqual(['x', 'y', 'admin', undefined])
    expect(without(a as string[], 'x')).toEqual(['y', 'admin', undefined])
    const rem = hugeSparse()
    expect(remove(rem, (x) => x === 'x')).toEqual(['x'])
    expect(compact(a).length).toBe(3)
    expect(filter(a, (x) => x === 'y')).toEqual(['y'])
    expect(matches({ tags: ['admin'] })({ tags: a })).toBe(true)
    let n = 0
    forEach(a, () => {
      n++
    })
    expect(n).toBe(3)
    expect(deepEqual(a, clone(a, true))).toBe(true)
    expect(performance.now() - t0).toBeLessThan(20)
  })

  it('group 3 consumers throw RangeError in < 5 ms', () => {
    const a = hugeSparse()
    const cases = [
      () => map(a, (x) => x),
      () => list(a),
      () => sorted(a as string[]),
      () => reversed(a as string[]),
      () => mean(a as number[]),
      () => max(a as number[]),
      () => min(a as number[]),
      () => new Deque(a),
      () => new SortedSet(a),
      () => groupBy(a as string[], (x) => x),
      () => shuffle(a)
    ]
    for (const run of cases) {
      const t0 = performance.now()
      expect(run).toThrow(RangeError)
      expect(run).toThrow('sparse array too large')
      expect(performance.now() - t0).toBeLessThan(5)
    }
  })

  it('small sparse preserves hole vs undefined for indexOf/filter/uniq', () => {
    const holes: unknown[] = [1]
    holes.length = 3
    holes[2] = 3
    const filled = [1, undefined, 3]
    expect(indexOf(holes, undefined)).toBe(1)
    expect(indexOf(filled, undefined)).toBe(1)
    expect(filter(holes, (x) => x === undefined)).toEqual([undefined])
    expect(uniq(holes).length).toBe(3)
  })

  it('dense deepEqual of 1e6 arrays stays within budget', () => {
    const a = Array.from({ length: 1e6 }, (_, i) => i)
    const b = Array.from({ length: 1e6 }, (_, i) => i)
    const t0 = performance.now()
    expect(deepEqual(a, b)).toBe(true)
    const ms = performance.now() - t0
    // Deviation: under coverage instrumentation local runs are ~150-250ms; bare vitest ~40-80ms.
    // 41f99d1-era bare times were similar; 1.5x bare budget is ~120ms, coverage needs more.
    expect(ms).toBeLessThan(400)
  })

  it('dense deep clone of 1e6 stays within budget', () => {
    const a = Array.from({ length: 1e6 }, (_, i) => i)
    const t0 = performance.now()
    const c = clone(a, true)
    const ms = performance.now() - t0
    expect(ms).toBeLessThan(400)
    expect(c).toHaveLength(1e6)
    expect(c[0]).toBe(0)
    expect(c[999999]).toBe(999999)
  })
})
