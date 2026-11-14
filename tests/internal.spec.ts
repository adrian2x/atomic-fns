import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { enumerableKeys } from '../src/internal/keys.ts'
import {
  bytesOf,
  contentKindOf,
  isArguments,
  isFloatView,
  kindOf,
  mapSize,
  sameClass,
  setSize,
  typedArrayLength,
  typedArrayName,
  unbox
} from '../src/internal/kind.ts'
import {
  assertNotHugeSparse,
  isCanonicalArrayIndex,
  isHugeSparse,
  walkArray,
  walkArrayIndices,
  type ArrayIndexWalkEvent,
  type ArrayWalkEvent
} from '../src/internal/sparse.ts'
import { truncateForError } from '../src/internal/truncate.ts'
import {
  Ancestors,
  DEPTH_ERROR,
  enterDepth,
  exitDepth,
  guardDepth,
  MAX_DEPTH,
  RevisitBudget
} from '../src/internal/walk.ts'
import { sparse as holey } from './sparse.ts'

function descend(levels: number): number {
  if (levels === 0) return 0
  enterDepth()
  try {
    return 1 + descend(levels - 1)
  } finally {
    exitDepth()
  }
}

function hugeSparse(): unknown[] {
  return holey(4_294_967_294, { 0: 'x', 1e9: 'y', 4e9: 'admin' })
}

describe('depth guard', () => {
  it('allows MAX_DEPTH levels and throws one past it', () => {
    expect(guardDepth(() => descend(MAX_DEPTH))).toBe(MAX_DEPTH)
    expect(() => guardDepth(() => descend(MAX_DEPTH + 1))).toThrow(new RangeError(DEPTH_ERROR))
    expect(guardDepth(() => descend(10))).toBe(10)
  })

  it('turns an engine stack overflow into the depth error', () => {
    const overflow = new RangeError('Maximum call stack size exceeded')
    expect(() =>
      guardDepth(() => {
        throw overflow
      })
    ).toThrow(new RangeError(DEPTH_ERROR, { cause: overflow }))
    const spiderMonkey = Object.assign(new Error('too much recursion'), { name: 'InternalError' })
    expect(() =>
      guardDepth(() => {
        throw spiderMonkey
      })
    ).toThrow(new RangeError(DEPTH_ERROR, { cause: spiderMonkey }))
  })

  it('lets errors other than a stack overflow through', () => {
    const other = Object.assign(new Error('out of range'), { name: 'InternalError' })
    expect(() =>
      guardDepth(() => {
        throw other
      })
    ).toThrow(other)
  })

  it('gives the next walk the full depth after one throws', () => {
    expect(() =>
      guardDepth(() => {
        enterDepth()
        throw new Error('stop')
      })
    ).toThrow('stop')
    expect(guardDepth(() => descend(MAX_DEPTH))).toBe(MAX_DEPTH)
  })

  it('counts a walk started inside another from the outer depth', () => {
    const nested = (): number => {
      enterDepth()
      try {
        return guardDepth(() => descend(MAX_DEPTH))
      } finally {
        exitDepth()
      }
    }
    expect(() => guardDepth(nested)).toThrow(new RangeError(DEPTH_ERROR))
  })

  it('keeps the outer count after a nested walk returns', () => {
    const outer = (): number => {
      enterDepth()
      try {
        expect(guardDepth(() => descend(10))).toBe(10)
        return descend(MAX_DEPTH)
      } finally {
        exitDepth()
      }
    }
    expect(() => guardDepth(outer)).toThrow(new RangeError(DEPTH_ERROR))
  })
})

describe('Ancestors', () => {
  it('tells the current path from shared objects', () => {
    const path = new Ancestors()
    const a = {}
    const b = {}
    guardDepth(() => {
      path.enter(a)
      expect(path.has(a)).toBe(true)
      path.enter(b)
      expect(path.has(a)).toBe(true)
      path.leave(b)
      expect(path.has(b)).toBe(false)
      path.leave(a)
      expect(path.has(a)).toBe(false)
    })
  })

  it('counts each step against the depth limit and gives it back on leave', () => {
    const path = new Ancestors()
    guardDepth(() => {
      const last = {}
      for (let i = 1; i < MAX_DEPTH; i++) path.enter({})
      path.enter(last)
      expect(() => path.enter({})).toThrow(new RangeError(DEPTH_ERROR))
      path.leave(last)
      expect(() => path.enter({})).not.toThrow()
    })
  })
})

