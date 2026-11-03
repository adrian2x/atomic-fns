import { describe, expect, it } from 'vitest'
import {
  add,
  adaptProtocol,
  compare,
  deepEqual,
  div,
  mod,
  mul,
  pow,
  protocol,
  shallowEqual,
  sub
} from '../src/operators/index.js'
import {
  IndexError,
  IOError,
  KeyError,
  NotImplementedError,
  ValueError,
  ZeroDivisionError,
  del,
  float,
  get,
  isDate,
  isError,
  isMap,
  isRegExp,
  isSet,
  isUndefined,
  isWeakMap,
  isWeakSet,
  len,
  notNull
} from '../src/globals/index.js'
import {
  compact,
  defaults,
  findIndex,
  findLastIndex,
  forEachRight,
  groupBy,
  groupByMap,
  indexOf,
  insert,
  intersection,
  map,
  matches,
  remove
} from '../src/collections/index.js'
import { abs, logBase, mean, sum } from '../src/math/index.js'
import { contains, first, iforEach, partition, times } from '../src/itertools/index.js'
import { decimal } from '../src/decimal/index.js'

describe('SPEC-R16 arithmetic operators coverage', () => {
  it('SPEC-R16 sub mul div mod pow numeric and protocol paths', () => {
    expect(sub(5, 2)).toBe(3)
    expect(mul(3, 4)).toBe(12)
    expect(div(10, 2)).toBe(5)
    expect(mod(7, 3)).toBe(1)
    expect(pow(2, 3)).toBe(8)
    const o = {
      [protocol.sub](y: unknown) {
        return Number(y) + 1
      },
      [protocol.mul](y: unknown) {
        return Number(y) + 2
      },
      [protocol.div](y: unknown) {
        return Number(y) + 3
      },
      [protocol.mod](y: unknown) {
        return Number(y) + 4
      },
      [protocol.pow](y: unknown) {
        return Number(y) + 5
      },
      [protocol.add](y: unknown) {
        return Number(y) + 6
      },
      [protocol.abs]() {
        return 99
      }
    }
    expect(sub(o, 1)).toBe(2)
    expect(mul(o, 1)).toBe(3)
    expect(div(o, 1)).toBe(4)
    expect(mod(o, 1)).toBe(5)
    expect(pow(o, 1)).toBe(6)
    expect(add(o, 1)).toBe(7)
    expect(abs(o)).toBe(99)
  })
})

describe('SPEC-R17 deepEqual branch coverage', () => {
  it('SPEC-R17 RegExp ArrayBuffer Map Set mismatch and nested failure', () => {
    expect(deepEqual(/a/g, /a/i)).toBe(false)
    expect(deepEqual(/a/g, /a/g)).toBe(true)
    expect(deepEqual(new ArrayBuffer(2), new ArrayBuffer(3))).toBe(false)
    const a = new ArrayBuffer(2)
    const b = new ArrayBuffer(2)
    new Uint8Array(a)[0] = 1
    new Uint8Array(b)[0] = 2
    expect(deepEqual(a, b)).toBe(false)
    expect(deepEqual(new ArrayBuffer(1), new ArrayBuffer(1))).toBe(true)
    expect(deepEqual(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(false)
    expect(deepEqual(new Uint8Array([1]), new Uint8Array([1, 2]))).toBe(false)
    expect(deepEqual(new Map([[1, 2]]), new Map([[1, 3]]))).toBe(false)
    expect(deepEqual(new Map([[1, 2]]), new Map([[2, 2]]))).toBe(false)
    expect(
      deepEqual(
        new Map([[1, 2]]),
        new Map([
          [1, 2],
          [3, 4]
        ])
      )
    ).toBe(false)
    expect(deepEqual(new Map([[1, 2]]), new Map([[1, 2]]))).toBe(true)
    expect(deepEqual(new Set([1]), new Set([2]))).toBe(false)
    expect(deepEqual(new Set([1, 2]), new Set([1]))).toBe(false)
    expect(deepEqual(new Set([1]), new Set([1]))).toBe(true)
    expect(deepEqual([1, 2], [1])).toBe(false)
    expect(deepEqual([1, 2], [1, 3])).toBe(false)
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false)
    expect(deepEqual({ a: 1 }, { b: 1 })).toBe(false)
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false)
    expect(deepEqual(null, {})).toBe(false)
    expect(deepEqual(1, 2)).toBe(false)
  })

  it('SPEC-R18 shallowEqual mismatch branches', () => {
    expect(shallowEqual({ a: 1 }, { a: 1 })).toBe(true)
    expect(shallowEqual({ a: 1 }, { a: 2 })).toBe(false)
    expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false)
    expect(shallowEqual({ a: 1 }, { b: 1 })).toBe(false)
    expect(shallowEqual(null, {})).toBe(false)
    expect(shallowEqual(1, 1)).toBe(true)
    expect(shallowEqual(Object.create(null), {})).toBe(false)
  })
})

