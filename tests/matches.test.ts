import { describe, expect, it } from 'vitest'
import { filter, find, matches } from '../src/collections/index.js'
import { isPlainObject } from '../src/collections/object.js'
import { Decimal, decimal } from '../src/decimal/index.js'
import { Currency } from '../src/i18n/currency.js'
import { IntlDate } from '../src/i18n/date/index.js'
import { deepEqual, eq, protocol } from '../src/operators/index.js'

const LIMIT_ERROR = new RangeError('matches exceeded 33554432 comparisons')

/** Reaching the limit takes a few seconds of synchronous work on a slow runner. */
const LONG = { timeout: 60_000 }

/** An object whose field `v` counts its reads. */
function readCounter(v: unknown): { leaf: object; reads: () => number } {
  let reads = 0
  return {
    leaf: {
      get v() {
        reads++
        return v
      }
    },
    reads: () => reads
  }
}

/** Leaves that compare by identity, so that no index can narrow a walk away from them. */
const pass = () => 1
const fail = () => 2

/** Array DAG: x(i+1) = [x(i), x(i)]. */
function arrDag(depth: number, bottom: unknown): unknown {
  let x = bottom
  for (let i = 0; i < depth; i++) x = [x, x]
  return x
}

/** Object DAG: x(i+1) = { l: x(i), r: x(i) }. */
function dag(depth: number, bottom: object): object {
  let x = bottom
  for (let i = 0; i < depth; i++) x = { l: x, r: x }
  return x
}

/** Single-path shape that walks one route down an {@link arrDag} of the same depth. */
function arrChain(depth: number, bottom: unknown): unknown {
  let x = bottom
  for (let i = 0; i < depth; i++) x = [x]
  return x
}

/** Fills the memo with failed pairs: each shape row fails every `{ a: 1 }`, then claims its own. */
function memoFlood(rows = 2 ** 10): { shape: object[]; target: object[] } {
  return {
    shape: Array.from({ length: rows }, () => ({ a: {} })),
    target: [
      ...Array.from({ length: rows }, () => ({ a: 1 })),
      ...Array.from({ length: rows }, () => ({ a: {} }))
    ]
  }
}

