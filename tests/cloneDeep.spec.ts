import vm from 'node:vm'
import { describe, expect, it } from 'vitest'
import { DEPTH_ERROR } from '../src/internal/walk.ts'
import { cloneDeep, isEqual } from '../src/object/index.ts'
import { sparse } from './sparse.ts'

const tag = Symbol('tag')

class MyArray extends Array<unknown> {}
class MyMap extends Map<unknown, unknown> {}
class MySet extends Set<unknown> {}
class MyDate extends Date {}
class MyRegExp extends RegExp {}
class MyBuffer extends ArrayBuffer {}
class MyShared extends SharedArrayBuffer {}
class MyBytes extends Uint8Array {}
class MyView extends DataView<ArrayBuffer> {}

/** A subclass instance of each copied kind, and whether its own string keys are copied. */
const SUBCLASSED: ReadonlyArray<readonly [string, () => object, boolean]> = [
  ['Array', () => MyArray.from([1]), true],
  ['Map', () => new MyMap([[1, 1]]), true],
  ['Set', () => new MySet([1]), true],
  ['Date', () => new MyDate(1), true],
  ['RegExp', () => new MyRegExp('a', 'g'), true],
  ['ArrayBuffer', () => new MyBuffer(2), true],
  ['SharedArrayBuffer', () => new MyShared(2), true],
  ['Uint8Array', () => new MyBytes(2), false],
  ['DataView', () => new MyView(new ArrayBuffer(2)), false],
  ['Number', () => Object.setPrototypeOf(Object(1), class extends Number {}.prototype), true],
  ['String', () => Object.setPrototypeOf(Object('ab'), class extends String {}.prototype), false]
]

