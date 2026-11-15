import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import {
  bytesOf,
  isArguments,
  isError,
  isFloatView,
  kindOf,
  sameClass,
  unbox
} from '../src/internal/kind.ts'
import {
  Ancestors,
  DEPTH_ERROR,
  enterDepth,
  exitDepth,
  guardDepth,
  MAX_DEPTH,
  RevisitBudget
} from '../src/internal/walk.ts'

function descend(levels: number): number {
  if (levels === 0) return 0
  enterDepth()
  try {
    return 1 + descend(levels - 1)
  } finally {
    exitDepth()
  }
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

  it('isError accepts errors from any realm and refuses look-alikes', () => {
    expect(isError(new TypeError('x'))).toBe(true)
    expect(isError(runInNewContext('new Error("x")'))).toBe(true)
    expect(isError({ name: 'Error', message: 'x' })).toBe(false)
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
