import { describe, expect, it } from 'vitest'
import { clone, flatten, pick } from '../src/collections/index.js'
import { set } from '../src/globals/index.js'
import { HUGE_SPARSE_MIN_LENGTH } from '../src/internal/arrayKeys.js'
import { deepEqual } from '../src/operators/index.js'
import { expectFast } from './helpers/perf.js'

/** Pre-fix: hang iterating length 2**32-1. Hang-floor budget max(1000, 5xM). */
const BUDGET = 1000

/**
 * Native slice blocks the thread at length 2**32-1, where no test timeout can fire. One past the
 * threshold it returns in milliseconds, so an unguarded copy fails the assertion instead.
 */
const JUST_OVER_THRESHOLD = HUGE_SPARSE_MIN_LENGTH + 1

const SPARSE_REFUSAL = new RangeError('sparse array too large')

function sparseOfLength(length: number): unknown[] {
  const sparse: unknown[] = ['first']
  sparse.length = length
  return sparse
}

const shallowCopiers: [string, (source: unknown[]) => unknown[]][] = [
  ['clone', (source) => clone(source)],
  ['pick', (source) => pick({ source }, ['source']).source as unknown[]]
]

describe('POL-24 sparse array walks', () => {
  it('set refuses index beyond length; append at length works', () => {
    const d = { tags: ['a'] as string[] }
    expect(() => set('tags.4294967294', d, 'x')).toThrow(RangeError)
    expect(() => set('tags.4294967294', d, 'x')).toThrow('array index beyond length')
    expect(d.tags.length).toBe(1)
    set('tags.1', d, 'b', true, true)
    expect(d.tags.length).toBe(2)
    expect(d.tags[1]).toBe('b')
  })

  it('huge sparse array of length 2**32-1 with 3 elements clones/compares/flattens within budget', () => {
    const a: unknown[] = []
    a[0] = 'a'
    a[1] = 'b'
    a[2 ** 32 - 2] = 'z'
    expect(a.length).toBe(2 ** 32 - 1)

    let c: unknown[] = []
    expectFast(() => {
      c = clone(a, true)
      expect(c.length).toBe(a.length)
      expect(c[0]).toBe('a')
      expect(c[1]).toBe('b')
      expect(c[2 ** 32 - 2]).toBe('z')
      expect(0 in c).toBe(true)
      expect(3 in c).toBe(false)
    }, BUDGET)

    expectFast(() => {
      expect(deepEqual(a, c)).toBe(true)
    }, BUDGET)

    expectFast(() => {
      const flat: unknown[] = flatten(a, true)
      expect(flat).toEqual(['a', 'b', 'z'])
    }, BUDGET)
  })
})

describe('shallow copies of sparse arrays', () => {
  it.each(shallowCopiers)(
    '%s refuses an array over the huge sparse threshold',
    { timeout: BUDGET },
    (_name, copy) => {
      const source = sparseOfLength(JUST_OVER_THRESHOLD)

      expect(() => copy(source)).toThrow(SPARSE_REFUSAL)
    }
  )

  it.each(shallowCopiers)(
    '%s copies a sparse array at the threshold with its holes',
    { timeout: BUDGET },
    (_name, copy) => {
      const source = sparseOfLength(HUGE_SPARSE_MIN_LENGTH)

      const copied = copy(source)

      expect(copied === source).toBe(false)
      expect(copied.length).toBe(HUGE_SPARSE_MIN_LENGTH)
      expect(copied[0]).toBe('first')
      expect(1 in copied).toBe(false)
    }
  )

  it.each(shallowCopiers)('%s copies a dense array', (_name, copy) => {
    const source = ['a', 'b', 'c']

    const copied = copy(source)

    expect(copied).toEqual(['a', 'b', 'c'])
    expect(copied).not.toBe(source)
  })
})
