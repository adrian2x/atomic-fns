import { describe, it, expect } from 'vitest'
import { clone } from '../src/collections/index.js'
import { protocol } from '../src/operators/index.js'

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
    const o = Object.create(proto)
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

    expect(typeof clone({ f() {} }, true).f).toBe('function')
    expect(clone([() => 1], true)[0]()).toBe(1)

    const s = new Set([1, { x: 1 }])
    const sc = clone(s, true)
    expect(sc).not.toBe(s)
    expect(sc.has(1)).toBe(true)
    const obj = [...sc].find((x) => typeof x === 'object') as { x: number }
    expect(obj.x).toBe(1)
    expect(obj).not.toBe([...s].find((x) => typeof x === 'object'))

    const m = new Map([[{ k: 1 }, { v: 2 }]])
    const mc = clone(m, true)
    const [[k, v]] = mc
    expect(k).not.toBe([...m.keys()][0])
    expect(v).not.toBe([...m.values()][0])
    expect(k).toEqual({ k: 1 })
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
})
