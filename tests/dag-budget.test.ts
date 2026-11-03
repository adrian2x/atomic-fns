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

describe('shared-reference DAG budgets', () => {
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
    // Tree expansion exceeds 64 KB -> no exact key (pairwise fallback).
    expect(key).toBeUndefined()
  })

  const REVISIT_MESSAGE = 'input repeats shared objects more than 10000 times'

  describe.each([23, 40])('depth-%i DAG', (depth) => {
    it('flatten throws the revisit error in < 20 ms', () => {
      const src = dag(depth)
      const t0 = performance.now()
      expect(() => flatten(src)).toThrow(RangeError)
      expect(() => flatten(src)).toThrow(REVISIT_MESSAGE)
      expect((performance.now() - t0) / 2).toBeLessThan(20)
    })

    it('merge throws the revisit error in < 20 ms', () => {
      const src = dag(depth)
      const t0 = performance.now()
      expect(() => merge({}, src)).toThrow(RangeError)
      expect(() => merge({}, src)).toThrow(REVISIT_MESSAGE)
      expect((performance.now() - t0) / 2).toBeLessThan(20)
    })

    it('matches throws the revisit error in < 20 ms', () => {
      const src = dag(depth)
      const t0 = performance.now()
      expect(() => matches(src)(src)).toThrow(RangeError)
      expect(() => matches(src)(src)).toThrow(REVISIT_MESSAGE)
      expect((performance.now() - t0) / 2).toBeLessThan(20)
    })

    it('flatten of a nested-array DAG throws the revisit error in < 20 ms', () => {
      let x: unknown[] = [1]
      for (let i = 0; i < depth; i++) x = [x, x]
      const t0 = performance.now()
      expect(() => flatten(x, true)).toThrow(REVISIT_MESSAGE)
      expect(performance.now() - t0).toBeLessThan(20)
    })
  })

  it('merge of 1.2M distinct empty objects succeeds (first visits are unbounded)', () => {
    const items = Array.from({ length: 1_200_000 }, () => ({}))
    const out = merge({}, { a: items }) as { a: unknown[] }
    expect(out.a).toHaveLength(1_200_000)
  })

  it('a failed call does not leak revisit state into the next call', () => {
    expect(() => merge({}, dag(23))).toThrow(REVISIT_MESSAGE)
    const shared = {}
    expect(merge({}, { a: shared, b: shared })).toEqual({ a: {}, b: {} })
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