describe('matches', () => {
  it('an array chain reaches the nesting limit before the native stack does', () => {
    expect(matches(arrChain(1000, 7))(arrChain(1000, 7))).toBe(true)
    expect(() => matches(arrChain(1001, 7))(arrChain(1001, 7))).toThrow(
      new RangeError('nesting deeper than 1000 levels')
    )
  })

  it('SPEC-R42 matches deep partial', () => {
    expect(filter([{ a: { b: 1, c: 2 } }], { a: { b: 1 } })).toHaveLength(1)
    expect(matches({ a: 1 })({ a: 2 })).toBe(false)
    expect(matches([1, { a: 1 }])([1, { a: 1, b: 2 }])).toBe(true)
    expect(matches([1])({})).toBe(false)
    expect(matches([1, 2])([1, 3])).toBe(false)
  })

  it('compares Date, Map, Set and RegExp shape values by deepEqual', () => {
    expect(matches({ d: new Date(0) })({ d: new Date(0) })).toBe(true)
    expect(matches({ m: new Map([[1, 1]]) })({ m: new Map([[1, 1]]) })).toBe(true)
    expect(matches({ s: new Set([1]) })({ s: new Set([1]) })).toBe(true)
    expect(matches({ r: /a/g })({ r: /a/g })).toBe(true)
    expect(matches(new Set([1]))(new Set([1]))).toBe(true)
    expect(filter([{ d: new Date(0) }], { d: new Date(0) })).toHaveLength(1)
  })

  it('requires an own key for an undefined shape value', () => {
    expect(matches({ a: undefined })({})).toBe(false)
    expect(matches({ a: undefined })({ a: undefined })).toBe(true)
    expect(matches({ a: undefined })(Object.create({ a: undefined }))).toBe(false)
  })

  it('a top-level empty shape matches anything', () => {
    expect(matches({})(1)).toBe(true)
    expect(matches({})(null)).toBe(true)
    expect(matches([])('x')).toBe(true)
  })

  it('nested empty shapes require the same kind', () => {
    expect(find([{ email: 'a', token: 't' }], { email: 'a', token: {} })).toBeUndefined()
    expect(find([{ email: 'a', token: { x: 1 } }], { email: 'a', token: {} })).toEqual({
      email: 'a',
      token: { x: 1 }
    })
    expect(find([{ email: 'a', token: [] }], { email: 'a', token: [] })).toEqual({
      email: 'a',
      token: []
    })
    expect(filter([{ email: 'a', token: 't' }], { token: [] })).toEqual([])
    expect(matches({ a: {} })({})).toBe(false)
    expect(matches({ a: {} })({ a: 'str' })).toBe(false)
    expect(matches({ a: {} })({ a: null })).toBe(false)
    expect(matches({ a: {} })({ a: [] })).toBe(false)
    expect(matches({ a: {} })({ a: { b: 1 } })).toBe(true)
    expect(matches({ a: [] })({ a: 'str' })).toBe(false)
    expect(matches({ a: [] })({ a: [1] })).toBe(true)
  })

  it('a nested {} matches any non-array object in both positions', () => {
    expect(matches({ a: {} })({ a: new Date(0) })).toBe(true)
    expect(matches([{}])([new Date(0)])).toBe(true)
    expect(matches({ a: {} })({ a: /a/ })).toBe(true)
    expect(matches([{}])([/a/])).toBe(true)
  })

  it('R16-A: hooks equate an element with a primitive across kinds', () => {
    expect(matches([1])([decimal(1)])).toBe(true)
    expect(matches({ prices: [1] })({ prices: [decimal(1)] })).toBe(true)
    expect(matches({ items: [{ amount: 10 }] })({ items: [{ amount: decimal(10) }] })).toBe(true)
    const ms = Date.UTC(2020, 0, 1)
    expect(matches({ when: [new Date(ms)] })({ when: [new IntlDate(ms)] })).toBe(true)
    expect(matches({ prices: [1] })({ prices: [new Currency(1, 'USD')] })).toBe(true)
    expect(matches([[1, 1]])([[1]])).toBe(false)
    expect(matches([[decimal(1), decimal(1)]])([[decimal(1)]])).toBe(false)
    expect(matches([1, 1])([1])).toBe(false)
  })

  it('a shape element that is no plain object or array can match any element', () => {
    const run = () => 1

    expect(matches([decimal(1)])(['a', 1])).toBe(true)
    expect(matches([run])(['a', run])).toBe(true)
  })

  it('a primitive shape element only asks the hook elements on a miss', () => {
    let calls = 0
    const hook = {
      [protocol.equals]() {
        calls++
        return false
      }
    }

    expect(matches([9])([1, 2, hook])).toBe(false)
    expect(calls).toBe(1)
    expect(matches([1])([1, hook])).toBe(true)
    expect(calls).toBe(1)
  })

  it('matches class-instance elements key by key', () => {
    const run = () => 1
    class Job {
      run = run
    }
    expect(matches([{ run }])([new Job()])).toBe(true)
    expect(matches([{ run }])([1, { other: run }])).toBe(false)
  })

  it('R19-A: Date leaf inside array-element object matches', () => {
    const d = (n: number) => new Date(n)
    expect(matches({ at: d(5) })({ at: d(5) })).toBe(true)
    expect(matches({ t: [d(5)] })({ t: [d(5)] })).toBe(true)
    expect(matches({ t: [{ at: d(5) }] })({ t: [{ at: d(5) }] })).toBe(true)
    expect(matches({ t: [{ at: d(5) }] })({ t: [{ at: d(6) }] })).toBe(false)
  })

  it('R19-A: agrees with a plain recursive reference over 5000 random pairs', () => {
    function refMatch(shape: unknown, obj: unknown, top = true): boolean {
      if (shape === null || typeof shape !== 'object') return eq(obj, shape)
      if (Array.isArray(shape)) {
        if (shape.length === 0) return top || Array.isArray(obj)
        if (!Array.isArray(obj)) return false
        const claimed = new Set<number>()
        return shape.every((item) => {
          const free = obj.findIndex((el, i) => !claimed.has(i) && refMatch(item, el, false))
          claimed.add(free)
          return free >= 0
        })
      }
      if (isPlainObject(shape)) {
        const shapeKeys = Object.keys(shape)
        const notObject = obj === null || typeof obj !== 'object'
        if (top ? obj == null : notObject || Array.isArray(obj)) {
          return top && shapeKeys.length === 0
        }
        const record = Object(obj) as Record<string, unknown>
        return shapeKeys.every(
          (key) =>
            (shape[key] !== undefined || Object.hasOwn(record, key)) &&
            refMatch(shape[key], record[key], false)
        )
      }
      return deepEqual(shape, obj)
    }

    let seed = 0xc0ffee ^ 19
    const rnd = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed / 0x100000000
    }
    const pick = <T>(xs: readonly T[]): T => {
      const v = xs[Math.floor(rnd() * xs.length)]
      if (v === undefined) throw new Error('empty pool')
      return v
    }

    function freshLeaf(): unknown {
      const kind = Math.floor(rnd() * 12)
      switch (kind) {
        case 0:
          return null
        case 1:
          return rnd() < 0.5
        case 2:
          return Math.floor(rnd() * 5)
        case 3:
          return pick(['a', 'b', 'c'] as const)
        case 4:
          return undefined
        case 5:
          return new Date(Math.floor(rnd() * 20))
        case 6:
          return decimal(Math.floor(rnd() * 5))
        case 7:
          return new Currency(Math.floor(rnd() * 3), pick(['USD', 'EUR'] as const))
        case 8:
          return new IntlDate(Math.floor(rnd() * 20))
        case 9:
          return Object(Math.floor(rnd() * 3))
        case 10:
          return Object(pick(['x', 'y'] as const))
        default:
          return Object(rnd() < 0.5)
      }
    }

    function gen(depth: number): unknown {
      if (depth <= 0 || rnd() < 0.45) return freshLeaf()
      if (rnd() < 0.5) {
        const n = 1 + Math.floor(rnd() * 3)
        return Array.from({ length: n }, () => gen(depth - 1))
      }
      const n = 1 + Math.floor(rnd() * 3)
      const o: Record<string, unknown> = {}
      for (let i = 0; i < n; i++) o['k' + String(i)] = gen(depth - 1)
      return o
    }

    /** Rebuild a value that deepEqual-matches `v` (fresh instances for class leaves). */
    function twin(v: unknown): unknown {
      if (v === null || typeof v !== 'object') return v
      if (Array.isArray(v)) return v.map(twin)
      if (v instanceof Date) return new Date(v.getTime())
      if (v instanceof Currency) return v.clone()
      if (v instanceof IntlDate) return new IntlDate(v.valueOf())
      if (v instanceof Decimal) return v.clone()
      if (isPlainObject(v)) {
        const o: Record<string, unknown> = {}
        for (const key of Object.keys(v)) o[key] = twin(v[key])
        return o
      }
      if (v instanceof Number) return Object(Number(v))
      if (v instanceof String) return Object(String(v))
      if (v instanceof Boolean) return Object(Boolean(v))
      return v
    }

    let diffs = 0
    for (let i = 0; i < 5000; i++) {
      const depth = 1 + Math.floor(rnd() * 4)
      const shape = gen(depth)
      const value = rnd() < 0.55 ? twin(shape) : gen(depth)
      if (matches(shape)(value) !== refMatch(shape, value)) diffs += 1
    }
    expect(diffs).toBe(0)
  })
})

