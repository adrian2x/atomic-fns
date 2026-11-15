import { describe, expect, it } from 'vitest'
import {
  assertNotHugeSparse,
  isHugeSparse,
  walkArray
} from '../../src/collections/internal/arrayKeys.ts'
import type { ArrayWalkEvent } from '../../src/internal/sparse.ts'

function events(arr: unknown[], stopAfter = Infinity): ArrayWalkEvent[] {
  const seen: ArrayWalkEvent[] = []
  walkArray(arr, (event) => {
    seen.push(event)
    if (seen.length >= stopAfter) return false
  })
  return seen
}

/** 300 leading holes, values at 300 and 301, a gap, a value at 400, then trailing holes. */
function farSparse(): unknown[] {
  const arr = new Array<unknown>(500)
  arr[300] = 'a'
  arr[301] = 'b'
  arr[400] = 'c'
  Object.assign(arr, { foo: 1, '01': 2, '-1': 3, '4294967295': 4 })
  return arr
}

const farSparseEvents: ArrayWalkEvent[] = [
  { kind: 'holeRun', start: 0, end: 300 },
  { kind: 'value', index: 300, value: 'a' },
  { kind: 'value', index: 301, value: 'b' },
  { kind: 'holeRun', start: 302, end: 400 },
  { kind: 'value', index: 400, value: 'c' },
  { kind: 'holeRun', start: 401, end: 500 }
]

describe('walkArray', () => {
  it('reports dense values and short hole runs index by index', () => {
    // biome-ignore lint/suspicious/noSparseArray: the hole is the point of the test
    expect(events([1, , 3, ,])).toEqual([
      { kind: 'value', index: 0, value: 1 },
      { kind: 'holeRun', start: 1, end: 2 },
      { kind: 'value', index: 2, value: 3 },
      { kind: 'holeRun', start: 3, end: 4 }
    ])
  })

  it('continues over own canonical indices after a long hole run', () => {
    expect(events(farSparse())).toEqual(farSparseEvents)
  })

  it('reports an array with no own indices as one hole run', () => {
    expect(events(new Array(300))).toEqual([{ kind: 'holeRun', start: 0, end: 300 }])
  })

  it('stops when visit returns false', () => {
    expect(events([1, 2, 3], 2)).toHaveLength(2)
    for (let stopAfter = 1; stopAfter <= farSparseEvents.length; stopAfter++) {
      expect(events(farSparse(), stopAfter)).toEqual(farSparseEvents.slice(0, stopAfter))
    }
  })
})

describe('isHugeSparse', () => {
  it('never treats an array at or below 2^24 elements as huge', () => {
    expect(isHugeSparse(new Array(2000))).toBe(false)
    expect(isHugeSparse(new Array(2 ** 24))).toBe(false)
    expect(() => assertNotHugeSparse(new Array(2 ** 24))).not.toThrow()
  })

  it('flags an array past 2^24 elements with few own elements', () => {
    const arr = new Array(2 ** 24 + 2048)
    arr[5] = 1
    arr[2 ** 24] = 2
    expect(isHugeSparse(arr)).toBe(true)
    expect(() => assertNotHugeSparse(arr)).toThrow(new RangeError('sparse array too large'))
  })
})
