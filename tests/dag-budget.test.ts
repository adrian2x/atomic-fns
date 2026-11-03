import { describe, expect, it } from 'vitest'
import { flatten, matches, merge } from '../src/collections/index.js'
import { Duration, durationField } from '../src/i18n/duration.js'
import { canonicalKey } from '../src/internal/canonicalKey.js'
import { truncateForError } from '../src/internal/truncate.js'
import { deepEqual } from '../src/operators/index.js'

/** Shared-reference DAG: x(i+1) = { l: x(i), r: x(i) }. */
function dag(depth: number): object {
  let x: object = { v: 1 }
  for (let i = 0; i < depth; i++) {
    x = { l: x, r: x }
  }
  return x
}

const FLATTEN_REVISIT = 'input repeats shared objects more than 100000 times'

describe('shared-reference DAG budgets', () => {
  it('flatten depth-20 DAG throws the revisit error in < 50 ms', () => {
    const src = dag(20)
    const t0 = performance.now()
    let err: unknown
    try {
      flatten(src)
    } catch (e) {
      err = e
    }
    expect(performance.now() - t0).toBeLessThan(50)
    expect(err).toBeInstanceOf(RangeError)
    expect((err as Error).message).toBe(FLATTEN_REVISIT)
  })

  it('flatten of a nested-array depth-20 DAG throws the revisit error in < 50 ms', () => {
    let x: unknown[] = [1]
    for (let i = 0; i < 20; i++) x = [x, x]
    const t0 = performance.now()
    let err: unknown
    try {
      flatten(x, true)
    } catch (e) {
      err = e
    }
    expect(performance.now() - t0).toBeLessThan(50)
    expect(err).toBeInstanceOf(RangeError)
    expect((err as Error).message).toBe(FLATTEN_REVISIT)
  })

  it('flatten of 10001 shared row objects works', () => {
    const row = { x: 1 }
    const out = flatten({ rows: new Array(10_001).fill(row) }) as Record<string, unknown>
    expect(out['rows[0].x']).toBe(1)
    expect(out['rows[10000].x']).toBe(1)
  })

  it('deepEqual depth-40 DAG pair compares in < 50 ms', () => {
    const a = dag(40)
    const b = dag(40)
    const t0 = performance.now()
    expect(deepEqual(a, b)).toBe(true)
    expect(performance.now() - t0).toBeLessThan(50)
  })

  it('canonicalKey depth-40 DAG completes in < 50 ms', () => {
    const a = dag(40)
    const t0 = performance.now()
    const key = canonicalKey(a)
    expect(performance.now() - t0).toBeLessThan(50)
    // Tree expansion exceeds 64 KB -> fixed-size hashed key.
    expect(key).toMatch(/^H:[0-9a-f]{16}$/)
    expect(canonicalKey(dag(40))).toBe(key)
  })

  it('merge of depth-23 DAG throws the revisit error in < 50 ms', () => {
    const src = dag(23)
    const t0 = performance.now()
    let err: unknown
    try {
      merge({}, src)
    } catch (e) {
      err = e
    }
    expect(performance.now() - t0).toBeLessThan(50)
    expect(err).toBeInstanceOf(RangeError)
    expect((err as Error).message).toBe(FLATTEN_REVISIT)
  })

  it('matches depth-40 DAG shape and value in < 20 ms', () => {
    const src = dag(40)
    const t0 = performance.now()
    expect(matches(src)(src)).toBe(true)
    expect(performance.now() - t0).toBeLessThan(20)
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

  it('merge of 1.2M distinct empty objects succeeds (first visits are unbounded)', () => {
    const items = Array.from({ length: 1_200_000 }, () => ({}))
    const out = merge({}, { a: items }) as { a: unknown[] }
    expect(out.a).toHaveLength(1_200_000)
  })

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

  it('R12-F: merge into a mirrored DAG completes in < 20 ms', () => {
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
      const t0 = performance.now()
      const out = merge(target, src)
      expect(performance.now() - t0).toBeLessThan(20)
      expect(out).toBe(target)
      expect(deepEqual(out, src)).toBe(true)
    }
    let a: unknown[] = [1]
    for (let i = 0; i < 40; i++) a = [a, a]
    const msg = { a }
    const target = copyShared(msg)
    const t0 = performance.now()
    merge(target, msg)
    expect(performance.now() - t0).toBeLessThan(20)
    expect(deepEqual(target, msg)).toBe(true)
  })

  it('Duration.round error echo for a depth-22 DAG builds in < 5 ms', () => {
    const a = dag(22)
    const t0 = performance.now()
    const d = new Duration(0)
    expect(() => {
      const opts = { largestUnit: 'seconds' as const }
      Object.defineProperty(opts, 'largestUnit', { get: () => a })
      d.round(opts)
    }).toThrow()
    expect(performance.now() - t0).toBeLessThan(5)
    expect(truncateForError(a).length).toBeLessThanOrEqual(43)
    const callField = durationField as (unit: unknown) => string
    expect(() => callField(a)).toThrow()
  })
})
