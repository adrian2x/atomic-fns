import vm from 'node:vm'
import { describe, it, expect } from 'vitest'
import { clone, Deque, Heap, LRUCache, SortedMap, Trie } from '../src/collections/index.js'
import { deepEqual, protocol } from '../src/operators/index.js'

describe('clone', () => {
  it('SPEC-R37 shallow typed array isolation ArrayBuffer Date Map', () => {
    const u8 = new Uint8Array([1, 2, 3])
    const c = clone(u8)
    expect(c).not.toBe(u8)
    c[0] = 9
    expect(u8[0]).toBe(1)

    expect(clone(new ArrayBuffer(8)).byteLength).toBe(8)
    expect(clone(new Date(0))).toBeInstanceOf(Date)
    expect(clone(new Date(0)).getTime()).toBe(0)

    const m = new Map([[1, 2]])
    const mc = clone(m)
    expect(mc).not.toBe(m)
    expect([...mc.entries()]).toEqual([[1, 2]])
  })

  it('SPEC-R37 DataView and RegExp lastIndex', () => {
    const buf = new ArrayBuffer(8)
    const dv = new DataView(buf, 2, 4)
    dv.setUint8(0, 7)
    const dvc = clone(dv)
    expect(dvc).toBeInstanceOf(DataView)
    expect(dvc.byteLength).toBe(4)
    expect(dvc.getUint8(0)).toBe(7)
    dvc.setUint8(0, 1)
    expect(dv.getUint8(0)).toBe(7)

    const re = /ab/g
    re.lastIndex = 2
    const rc = clone(re)
    expect(rc).not.toBe(re)
    expect(rc.source).toBe('ab')
    expect(rc.flags).toBe('g')
    expect(rc.lastIndex).toBe(2)
  })

  it('SPEC-R37 private class by reference; string clone ignored', () => {
    class Box {
      #x: number
      constructor(x: number) {
        this.#x = x
      }
      get() {
        return this.#x
      }
    }
    const b = new Box(3)
    expect(clone(b)).toBe(b)
    expect(b.get()).toBe(3)

    const proto = {
      clone() {
        return { cloned: true }
      }
    }
    const o = Object.create(proto) as { a?: number; cloned?: boolean }
    o.a = 1
    const r = clone(o)
    expect(r).toBe(o)
    expect(r.cloned).toBeUndefined()
  })

  it('SPEC-R37 symbol protocol.clone is used', () => {
    const o = {
      [protocol.clone]() {
        return { ok: true }
      }
    }
    expect(clone(o)).toEqual({ ok: true })
  })

  it('SPEC-R37 deep cycles functions and Set Map', () => {
    const a: { self?: object } = {}
    a.self = a
    const c = clone(a, true)
    expect(c.self).toBe(c)

    expect(
      typeof clone(
        {
          f() {
            return undefined
          }
        },
        true
      ).f
    ).toBe('function')
    expect(clone([() => 1], true)[0]()).toBe(1)

    const s = new Set([1, { x: 1 }])
    const sc = clone(s, true)
    expect(sc).not.toBe(s)
    expect(sc.has(1)).toBe(true)
    const obj = [...sc].find((x) => typeof x === 'object') as { x: number }
    expect(obj.x).toBe(1)
    expect(obj).not.toBe([...s].find((x) => typeof x === 'object'))

    const key = { k: 1 }
    const m = new Map([[key, { v: 2 }]])
    const mc = clone(m, true)
    const [[k, v]] = mc
    expect(k).toBe(key)
    expect(mc.get(key)).toEqual({ v: 2 })
    expect(v).not.toBe([...m.values()][0])
    expect(v).toEqual({ v: 2 })
  })

  it('SPEC-R37 primitives symbols and Symbol.iterator', () => {
    expect(clone(1)).toBe(1)
    expect(clone('x')).toBe('x')
    expect(clone(null)).toBe(null)
    expect(clone(Symbol.iterator)).toBe(Symbol.iterator)
    const fn = () => 1
    expect(clone(fn)).toBe(fn)
  })

  it('SPEC-R37 collection equality is order-independent where required', () => {
    expect(deepEqual(new Trie(['ab', 'ac']), new Trie(['ac', 'ab']))).toBe(true)
    expect(deepEqual(new Heap([1, 3, 2]), new Heap([1, 2, 3]))).toBe(true)
    expect(deepEqual(new Heap([1, 1, 2]), new Heap([1, 2, 2]))).toBe(false)
    expect(deepEqual(new Deque([1, 2]), new Deque([2, 1]))).toBe(false)

    const a = new LRUCache<string, number>(4)
    a.set('x', 1)
    a.set('y', 2)
    const b = new LRUCache<string, number>(4)
    b.set('y', 2)
    b.set('x', 1)
    // Touch x on a so recency differs from b.
    expect(a.get('x')).toBe(1)
    expect(deepEqual(a, b)).toBe(true)
  })

  it('SPEC-R37 deep clone of SortedMap deep-clones values; shallow shares them', () => {
    const v = { n: 1 }
    const m = new SortedMap([['k', v]])
    const shallow = clone(m)
    expect(shallow).not.toBe(m)
    expect(shallow.get('k')).toBe(v)

    const deep = clone(m, true)
    expect(deep.get('k')).toEqual({ n: 1 })
    expect(deep.get('k')).not.toBe(v)
  })

  it('clone Buffer copies memory; DataView keeps offset; symbols; match arrays', () => {
    const b = Buffer.from('abc')
    const c = clone(b)
    c[0] = 0x7a
    expect(b.toString()).toBe('abc')
    expect(clone(b, true)[0]).toBe(0x61)

    const inner = Buffer.from('xy')
    const nested = clone({ buf: inner }, true)
    nested.buf[0] = 0x7a
    expect(inner.toString()).toBe('xy')

    const dv = new DataView(new ArrayBuffer(16), 4, 8)
    dv.setUint8(0, 9)
    const dvc = clone(dv)
    expect(dvc.byteOffset).toBe(4)
    expect(dvc.byteLength).toBe(8)
    expect(dvc.buffer.byteLength).toBe(16)
    expect(dvc.getUint8(0)).toBe(9)
    dvc.setUint8(0, 1)
    expect(dv.getUint8(0)).toBe(9)

    const s = Symbol('s')
    expect(clone({ [s]: 1, a: 1 })[s]).toBe(1)
    const srcSym = { [s]: { x: 1 } }
    const deep = clone(srcSym, true)
    expect(deep[s].x).toBe(1)
    expect(deep[s]).not.toBe(srcSym[s])

    const m = /b/.exec('abc')
    expect(m).not.toBeNull()
    if (m === null) return
    const mc = clone(m)
    expect(mc.index).toBe(1)
    expect(mc.input).toBe('abc')
  })
})