describe('matches follows Lodash', () => {
  it('each target element serves at most one shape element', () => {
    expect(matches({ a: [2, 2] })({ a: [1, 2] })).toBe(false)
    expect(matches({ a: [1, 1] })({ a: [1, 2, 3] })).toBe(false)
    expect(matches({ a: [1, 1] })({ a: [1, 1, 3] })).toBe(true)
    expect(matches([{ a: 1 }, { a: 1 }])([{ a: 1 }, { a: 2 }])).toBe(false)
    expect(matches([[1], [1]])([[1], [2]])).toBe(false)
  })

  it('claims greedily, in shape order, the first element that matches', () => {
    expect(matches([{}, { a: 1 }])([{ a: 1 }, { b: 2 }])).toBe(false)
    expect(matches([{ a: 1 }, {}])([{ a: 1 }, { b: 2 }])).toBe(true)
  })

  it('a hook element ahead of an equal primitive is the one claimed', () => {
    class EqualsOne {
      tag = 'hook';
      [protocol.equals](other: unknown): boolean {
        return other === 1
      }
    }

    expect(matches([1, { tag: 'hook' }])([new EqualsOne(), 1])).toBe(false)
    expect(matches([{ tag: 'hook' }, 1])([new EqualsOne(), 1])).toBe(true)
  })

  it('claims skip taken positions without skipping free ones', () => {
    const shape = [{ a: {} }, { b: {} }, { c: {} }]

    expect(matches(shape)([{ a: {} }, { c: {} }, { b: {} }])).toBe(true)
  })

  it('below the top level a plain-object shape never matches an array', () => {
    expect(matches({ a: { length: 2 } })({ a: [1, 1] })).toBe(false)
    expect(matches([{ length: 2 }])([[1, 1]])).toBe(false)
    expect(matches([{ 0: 'x' }])([['x']])).toBe(false)
    expect(matches({ length: 2 })([1, 1])).toBe(true)
  })

  it('the top level looser rules stay out of the answer for a nested pair', () => {
    const shape: Record<string, unknown> = {}
    shape[0] = shape
    const target: unknown[] = []
    target.push(target)

    expect(matches(shape)(target)).toBe(false)
  })

  it('shape keys read non-enumerable and inherited keys in every position', () => {
    const hidden = Object.defineProperty({}, 'a', { value: 1 })
    const inherited: unknown = Object.create({ a: 1 })

    for (const target of [hidden, inherited]) {
      expect(matches({ a: 1 })(target)).toBe(true)
      expect(matches({ x: { a: 1 } })({ x: target })).toBe(true)
      expect(matches([{ a: 1 }])([target])).toBe(true)
      expect(matches([{ a: 2 }])([target])).toBe(false)
    }
    expect(matches([{ constructor: Object }])([{}])).toBe(true)
  })

  it('boxes a primitive or function target at the top level only', () => {
    expect(filter(['abc'], { length: 3 })).toEqual(['abc'])
    expect(matches({ a: 1 })(Object.assign(() => 0, { a: 1 }))).toBe(true)
    expect(matches({ a: { length: 3 } })({ a: 'abc' })).toBe(false)
    expect(matches([{ length: 3 }])(['abc'])).toBe(false)
    expect(matches({ a: 1 })(null)).toBe(false)
  })

  it('a primitive shape compares with eq', () => {
    expect(matches(5)(5)).toBe(true)
    expect(matches(5)(6)).toBe(false)
    expect(matches(1)(decimal(1))).toBe(true)
    expect(matches(null)({ a: 1 })).toBe(false)
    expect(matches(null)(null)).toBe(true)
  })

  it('never walks an element the shape does not need', () => {
    expect(matches([1])([1, arrChain(1500, 0)])).toBe(true)
  })

  it('a top-level array shape is a subset, unlike Lodash', () => {
    expect(matches([2])([1, 2])).toBe(true)
  })

  it('a class-instance shape compares with deepEqual, unlike Lodash', () => {
    class Point {
      constructor(
        readonly x: number,
        readonly y: number
      ) {}
    }

    expect(matches(new Point(1, 2))(new Point(1, 2))).toBe(true)
    expect(matches({ p: new Point(1, 2) })({ p: { x: 1, y: 2 } })).toBe(false)
  })
})

