import { deserialize, serialize } from 'node:v8'
import { describe, expect, it } from 'vitest'
import { flatten, matches, merge } from '../src/collections/index.js'
import {
  getLeafKeyVisits,
  getSubsetPairComparisons,
  resetLeafKeyVisits,
  resetSubsetPairComparisons
} from '../src/collections/internal.js'
import { Duration, durationField } from '../src/i18n/duration.js'
import { canonicalKey } from '../src/internal/canonicalKey.js'
import {
  getSharedWorkCharged,
  MAX_FLATTEN_SHARED_WORK,
  MAX_SHARED_WORK,
  subtreeContainerCount
} from '../src/internal/nesting.js'
import { truncateForError } from '../src/internal/truncate.js'
import { deepEqual } from '../src/operators/index.js'
import { expectFast } from './helpers/perf.js'

/** Shared-reference DAG: x(i+1) = { l: x(i), r: x(i) }. */
function dag(depth: number, bottom: object = { v: 1 }): object {
  let x = bottom
  for (let i = 0; i < depth; i++) {
    x = { l: x, r: x }
  }
  return x
}

/** Fan-out DAG from r9.mjs: each level has `fan` keys pointing at the same child. */
function fan(f: number, d: number): object {
  let x: object = { v: 1 }
  for (let i = 0; i < d; i++) {
    const o: Record<string, object> = {}
    for (let j = 0; j < f; j++) o['k' + String(j)] = x
    x = o
  }
  return x
}

function nestIn(d: number, inner: object): object {
  let x: object = inner
  for (let i = 0; i < d; i++) x = { n: x }
  return x
}

/** Peak heap growth at reads of the probe's getter, after collecting garbage. */
function heapHeldAtProbe(run: (probe: { readonly p: number }) => void): number {
  const { gc } = globalThis
  if (gc === undefined) throw new Error('tests need --expose-gc')
  gc()
  const before = process.memoryUsage().heapUsed
  let held = 0
  run({
    get p() {
      gc()
      held = Math.max(held, process.memoryUsage().heapUsed - before)
      return 0
    }
  })
  return held
}

const SHARED_REVISIT = 'input repeats shared objects beyond 500000 copied nodes'
const FLATTEN_REVISIT = 'input repeats shared objects beyond 250000 output keys'
/** Pre-fix: hang / multi-second DAG walks. Hang-floor budget max(1000, 5xM). */
const BUDGET = 1000

function expectBudgetTrip(
  run: () => void,
  src: object,
  message = SHARED_REVISIT,
  limit = MAX_SHARED_WORK
): void {
  let err: unknown
  try {
    run()
  } catch (e) {
    err = e
  }
  expect(err).toBeInstanceOf(RangeError)
  expect((err as Error).message).toBe(message)
  const largest = subtreeContainerCount(src)
  expect(getSharedWorkCharged()).toBeLessThanOrEqual(limit + largest)
}