describe('clone of builtin subclasses', () => {
  class Registry extends Map<string, number> {}
  class Tags extends Set<string> {}
  class Moment extends Date {}
  class Pattern extends RegExp {}
  class Stack extends Array<number> {}
  class Amount extends Number {}

  it.each([
    ['Map', new Registry([['a', 1]])],
    ['Set', new Tags(['a'])],
    ['Date', new Moment(0)],
    ['RegExp', new Pattern('a')],
    ['Array', Stack.from([1])],
    ['Number', new Amount(1)]
  ])('a %s subclass stays by reference, shallow, deep and nested', (_name, instance) => {
    expect(clone(instance)).toBe(instance)
    expect(clone(instance, true)).toBe(instance)
    expect(clone([instance], true)[0]).toBe(instance)
  })
})

describe('clone brand checks', () => {
  it.each(['Date', 'RegExp', 'Map', 'Set', 'ArrayBuffer', 'DataView', 'Number'])(
    'an object tagged %s is no builtin',
    (tag) => {
      const tagged = { [Symbol.toStringTag]: tag, a: 1 }
      class Tagged {
        get [Symbol.toStringTag](): string {
          return tag
        }
      }
      const instance = new Tagged()
      expect(clone(tagged)).toBe(tagged)
      expect(clone(tagged, true)).toBe(tagged)
      expect(clone(instance)).toBe(instance)
      expect(clone(instance, true)).toBe(instance)
    }
  )
})

describe('clone of Dates', () => {
  it('copies own enumerable keys', () => {
    const s = Symbol('s')
    const when = Object.assign(new Date(0), { x: 1, nested: { y: 2 }, [s]: 3 })
    const shallow = clone(when)
    expect(shallow).not.toBe(when)
    expect(shallow.x).toBe(1)
    expect(shallow[s]).toBe(3)
    expect(shallow.nested).toBe(when.nested)
    const deep = clone(when, true)
    expect(deep.getTime()).toBe(0)
    expect(deep.nested).toEqual({ y: 2 })
    expect(deep.nested).not.toBe(when.nested)
  })
})

describe('clone across realms', () => {
  const foreign = (source: string): object => vm.runInNewContext(source) as object

  it.each([
    ['plain object', '({ a: { b: 1 } })'],
    ['array', '[{ a: 1 }]'],
    ['Date', 'new Date(0)'],
    ['Map', 'new Map([[1, {}]])']
  ])('copies a foreign %s', (_name, source) => {
    const value = foreign(source)
    expect(clone(value)).not.toBe(value)
    expect(clone(value, true)).not.toBe(value)
  })

  it('a deep copy of a foreign object shares nothing with it', () => {
    const value = foreign('({ a: { b: 1 } })') as { a: object }
    expect(clone(value, true).a).not.toBe(value.a)
  })

  it('a foreign subclass stays by reference', () => {
    const value = foreign('new (class Sub extends Map {})()')
    expect(clone(value)).toBe(value)
  })
})