describe('SPEC-R10 adaptProtocol gt-only ordering', () => {
  it('SPEC-R10 gt-only class derives compare', () => {
    class G {
      constructor(readonly n: number) {}
      gt(o: G) {
        return this.n > o.n
      }
    }
    adaptProtocol(G)
    expect(compare(new G(2), new G(1))).toBe(1)
    expect(compare(new G(1), new G(2))).toBe(-1)
    expect(compare(new G(1), new G(1))).toBe(0)
  })

  it('SPEC-R10 gt+eq class declines incomparable', () => {
    class GE {
      constructor(readonly n: number) {}
      gt(o: GE) {
        return this.n > o.n
      }
      eq(o: GE) {
        return this.n === o.n
      }
    }
    adaptProtocol(GE)
    const a = new GE(NaN)
    const b = new GE(NaN)
    expect(compare(a, b)).toBe(-compare(b, a))
  })
})

describe('SPEC-R27 error class names', () => {
  it('SPEC-R27 IndexError IOError and siblings name literals', () => {
    expect(new IndexError('i').name).toBe('IndexError')
    expect(new IOError('io').name).toBe('IOError')
    expect(new KeyError('k').name).toBe('KeyError')
    expect(new NotImplementedError('n').name).toBe('NotImplementedError')
    expect(new ValueError('v').name).toBe('ValueError')
    expect(new ZeroDivisionError('z').name).toBe('ZeroDivisionError')
  })
})

describe('globals predicate and helper coverage', () => {
  it('type guards and len size paths', () => {
    expect(isError(new Error())).toBe(true)
    expect(isDate(new Date())).toBe(true)
    expect(isUndefined(undefined)).toBe(true)
    expect(notNull(0)).toBe(true)
    expect(notNull(null)).toBe(false)
    expect(isRegExp(/x/)).toBe(true)
    expect(isSet(new Set())).toBe(true)
    expect(isMap(new Map())).toBe(true)
    expect(isWeakSet(new WeakSet())).toBe(true)
    expect(isWeakMap(new WeakMap())).toBe(true)
    expect(len({ size: 3 })).toBe(3)
    expect(len({ size: () => 4 })).toBe(4)
    expect(len(Symbol())).toBeUndefined()
    expect(float('3.14')).toBe(3.14)
    const o = { a: 1 }
    del('a', o)
    expect(o).toEqual({})
    expect(del('a', null)).toBeNull()
    expect(get('missing', null, 7)).toBe(7)
    expect(get('a.b', { a: null }, 9)).toBe(9)
  })
})

describe('SPEC-R61 math helpers coverage', () => {
  it('SPEC-R61 logBase mean sum key forms', () => {
    expect(logBase(10, 100)).toBe(2)
    expect(Number.isNaN(logBase(-1, 10))).toBe(true)
    expect(mean([1, 2, 3])).toBe(2)
    expect(Number.isNaN(mean([]))).toBe(true)
    expect(mean([{ n: 4 }, { n: 6 }], (o) => o.n)).toBe(5)
    expect(sum([{ n: 1 }, { n: 2 }], (o) => o.n)).toBe(3)
  })
})

