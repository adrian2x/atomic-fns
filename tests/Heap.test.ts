import { describe, expect, it } from 'vitest'
import { Heap, heapify, heappop, heappush } from '../src/collections/Heap.js'
import { sorted } from '../src/itertools/index.js'
import { expectFast } from './helpers/perf.js'

describe('Heap', () => {
  it('SPEC-R83 empty heap', () => {
    const h = new Heap()
    expect(h.size).toBe(0)
    expect(h.peek()).toBeUndefined()
    expect(h.pop()).toBeUndefined()
    expect(h.has(1)).toBe(false)
  })

  it('rejects length-driven array-likes before allocating', () => {
    const evil = JSON.parse('{"length":4294967295}') as never
    expectFast(() => {
      expect(() => new Heap(evil)).toThrow(TypeError)
    }, 1000)
  })

  it('SPEC-R83 heapifies a copied array and pops in order', () => {
    const arr = [7, 9, 3, 5, 8, 1, 2, 6, 4]
    const h = new Heap(arr)
    expect([...h.values()]).not.toEqual([])
    for (const x of sorted(arr)) {
      expect(h.has(x)).toBe(true)
      expect(h.pop()).toBe(x)
    }
    expect(h.size).toBe(0)
  })

  it('SPEC-R83 no aliasing of source array', () => {
    const arr = [3, 1, 2]
    const h = new Heap(arr)
    arr[0] = 99
    arr.push(100)
    expect(h.size).toBe(3)
    expect(h.has(99)).toBe(false)
    expect(sorted(h)).toEqual([1, 2, 3])
  })

  it('SPEC-R83 max-heap with custom comparator', () => {
    const arr = [7, 9, 3, 5, 8, 1, 2, 6, 4]
    const h = new Heap(arr, (x, y) => {
      if (x > y) return -1
      if (x < y) return 1
      return 0
    })
    for (const x of sorted(arr, true)) {
      expect(h.has(x)).toBe(true)
      expect(h.pop()).toBe(x)
    }
  })

  it('SPEC-R83 push and peek', () => {
    const h = new Heap()
    const arr = [7, 9, 3, 5, 8, 1, 2, 6, 4]
    for (const value of arr) {
      expect(h.push(value)).toBe(h.size)
      expect(h.has(value)).toBe(true)
    }
    expect(h.size).toBe(arr.length)
    expect(h.peek()).toBe(1)
    expect(h.size).toBe(arr.length)
  })

  it('SPEC-R83 pop removes the top', () => {
    const h = new Heap()
    for (const value of [7, 9, 3, 5, 8, 1, 2, 6, 4]) h.push(value)
    expect(h.pop()).toBe(1)
    expect(h.size).toBe(8)
    expect(h.pop()).toBe(2)
  })

  it('SPEC-R83 delete removes a middle element', () => {
    const h = new Heap([7, 9, 3, 5, 8, 1, 2, 6, 4])
    expect(h.delete(5)).toBe(true)
    expect(h.has(5)).toBe(false)
    expect(h.size).toBe(8)
    expect(h.delete(5)).toBe(false)
    expect([...sorted(h)]).toEqual([1, 2, 3, 4, 6, 7, 8, 9])
  })

  it('SPEC-R83 delete top and last', () => {
    const h = new Heap([1, 2, 3])
    expect(h.delete(1)).toBe(true)
    expect(h.peek()).toBe(2)
    const h2 = new Heap([1, 2, 3])
    const last = [...h2.values()].at(-1)
    if (last === undefined) throw new Error('heap empty')
    expect(h2.delete(last)).toBe(true)
    expect(h2.size).toBe(2)
  })

  it('SPEC-R83 has and delete agree on NaN (SameValueZero)', () => {
    const h = new Heap([1, NaN, 2])
    expect(h.has(NaN)).toBe(true)
    expect(h.delete(NaN)).toBe(true)
    expect(h.has(NaN)).toBe(false)
    expect(h.size).toBe(2)
  })

  it('SPEC-R83 has and delete treat 0 and -0 as equal', () => {
    const h = new Heap([0, 1])
    expect(h.has(-0)).toBe(true)
    expect(h.delete(-0)).toBe(true)
    expect(h.has(0)).toBe(false)
  })

  it('SPEC-R83 fuzz vs sorted reference over 300 trials', () => {
    for (let trial = 0; trial < 300; trial++) {
      const n = 1 + (trial % 40)
      const values: number[] = []
      for (let i = 0; i < n; i++) values.push(((trial * 17 + i * 31) % 97) - 40)
      const h = new Heap(values)
      const ref = sorted(values)
      if (trial % 3 === 0 && values.length > 0) {
        const victim = values[trial % values.length]
        h.delete(victim)
        const idx = ref.indexOf(victim)
        if (idx >= 0) ref.splice(idx, 1)
      }
      const got: number[] = []
      while (h.size) {
        const next = h.pop()
        if (next === undefined) throw new Error('heap empty')
        got.push(next)
      }
      expect(got).toEqual(ref)
    }
  })

  it('SPEC-R83 throwing comparator on push leaves heap unchanged', () => {
    const cmp = (a: number, b: number) => {
      if (a === 99 || b === 99) throw new Error('cmp boom')
      return a - b
    }
    const h = new Heap([1, 3, 5], cmp)
    const snap = [...h]
    expect(() => h.push(99)).toThrow('cmp boom')
    expect([...h]).toEqual(snap)
  })

  it('SPEC-R83 throwing comparator on pop leaves heap unchanged', () => {
    let armed = false
    const cmp = (a: number, b: number) => {
      if (armed) throw new Error('pop boom')
      return a - b
    }
    const h = new Heap([1, 2, 3, 4, 5], cmp)
    armed = true
    const snap = [...h]
    expect(() => h.pop()).toThrow('pop boom')
    expect([...h]).toEqual(snap)
  })

  it('SPEC-R83 clear empties the heap', () => {
    const h = new Heap([1, 2, 3])
    h.clear()
    expect(h.size).toBe(0)
    expect(h.pop()).toBeUndefined()
  })

  it('SPEC-R83 heapify heappush heappop free functions', () => {
    const arr = [4, 1, 3, 2]
    heapify(arr)
    heappush(arr, 0)
    expect(heappop(arr)).toBe(0)
    expect(heappop(arr)).toBe(1)
  })

  it('SPEC-R83 toStringTag is Heap', () => {
    expect(Object.prototype.toString.call(new Heap())).toBe('[object Heap]')
  })
})
