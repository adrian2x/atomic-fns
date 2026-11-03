import { describe, expect, it } from 'vitest'
import { Deque } from '../src/collections/deque.js'

describe('Deque', () => {
  it('SPEC-R80 empty starts at size 0', () => {
    expect(new Deque().size).toBe(0)
    expect(new Deque().toArray()).toEqual([])
  })

  it('SPEC-R80 constructor copies iterable values', () => {
    const values = [1, 2, 3, 4]
    const deque = new Deque(values)
    expect([...deque]).toEqual(values)
    expect([...deque.values()]).toEqual(values)
    expect(deque.size).toBe(4)
  })

  it('SPEC-R80 push appends and returns new size', () => {
    const deque = new Deque([1, 2, 3, 4])
    expect(deque.push(5)).toBe(5)
    expect(deque.toArray()).toEqual([1, 2, 3, 4, 5])
  })

  it('SPEC-R80 unshift(a, b) yields [a, b, ...]', () => {
    const deque = new Deque([3])
    expect(deque.unshift(1, 2)).toBe(3)
    expect(deque.toArray()).toEqual([1, 2, 3])
  })

  it('SPEC-R80 unshift single elements prepend in call order', () => {
    const deque = new Deque([1, 2, 3, 4])
    deque.unshift(0)
    deque.unshift(1)
    deque.unshift(1)
    deque.unshift(0)
    expect(deque.toArray()).toEqual([0, 1, 1, 0, 1, 2, 3, 4])
    expect(deque.size).toBe(8)
  })

  it('SPEC-R80 pop removes from the end', () => {
    const deque = new Deque([1, 2, 3, 4])
    expect(deque.pop()).toBe(4)
    expect(deque.pop()).toBe(3)
    expect(deque.pop()).toBe(2)
    expect(deque.pop()).toBe(1)
    expect(deque.pop()).toBeUndefined()
    expect(deque.size).toBe(0)
    expect(deque.toArray()).toEqual([])
  })

  it('SPEC-R80 shift removes from the front', () => {
    const deque = new Deque([1, 2, 3, 4])
    expect(deque.shift()).toBe(1)
    expect(deque.shift()).toBe(2)
    expect(deque.shift()).toBe(3)
    expect(deque.shift()).toBe(4)
    expect(deque.shift()).toBeUndefined()
    expect(deque.size).toBe(0)
  })

  it('SPEC-R80 includes and has use SameValueZero', () => {
    const deque = new Deque([1, 2, NaN, 4])
    expect(deque.includes(2)).toBe(true)
    expect(deque.has(2)).toBe(true)
    expect(deque.includes(NaN)).toBe(true)
    expect(deque.has(9)).toBe(false)
  })

  it('SPEC-R80 at supports negative indices; out of range is undefined', () => {
    const deque = new Deque([1, 2, 3, 4])
    expect(deque.at(0)).toBe(1)
    expect(deque.at(3)).toBe(4)
    expect(deque.at(-1)).toBe(4)
    expect(deque.at(-2)).toBe(3)
    expect(deque.at(99)).toBeUndefined()
    expect(deque.at(-99)).toBeUndefined()
  })

  it('SPEC-R80 at(NaN) treats index as 0', () => {
    const deque = new Deque(['a', 'b'])
    expect(deque.at(NaN)).toBe('a')
  })

  it('SPEC-R80 set replaces in range and returns this', () => {
    const deque = new Deque([1, 2, 3])
    expect(deque.set(1, 9)).toBe(deque)
    expect(deque.toArray()).toEqual([1, 9, 3])
    deque.set(-1, 8)
    expect(deque.toArray()).toEqual([1, 9, 8])
  })

  it('SPEC-R80 set out of range throws RangeError', () => {
    const deque = new Deque([1, 2])
    expect(() => deque.set(2, 9)).toThrow(RangeError)
    expect(() => deque.set(-3, 9)).toThrow(RangeError)
  })

  it('SPEC-R80 clear empties the deque', () => {
    const deque = new Deque([1, 2, 3, 4])
    deque.clear()
    expect(deque.size).toBe(0)
    expect(deque.toArray()).toEqual([])
  })

  it('SPEC-R80 toReversed returns a reversed copy', () => {
    const deque = new Deque([4, 3, 2, 0, 1])
    expect(deque.toReversed()).toEqual([1, 0, 2, 3, 4])
    expect(deque.toArray()).toEqual([4, 3, 2, 0, 1])
  })

  it('SPEC-R80 keys are indices; entries are [i, v]', () => {
    const deque = new Deque(['a', 'b', 'c'])
    expect([...deque.keys()]).toEqual([0, 1, 2])
    expect([...deque.entries()]).toEqual([
      [0, 'a'],
      [1, 'b'],
      [2, 'c']
    ])
  })

  it('SPEC-R80 find and forEach use indices', () => {
    const deque = new Deque([10, 20, 30])
    expect(deque.find((_v, i) => i === 1)).toBe(20)
    expect(deque.find(() => false)).toBeUndefined()
    const seen: [unknown, number][] = []
    deque.forEach((v, i) => {
      seen.push([v, i])
    })
    expect(seen).toEqual([
      [10, 0],
      [20, 1],
      [30, 2]
    ])
  })

  it('SPEC-R80 2000 pushes without maxlen give size 2000', () => {
    const deque = new Deque<number>()
    for (let i = 0; i < 2000; i++) deque.push(i)
    expect(deque.size).toBe(2000)
    expect(deque.at(0)).toBe(0)
    expect(deque.at(-1)).toBe(1999)
  })

  it('SPEC-R80 maxlen eviction keeps the last N after pushes', () => {
    const deque = new Deque<number>([], { maxlen: 3 })
    deque.push(1, 2, 3, 4)
    expect(deque.toArray()).toEqual([2, 3, 4])
    expect(deque.size).toBe(3)
  })

  it('SPEC-R80 maxlen eviction on unshift drops from the end', () => {
    const deque = new Deque([1, 2, 3], { maxlen: 3 })
    deque.unshift(0)
    expect(deque.toArray()).toEqual([0, 1, 2])
  })

  it('SPEC-R80 maxlen 0 makes push and unshift no-ops', () => {
    const deque = new Deque<number>([1, 2], { maxlen: 0 })
    expect(deque.size).toBe(0)
    expect(deque.push(9)).toBe(0)
    expect(deque.unshift(8)).toBe(0)
    expect(deque.toArray()).toEqual([])
  })

  it('SPEC-R80 initial items longer than maxlen keep the last maxlen', () => {
    const deque = new Deque([1, 2, 3, 4, 5], { maxlen: 3 })
    expect(deque.toArray()).toEqual([3, 4, 5])
  })

  it('SPEC-R80 negative or non-integer maxlen throws RangeError', () => {
    expect(() => new Deque([], { maxlen: -1 })).toThrow(RangeError)
    expect(() => new Deque([], { maxlen: 1.5 })).toThrow(RangeError)
    expect(() => new Deque([], { maxlen: NaN })).toThrow(RangeError)
  })

  it('rejects length-driven array-likes before allocating', () => {
    const evil = JSON.parse('{"length":4294967295}') as never
    const start = performance.now()
    expect(() => new Deque(evil)).toThrow(TypeError)
    expect(performance.now() - start).toBeLessThan(5)
  })

  it('SPEC-R80 after pop vacated Array slot is undefined', () => {
    const deque = new Deque([1, 2, 3])
    expect(deque.pop()).toBe(3)
    expect(deque.size).toBe(2)
    expect(deque.at(2)).toBeUndefined()
    // Fill to capacity (8), pop, then grow: vacated slot must not leak into the compacted buffer.
    const d = new Deque<number | undefined>([])
    for (let i = 0; i < 8; i++) d.push(i)
    expect(d.pop()).toBe(7)
    for (let i = 0; i < 8; i++) d.push(100 + i)
    expect(d.toArray()).toEqual([0, 1, 2, 3, 4, 5, 6, 100, 101, 102, 103, 104, 105, 106, 107])
    expect(d.toArray().some((v) => v === undefined)).toBe(false)
  })

  it('SPEC-R80 slot clearing on shift and clear', () => {
    const d = new Deque(['a', 'b', 'c'])
    expect(d.shift()).toBe('a')
    expect(d.at(-1)).toBe('c')
    d.clear()
    expect(d.size).toBe(0)
    expect(d.at(0)).toBeUndefined()
    d.push('z')
    expect(d.toArray()).toEqual(['z'])
  })

  // F-074: WeakRef pins require --expose-gc (vitest.config execArgv).
  function track(d: Deque<object>): WeakRef<object> {
    const obj = { n: 1 }
    d.push(obj)
    return new WeakRef(obj)
  }

  async function awaitCollected(ref: WeakRef<object>): Promise<void> {
    const gc = globalThis.gc
    expect(typeof gc).toBe('function')
    for (let round = 0; round < 10; round++) {
      if (typeof gc === 'function') {
        for (let i = 0; i < 5; i++) {
          gc()
          gc()
        }
      }
      await new Promise<void>((r) => setImmediate(r))
      if (typeof gc === 'function') {
        for (let i = 0; i < 5; i++) gc()
      }
      if (ref.deref() === undefined) return
    }
    expect(ref.deref()).toBeUndefined()
  }

  it('F-074 pop releases the vacated slot for GC', async () => {
    const d = new Deque<object>()
    const ref = track(d)
    void d.pop()
    await awaitCollected(ref)
  })

  it('F-074 shift releases the vacated slot for GC', async () => {
    const d = new Deque<object>()
    const ref = track(d)
    void d.shift()
    await awaitCollected(ref)
  })

  it('F-074 clear releases slots for GC', async () => {
    const d = new Deque<object>()
    const ref = track(d)
    d.clear()
    await awaitCollected(ref)
  })

  it('SPEC-R80 typed backing grows without huge maxlen prealloc', () => {
    const deque = new Deque<number>([], { maxlen: 2 ** 30, arrType: Uint8Array })
    expect(deque.size).toBe(0)
    deque.push(1, 2, 3)
    expect(deque.toArray()).toEqual([1, 2, 3])
    for (let i = 0; i < 20; i++) deque.push(i & 0xff)
    expect(deque.size).toBe(23)
  })

  it('SPEC-R80 typed pop clears vacated slot to 0', () => {
    const deque = new Deque<number>([1, 2, 3], { arrType: Uint8Array })
    expect(deque.pop()).toBe(3)
    deque.push(9)
    expect(deque.toArray()).toEqual([1, 2, 9])
  })

  it('SPEC-R80 differential vs Array model over 5000 random ops', () => {
    const deque = new Deque<number>()
    const model: number[] = []
    const ops = ['push', 'pop', 'shift', 'unshift', 'at', 'set'] as const
    for (let n = 0; n < 5000; n++) {
      const op = ops[n % ops.length]
      const arg = (n * 17 + 3) % 100
      switch (op) {
        case 'push': {
          deque.push(arg)
          model.push(arg)
          break
        }
        case 'unshift': {
          deque.unshift(arg)
          model.unshift(arg)
          break
        }
        case 'pop': {
          expect(deque.pop()).toBe(model.pop())
          break
        }
        case 'shift': {
          expect(deque.shift()).toBe(model.shift())
          break
        }
        case 'at': {
          const i = model.length === 0 ? 0 : (arg % (model.length + 2)) - 1
          expect(deque.at(i)).toBe(model.at(i))
          break
        }
        case 'set': {
          if (model.length === 0) break
          const i = arg % model.length
          expect(deque.set(i, arg)).toBe(deque)
          model[i] = arg
          break
        }
      }
      expect(deque.size).toBe(model.length)
      if (n % 200 === 0) expect(deque.toArray()).toEqual(model)
    }
    expect(deque.toArray()).toEqual(model)
  })
})