describe('matches holes', () => {
  it('a hole in the target matches undefined at any depth', () => {
    expect(matches([undefined])(new Array(1))).toBe(true)
    expect(matches([[undefined]])([new Array(1)])).toBe(true)
    expect(matches({ a: [[undefined]] })({ a: [new Array(1)] })).toBe(true)
    expect(matches([[1]])([new Array(1)])).toBe(false)
  })

  it('every hole is one position to claim', () => {
    expect(matches([undefined, undefined])(new Array(2))).toBe(true)
    expect(matches([undefined, undefined])([1, undefined])).toBe(false)
    expect(matches(new Array(2))([undefined, undefined])).toBe(true)
    expect(matches(new Array(2))([undefined, 1])).toBe(false)
    const oneHole = [1]
    oneHole.length = 2
    expect(matches([undefined, undefined])(oneHole)).toBe(false)
    expect(matches([undefined, 1])(oneHole)).toBe(true)
  })

  it('the holes of a huge sparse shape ask for one undefined', () => {
    const shape: unknown[] = []
    shape.length = 2 ** 32 - 2
    shape[0] = 'x'
    shape[4e9] = 'admin'

    expect(matches(shape)(['x', undefined, 'admin'])).toBe(true)
    expect(matches(shape)(['x', 'admin'])).toBe(false)
  })
})

