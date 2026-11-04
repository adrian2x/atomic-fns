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
import { isCanonicalArrayIndex, isHugeSparse, walkArray } from '../src/internal/arrayKeys.js'
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
import { deepEqual, protocol } from '../src/operators/index.js'
import { sample, shuffle } from '../src/random/index.js'
import { expectFast } from './helpers/perf.js'

/** Pre-fix: hang on length 4e9. Hang-floor budget max(1000, 5xM). */
const BUDGET = 1000
/** Dense 1e6 deepEqual median under coverage ~178ms -> max(1000, 5xM)=1000. */
const DENSE_EQ_BUDGET = 1000
/** Dense 1e6 clone median ~28ms -> max(1000, 5xM)=1000. */
const DENSE_CLONE_BUDGET = 1000
/** Far above the few hundred reads an own-element walk needs; far below any huge length. */
const INDEX_READ_LIMIT = 10_000

function hugeSparse(): unknown[] {
  const a: unknown[] = []
  a.length = 4_294_967_294
  a[0] = 'x'
  a[1e9] = 'y'
  a[4e9] = 'admin'
  return a
}

/** All holes except 8 evenly spaced indices, endpoints included, set to `value`. */
function holesBetweenSpreadIndices(length: number, value: unknown): unknown[] {
  const arr: unknown[] = []
  arr.length = length
  for (let step = 0; step < 8; step++) arr[Math.floor((step * (length - 1)) / 7)] = value
  return arr
}

/** vitest timeouts cannot interrupt synchronous code, so a hole walk has to throw to fail fast. */
function withIndexReadLimit(arr: unknown[]): unknown[] {
  let reads = 0
  const countRead = (key: string | symbol): void => {
    if (typeof key === 'string' && isCanonicalArrayIndex(key) && ++reads > INDEX_READ_LIMIT) {
      throw new Error(`read more than ${String(INDEX_READ_LIMIT)} indices`)
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
      expect(uniq(a as string[])).toEqual(['x', 'y', 'admin'])
      expect(without(a as string[], 'x')).toEqual(['y', 'admin'])
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
    for (let i = 0; i < 600; i++) spaced[i * 1023] = 'z'
    expect(matches({ tags: Array(600).fill('z') })({ tags: spaced })).toBe(true)
    expect(matches({ tags: Array(601).fill('z') })({ tags: spaced })).toBe(false)
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
    }, BUDGET)

    const perIndex = [
      () => [...enumerate(a)],
      () => [...chain(a)],
      () => [...imap(a, (x) => x)],
      () => partition(a, Boolean),
      () => sum(a, () => 0),
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

  it('R13-E3: sparse semantics match native Array methods', () => {
    const holes: unknown[] = [1]
    holes.length = 3
    holes[2] = 3
    const filled = [1, undefined, 3]
    expect(indexOf(holes, undefined)).toBe(-1)
    expect(indexOf(filled, undefined)).toBe(1)
    expect(filter(holes, () => true)).toEqual([1, 3])
    expect(filter(filled, (x) => x === undefined)).toEqual([undefined])
    expect(findIndex(holes, (x) => x === undefined)).toBe(1)
    expect(uniq(holes)).toEqual([1, undefined, 3])

    for (let n = 0; n < 1000; n++) {
      const len = 1 + (n % 64)
      const a: unknown[] = []
      a.length = len
      for (let i = 0; i < len; i++) {
        if ((n * 17 + i * 13) % 3 !== 0) a[i] = (n + i) % 7
      }
      const keep = (_x: unknown) => true
      expect(filter(a, keep)).toEqual(a.filter(keep))
      expect(map(a, (x) => x)).toEqual(a.map((x) => x))
      expect(indexOf(a, undefined)).toBe(a.indexOf(undefined))
      expect(lastIndexOf(a, undefined)).toBe(a.lastIndexOf(undefined))
      expect(findIndex(a, (x) => x === undefined)).toBe(a.findIndex((x) => x === undefined))
      expect(find(a, (x) => x === 3)).toBe(a.find((x) => x === 3))
    }

    const huge = hugeSparse()
    expectFast(() => {
      expect(filter(huge, () => true)).toEqual(['x', 'y', 'admin'])
      expect(indexOf(huge, undefined)).toBe(-1)
      expect(findIndex(huge, (x) => x === undefined)).toBe(1)
    }, BUDGET)
  })

  it('huge arrays filled at evenly spaced indices compare own elements without walking holes', () => {
    const length = 2 ** 32 - 1
    const a = holesBetweenSpreadIndices(length, 'x')
    const same = holesBetweenSpreadIndices(length, 'x')
    const valueDiffers = holesBetweenSpreadIndices(length, 'x')
    a[1234] = 'y'
    same[1234] = 'y'
    valueDiffers[1234] = 'z'

    expect(deepEqual(withIndexReadLimit(a), withIndexReadLimit(same))).toBe(true)
    expect(deepEqual(withIndexReadLimit(a), withIndexReadLimit(valueDiffers))).toBe(false)
  }, 2000)

  it('a huge sparse array equals an all-undefined array in both argument orders', () => {
    const length = 2 ** 24 + 1
    const sparse = holesBetweenSpreadIndices(length, undefined)
    const allUndefined = new Array<unknown>(length).fill(undefined)

    expect(deepEqual(sparse, allUndefined)).toBe(true)
    expect(deepEqual(allUndefined, sparse)).toBe(true)
  }, 30_000)

  it('a dense huge array differing at index 0 is rejected without scanning for holes', () => {
    const length = 2 ** 24 + 1
    const dense = new Array<unknown>(length).fill('x')
    const other = holesBetweenSpreadIndices(length, 'y')

    expect(deepEqual(withIndexReadLimit(dense), other)).toBe(false)
  })

  it('a huge sparse array compares the element before its first hole once', () => {
    let comparisons = 0
    const counted = {
      [protocol.equals]: () => {
        comparisons++
        return true
      }
    }
    const a = hugeSparse()
    const b = hugeSparse()
    a[0] = counted
    b[0] = counted

    expect(deepEqual(a, b)).toBe(true)
    // hooks bypass the proven memo, so a repeat here would double at every nesting level
    expect(comparisons).toBe(1)
  })

  it('dense deepEqual of 1e6 arrays stays within budget', { timeout: 60_000 }, () => {
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

describe('walkArray on elements spaced below the hole streak', () => {
  it('takes keys once holes outnumber elements instead of visiting every hole', () => {
    const spaced: unknown[] = []
    spaced.length = 2 ** 20
    for (let i = 0; i < spaced.length; i += 200) spaced[i] = i
    const indices: number[] = []
    walkArray(withIndexReadLimit(spaced), (ev) => {
      if (ev.kind === 'value') indices.push(ev.index)
    })
    expect(indices).toHaveLength(Math.ceil(spaced.length / 200))
    expect(indices.at(-1)).toBe(Math.floor((spaced.length - 1) / 200) * 200)
  })
})