describe('cloneDeep', () => {
  it('copies plain objects and arrays all the way down', () => {
    const src = { a: [{ b: 1 }], c: { d: 'x' } }
    const copy = cloneDeep(src)
    expect(copy).toEqual(src)
    expect(copy.a).not.toBe(src.a)
    expect(copy.a[0]).not.toBe(src.a[0])
    expect(copy.c).not.toBe(src.c)
  })

  it('keeps prototypes, null prototypes and subclasses', () => {
    const bare = Object.create(null) as Record<string, number>
    bare.a = 1
    expect(Object.getPrototypeOf(cloneDeep(bare))).toBeNull()
    class Stack extends Array<number> {}
    const stack = Stack.from([1, 2])
    const stackCopy = cloneDeep(stack)
    expect(stackCopy).toBeInstanceOf(Stack)
    expect(stackCopy).not.toBe(stack)
    expect([...stackCopy]).toEqual([1, 2])
    class Registry extends Map<string, number> {}
    expect(cloneDeep(new Registry([['a', 1]]))).toBeInstanceOf(Registry)
  })

  it('copies own enumerable symbol keys and skips non-enumerable ones', () => {
    const sym = Symbol('s')
    const hidden = Symbol('h')
    const src: Record<symbol, unknown> = { [sym]: { v: 1 } }
    Object.defineProperty(src, hidden, { value: 2, enumerable: false })
    const copy = cloneDeep(src)
    expect(copy[sym]).toEqual({ v: 1 })
    expect(copy[sym]).not.toBe(src[sym])
    expect(hidden in copy).toBe(false)
  })

  it('copies Map values and keeps Map keys by identity', () => {
    const key = { k: 1 }
    const value = { v: 1 }
    const copy = cloneDeep(new Map([[key, value]]))
    expect(copy.has(key)).toBe(true)
    expect(copy.get(key)).toEqual(value)
    expect(copy.get(key)).not.toBe(value)
  })

  it('copies Set members, Dates, RegExps and boxed primitives', () => {
    const member = { m: 1 }
    const [copied] = cloneDeep(new Set([member]))
    expect(copied).toEqual(member)
    expect(copied).not.toBe(member)
    const date = new Date(5)
    expect(cloneDeep(date).getTime()).toBe(5)
    expect(cloneDeep(date)).not.toBe(date)
    const re = /a/gi
    re.exec('ba')
    const reCopy = cloneDeep(re)
    expect([reCopy.source, reCopy.flags, reCopy.lastIndex]).toStrictEqual(['a', 'gi', 2])
    expect(reCopy).not.toBe(re)
    expect(isEqual(reCopy, re)).toBe(true)
    const boxed = cloneDeep(Object('str') as string)
    expect(typeof boxed).toBe('object')
    expect(String(boxed)).toBe('str')
  })

  it('copies buffers and views, and views over one buffer share one copy', () => {
    const buffer = new Uint8Array([1, 2, 3, 4]).buffer
    const bytes = new Uint8Array(buffer, 1, 2)
    const view = new DataView(buffer, 2, 2)
    const copy = cloneDeep({ bytes, view })
    expect(copy.bytes).not.toBe(bytes)
    expect([...copy.bytes]).toEqual([2, 3])
    expect(copy.bytes.buffer).not.toBe(buffer)
    expect(copy.view.buffer).toBe(copy.bytes.buffer)
    expect(copy.view.getUint8(0)).toBe(3)
    copy.bytes[0] = 9
    expect(new Uint8Array(buffer)[1]).toBe(2)
    const floats = cloneDeep(new Float64Array([0.5]))
    expect(floats).toBeInstanceOf(Float64Array)
    expect(floats[0]).toBe(0.5)
  })

  it.each(SUBCLASSED)('keeps the prototype and own keys of a %s subclass', (_, make, strings) => {
    const src = make() as Record<PropertyKey, unknown>
    src[tag] = { t: 1 }
    src.extra = { e: 1 }
    const copy = cloneDeep(src)
    expect(copy).not.toBe(src)
    expect(Object.getPrototypeOf(copy)).toBe(Object.getPrototypeOf(src))
    expect(copy[tag]).toEqual({ t: 1 })
    expect(copy[tag]).not.toBe(src[tag])
    expect(copy.extra).toEqual(strings ? { e: 1 } : undefined)
  })

  it.each(SUBCLASSED)('copies a %s reached twice once', (_, make) => {
    const src = make()
    const [first, second] = cloneDeep([src, src])
    expect(first).not.toBe(src)
    expect(first).toBe(second)
  })

  it('copies a SharedArrayBuffer into a new SharedArrayBuffer', () => {
    const shared = new SharedArrayBuffer(2)
    new Uint8Array(shared)[1] = 7
    const copy = cloneDeep(shared)
    expect(copy).not.toBe(shared)
    expect(copy).toBeInstanceOf(SharedArrayBuffer)
    expect([...new Uint8Array(copy)]).toEqual([0, 7])
  })

  it('keeps a resizable buffer resizable', () => {
    const buffer = new ArrayBuffer(2, { maxByteLength: 8 })
    new Uint8Array(buffer)[0] = 3
    const copy = cloneDeep(buffer)
    expect([copy.resizable, copy.maxByteLength, copy.byteLength]).toEqual([true, 8, 2])
    copy.resize(8)
    expect(buffer.byteLength).toBe(2)
    expect(new Uint8Array(copy)[0]).toBe(3)
  })

  it('copies a detached buffer and its views as empty', () => {
    const buffer = new ArrayBuffer(4)
    const bytes = new Uint8Array(buffer)
    const view = new DataView(buffer, 1, 2)
    buffer.transfer()
    const copy = cloneDeep({ buffer, bytes, view })
    expect(copy.buffer.byteLength).toBe(0)
    expect(copy.bytes).toBeInstanceOf(Uint8Array)
    expect(copy.bytes.length).toBe(0)
    expect(copy.view).toBeInstanceOf(DataView)
    expect(copy.view.byteLength).toBe(0)
    expect(copy.view.buffer).toBe(copy.buffer)
  })

  it('copies a buffer whose constructor would build a different one', () => {
    class Page extends ArrayBuffer {
      constructor(options: { size: number }) {
        super(options.size)
      }
    }
    const page = new Page({ size: 8 })
    new Uint8Array(page)[7] = 1
    const copy = cloneDeep(page)
    expect(copy).toBeInstanceOf(Page)
    expect(copy.byteLength).toBe(8)
    expect(new Uint8Array(copy)[7]).toBe(1)
  })

  it('calls no method of the values it copies', () => {
    let called = false
    class Spy extends Map<unknown, unknown> {
      override set(key: unknown, value: unknown): this {
        called = true
        return super.set(key, value)
      }
      override entries(): MapIterator<[unknown, unknown]> {
        called = true
        return super.entries()
      }
    }
    const spy = new Spy([['k', 1]])
    called = false
    const copy = cloneDeep(spy)
    expect(called).toBe(false)
    expect(Map.prototype.get.call(copy, 'k')).toBe(1)
  })

  it('copies a JSON __proto__ key as an own key, not as the prototype', () => {
    const src = JSON.parse('{"__proto__":{"isAdmin":true}}') as Record<string, unknown>
    const copy = cloneDeep(src)
    expect(Object.getPrototypeOf(copy)).toBe(Object.prototype)
    expect(copy.isAdmin).toBeUndefined()
    expect(Object.getOwnPropertyDescriptor(copy, '__proto__')?.value).toEqual({ isAdmin: true })
  })

  it('copies an array or Set shared down many levels once per level', () => {
    let list: unknown[] = ['x']
    let set: Set<unknown> = new Set(['x'])
    for (let i = 0; i < 16; i++) {
      list = [list, list]
      set = new Set([set, [set]])
    }
    const listCopy = cloneDeep(list)
    expect(listCopy[0]).toBe(listCopy[1])
    const [inner, wrapped] = cloneDeep(set) as unknown as [Set<unknown>, Set<unknown>[]]
    expect(wrapped[0]).toBe(inner)
  })

  it('keeps holes and extra own keys of an array', () => {
    const arr = sparse(3, { 0: 1, 2: { x: 1 } })
    ;(arr as unknown as Record<string, unknown>).extra = 'e'
    const copy = cloneDeep(arr)
    expect(copy).toHaveLength(3)
    expect(1 in copy).toBe(false)
    expect(copy[2]).toEqual({ x: 1 })
    expect((copy as unknown as Record<string, unknown>).extra).toBe('e')
  })

  it('stays linear on a huge sparse array', () => {
    const arr = sparse(2 ** 32 - 1, { 4000000000: 'y' })
    const copy = cloneDeep(arr)
    expect(copy).toHaveLength(2 ** 32 - 1)
    expect(copy[4_000_000_000]).toBe('y')
  })

  it('keeps class instances, functions and errors by reference', () => {
    class Point {
      #x = 1
      get x(): number {
        return this.#x
      }
    }
    const point = new Point()
    const fn = (): number => 1
    const err = new Error('e')
    const copy = cloneDeep({ point, fn, err })
    expect(copy.point).toBe(point)
    expect(copy.point.x).toBe(1)
    expect(copy.fn).toBe(fn)
    expect(copy.err).toBe(err)
  })

  it('keeps shared references shared and cycles cyclic', () => {
    const shared = { s: 1 }
    const node: Record<string, unknown> = { a: shared, b: shared }
    node.self = node
    const copy = cloneDeep(node)
    expect(copy.a).toBe(copy.b)
    expect(copy.a).not.toBe(shared)
    expect(copy.self).toBe(copy)
    const map = new Map<string, unknown>()
    map.set('me', map)
    const mapCopy = cloneDeep(map)
    expect(mapCopy.get('me')).toBe(mapCopy)
  })

  it('copies plain data from another realm with its own prototype', () => {
    const foreign = vm.runInNewContext('({ list: [1, { a: 2 }], when: new Date(0) })') as {
      list: unknown[]
      when: Date
    }
    const copy = cloneDeep(foreign)
    expect(copy.list).not.toBe(foreign.list)
    expect(Object.getPrototypeOf(copy.list)).toBe(Object.getPrototypeOf(foreign.list))
    expect(copy.when.getTime()).toBe(0)
    expect(isEqual(copy, foreign)).toBe(true)
  })

  it('passes primitives through and stops past the nesting limit', () => {
    expect(cloneDeep(5)).toBe(5)
    expect(cloneDeep(null)).toBeNull()
    let deep: Record<string, unknown> = {}
    for (let i = 0; i < 1500; i++) deep = { a: deep }
    expect(() => cloneDeep(deep)).toThrow(RangeError)
    expect(cloneDeep({ ok: 1 })).toEqual({ ok: 1 })
  })

  it('counts nesting, not objects visited', () => {
    const wide = Array.from({ length: 2000 }, (_, i) => ({ i }))
    expect(cloneDeep(wide)).toEqual(wide)
  })

  it('turns an engine stack overflow into the depth error', () => {
    const overflowing = {
      get a(): never {
        throw new RangeError('Maximum call stack size exceeded')
      }
    }
    expect(() => cloneDeep(overflowing)).toThrow(new RangeError(DEPTH_ERROR))
  })

  it('copies a large typed array into an independent buffer', () => {
    const bytes = new Uint8Array(16 * 1024 * 1024)
    bytes[bytes.length - 1] = 1
    const copy = cloneDeep({ bytes })
    expect(copy.bytes.buffer === bytes.buffer).toBe(false)
    expect(copy.bytes.length).toBe(bytes.length)
    expect(copy.bytes[bytes.length - 1]).toBe(1)
  })
})