describe('matches work stays bounded', () => {
  it('indexes an array once however many depths meet it', () => {
    const target: unknown[] = []
    target.push(target)
    for (let i = 0; i < 100_000; i++) target.push(i)
    let reads = 0
    Object.defineProperty(target, 1, {
      enumerable: true,
      get() {
        reads++
        return 0
      }
    })

    expect(matches(arrChain(100, [5]))(target)).toBe(true)
    expect(reads).toBe(1)
  })

  it('a large array of distinct rows is not mistaken for shared objects', () => {
    const rows = Array.from({ length: 600_000 }, (_, i) => ({ x: i + 2 }))
    rows.push({ x: 1 })

    expect(matches({ t: [{ x: 1 }] })({ t: rows })).toBe(true)
  })

  it('records cost a read per row, not per pair of rows', () => {
    const count = 10_000
    let idReads = 0
    let tagReads = 0
    const target = Array.from({ length: count }, (_, i) => ({
      get id() {
        idReads++
        return i
      },
      get tag() {
        tagReads++
        return 'x'
      }
    }))
    const shape = Array.from({ length: count }, (_, id) => ({ id, tag: 'x' }))

    expect(matches({ rows: shape })({ rows: target })).toBe(true)

    // Once for the index and once for the row's own check.
    expect(idReads).toBe(2 * count)
    // The id field left one candidate, so nothing indexed the tag.
    expect(tagReads).toBe(count)
  })

  it('records that open with a field every row shares stay near linear', () => {
    const count = 10_000
    let idReads = 0
    const target = Array.from({ length: count }, (_, i) => ({
      type: 'user',
      get id() {
        idReads++
        return i
      }
    }))
    const shape = Array.from({ length: count }, (_, id) => ({ type: 'user', id }))

    expect(matches({ rows: shape })({ rows: target })).toBe(true)
    expect(idReads).toBe(2 * count)
  })

  /** Rows holding `id` under `keys`, the target's in reverse so a scan walks most of them. */
  function nestedRows(
    keys: string[],
    count: number
  ): { shape: object; target: object; reads: () => number } {
    let reads = 0
    const nest = (leaf: object) =>
      keys.reduceRight<object>((inner, key) => ({ [key]: inner }), leaf)
    const shape = Array.from({ length: count }, (_, id) => nest({ id }))
    const target = Array.from({ length: count }, (_, i) =>
      nest({
        get id() {
          reads++
          return count - 1 - i
        }
      })
    )
    return { shape, target, reads: () => reads }
  }

  it('nested records in another order cost a read per row, not per pair of rows', () => {
    const count = 100_000
    const { shape, target, reads } = nestedRows(['meta'], count)

    expect(matches(shape)(target)).toBe(true)
    expect(reads()).toBe(2 * count)
  })

  it('narrows on a field up to four keys deep and scans past that', () => {
    const count = 100
    const reachable = nestedRows(['a', 'b', 'c'], count)
    const tooDeep = nestedRows(['a', 'b', 'c', 'd'], count)

    expect(matches(reachable.shape)(reachable.target)).toBe(true)
    expect(matches(tooDeep.shape)(tooDeep.target)).toBe(true)

    expect(reachable.reads()).toBe(2 * count)
    expect(tooDeep.reads()).toBe((count * (count + 1)) / 2)
  })

  it('a nested field narrows without changing what matches', () => {
    expect(matches([{ meta: { amount: 10 } }])([{ meta: { amount: decimal(10) } }])).toBe(true)
    expect(matches([{ meta: { a: 1 } }])([{ meta: Object.create({ a: 1 }) as object }])).toBe(true)
    expect(matches([{ meta: { length: 1 } }])([{ meta: [1] }])).toBe(false)
    expect(matches([{ meta: { length: 3 } }])([{ meta: 'abc' }])).toBe(false)
    expect(matches([{ meta: { id: 1 } }])([{ meta: null }, { meta: 1 }, {}])).toBe(false)
    expect(matches([{ meta: [5] }])([{ meta: [1, 5] }])).toBe(true)
  })

  it('a key with a dot in it is not a path', () => {
    const shape = [{ 'a.b': 1 }, { a: { b: 2 } }]

    expect(matches(shape)([{ 'a.b': 1 }, { a: { b: 2 } }])).toBe(true)
  })

  it('a wide shared shape element searches a bounded number of objects', LONG, () => {
    const wide = (child: object) =>
      Object.fromEntries(Array.from({ length: 300 }, (_, i) => ['k' + String(i), child]))

    expect(matches([wide(wide(wide({})))])([{}])).toBe(false)
  })

  it('a run of duplicates claims in linear time', () => {
    const rows = () => Array.from({ length: 100_000 }, () => ({ a: 1 }))

    expect(matches(rows())(rows())).toBe(true)
  })

  it('a shape past the field index room scans instead of indexing', () => {
    const { leaf, reads } = readCounter(1)
    const row = Object.create(leaf) as object
    Object.assign(row, { k0: 1, k1: 1, k2: 1, k3: 1 })
    const target = new Array<unknown>(2 ** 20).fill(row)

    expect(matches([{ k0: 1, k1: 1, k2: 1, k3: 1 }, { v: 1 }])(target)).toBe(true)

    // Only the second row's own check reads it: no index walked the million rows.
    expect(reads()).toBe(1)
  })

  it('a shared DAG the shape never needs is never walked', () => {
    const { leaf, reads } = readCounter(1)

    expect(matches({ t: [7] })({ t: [arrDag(30, leaf), 7] })).toBe(true)
    expect(reads()).toBe(0)
  })

  it('walks a shared DAG pair once', () => {
    const arrays = readCounter({})
    const objects = readCounter({})

    expect(matches({ t: [arrDag(40, { v: {} })] })({ t: [arrDag(40, arrays.leaf)] })).toBe(true)
    expect(matches(dag(40, { v: {} }))(dag(40, objects.leaf))).toBe(true)

    expect(arrays.reads()).toBe(1)
    expect(objects.reads()).toBe(1)
  })

  it('walks a failed shared pair once', () => {
    const { leaf, reads } = readCounter({})

    expect(matches(arrChain(16, [{ v: 1 }]))(arrDag(16, [leaf]))).toBe(false)
    expect(reads()).toBe(1)
  })

  it('remembers a failed pair over a wide array', () => {
    const { leaf, reads } = readCounter(2)
    const wide = [10, 11, 12, leaf]

    expect(matches([[{ v: {} }]])([wide, wide])).toBe(false)
    expect(reads()).toBe(1)
  })

  it('a failed pair leaves the other candidates and shapes free to match', () => {
    const depth = 12
    const dead = arrDag(depth, { a: 2, b: 1 })
    const live = arrDag(depth, { a: 1 })

    expect(matches(arrChain(depth + 1, { a: 1 }))([dead, live])).toBe(true)
    expect(matches([{ a: 1 }, { a: 9 }])([{ a: 9, b: 1 }, { a: 1 }])).toBe(true)
  })

  it('walks a shape DAG of empty containers without multiplying', () => {
    expect(matches([arrDag(26, [])])([[1]])).toBe(false)
    expect(matches([dag(26, {})])([{ l: 1 }])).toBe(false)
  })

  it('an array too large for a Map or Set answers or ends in the limit error', LONG, () => {
    const large = Array.from({ length: 2 ** 24 + 1 }, (_, i) => i)

    const copy = large.slice()

    expect(matches([7])(large)).toBe(true)
    expect(matches(large)(copy)).toBe(true)
    expect(() => matches(large)(copy.reverse())).toThrow(LIMIT_ERROR)
  })

  it('a full memo keeps what it holds and stops adding', () => {
    const early = readCounter(1)
    const late = readCounter(1)
    const flood = memoFlood()
    const earlyShape = { v: 1 }
    const lateShape = { v: 1 }

    expect(
      matches({
        early: earlyShape,
        flood: flood.shape,
        late: lateShape,
        lateAgain: lateShape,
        earlyAgain: earlyShape
      })({
        early: early.leaf,
        flood: flood.target,
        late: late.leaf,
        lateAgain: late.leaf,
        earlyAgain: early.leaf
      })
    ).toBe(true)

    expect(early.reads()).toBe(1)
    expect(late.reads()).toBe(2)
  })

  it('a tower that doubles per level past the memo ends in a catchable error', LONG, () => {
    const flood = memoFlood()
    const shape = { flood: flood.shape, tower: arrDag(40, [7]) }
    const target = { flood: flood.target, tower: arrDag(40, [7]) }

    expect(() => matches(shape)(target)).toThrow(LIMIT_ERROR)

    const deep = arrChain(900, [7])
    expect(matches(deep)(arrChain(900, [7]))).toBe(true)
  })

  it('a hostile shape x target scan ends in a catchable error', LONG, () => {
    const rows = 6000
    const shape = Array.from({ length: rows }, () => ({ a: {} }))
    const target = [
      ...Array.from({ length: rows }, () => ({ a: 1 })),
      ...Array.from({ length: rows }, () => ({ a: {} }))
    ]

    expect(() => matches(shape)(target)).toThrow(LIMIT_ERROR)
  })

  it('wide rows walked again past the memo count their keys', LONG, () => {
    function rowsOfWidth(keys: number): boolean {
      const row = (first: () => number) => {
        const out: Record<string, () => number> = { first }
        for (let i = 0; i < keys; i++) out['k' + String(i)] = pass
        return out
      }
      const rows = 2 ** 10
      const expected = row(pass)
      const fails = row(fail)
      const flood = memoFlood(3300)
      return matches({
        flood: flood.shape,
        rows: Array.from({ length: rows }, () => ({ a: expected }))
      })({
        flood: flood.target,
        rows: [
          ...Array.from({ length: rows }, () => ({ a: fails })),
          ...Array.from({ length: rows }, () => ({ a: row(pass) }))
        ]
      })
    }

    expect(rowsOfWidth(1)).toBe(true)
    expect(() => rowsOfWidth(1000)).toThrow(LIMIT_ERROR)
  })
})

