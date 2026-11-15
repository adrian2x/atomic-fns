import { describe, expect, it } from 'vitest'
import { Heap } from '../../src/collections/index.ts'

const ascending = (a: number, b: number): number => a - b
const sorted = (items: Iterable<number>, reverse = false): number[] =>
  [...items].toSorted(reverse ? (a, b) => b - a : ascending)
const drain = (h: Heap<number>): number[] => {
  const out: number[] = []
  while (h.size) {
    const next = h.pop()
    if (next === undefined) throw new Error('heap empty')
    out.push(next)
  }
  return out
}
/** Whether heap-order iteration satisfies the min-heap property. */
const isMinHeap = (h: Heap<number>): boolean => {
  const items = [...h]
  return items.every((item, index) => index === 0 || items[(index - 1) >> 1] <= item)
}
/** A numeric comparator whose `n`th call after `arm()` throws. */
const throwsOnArmedCall = (n: number) => {
  let armed = false
  let calls = 0
  return {
    arm: (): void => {
      armed = true
    },
    compare: (a: number, b: number): number => {
      if (armed && ++calls === n) throw new Error('mid-sift boom')
      return a - b
    }
  }
}

describe('Heap', () => {
  it('empty heap', () => {
    const h = new Heap()
    expect(h.size).toBe(0)
    expect(h.peek()).toBeUndefined()
    expect(h.pop()).toBeUndefined()
    expect(h.has(1)).toBe(false)
  })

  it('rejects length-driven array-likes before allocating', () => {
    const evil = JSON.parse('{"length":4294967295}') as never
    expect(() => new Heap(evil)).toThrow(TypeError)
  })

  it.each([false, true])('heapifies and pops in order (max=%s)', (max) => {
    const arr = [7, 9, 3, 5, 8, 1, 2, 6, 4]
    const h = new Heap(arr, max ? (a, b) => b - a : undefined)
    for (const x of sorted(arr, max)) {
      expect(h.has(x)).toBe(true)
      expect(h.pop()).toBe(x)
    }
    expect(h.size).toBe(0)
  })

  it('no aliasing of source array', () => {
    const arr = [3, 1, 2]
    const h = new Heap(arr)
    arr[0] = 99
    arr.push(100)
    expect(h.size).toBe(3)
    expect(h.has(99)).toBe(false)
    expect(sorted(h)).toEqual([1, 2, 3])
  })

  it('push and peek', () => {
    const h = new Heap()
    const arr = [7, 9, 3, 5, 8, 1, 2, 6, 4]
    for (const [index, value] of arr.entries()) {
      expect(h.push(value)).toBe(index + 1)
      expect(h.has(value)).toBe(true)
    }
    expect(h.size).toBe(arr.length)
    expect(h.peek()).toBe(1)
    expect(h.size).toBe(arr.length)
  })

  it('pop removes the top', () => {
    const h = new Heap()
    for (const value of [7, 9, 3, 5, 8, 1, 2, 6, 4]) h.push(value)
    expect(h.pop()).toBe(1)
    expect(h.size).toBe(8)
    expect(h.pop()).toBe(2)
  })

  it('delete removes a middle element', () => {
    const h = new Heap([7, 9, 3, 5, 8, 1, 2, 6, 4])
    expect(h.delete(5)).toBe(true)
    expect(h.has(5)).toBe(false)
    expect(h.size).toBe(8)
    expect(h.delete(5)).toBe(false)
    expect(sorted(h)).toEqual([1, 2, 3, 4, 6, 7, 8, 9])
  })

  it('delete removes the top', () => {
    const h = new Heap([1, 2, 3])
    expect(h.delete(1)).toBe(true)
    expect(h.peek()).toBe(2)
  })

  it('delete removes the last element', () => {
    const h = new Heap([1, 2, 3])
    const last = [...h.values()].at(-1)
    if (last === undefined) throw new Error('heap empty')
    expect(h.delete(last)).toBe(true)
    expect([...h]).toEqual([1, 2])
    expect(h.has(3)).toBe(false)
  })

  it('delete sifts the moved last element up when it is smaller than its new parent', () => {
    const h = new Heap([0, 10, 1, 11, 12, 5, 3])
    expect(h.delete(11)).toBe(true)
    expect(isMinHeap(h)).toBe(true)
    expect(drain(h)).toEqual([0, 1, 3, 5, 10, 12])
  })

  it('has and delete agree on NaN (SameValueZero)', () => {
    const nanFirst = (a: number, b: number): number =>
      Number.isNaN(a) ? (Number.isNaN(b) ? 0 : -1) : Number.isNaN(b) ? 1 : a - b
    expect(() => new Heap([1, NaN, 2])).toThrow(RangeError)
    const h = new Heap([1, NaN, 2], nanFirst)
    expect(h.has(NaN)).toBe(true)
    expect(h.delete(NaN)).toBe(true)
    expect(h.has(NaN)).toBe(false)
    expect(h.size).toBe(2)
  })

  it('has and delete treat 0 and -0 as equal', () => {
    const h = new Heap([0, 1])
    expect(h.has(-0)).toBe(true)
    expect(h.delete(-0)).toBe(true)
    expect(h.has(0)).toBe(false)
  })

  it('fuzz vs sorted reference over 300 trials', () => {
    for (let trial = 0; trial < 300; trial++) {
      const n = 1 + (trial % 40)
      const values: number[] = []
      for (let i = 0; i < n; i++) values.push(((trial * 17 + i * 31) % 97) - 40)
      const h = new Heap(values)
      const ref = sorted(values)
      if (trial % 3 === 0) {
        const victim = values[trial % values.length]
        expect(h.delete(victim)).toBe(true)
        expect(isMinHeap(h)).toBe(true)
        ref.splice(ref.indexOf(victim), 1)
      }
      expect(drain(h)).toEqual(ref)
    }
  })

  it('throwing comparator on push leaves heap unchanged', () => {
    const cmp = (a: number, b: number) => {
      if (a === 99 || b === 99) throw new Error('cmp boom')
      return a - b
    }
    const h = new Heap([1, 3, 5], cmp)
    const snap = [...h]
    expect(() => h.push(99)).toThrow('cmp boom')
    expect([...h]).toEqual(snap)
  })

  it('throwing comparator on a push of several items adds none of them', () => {
    const cmp = (a: number, b: number) => {
      if (a === 99 || b === 99) throw new Error('cmp boom')
      return a - b
    }
    const h = new Heap([1, 5], cmp)
    const snap = [...h]
    expect(() => h.push(3, 0, 99)).toThrow('cmp boom')
    expect([...h]).toEqual(snap)
    expect(h.has(3)).toBe(false)
    expect(h.has(0)).toBe(false)
    expect(h.push(3, 0)).toBe(4)
    expect(drain(h)).toEqual([0, 1, 3, 5])
  })

  it.each(['push', 'pop'] as const)(
    'comparator throwing mid-sift on %s leaves heap unchanged',
    (method) => {
      const { arm, compare } = throwsOnArmedCall(3)
      const h = new Heap(
        Array.from({ length: 15 }, (_, i) => i + 1),
        compare
      )
      const snap = [...h]
      arm()
      expect(() => (method === 'push' ? h.push(0) : h.pop())).toThrow('mid-sift boom')
      expect([...h]).toStrictEqual(snap)
    }
  )

  it('push of several items returns the new size', () => {
    const h = new Heap<number>()
    expect(h.push(3, 1, 2)).toBe(3)
    expect(h.push()).toBe(3)
    expect(sorted(h)).toEqual([1, 2, 3])
    expect(h.peek()).toBe(1)
  })

  it('null items and a null comparator mean omitted', () => {
    expect(new Heap(null).size).toBe(0)
    expect([...new Heap([2, 1], null)]).toEqual([1, 2])
  })

  it('refuses huge sparse arrays', () => {
    const sparse = new Array<number>(2 ** 24 + 2048)
    expect(() => new Heap(sparse)).toThrow(new RangeError('sparse array too large'))
  })

  it('clear empties the heap', () => {
    const h = new Heap([1, 2, 3])
    h.clear()
    expect(h.size).toBe(0)
    expect(h.pop()).toBeUndefined()
  })

  it('orders primitives by default and asks for a comparator otherwise', () => {
    expect(new Heap(['b', 'a', 'c']).peek()).toBe('a')
    expect(new Heap([3n, 1, 2n]).peek()).toBe(1)
    expect(() => new Heap([{ n: 2 }, { n: 1 }])).toThrow(/pass a comparator/)
    expect(() => new Heap([1, null])).toThrow(TypeError)
    expect(() => new Heap([undefined, 1])).toThrow(TypeError)
    expect(() => new Heap([NaN])).toThrow(RangeError)
    expect(() => new Heap([null])).toThrow(TypeError)
    expect(() => new Heap<unknown>().push(undefined)).toThrow(TypeError)
    const h = new Heap<unknown>([1])
    expect(() => h.push(2, NaN)).toThrow(RangeError)
    expect([...h]).toEqual([1])
    const rows = new Heap([{ n: 2 }, { n: 1 }], (a, b) => a.n - b.n)
    expect(rows.pop()).toEqual({ n: 1 })
  })

  it('keys, entries and forEach follow Set', () => {
    const h = new Heap([2, 1])
    expect([...h.keys()]).toEqual([...h.values()])
    expect([...h.entries()]).toEqual([
      [1, 1],
      [2, 2]
    ])
    const seen: unknown[] = []
    h.forEach(function (this: unknown, value, key, heap) {
      seen.push([value, key, heap === h, this])
    }, 'ctx')
    expect(seen).toEqual([
      [1, 1, true, 'ctx'],
      [2, 2, true, 'ctx']
    ])
  })

  it('toStringTag is Heap', () => {
    expect(Object.prototype.toString.call(new Heap())).toBe('[object Heap]')
    expect(Reflect.ownKeys(new Heap())).toEqual([])
  })

  it('rejects a comparator that is not a function', () => {
    expect(() => new Heap([], 1 as never)).toThrow(new TypeError('comparator must be a function'))
  })
})