describe('collections edge coverage', () => {
  it('compact insert matches forEachRight index find defaults groupBy', () => {
    expect(compact(null as unknown as Record<string, number>)).toEqual({})
    expect(compact({ a: 1, b: 0 })).toEqual({ a: 1 })
    expect(insert(null, 0, 1)).toBeNull()
    expect(insert([1, 3], 1, 2)).toEqual([1, 2, 3])
    expect(matches(null)({})).toBe(false)
    expect(matches([1, { a: 1 }])([1, { a: 1, b: 2 }])).toBe(true)
    expect(matches([1])({})).toBe(false)
    expect(matches([1, 2])([1, 3])).toBe(false)
    expect(matches(new Set([1]))(new Set([1]))).toBe(false)
    const seen: number[] = []
    forEachRight([1, 2, 3], (v) => {
      seen.push(v)
      return v !== 2
    })
    expect(seen).toEqual([3, 2])
    const objSeen: string[] = []
    forEachRight({ a: 1, b: 2 }, (_v, k) => {
      objSeen.push(String(k))
    })
    expect(objSeen).toEqual(['b', 'a'])
    forEachRight(new Set([1]), () => false)
    forEachRight(null, () => {
      throw new Error('no')
    })
    expect(findIndex(null, () => true)).toBe(-1)
    expect(findIndex([1, 2, 3], (x) => x === 2, -2)).toBe(1)
    expect(findIndex([], () => true)).toBe(-1)
    expect(findIndex([1], () => false)).toBe(-1)
    expect(indexOf(null, 1)).toBe(-1)
    expect(indexOf([1, 2, 3], 2, -2)).toBe(1)
    expect(indexOf([], 1)).toBe(-1)
    expect(indexOf([1], 9)).toBe(-1)
    expect(findLastIndex(null, () => true)).toBe(-1)
    expect(findLastIndex([1, 2, 3], (x) => x === 2)).toBe(1)
    expect(findLastIndex([], () => true)).toBe(-1)
    expect(findLastIndex([1], () => false)).toBe(-1)
    expect(defaults({ a: 1 }, { a: 2, b: 3 })).toEqual({ a: 1, b: 3 })
    expect([...intersection()]).toEqual([])
    expect(groupBy({ x: 1, y: 2 }, (v) => v)).toEqual({ 1: [1], 2: [2] })
    expect(groupByMap({ x: '10' }, 'length').get(2)).toEqual(['10'])
    expect(map(new Date(), () => 1)).toEqual([])
    remove([1, 2, 3], 'length')
    remove([{ a: 1 }, { a: 2 }], { a: 1 })
  })
})

describe('itertools remaining helpers', () => {
  it('contains first iforEach partition times', () => {
    expect(contains([1, 2], 2)).toBe(true)
    expect(contains('abcd', 'bc')).toBe(true)
    expect(contains({ a: 1 }, 1)).toBe(true)
    expect(first([9, 8])).toBe(9)
    const emptyFirst = first([] as number[])
    expect(emptyFirst).toBe(undefined)
    const acc: number[] = []
    iforEach([1, 2], (v) => {
      acc.push(v)
    })
    expect(acc).toEqual([1, 2])
    const [t, f] = partition([1, 2, 3, 4], (x) => x % 2 === 0)
    expect(t).toEqual([2, 4])
    expect(f).toEqual([1, 3])
    expect([...times(3, (i) => i)]).toEqual([0, 1, 2])
  })
})

describe('SPEC-R66 decimal edge coverage', () => {
  it('SPEC-R66 rounding modes and compare edges', () => {
    expect(decimal('2.5').div(1, { precision: 0, rounding: 'halfUp' }).toString()).toBe('3')
    expect(decimal('2.5').div(1, { precision: 0, rounding: 'halfDown' }).toString()).toBe('2')
    expect(decimal('2.5').div(1, { precision: 0, rounding: 'up' }).toString()).toBe('3')
    expect(decimal('2.5').div(1, { precision: 0, rounding: 'down' }).toString()).toBe('2')
    expect(decimal('2.5').div(1, { precision: 0, rounding: 'floor' }).toString()).toBe('2')
    expect(decimal('2.5').div(1, { precision: 0, rounding: 'ceil' }).toString()).toBe('3')
    expect(decimal(-2.5).div(1, { precision: 0, rounding: 'floor' }).toString()).toBe('-3')
    expect(decimal(-2.5).div(1, { precision: 0, rounding: 'ceil' }).toString()).toBe('-2')
    expect(decimal(4).sqrt({ precision: 0 }).toString()).toBe('2')
    expect(decimal(1).lt(2)).toBe(true)
    expect(decimal(1).lte(1)).toBe(true)
    expect(decimal(2).gt(1)).toBe(true)
    expect(decimal(1).gte(1)).toBe(true)
  })
})