describe('shared-reference DAG budgets', () => {
  it('flatten depth-20 DAG throws the revisit error', () => {
    const src = dag(20)
    expectBudgetTrip(() => flatten(src), src, FLATTEN_REVISIT, MAX_FLATTEN_SHARED_WORK)
  })

  it('flatten of a nested-array depth-20 DAG throws the revisit error', () => {
    let x: unknown[] = [1]
    for (let i = 0; i < 20; i++) x = [x, x]
    expectBudgetTrip(() => flatten(x, true), x, FLATTEN_REVISIT, MAX_FLATTEN_SHARED_WORK)
  })

  it('flatten of 10001 shared row objects works', () => {
    const row = { x: 1 }
    const out = flatten({ rows: new Array(10_001).fill(row) }) as Record<string, unknown>
    expect(out['rows[0].x']).toBe(1)
    expect(out['rows[10000].x']).toBe(1)
  })

  it('deepEqual depth-40 DAG pair compares within budget', () => {
    const a = dag(40)
    const b = dag(40)
    expectFast(() => {
      expect(deepEqual(a, b)).toBe(true)
    }, BUDGET)
  })

  it('canonicalKey depth-40 DAG completes within budget', () => {
    const a = dag(40)
    expectFast(() => {
      const key = canonicalKey(a)
      // Tree expansion exceeds 64 KB -> fixed-size hashed key.
      expect(key).toMatch(/^H:[0-9a-f]{16}$/)
      expect(canonicalKey(dag(40))).toBe(key)
    }, BUDGET)
  })

  it('merge of depth-23 DAG throws the budget error deterministically', () => {
    const src = dag(23)
    expectBudgetTrip(() => merge({}, src), src)
  })

  it('merge of depth-23 DAG throws within expectFast smoke budget', () => {
    const src = dag(23)
    expectFast(() => {
      expect(() => merge({}, src)).toThrow(SHARED_REVISIT)
    }, BUDGET)
  })

  it('merge of depth-40 DAG throws the budget error deterministically', () => {
    const src = dag(40)
    expectBudgetTrip(() => merge({}, src), src)
  })

  it('r9 fan-out shapes throw the budget error deterministically', { timeout: 60_000 }, () => {
    for (const [f, d] of [
      [4, 12],
      [3, 14],
      [8, 8]
    ] as const) {
      const src = fan(f, d)
      expectBudgetTrip(() => merge({}, src), src)
      expectBudgetTrip(() => flatten(src), src, FLATTEN_REVISIT, MAX_FLATTEN_SHARED_WORK)
    }
  })

  it('dos-31: flattenFan4d12 throws within shared-work bound', () => {
    // Pre-fix 154 ms; expectFast 100 was above 1/4 of pre-fix. Count via nesting budget.
    const src = fan(4, 12)
    expectBudgetTrip(() => flatten(src), src, FLATTEN_REVISIT, MAX_FLATTEN_SHARED_WORK)
  })

  it('matches depth-40 DAG shape and value within budget', () => {
    const src = dag(40)
    expectFast(() => {
      expect(matches(src)(src)).toBe(true)
    }, BUDGET)
  })

  /** Array DAG: x(i+1) = [x(i), x(i)] - shared refs survive structured clone. */
  function arrDag(depth: number, bottom: unknown = [1]): unknown {
    let x = bottom
    for (let i = 0; i < depth; i++) x = [x, x]
    return x
  }

  /** Single-path shape that walks one route down an {@link arrDag} of the same depth. */
  function arrChain(depth: number, bottom: unknown): unknown {
    let x = bottom
    for (let i = 0; i < depth; i++) x = [x]
    return x
  }

  const SHARED_REVISIT_RE = /shared objects beyond/

  /**
   * Completes with `expected` or throws the shared-work budget error; leaf-key visits stay
   * O(distinct nodes) in arrDag(depth) (d+1 arrays) with headroom for wrappers.
   */
  function expectMatchesDagBounded(depth: number, expected: boolean, run: () => boolean): void {
    resetLeafKeyVisits()
    let result: boolean | undefined
    let err: unknown
    try {
      result = run()
    } catch (e) {
      err = e
    }
    if (err !== undefined) {
      expect(err).toBeInstanceOf(RangeError)
      expect((err as Error).message).toMatch(SHARED_REVISIT_RE)
    } else {
      expect(result).toBe(expected)
    }
    expect(getLeafKeyVisits()).toBeLessThanOrEqual(8 * (depth + 4))
  }

  it('dos-37: matchesDagTarget30 leaf-key work is linear in distinct nodes', () => {
    const depth = 30
    const bytes = serialize({ t: [arrDag(depth), 7] })
    const msg: unknown = deserialize(bytes)
    expectFast(() => {
      expectMatchesDagBounded(depth, true, () => matches({ t: [7] })(msg))
    }, 1000)
  })

  it('dos-37: matchesDagBoth24 leaf-key work is linear in distinct nodes', () => {
    const depth = 24
    const bytes = serialize({ t: [arrDag(depth)] })
    const shape: unknown = deserialize(bytes)
    const value: unknown = deserialize(bytes)
    expectFast(() => {
      expectMatchesDagBounded(depth, true, () => matches(shape)(value))
    }, 1000)
  })

  it('dos-37: matchesDagShape30 leaf-key work is linear in distinct nodes', () => {
    const depth = 30
    const bytes = serialize({ t: [arrDag(depth)] })
    const shape: unknown = deserialize(bytes)
    expectFast(() => {
      expectMatchesDagBounded(depth, false, () => matches(shape)({ t: [1] }))
    }, 1000)
  })

  it('matches compares each failed shared pair once', { timeout: 5000 }, () => {
    const depth = 16
    const shape = arrChain(depth, { a: 1 })
    const target = arrDag(depth, { a: 2, b: 1 })
    resetSubsetPairComparisons()

    expect(matches(shape)(target)).toBe(false)

    expect(getSubsetPairComparisons()).toBeLessThanOrEqual(4 * depth)
  })

  it('a failed pair leaves the other candidates and shapes free to match', () => {
    const depth = 12
    const dead = arrDag(depth, { a: 2, b: 1 })
    const live = arrDag(depth, { a: 1 })
    expect(matches(arrChain(depth + 1, { a: 1 }))([dead, live])).toBe(true)

    const failsFirstShape = { a: 2, b: 1 }
    expect(matches([{ a: 1 }, { a: 2 }])([failsFirstShape, { a: 1 }])).toBe(true)
  })

  it('matches walks a shape DAG of empty containers in bounded time', () => {
    const arrays = arrDag(26, [])
    const objects = dag(26, {})
    expectFast(() => {
      expect(matches([arrays])([[1]])).toBe(false)
      expect(matches([objects])([{ l: 1 }])).toBe(false)
    }, BUDGET)
  })

  /** Two-node cycle: `node.x.back === node`, with `node.y` read after the cycle edge. */
  function ring(y: number): { node: object; back: object } {
    const node: Record<string, unknown> = {}
    const back = { back: node }
    node.x = back
    node.y = y
    // Shared leaf key, so the index keeps every ring as a candidate.
    node.z = 1
    return { node, back }
  }

  it('matches rejects a pair whose cycle partner failed after proving it', () => {
    const shape = ring(1)
    const failing = ring(2)
    const passing = ring(1)
    const elements = [failing.node, passing.node]

    expect(matches([{ u: [shape.node], k: shape.back }])([{ u: elements, k: failing.back }])).toBe(
      false
    )
    expect(matches([{ u: [shape.node], k: shape.back }])([{ u: elements, k: passing.back }])).toBe(
      true
    )
  })

  it('a pair reached twice on one cycle resolves below the nesting cap', () => {
    function selfPair(...tail: number[]): unknown[] {
      const a: unknown[] = []
      a.push(a, a, ...tail)
      return a
    }
    expect(matches(selfPair())(selfPair())).toBe(true)
    expect(matches(selfPair(1))(selfPair(2))).toBe(false)
  })

  describe('matches memory', () => {
    const LEAVES = Array.from({ length: 100_000 }, (_, i) => i)
    const CHAIN_DEPTH = 100
    /** An uncapped index holds about 290 MB here and grows with depth. */
    const HEAP_BOUND = 128 * 1024 * 1024

    it('holds no per-level copy of a deep target leaf set', { timeout: 10_000 }, () => {
      const chain = nestIn(CHAIN_DEPTH, LEAVES)

      const held = heapHeldAtProbe((probe) => {
        expect(matches({ list: [{ n: -1 }] })({ list: [chain, probe] })).toBe(false)
      })

      expect(held).toBeLessThan(HEAP_BOUND)
    })

    it('holds no per-level copy of a deep shape leaf set', { timeout: 10_000 }, () => {
      const chain = nestIn(CHAIN_DEPTH, LEAVES)

      const held = heapHeldAtProbe((probe) => {
        expect(matches({ list: [[chain, probe]] })({ list: [[1, 2]] })).toBe(false)
      })

      expect(held).toBeLessThan(HEAP_BOUND)
    })

    it('caps its memo of pairs through a quadratic failing scan', { timeout: 10_000 }, () => {
      const rows = 2000
      /** An uncapped memo holds about 128 MB here, against 30 MB capped. */
      const memoBound = 64 * 1024 * 1024
      const shape: object[] = Array.from({ length: rows }, () => ({ a: 5, b: 6 }))
      shape.push({ z: { p: 0 } })
      const target: object[] = Array.from({ length: rows }, () => ({ a: 6, b: 5 }))

      const held = heapHeldAtProbe((probe) => {
        target.push({ a: 5, b: 6, z: probe })
        expect(matches(shape)(target)).toBe(true)
      })

      expect(held).toBeLessThan(memoBound)
    })

    it('still matches elements and shapes the index gave up on', { timeout: 10_000 }, () => {
      const chain = nestIn(CHAIN_DEPTH, LEAVES)
      const twin = nestIn(CHAIN_DEPTH, LEAVES)

      expect(matches({ list: [{ n: 7 }] })({ list: [chain, { n: 7 }] })).toBe(true)
      expect(matches({ list: [chain] })({ list: [twin] })).toBe(true)
      expect(matches({ list: [chain] })({ list: [nestIn(CHAIN_DEPTH - 1, LEAVES)] })).toBe(false)

      const item = nestIn(CHAIN_DEPTH, [7])
      const indexedFirst = nestIn(CHAIN_DEPTH, [7])
      const overflows = nestIn(CHAIN_DEPTH, LEAVES.slice(0, 2000))
      expect(
        matches({ a: [item], b: [item], c: [item] })({
          a: [indexedFirst],
          b: [overflows],
          c: [overflows]
        })
      ).toBe(true)
    })
  })

  it('merge of 10001 shared row objects works with distinct copies', () => {
    const row = { x: 1 }
    const out = merge({}, { rows: new Array(10_001).fill(row) }) as { rows: object[] }
    expect(out.rows).toHaveLength(10_001)
    expect(out.rows[0]).toEqual({ x: 1 })
    expect(out.rows[0]).not.toBe(out.rows[10_000])
    ;(out.rows[0] as { x: number }).x = 99
    expect((out.rows[10_000] as { x: number }).x).toBe(1)
  })

  it('R13-B: merge/flatten of filled nested rows succeed (400 / 50k / 100001)', () => {
    const child = { x: 1, meta: {} }
    for (const n of [400, 50_000, 100_001]) {
      const rows = new Array(n).fill(child)
      const merged = merge({}, { rows }) as { rows: object[] }
      expect(merged.rows).toHaveLength(n)
      expect(merged.rows[0]).toEqual({ x: 1, meta: {} })
      expect(merged.rows[0]).not.toBe(merged.rows[n - 1])

      const flat = flatten({ rows }) as Record<string, unknown>
      expect(flat['rows[0].x']).toBe(1)
      expect(flat[`rows[${String(n - 1)}].x`]).toBe(1)
    }
  })

  it('R14-B: 20-level wrap of 60k shared leaves merges and flattens', () => {
    const row = { id: 1, a: { b: 1 } }
    const src = nestIn(20, { rows: new Array(60_000).fill(row) })
    const merged = merge({}, src) as { n: unknown }
    expect(merged).toBeTruthy()
    const flat = flatten(src) as Record<string, unknown>
    expect(Object.keys(flat).length).toBeGreaterThan(0)
  })

  it('dos-33: 60k fill rows wrapped 20 levels deep succeed', () => {
    const row = { id: 1, a: { b: 1 } }
    const src = nestIn(20, { rows: new Array(60_000).fill(row) })
    expect(() => merge({}, src)).not.toThrow()
    expect(() => flatten(src)).not.toThrow()
  })

  it('R13-B / dos-30: 2e5 shared rows merge into an existing target', () => {
    const row = { x: 1, meta: {} }
    const target: { rows: object[] } = { rows: [] }
    const out = merge(target, { rows: new Array(200_000).fill(row) })
    expect(out).toBe(target)
    expect(out.rows).toHaveLength(200_000)
    expect(out.rows[0]).toEqual({ x: 1, meta: {} })
  })

  it(
    'merge of 1.2M distinct empty objects succeeds (first visits are unbounded)',
    { timeout: 60_000 },
    () => {
      const items = Array.from({ length: 1_200_000 }, () => ({}))
      const out = merge({}, { a: items }) as { a: unknown[] }
      expect(out.a).toHaveLength(1_200_000)
    }
  )

  it('a failed flatten does not leak revisit state into the next call', () => {
    expect(() => flatten(dag(20))).toThrow(FLATTEN_REVISIT)
    const shared = {}
    expect(merge({}, { a: shared, b: shared })).toEqual({ a: {}, b: {} })
    const out = merge({}, { a: shared, b: shared }) as { a: object; b: object }
    expect(out.a).not.toBe(out.b)
  })

  it('R12-B: merge never shares copies across keys (user/admin leak)', () => {
    const e = { name: 'admin' }
    const state = merge({}, { user: e, admin: e }) as {
      user: { name: string }
      admin: { name: string }
    }
    expect(state.user).not.toBe(state.admin)
    merge(state, { user: { name: 'x' } })
    expect(state.user.name).toBe('x')
    expect(state.admin.name).toBe('admin')
  })

  it('R12-B: sibling key stays independent when another key is updated', () => {
    const s = { z: 0 }
    const out = merge({}, { a: s, b: s }, { a: { z: 1 } }) as {
      a: { z: number }
      b: { z: number }
    }
    expect(out.a.z).toBe(1)
    expect(out.b.z).toBe(0)
    expect(out.a).not.toBe(out.b)
  })

  it('R12-F: merge into a mirrored DAG completes within budget', () => {
    /** Copy that preserves shared references (unlike merge, which gives each key its own copy). */
    function copyShared(node: object, map = new WeakMap<object, object>()): object {
      const hit = map.get(node)
      if (hit) return hit
      const out: object = Array.isArray(node) ? [] : {}
      map.set(node, out)
      for (const k of Object.keys(node)) {
        const v = (node as Record<string, unknown>)[k]
        ;(out as Record<string, unknown>)[k] =
          v !== null && typeof v === 'object' ? copyShared(v, map) : v
      }
      return out
    }
    for (const depth of [20, 24, 40]) {
      const src = dag(depth)
      const target = copyShared(src)
      expectFast(() => {
        const out = merge(target, src)
        expect(out).toBe(target)
        expect(deepEqual(out, src)).toBe(true)
      }, BUDGET)
    }
    let a: unknown[] = [1]
    for (let i = 0; i < 40; i++) a = [a, a]
    const msg = { a }
    const target = copyShared(msg)
    expectFast(() => {
      merge(target, msg)
      expect(deepEqual(target, msg)).toBe(true)
    }, BUDGET)
  })

  it('Duration.round error echo for a depth-22 DAG builds within budget', () => {
    const a = dag(22)
    expectFast(() => {
      const d = new Duration(0)
      expect(() => {
        const opts = { largestUnit: 'seconds' as const }
        Object.defineProperty(opts, 'largestUnit', { get: () => a })
        d.round(opts)
      }).toThrow()
      expect(truncateForError(a).length).toBeLessThanOrEqual(43)
      const callField = durationField as (unit: unknown) => string
      expect(() => callField(a)).toThrow()
    }, BUDGET)
  })
})
