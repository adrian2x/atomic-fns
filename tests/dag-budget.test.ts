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
    // Tree expansion exceeds 64 KB -> no key (preserves key/deepEqual agreement).
    expect(key).toBeUndefined()
  })

  it('flatten of a depth-20 DAG throws the visit budget error', () => {
    expect(() => flatten(dag(20))).toThrow(RangeError)
    expect(() => flatten(dag(20))).toThrow(/input exceeds 1000000 nodes/)
  })

  it('merge of a depth-23 DAG throws the budget error quickly without OOM', () => {
    const src = dag(23)
    const t0 = performance.now()
    expect(() => merge({}, src)).toThrow(/input exceeds 1000000 nodes/)
    expect(performance.now() - t0).toBeLessThan(500)
  })

  it('matches on a deep DAG hits the visit budget', () => {
    const a = dag(22)
    expect(() => matches(a)(a)).toThrow(/input exceeds 1000000 nodes/)
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