describe('matches cycles', () => {
  it('a pair reached twice on one cycle resolves below the nesting cap', () => {
    function selfPair(...tail: number[]): unknown[] {
      const a: unknown[] = []
      a.push(a, a, ...tail)
      return a
    }
    expect(matches(selfPair())(selfPair())).toBe(true)
    expect(matches(selfPair(1))(selfPair(2))).toBe(false)
  })

  /** Two-node cycle: `node.x.back === node`, with `node.y` read after the cycle edge. */
  function ring(y: () => number): { node: object; back: object } {
    const node: Record<string, unknown> = {}
    const back = { back: node }
    node.x = back
    node.y = y
    return { node, back }
  }

  it('rejects a pair whose cycle partner failed after proving it', () => {
    const shape = ring(pass)
    const failing = ring(fail)
    const passing = ring(pass)
    const elements = [failing.node, passing.node]

    expect(matches([{ u: [shape.node], k: shape.back }])([{ u: elements, k: failing.back }])).toBe(
      false
    )
    expect(matches([{ u: [shape.node], k: shape.back }])([{ u: elements, k: passing.back }])).toBe(
      true
    )
  })

  it('keeps a proof that became final through a later failure', () => {
    const { leaf, reads } = readCounter({})
    const shapeLoop: Record<string, unknown> = {}
    const shapeBack = { v: {}, loop: shapeLoop }
    shapeLoop.back = shapeBack
    const targetLoop: Record<string, unknown> = {}
    const targetBack = Object.create(leaf) as Record<string, unknown>
    targetBack.loop = targetLoop
    targetLoop.back = targetBack
    const item = { loop: shapeLoop, back: shapeBack, fails: {} }

    expect(
      matches([item])([
        { loop: targetLoop, back: targetBack, fails: 1 },
        { loop: targetLoop, back: targetBack, fails: {} }
      ])
    ).toBe(true)

    expect(reads()).toBe(1)
  })

  /** A failing tower where every level assumes its own pair and offers the same rows twice. */
  function failingTower(levels: number): { shape: object; target: object; reads: () => number } {
    const { leaf, reads } = readCounter(fail)
    let shape: Record<string, unknown> = { y: { v: pass } }
    let target: Record<string, unknown> = { y: leaf, z: 1 }
    for (let i = 0; i < levels; i++) {
      const nextShape: Record<string, unknown> = {}
      nextShape.x = { back: nextShape, l: [shape] }
      nextShape.y = { v: pass }
      const nextTarget: Record<string, unknown> = {}
      nextTarget.x = { back: nextTarget, l: [target, target, shape] }
      nextTarget.y = { v: fail }
      nextTarget.z = 1
      shape = nextShape
      target = nextTarget
    }
    return { shape, target, reads }
  }

  it('remembers a failed pair whose tentative pairs rolled back', () => {
    const { shape, target, reads } = failingTower(14)

    expect(matches({ tower: shape })({ tower: target })).toBe(false)
    expect(reads()).toBe(1)
  })

  /** A shape path against a DAG target that fails at the bottom, every node naming the root. */
  function parentPointerDag(depth: number): { shape: object; target: object } {
    const shape: Record<string, unknown> = {}
    const target: Record<string, unknown> = {}
    let s: object = { up: shape, v: pass }
    let t: object = { up: target, v: fail }
    for (let i = 0; i < depth; i++) {
      s = { up: shape, kids: [s] }
      t = { up: target, kids: [t, t] }
    }
    shape.top = s
    target.top = t
    return { shape, target }
  }

  it('an assumption does not cost a failure its memo when nothing competes for an element', () => {
    const { shape, target } = parentPointerDag(60)

    expect(matches(shape)(target)).toBe(false)
  })

  /** `second` only matches once the pair it runs through has failed for its own reason. */
  function claimedUnderAssumption(): { shape: object; target: object } {
    const failingShape: Record<string, unknown> = {}
    const second = [{ q: failingShape }, { y: 1 }]
    failingShape.w = second
    failingShape.z = pass
    const failingTarget: Record<string, unknown> = {}
    const passingTarget: Record<string, unknown> = {}
    const secondTarget = [{ q: failingTarget, y: 1 }, { q: passingTarget }]
    failingTarget.w = secondTarget
    failingTarget.z = fail
    passingTarget.w = [{ q: passingTarget }, { y: 1 }]
    passingTarget.z = pass
    return {
      shape: { u: [{ r: failingShape }], second },
      target: { u: [{ r: failingTarget }, { r: passingTarget }], second: secondTarget }
    }
  }

  it('a failure caused by a claim on an assumed pair does not outlive the assumption', () => {
    const { shape, target } = claimedUnderAssumption()

    expect(matches(shape)(target)).toBe(true)
  })

  it('a failure that refuted its own assumption is walked again', () => {
    const shapeInner: unknown[] = []
    const shapeOuter = [shapeInner]
    shapeInner.push(shapeOuter, shapeInner)
    const leaf: unknown[] = []
    const loop: unknown[] = []
    const fork = [loop, leaf]
    leaf.push(fork)
    loop.push(loop, leaf)

    expect(matches([shapeOuter])([[fork]])).toBe(false)
  })

  it('a pair keeps one answer where greedy cycles leave several consistent ones', () => {
    const shapeLoop: unknown[] = []
    shapeLoop.push(shapeLoop, [{}])
    const first: unknown[] = []
    const second: unknown[] = []
    const root: unknown[] = []
    first.push(second, {}, root)
    second.push(first, {}, root)
    root.push([first, {}, first], second)

    expect(
      matches({ u: [{ r: shapeLoop }], again: shapeLoop })({ u: [{ r: root }], again: second })
    )
      // `second` failed while `root` was proved, as it does in Lodash.
      .toBe(false)
  })

  it('a resolved contest leaves later failures remembered', () => {
    const contest = claimedUnderAssumption()
    const dagPair = parentPointerDag(60)

    expect(
      matches({ contest: contest.shape, dag: dagPair.shape })({
        contest: contest.target,
        dag: dagPair.target
      })
    ).toBe(false)
  })
})
