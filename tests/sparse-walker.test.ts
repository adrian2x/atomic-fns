import { describe, expect, it } from 'vitest'
import {
  Deque,
  FrozenSet,
  SortedSet,
  compact,
  difference,
  filter,
  find,
  findIndex,
  forEach,
  groupBy,
  indexOf,
  insert,
  intersection,
  lastIndexOf,
  map,
  matches,
  remove,
  union,
  uniq,
  without,
  clone,
  insort
} from '../src/collections/index.js'
import { list } from '../src/globals/index.js'
import { isHugeSparse, walkArray } from '../src/internal/arrayKeys.js'
import {
  all,
  any,
  chain,
  contains,
  enumerate,
  icompact,
  imap,
  partition,
  reduce,
  reversed,
  sorted
} from '../src/itertools/index.js'
import { max, mean, min, sum } from '../src/math/index.js'
import { deepEqual } from '../src/operators/index.js'
import { sample, shuffle } from '../src/random/index.js'
import { expectFast } from './helpers/perf.js'

/** Pre-fix: hang on length 4e9. Hang-floor budget. */
const BUDGET = 250
/** Dense 1e6 deepEqual median under coverage ~178ms -> 5x = 900, use 1000. */
const DENSE_EQ_BUDGET = 1000
/** Dense 1e6 clone median ~28ms -> 5x = 141, hang-adjacent floor 250. */
const DENSE_CLONE_BUDGET = 250

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

  it('group 2 consumers return within budget on length 4294967294 with 3 elements', () => {
    const a = hugeSparse()
    expectFast(() => {
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
    }, BUDGET)
  })

  it('group 3 consumers throw RangeError within budget', () => {
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
      expectFast(() => {
        expect(run).toThrow(RangeError)
        expect(run).toThrow('sparse array too large')
      }, BUDGET)
    }
  })

  it('R13-C: moderate sparse arrays are not rejected by absolute length', () => {
    const user = { id: 1 }
    const byId: unknown[] = []
    byId[2000] = user
    const mapped = map(byId, (x) => x)
    expect(mapped).toHaveLength(2001)
    expect(mapped[2000]).toBe(user)
    expect(0 in mapped).toBe(false)
    const listed = list(new Array(1025))
    expect(listed).toHaveLength(1025)
    expect(Object.keys(listed)).toEqual([])
    const ordered = sorted(byId as { id: number }[])
    expect(ordered).toContain(user)
    expect(ordered.filter((x) => x === user)).toHaveLength(1)
  })

  it('R13-C: length 2**24+1 with 1 element is huge-sparse; 2**20 dense is not', () => {
    const sparse: unknown[] = []
    sparse.length = 2 ** 24 + 1
    sparse[0] = 'x'
    expect(isHugeSparse(sparse)).toBe(true)
    expect(() => map(sparse, (x) => x)).toThrow('sparse array too large')

    const dense = Array.from({ length: 2 ** 20 }, (_, i) => i)
    expect(isHugeSparse(dense)).toBe(false)
    expect(() => map(dense, (x) => x)).not.toThrow()
  })

  it('R13-E1: matches walks sparse shapes and spaced values within budget', () => {
    const shapeTags: unknown[] = []
    shapeTags.length = 4_294_967_294
    shapeTags[0] = 'x'
    shapeTags[4e9] = 'admin'
    const shape = { tags: shapeTags }
    expectFast(() => {
      expect(filter([{ tags: ['x', undefined, 'admin'] }], shape).length).toBe(1)
      const withHole: unknown[] = ['x']
      withHole.length = 3
      withHole[2] = 'admin'
      expect(filter([{ tags: withHole }], shape).length).toBe(1)
      expect(filter([{ tags: ['x', 'admin'] }], shape).length).toBe(0)
    }, BUDGET)

    const spaced: unknown[] = []
    for (let i = 0; i < 600; i++) spaced[i * 1023] = i
    spaced[600 * 1023] = 'z'
    const ampShape = { tags: Array(600).fill('z') }
    expectFast(() => {
      expect(matches(ampShape)({ tags: spaced })).toBe(true)
    }, BUDGET)
  })

  it('R13-D2: iterator helpers finish or reject huge sparse within budget', () => {
    const a = hugeSparse()
    const labels: string[] = []
    labels.length = 4_294_967_294
    labels[0] = 'x'
    labels[1e9] = 'y'
    labels[4e9] = 'admin'
    expectFast(() => {
      expect([...icompact(labels)].length).toBe(3)
      expect(reduce(a, (acc) => acc, 0)).toBe(0)
      expect(all(a, (x) => x !== 'zzz')).toBe(true)
      expect(any(a, (x) => x === 'zzz')).toBe(false)
      expect(contains(a, 'zzz')).toBe(false)
      expect([...union(a)].length).toBeGreaterThanOrEqual(3)
      expect([...difference(a, [])].length).toBeGreaterThanOrEqual(3)
      expect([...intersection(a, a)].length).toBeGreaterThanOrEqual(3)
      expect(new FrozenSet(a).size).toBeGreaterThanOrEqual(3)
      expect(sum(a, () => 0)).toBe(0)
    }, BUDGET)

    const perIndex = [
      () => [...enumerate(a)],
      () => [...chain(a)],
      () => [...imap(a, (x) => x)],
      () => partition(a, Boolean),
      () => insort(labels, 'c'),
      () => insert(labels, 0, 'z'),
      () => sample(labels, 2)
    ]
    for (const run of perIndex) {
      expectFast(() => {
        expect(run).toThrow(RangeError)
        expect(run).toThrow('sparse array too large')
      }, BUDGET)
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
    expectFast(() => {
      expect(deepEqual(a, b)).toBe(true)
    }, DENSE_EQ_BUDGET)
  })

  it('dense deep clone of 1e6 stays within budget', () => {
    const a = Array.from({ length: 1e6 }, (_, i) => i)
    expectFast(() => {
      const c = clone(a, true)
      expect(c).toHaveLength(1e6)
      expect(c[0]).toBe(0)
      expect(c[999999]).toBe(999999)
    }, DENSE_CLONE_BUDGET)
  })
})
