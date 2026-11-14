import { describe, expect, it } from 'vitest'
import { Deque } from '../../src/collections/index.ts'

describe('Deque', () => {
  it('empty starts at size 0', () => {
    expect(new Deque().size).toBe(0)
    expect([...new Deque()]).toEqual([])
  })

  it('constructor copies iterable values', () => {
    const values = [1, 2, 3, 4]
    const deque = new Deque(values)
    values[0] = 99
    values.push(5)
    expect([...deque]).toStrictEqual([1, 2, 3, 4])
    expect([...deque.values()]).toStrictEqual([1, 2, 3, 4])
    expect(deque.size).toBe(4)
  })

  it('push appends and returns new size', () => {
    const deque = new Deque([1, 2, 3, 4])
    expect(deque.push(5)).toBe(5)
    expect([...deque]).toEqual([1, 2, 3, 4, 5])
  })

  it('unshift(a, b) yields [a, b, ...]', () => {
    const deque = new Deque([3])
    expect(deque.unshift(1, 2)).toBe(3)
    expect([...deque]).toEqual([1, 2, 3])
  })

  it('unshift single elements prepend in call order', () => {
    const deque = new Deque([1, 2, 3, 4])
    deque.unshift(0)
    deque.unshift(1)
    deque.unshift(1)
    deque.unshift(0)
    expect([...deque]).toEqual([0, 1, 1, 0, 1, 2, 3, 4])
    expect(deque.size).toBe(8)
  })

  it('pop removes from the end', () => {
    const deque = new Deque([1, 2, 3, 4])
    expect(deque.pop()).toBe(4)
    expect(deque.pop()).toBe(3)
    expect(deque.pop()).toBe(2)
    expect(deque.pop()).toBe(1)
    expect(deque.pop()).toBeUndefined()
    expect(deque.size).toBe(0)
    expect([...deque]).toEqual([])
  })

  it('shift removes from the front', () => {
    const deque = new Deque([1, 2, 3, 4])
    expect(deque.shift()).toBe(1)
    expect(deque.shift()).toBe(2)
    expect(deque.shift()).toBe(3)
    expect(deque.shift()).toBe(4)
    expect(deque.shift()).toBeUndefined()
    expect(deque.size).toBe(0)
  })

  it('includes uses SameValueZero', () => {
    const deque = new Deque([1, 2, NaN, 4])
    expect(deque.includes(2)).toBe(true)
    expect(deque.includes(NaN)).toBe(true)
    expect(deque.includes(3)).toBe(false)
    expect(new Deque([0]).includes(-0)).toBe(true)
  })

  it('at supports negative indices; out of range is undefined', () => {
    const deque = new Deque([1, 2, 3, 4])
    expect(deque.at(0)).toBe(1)
    expect(deque.at(3)).toBe(4)
    expect(deque.at(-1)).toBe(4)
    expect(deque.at(-2)).toBe(3)
    expect(deque.at(99)).toBeUndefined()
    expect(deque.at(-99)).toBeUndefined()
  })

  it('set replaces in range and returns this', () => {
    const deque = new Deque([1, 2, 3])
    expect(deque.set(1, 9)).toBe(deque)
    expect([...deque]).toEqual([1, 9, 3])
    deque.set(-1, 8)
    expect([...deque]).toEqual([1, 9, 8])
  })

  it('set out of range throws RangeError', () => {
    const deque = new Deque([1, 2])
    expect(() => deque.set(2, 9)).toThrow(RangeError)
    expect(() => deque.set(-3, 9)).toThrow(RangeError)
    expect(() => deque.set(Infinity, 9)).toThrow(new RangeError('index Infinity out of range'))
  })

  it('clear empties the deque', () => {
    const deque = new Deque([1, 2, 3, 4])
    deque.clear()
    expect(deque.size).toBe(0)
    expect([...deque]).toEqual([])
  })

  it('keys are indices; entries are [i, v]', () => {
    const deque = new Deque(['a', 'b', 'c'])
    expect([...deque.keys()]).toEqual([0, 1, 2])
    expect([...deque.entries()]).toEqual([
      [0, 'a'],
      [1, 'b'],
      [2, 'c']
    ])
  })

  it('2000 pushes without maxlen give size 2000', () => {
    const deque = new Deque<number>()
    for (let i = 0; i < 2000; i++) deque.push(i)
    expect(deque.size).toBe(2000)
    expect(deque.at(0)).toBe(0)
    expect(deque.at(-1)).toBe(1999)
  })

  it('maxlen eviction keeps the last N after pushes', () => {
    const deque = new Deque<number>([], { maxlen: 3 })
    deque.push(1, 2, 3, 4)
    expect([...deque]).toEqual([2, 3, 4])
    expect(deque.size).toBe(3)
  })

  it('maxlen eviction on unshift drops from the end', () => {
    const deque = new Deque([1, 2, 3], { maxlen: 3 })
    deque.unshift(0)
    expect([...deque]).toEqual([0, 1, 2])
  })

  it('maxlen 0 makes push and unshift no-ops', () => {
    const deque = new Deque<number>([1, 2], { maxlen: 0 })
    expect(deque.size).toBe(0)
    expect(deque.push(9)).toBe(0)
    expect(deque.unshift(8)).toBe(0)
    expect([...deque]).toEqual([])
  })

  it('initial items longer than maxlen keep the last maxlen', () => {
    const deque = new Deque([1, 2, 3, 4, 5], { maxlen: 3 })
    expect([...deque]).toEqual([3, 4, 5])
  })

  it('negative or non-integer maxlen throws RangeError', () => {
    expect(() => new Deque([], { maxlen: -1 })).toThrow(RangeError)
    expect(() => new Deque([], { maxlen: 1.5 })).toThrow(RangeError)
    expect(() => new Deque([], { maxlen: NaN })).toThrow(RangeError)
  })

  it('a maxlen that is not a number throws TypeError', () => {
    for (const maxlen of ['3', 3n, true, {}, [3]]) {
      expect(() => new Deque([], { maxlen: maxlen as never })).toThrow(
        new TypeError('maxlen must be a number')
      )
    }
  })

  it('maxlen above Number.MAX_SAFE_INTEGER throws RangeError', () => {
    expect(() => new Deque([], { maxlen: 2 ** 53 })).toThrow(RangeError)
  })

  it('maxlen Infinity means unbounded', () => {
    const deque = new Deque([1, 2], { maxlen: Infinity })
    expect(deque.maxlen).toBeUndefined()
    for (let i = 3; i <= 20; i++) deque.push(i)
    expect([...deque]).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
  })

  it('rejects a non-iterable array-like', () => {
    const evil = JSON.parse('{"length":4294967295}') as never
    expect(() => new Deque(evil)).toThrow(TypeError)
  })

  it('refuses huge sparse arrays before allocating', () => {
    const sparse = new Array<number>(2 ** 24 + 2048)
    expect(() => new Deque(sparse)).toThrow(new RangeError('sparse array too large'))
    const longest = new Array<number>(2 ** 32 - 1)
    expect(() => new Deque(longest)).toThrow(new RangeError('sparse array too large'))
    expect(() => new Deque(longest, { arrType: Float64Array })).toThrow(
      new RangeError('sparse array too large')
    )
  })

  it('reads an array through its own Symbol.iterator, even a huge sparse one', () => {
    const custom = Object.defineProperty(new Array<number>(2 ** 24 + 2048), Symbol.iterator, {
      value: function* () {
        yield 7
        yield 8
      }
    })
    expect([...new Deque(custom)]).toEqual([7, 8])
  })

  it('a huge maxlen grows by doubling without overwriting live slots', () => {
    for (const maxlen of [2 ** 31, Number.MAX_SAFE_INTEGER]) {
      const d = new Deque<number>([], { maxlen })
      for (let i = 0; i < 20; i++) d.push(i)
      expect([...d]).toEqual([...Array(20).keys()])
    }
    const small = new Deque<number>([], { maxlen: 3 })
    small.push(0, 1, 2, 3, 4)
    expect([...small]).toEqual([2, 3, 4])
  })

  it('pop shrinks the range, and growing after a pop copies live slots only', () => {
    const deque = new Deque([1, 2, 3])
    expect(deque.pop()).toBe(3)
    expect(deque.size).toBe(2)
    expect(deque.at(2)).toBeUndefined()
    const d = new Deque<number | undefined>([])
    for (let i = 0; i < 8; i++) d.push(i)
    expect(d.pop()).toBe(7)
    for (let i = 0; i < 8; i++) d.push(100 + i)
    expect([...d]).toEqual([0, 1, 2, 3, 4, 5, 6, 100, 101, 102, 103, 104, 105, 106, 107])
  })

  it('shift then clear leaves an empty deque that refills', () => {
    const d = new Deque(['a', 'b', 'c'])
    expect(d.shift()).toBe('a')
    expect(d.at(-1)).toBe('c')
    d.clear()
    expect(d.size).toBe(0)
    expect(d.at(0)).toBeUndefined()
    d.push('z')
    expect([...d]).toEqual(['z'])
  })

  function track(d: Deque<object>): WeakRef<object> {
    const obj = { n: 1 }
    d.push(obj)
    return new WeakRef(obj)
  }

  async function awaitCollected(ref: WeakRef<object>): Promise<void> {
    const gc = globalThis.gc
    if (typeof gc !== 'function') throw new Error('run with --expose-gc')
    for (let round = 0; round < 10 && ref.deref() !== undefined; round++) {
      gc()
      await new Promise<void>((r) => setImmediate(r))
      gc()
    }
    expect(ref.deref()).toBeUndefined()
  }

  it.each(['pop', 'shift', 'clear'] as const)('%s releases slots for GC', async (method) => {
    const d = new Deque<object>()
    const ref = track(d)
    void d[method]()
    await awaitCollected(ref)
    expect(d.size).toBe(0)
    d.push({ n: 2 })
    expect([...d]).toStrictEqual([{ n: 2 }])
  })

  it('typed backing grows without huge maxlen prealloc', () => {
    const deque = new Deque<number>([], { maxlen: 2 ** 30, arrType: Uint8Array })
    expect(deque.size).toBe(0)
    deque.push(1, 2, 3)
    expect([...deque]).toEqual([1, 2, 3])
    for (let i = 0; i < 20; i++) deque.push(i & 0xff)
    expect(deque.size).toBe(23)
  })

  it('typed storage preserves contents through removals and evictions', () => {
    const deque = new Deque<number>([1, 2, 3], { arrType: Uint8Array })
    expect(deque.pop()).toBe(3)
    expect(deque.shift()).toBe(1)
    expect([...deque]).toStrictEqual([2])

    const ring = new Deque<number>([1, 2, 3], { arrType: Uint8Array, maxlen: 3 })
    ring.push(4)
    expect([...ring]).toStrictEqual([2, 3, 4])
    ring.unshift(9)
    expect([...ring]).toStrictEqual([9, 2, 3])
  })

  it('a value typed storage rejects leaves the deque unchanged', () => {
    const open = new Deque([1n, 2n, 3n], { arrType: BigInt64Array })
    expect(() => open.unshift(5 as never)).toThrow(TypeError)
    expect(() => open.push(5 as never)).toThrow(TypeError)
    expect([...open]).toEqual([1n, 2n, 3n])
    open.push(4n)
    expect([...open]).toEqual([1n, 2n, 3n, 4n])

    // maxlen 3 leaves free slots in the 8-slot buffer; maxlen 8 fills it.
    for (const maxlen of [3, 8]) {
      const items = Array.from({ length: maxlen }, (_, i) => BigInt(i + 1))
      const ring = new Deque(items, { arrType: BigInt64Array, maxlen })
      ring.shift()
      ring.push(BigInt(maxlen + 1))
      const before = [...ring]
      expect(() => ring.push(0 as never)).toThrow(TypeError)
      expect(() => ring.unshift(0 as never)).toThrow(TypeError)
      expect([...ring]).toEqual(before)
      expect(ring.size).toBe(maxlen)
    }
  })

  it('BigInt storage clears vacated slots with its own zero', () => {
    const deque = new Deque([1n, 2n, 3n], { arrType: BigInt64Array, maxlen: 3 })
    expect(deque.pop()).toBe(3n)
    expect(deque.shift()).toBe(1n)
    deque.push(4n, 5n, 6n)
    expect([...deque]).toEqual([4n, 5n, 6n])
    const over = new Deque([1n, 2n, 3n], { arrType: BigUint64Array, maxlen: 2 })
    expect([...over]).toEqual([2n, 3n])
  })

  it('at and set coerce an index as Array.prototype.at does', () => {
    const values = [10, 20, 30]
    const deque = new Deque(values)
    const indices = [undefined, null, 'x', '1', {}, [], true, NaN, -0, 0.5, -0.5, -1.5] as number[]
    for (const index of indices) expect(deque.at(index)).toBe(values.at(index))
    const unset = [undefined, 'x', {}] as number[]
    for (const index of unset) {
      expect([...new Deque([1, 2]).set(index, 9)]).toEqual([9, 2])
    }
  })

  it('a set out of range names the index the caller passed', () => {
    expect(() => new Deque([1, 2, 3]).set(-10, 0)).toThrow(new RangeError('index -10 out of range'))
  })

  it('maxlen null means unbounded', () => {
    const deque = new Deque([1, 2], { maxlen: null })
    expect(deque.maxlen).toBeUndefined()
    expect(deque.push(3)).toBe(3)
  })

  it('reads an iterable one item at a time, so maxlen bounds its memory', () => {
    const log: string[] = []
    function* rows(): Generator<number> {
      for (const n of [1, 2]) {
        log.push(`yield ${String(n)}`)
        const row = {
          valueOf(): number {
            log.push(`store ${String(n)}`)
            return n
          }
        }
        yield row as unknown as number
      }
    }
    const deque = new Deque(rows(), { arrType: Float64Array, maxlen: 1 })
    expect(log).toEqual(['yield 1', 'store 1', 'yield 2', 'store 2'])
    expect([...deque]).toEqual([2])
  })

  it('clear after growth leaves a deque that refills', () => {
    const deque = new Deque<number>()
    for (let i = 0; i < 17; i++) deque.push(i)
    deque.clear()
    expect([...deque]).toStrictEqual([])
    for (let i = 0; i < 20; i++) deque.push(i)
    expect([...deque]).toStrictEqual(Array.from({ length: 20 }, (_, i) => i))
  })

  it('differential vs Array model over 5000 seeded random ops', () => {
    // mulberry32: a fixed seed keeps a failure reproducible.
    let seed = 0x9e3779b9
    const random = (): number => {
      seed = (seed + 0x6d2b79f5) | 0
      let t = Math.imul(seed ^ (seed >>> 15), seed | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32
    }
    // Weighted toward inserts so the size passes 8, 16, 32 and 64 with the head mid-buffer.
    const ops = [
      'push',
      'push',
      'push',
      'unshift',
      'unshift',
      'unshift',
      'pop',
      'shift',
      'at',
      'set'
    ] as const
    const deque = new Deque<number>()
    const model: number[] = []
    let maxSize = 0
    for (let n = 0; n < 5000; n++) {
      if (n === 2500) {
        deque.clear()
        model.length = 0
      }
      const op = ops[Math.floor(random() * ops.length)]
      const arg = Math.floor(random() * 100)
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
      maxSize = Math.max(maxSize, model.length)
      if (n % 50 === 0) expect([...deque]).toEqual(model)
    }
    expect([...deque]).toEqual(model)
    expect(maxSize).toBeGreaterThan(64)
  })

  it('grows with the head wrapped, on push and on unshift', () => {
    const pushed = new Deque([1, 2, 3, 4, 5, 6, 7, 8])
    pushed.shift()
    pushed.shift()
    pushed.shift()
    pushed.push(9, 10, 11, 12)
    expect(pushed.size).toBe(9)
    expect([...pushed]).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 12])

    const unshifted = new Deque([1, 2, 3, 4, 5, 6, 7, 8])
    unshifted.shift()
    unshifted.shift()
    unshifted.push(9, 10)
    unshifted.unshift(0)
    expect([...unshifted]).toEqual([0, 3, 4, 5, 6, 7, 8, 9, 10])
    unshifted.push(11)
    unshifted.unshift(-1)
    expect([...unshifted]).toEqual([-1, 0, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    expect(unshifted.at(0)).toBe(-1)
    expect(unshifted.at(-1)).toBe(11)
  })

  it('maxlen evicts oldest values after growth', () => {
    const deque = new Deque<number>([], { maxlen: 10 })
    for (let i = 0; i < 12; i++) deque.push(i)
    expect([...deque]).toStrictEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
  })

  it('set after shift and wrap-around', () => {
    const deque = new Deque([1, 2, 3])
    deque.shift()
    deque.set(0, 9)
    expect([...deque]).toEqual([9, 3])
    deque.set(-1, 8)
    expect([...deque]).toEqual([9, 8])

    const ring = new Deque<number>([], { maxlen: 4 })
    for (const value of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      ring.push(value)
    }
    expect([0, 1, 2, 3].map((i) => ring.at(i))).toStrictEqual([7, 8, 9, 10])
    expect([-1, -2, -3, -4].map((i) => ring.at(i))).toStrictEqual([10, 9, 8, 7])
    ring.set(0, 70)
    ring.set(3, 100)
    expect([...ring]).toStrictEqual([70, 8, 9, 100])
  })

  it('at with a negative index after shift', () => {
    const deque = new Deque([1, 2, 3, 4])
    deque.shift()
    deque.shift()
    expect(deque.at(-1)).toBe(4)
    expect(deque.at(-2)).toBe(3)
  })

  it('at out of range after pop and shift', () => {
    const deque = new Deque([1, 2, 3])
    deque.pop()
    expect(deque.at(2)).toBeUndefined()
    expect(deque.at(-3)).toBeUndefined()
    deque.shift()
    expect(deque.at(1)).toBeUndefined()
    expect(deque.at(-2)).toBeUndefined()
  })
})

describe('Deque iteration', () => {
  it('spreads front to back and forEach passes the deque', () => {
    const deque = new Deque(['a', 'b'])
    deque.unshift('z')
    expect([...deque]).toEqual(['z', 'a', 'b'])
    expect(Array.from(deque).reverse()).toEqual(['b', 'a', 'z'])
    const seen: unknown[] = []
    deque.forEach(function (this: unknown, value, index, d) {
      seen.push([value, index, d === deque, this])
    }, 'ctx')
    expect(seen).toEqual([
      ['z', 0, true, 'ctx'],
      ['a', 1, true, 'ctx'],
      ['b', 2, true, 'ctx']
    ])
    expect(Object.prototype.toString.call(deque)).toBe('[object Deque]')
    expect(Reflect.ownKeys(deque)).toEqual([])
  })
})