describe('RevisitBudget', () => {
  it('charges only repeat expansions, by width', () => {
    const budget = new RevisitBudget(2, 'too much sharing')
    const row = {}
    budget.note(row, 32)
    budget.note({}, 1000)
    budget.note(row, 32)
    expect(() => budget.note(row, 1)).toThrow(new RangeError('too much sharing'))
  })

  it('an empty container costs nothing', () => {
    const budget = new RevisitBudget(0, 'never')
    const empty = {}
    for (let i = 0; i < 100; i++) budget.note(empty, 0)
  })
})

describe('sparse arrays', () => {
  it.each([
    {
      length: 4,
      indices: [0, 3],
      expected: [
        { kind: 'index', index: 0 },
        { kind: 'holeRun', start: 1, end: 3 },
        { kind: 'index', index: 3 }
      ]
    },
    {
      length: 500,
      indices: [300, 301, 400],
      expected: [
        { kind: 'holeRun', start: 0, end: 300 },
        { kind: 'index', index: 300 },
        { kind: 'index', index: 301 },
        { kind: 'holeRun', start: 302, end: 400 },
        { kind: 'index', index: 400 },
        { kind: 'holeRun', start: 401, end: 500 }
      ]
    }
  ])('walkArrayIndices reports indices and hole runs: $length', ({ length, indices, expected }) => {
    const arr = new Array<unknown>(length)
    for (const index of indices) arr[index] = index
    const seen: ArrayIndexWalkEvent[] = []

    walkArrayIndices(arr, (event) => {
      seen.push(event)
    })

    expect(seen).toStrictEqual(expected)
  })

  function walkEvents(arr: unknown[]): ArrayWalkEvent[] {
    const events: ArrayWalkEvent[] = []
    walkArray(arr, (ev) => {
      events.push(ev)
    })
    return events
  }

  it('walkArray reports values and hole runs without visiting each hole', () => {
    expect(walkEvents(hugeSparse())).toEqual([
      { kind: 'value', index: 0, value: 'x' },
      { kind: 'holeRun', start: 1, end: 1e9 },
      { kind: 'value', index: 1e9, value: 'y' },
      { kind: 'holeRun', start: 1e9 + 1, end: 4e9 },
      { kind: 'value', index: 4e9, value: 'admin' },
      { kind: 'holeRun', start: 4e9 + 1, end: 4_294_967_294 }
    ])
  })

  it('walkArray reports a short hole run between values', () => {
    expect(walkEvents(holey(4, { 0: 1, 3: 4 }))).toEqual([
      { kind: 'value', index: 0, value: 1 },
      { kind: 'holeRun', start: 1, end: 3 },
      { kind: 'value', index: 3, value: 4 }
    ])
  })

  it('walkArray reports one hole run when no element follows the switch to Object.keys', () => {
    const tail: unknown[] = ['a']
    tail.length = 1000
    expect(walkEvents(tail)).toEqual([
      { kind: 'value', index: 0, value: 'a' },
      { kind: 'holeRun', start: 1, end: 1000 }
    ])
  })

  it('walkArray skips named keys and stays below length after the switch to Object.keys', () => {
    const named: unknown[] = []
    named.length = 2000
    named[1000] = 'own'
    Object.assign(named, { ' 500': 'named', '4294967295': 'past' })
    expect(walkEvents(named)).toEqual([
      { kind: 'holeRun', start: 0, end: 1000 },
      { kind: 'value', index: 1000, value: 'own' },
      { kind: 'holeRun', start: 1001, end: 2000 }
    ])
  })

  it('walkArray stops when the visitor returns false', () => {
    const seen: unknown[] = []
    walkArray([1, 2, 3], (ev) => {
      if (ev.kind === 'value') seen.push(ev.value)
      return ev.kind === 'value' && ev.value === 2 ? false : undefined
    })
    expect(seen).toEqual([1, 2])
  })

  it('walkArray stops after Object.keys when the visitor returns false', () => {
    const events: ArrayWalkEvent[] = []
    walkArray(hugeSparse(), (ev) => {
      events.push(ev)
      return ev.kind === 'holeRun' ? false : undefined
    })
    expect(events).toEqual([
      { kind: 'value', index: 0, value: 'x' },
      { kind: 'holeRun', start: 1, end: 1e9 }
    ])
  })

  it('walkArray treats inherited and non-enumerable indices as holes at any spacing', () => {
    const shape = (length: number): unknown[] => {
      const arr: unknown[] = ['a']
      arr.length = length
      Object.defineProperty(arr, length - 1, { value: 'hidden', enumerable: false })
      return arr
    }
    expect(walkEvents(shape(200))).toEqual([
      { kind: 'value', index: 0, value: 'a' },
      { kind: 'holeRun', start: 1, end: 200 }
    ])
    expect(walkEvents(shape(1000))).toEqual([
      { kind: 'value', index: 0, value: 'a' },
      { kind: 'holeRun', start: 1, end: 1000 }
    ])
    const proto = Object.prototype as Record<number, unknown>
    proto[1] = 'inherited'
    proto[999] = 'inherited'
    try {
      expect(walkEvents(holey(3, { 0: 0, 2: 2 }))).toEqual([
        { kind: 'value', index: 0, value: 0 },
        { kind: 'holeRun', start: 1, end: 2 },
        { kind: 'value', index: 2, value: 2 }
      ])
      const far: unknown[] = [0]
      far.length = 1000
      expect(walkEvents(far)).toEqual([
        { kind: 'value', index: 0, value: 0 },
        { kind: 'holeRun', start: 1, end: 1000 }
      ])
    } finally {
      delete proto[1]
      delete proto[999]
    }
  })

  it('isHugeSparse needs a length past 2^24 and mostly holes', { timeout: 30_000 }, () => {
    expect(isHugeSparse(hugeSparse())).toBe(true)
    const sparse: unknown[] = []
    sparse.length = 2 ** 24 + 1
    sparse[0] = 'x'
    expect(isHugeSparse(sparse)).toBe(true)
    const atLimit: unknown[] = []
    atLimit.length = 2 ** 24
    atLimit[0] = 'x'
    expect(isHugeSparse(atLimit)).toBe(false)
    expect(isHugeSparse(new Array(2 ** 20))).toBe(false)
    expect(isHugeSparse(Array.from({ length: 1000 }, (_, i) => i))).toBe(false)
    expect(isHugeSparse(new Array(2 ** 24 + 1).fill(0))).toBe(false)
  })

  it('assertNotHugeSparse throws only for a huge sparse array', () => {
    expect(() => assertNotHugeSparse(hugeSparse())).toThrow(
      new RangeError('sparse array too large')
    )
    expect(() => assertNotHugeSparse([1, 2])).not.toThrow()
  })

  it('isCanonicalArrayIndex accepts 0..2^32-2 without leading zeros', () => {
    expect(isCanonicalArrayIndex('0')).toBe(true)
    expect(isCanonicalArrayIndex('4294967294')).toBe(true)
    expect(isCanonicalArrayIndex('4294967295')).toBe(false)
    expect(isCanonicalArrayIndex('99999999999999999999')).toBe(false)
    expect(isCanonicalArrayIndex('01')).toBe(false)
    expect(isCanonicalArrayIndex('-1')).toBe(false)
    expect(isCanonicalArrayIndex(' 1')).toBe(false)
    expect(isCanonicalArrayIndex('1.0')).toBe(false)
  })
})

describe('truncateForError', () => {
  it('quotes a short string whole', () => {
    expect(truncateForError('short')).toBe('"short"')
    expect(truncateForError('x'.repeat(40))).toBe(`"${'x'.repeat(40)}"`)
  })

  it('cuts a long string on a code point', () => {
    expect(truncateForError('x'.repeat(1e6))).toBe(`"${'x'.repeat(40)}"...`)
    expect(truncateForError(`${'x'.repeat(39)}😀`)).toBe(`"${'x'.repeat(39)}"...`)
  })

  it('escapes control characters in the kept units only', () => {
    expect(truncateForError('a\nb')).toBe('"a\\nb"')
    expect(truncateForError('\u0001'.repeat(1e6))).toBe(`"${'\\u0001'.repeat(40)}"...`)
  })
})

describe('kinds', () => {
  it('recognizes built-in kinds across realms', () => {
    expect(kindOf({})).toBe('plain')
    expect(kindOf([])).toBe('array')
    expect(kindOf(new Map())).toBe('map')
    expect(kindOf(new Set())).toBe('set')
    expect(kindOf(new Date(0))).toBe('date')
    expect(kindOf(/a/)).toBe('regexp')
    expect(kindOf(new Uint8Array(1))).toBe('view')
    expect(kindOf(new DataView(new ArrayBuffer(1)))).toBe('view')
    expect(kindOf(new ArrayBuffer(1))).toBe('buffer')
    expect(kindOf(new SharedArrayBuffer(1))).toBe('buffer')
    expect(kindOf(Object(1))).toBe('boxed')
    expect(kindOf(runInNewContext('new Map()'))).toBe('map')
    expect(kindOf(runInNewContext('new Set()'))).toBe('set')
    expect(kindOf(runInNewContext('new Date(0)'))).toBe('date')
    expect(kindOf(runInNewContext('/a/'))).toBe('regexp')
    expect(kindOf(runInNewContext('new ArrayBuffer(1)'))).toBe('buffer')
    expect(kindOf(new (class Point {})())).toBe('other')
    expect(kindOf(new Error('x'))).toBe('other')
    expect(kindOf(() => {})).toBe('other')
  })

  it('unbox returns the primitive inside a wrapper', () => {
    expect(unbox(Object(1n))).toBe(1n)
    expect(unbox(Object('a'))).toBe('a')
  })

  it('unbox leaves ordinary objects unchanged', () => {
    const plain = {}
    expect(unbox(plain)).toBe(plain)
  })

  it('bytesOf reads the bytes a view covers', () => {
    expect([...bytesOf(new Uint16Array(new Uint8Array([1, 0]).buffer))]).toStrictEqual([1, 0])
    expect([...bytesOf(new Uint8Array([1, 2, 3]).subarray(1))]).toEqual([2, 3])
  })

  it('bytesOf finds no bytes in a detached view', () => {
    const view = new Uint8Array(8)
    view.buffer.transfer()
    expect(bytesOf(view)).toHaveLength(0)
  })

  it('reads sizes and typed array metadata', () => {
    const map = new Map([[1, 1]])
    const set = new Set([1, 2])
    const floats = new Float64Array(3)
    expect(mapSize(map)).toBe(1)
    expect(setSize(set)).toBe(2)
    expect(typedArrayLength(floats)).toBe(3)
    expect(typedArrayLength(new DataView(new ArrayBuffer(4)))).toBeUndefined()
    expect(typedArrayName(floats)).toBe('Float64Array')
    expect(typedArrayName(new DataView(new ArrayBuffer(4)))).toBeUndefined()
  })

  it('contentKindOf adds errors and arguments to the kinds', () => {
    expect(contentKindOf(new TypeError('x'))).toBe('error')
    expect(contentKindOf(runInNewContext('(function () { return arguments })(1)'))).toBe(
      'arguments'
    )
    expect(contentKindOf(new Map())).toBe('map')
    expect(contentKindOf(new (class Point {})())).toBe('other')
  })

  it('enumerableKeys lists own enumerable strings, then symbols', () => {
    const hidden = Symbol('hidden')
    const shown = Symbol('shown')
    const value = Object.defineProperties({ b: 1, a: 2, [shown]: 3 } as object, {
      c: { value: 4, enumerable: false },
      [hidden]: { value: 5, enumerable: false }
    })
    expect(enumerableKeys(value)).toEqual(['b', 'a', shown])
    expect(enumerableKeys(Object.create({ inherited: 1 }) as object)).toEqual([])
  })

  it('isFloatView recognizes float element types across realms', () => {
    expect(isFloatView(new Float32Array(1))).toBe(true)
    expect(isFloatView(runInNewContext('new Float64Array(1)'))).toBe(true)
    expect(isFloatView(new Int32Array(1))).toBe(false)
    expect(isFloatView(new DataView(new ArrayBuffer(8)))).toBe(false)
  })

  it('sameClass accepts twin prototypes from another realm', () => {
    expect(sameClass({}, Object.create(null) as object)).toBe(true)
    expect(sameClass(new Map(), runInNewContext('new Map()'))).toBe(true)
    class MyMap extends Map {}
    expect(sameClass(new MyMap(), new Map())).toBe(false)
    expect(sameClass([], {})).toBe(false)
  })

  it('sameClass refuses two classes of one name from one realm', () => {
    const first = class Point {}
    const second = class Point {}
    expect(sameClass(new first(), new second())).toBe(false)
  })

  it('isArguments accepts arguments objects from any realm and refuses look-alikes', () => {
    const args = (function (..._rest: unknown[]) {
      // biome-ignore lint/complexity/noArguments: the arguments object is the value under test
      return arguments
    })(1, 2)
    expect(isArguments(args)).toBe(true)
    expect(isArguments(runInNewContext('(function () { return arguments })(1)'))).toBe(true)
    expect(isArguments([1])).toBe(false)
    expect(kindOf(args)).toBe('other')
  })
})
