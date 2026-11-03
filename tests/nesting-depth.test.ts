import { describe, expect, it } from 'vitest'
import {
  BTree,
  clone,
  Deque,
  flatten,
  FrozenSet,
  Heap,
  LRUCache,
  matches,
  merge,
  omit,
  SortedMap,
  SortedSet,
  SplayTree,
  Trie
} from '../src/collections/index.js'
import { getNestingDepth, HOOK_NESTING_COST } from '../src/internal/nesting.js'
import { deepEqual } from '../src/operators/index.js'

function nestArray(depth: number): unknown {
  return JSON.parse('['.repeat(depth) + ']'.repeat(depth))
}

function nestObject(depth: number): unknown {
  return JSON.parse('{"a":'.repeat(depth) + '1' + '}'.repeat(depth))
}

const NESTING_MSG = 'nesting deeper than 1000 levels'
const DEEP = 1500

function nestDeque(depth: number): Deque<unknown> {
  let d = new Deque<unknown>([0])
  for (let i = 1; i < depth; i++) d = new Deque<unknown>([d])
  return d
}

function nestSortedSet(depth: number): SortedSet<unknown> {
  let s = new SortedSet<unknown>([0])
  for (let i = 1; i < depth; i++) s = new SortedSet<unknown>([s])
  return s
}

function nestSortedMap(depth: number): SortedMap<number, unknown> {
  let m = new SortedMap<number, unknown>([[0, 0]])
  for (let i = 1; i < depth; i++) m = new SortedMap<number, unknown>([[0, m]])
  return m
}

function nestFrozen(depth: number): FrozenSet {
  let s: FrozenSet = new FrozenSet([0])
  for (let i = 1; i < depth; i++) s = new FrozenSet([s])
  return s
}

/** Comparator ties every item so Heap.equals reaches deepEqual on nested heaps. */
function nestHeap(depth: number): Heap<unknown> {
  const cmp = (): number => 0
  let h = new Heap<unknown>([0], cmp)
  for (let i = 1; i < depth; i++) h = new Heap<unknown>([h], cmp)
  return h
}

function nestLRU(depth: number): LRUCache<number> {
  let c = new LRUCache<number, unknown>(8)
  c.set(0, 0)
  for (let i = 1; i < depth; i++) {
    const n = new LRUCache<number, unknown>(8)
    n.set(0, c)
    c = n
  }
  return c
}

/** Trie cannot hold Tries; nest a Trie at every Deque level so Trie.equals re-enters each hop. */
function nestTrie(depth: number): Deque<unknown> {
  let d = new Deque<unknown>([new Trie(['0'])])
  for (let i = 1; i < depth; i++) d = new Deque([new Trie([String(i)]), d])
  return d
}

function nestBTree(depth: number): BTree<number> {
  let t = new BTree<number, unknown>([[0, 0]])
  for (let i = 1; i < depth; i++) t = new BTree([[0, t]])
  return t
}

function nestSplay(depth: number): SplayTree<number> {
  let t = new SplayTree<number, unknown>()
  t.set(0, 0)
  for (let i = 1; i < depth; i++) {
    const n = new SplayTree<number, unknown>()
    n.set(0, t)
    t = n
  }
  return t
}

describe('MAX_NESTING_DEPTH = 1000', () => {
  it('deepEqual: depth 1000 works, 1001 throws', () => {
    const a1000 = nestArray(1000)
    expect(deepEqual(a1000, nestArray(1000))).toBe(true)
    expect(() => deepEqual(nestArray(1001), nestArray(1001))).toThrow(RangeError)
    expect(() => deepEqual(nestArray(1001), nestArray(1001))).toThrow(NESTING_MSG)
  })

  it('deepEqual accepts 1000-deep object/array ending in a primitive', () => {
    expect(deepEqual(nestObject(1000), nestObject(1000))).toBe(true)
    expect(
      deepEqual(
        JSON.parse('['.repeat(999) + '[1]' + ']'.repeat(999)),
        JSON.parse('['.repeat(999) + '[1]' + ']'.repeat(999))
      )
    ).toBe(true)
  })

  it('clone deep: depth 1000 works, 1001 throws', () => {
    expect(clone(nestArray(1000), true)).toEqual(nestArray(1000))
    expect(() => clone(nestArray(1001), true)).toThrow(NESTING_MSG)
  })

  it('merge: depth 1000 works, 1001 throws', () => {
    expect(merge({}, nestObject(1000) as object)).toEqual(nestObject(1000))
    expect(() => merge({}, nestObject(1001) as object)).toThrow(NESTING_MSG)
  })

  it('matches: depth 1000 works, 1001 throws', () => {
    const s1000 = nestObject(1000)
    expect(matches(s1000)(nestObject(1000))).toBe(true)
    expect(() => matches(nestObject(1001))(nestObject(1001))).toThrow(NESTING_MSG)
  })

  it('flatten: depth 1000 works, 1001 throws', () => {
    expect(flatten(nestArray(1000) as unknown[], true)).toEqual([])
    expect(() => flatten(nestArray(1001) as unknown[], true)).toThrow(NESTING_MSG)
    expect(flatten(nestObject(1000) as object)).toEqual({
      ['a.'.repeat(999) + 'a']: 1
    })
    expect(() => flatten(nestObject(1001) as object)).toThrow(NESTING_MSG)
  })

  it('5000-deep probe throws RangeError under 50ms', () => {
    const deep = nestArray(5000)
    for (const fn of [
      () => deepEqual(deep, nestArray(5000)),
      () => clone(deep, true),
      () => merge({}, { x: deep }),
      () => matches({ x: deep })({ x: nestArray(5000) }),
      () => flatten(deep as unknown[], true)
    ]) {
      const start = performance.now()
      expect(fn).toThrow(NESTING_MSG)
      expect(performance.now() - start).toBeLessThan(50)
    }
  })

  it('collection hook re-entry: every type hits the cap under deepEqual and clone(deep)', () => {
    expect(HOOK_NESTING_COST).toBe(8)

    // FrozenSet/Trie membership is not structural, so equality nests them inside Deque so the
    // equals hook still re-enters every level; clone can self-nest FrozenSet values.
    function nestFrozenEq(depth: number): Deque<unknown> {
      let d = new Deque<unknown>([new FrozenSet([0])])
      for (let i = 1; i < depth; i++) d = new Deque([new FrozenSet([i]), d])
      return d
    }

    const eqNests: [string, (d: number) => unknown][] = [
      ['Deque', nestDeque],
      ['SortedSet', nestSortedSet],
      ['SortedMap', nestSortedMap],
      ['FrozenSet', nestFrozenEq],
      ['Heap', nestHeap],
      ['LRUCache', nestLRU],
      ['Trie', nestTrie],
      ['BTree', nestBTree],
      ['SplayTree', nestSplay]
    ]
    const cloneNests: [string, (d: number) => unknown][] = [
      ['Deque', nestDeque],
      ['SortedSet', nestSortedSet],
      ['SortedMap', nestSortedMap],
      ['FrozenSet', nestFrozen],
      ['Heap', nestHeap],
      ['LRUCache', nestLRU],
      ['Trie', nestTrie],
      ['BTree', nestBTree],
      ['SplayTree', nestSplay]
    ]

    for (const [name, nest] of eqNests) {
      expect(() => deepEqual(nest(DEEP), nest(DEEP)), `${name} deepEqual`).toThrow(NESTING_MSG)
      expect(getNestingDepth(), `${name} deepEqual counter`).toBe(0)
    }
    for (const [name, nest] of cloneNests) {
      expect(() => clone(nest(DEEP), true), `${name} clone`).toThrow(NESTING_MSG)
      expect(getNestingDepth(), `${name} clone counter`).toBe(0)
    }
    expect(deepEqual(1, 1)).toBe(true)
    expect(deepEqual([1], [1])).toBe(true)
  })

  it('omit cyclic deep path hits nesting cap, not stack overflow', () => {
    const o: { a?: unknown } = {}
    o.a = o
    const path = 'a.'.repeat(3000) + 'b'
    expect(() => omit(o, [path])).toThrow(NESTING_MSG)
    expect(getNestingDepth()).toBe(0)
  })

  it('headroom: depth 1000 succeeds inside 3000 caller frames', () => {
    const deep = nestArray(1000)
    function rec(n: number, fn: () => void): void {
      if (n === 0) {
        fn()
        return
      }
      rec(n - 1, fn)
    }
    expect(() => {
      rec(3000, () => {
        expect(deepEqual(deep, nestArray(1000))).toBe(true)
      })
    }).not.toThrow()
    expect(() => {
      rec(3000, () => {
        expect(clone(deep, true)).toEqual(deep)
      })
    }).not.toThrow()
    expect(() => {
      rec(3000, () => {
        expect(merge({}, nestObject(1000) as object)).toEqual(nestObject(1000))
      })
    }).not.toThrow()
    expect(() => {
      rec(3000, () => {
        expect(matches(nestObject(1000))(nestObject(1000))).toBe(true)
      })
    }).not.toThrow()
    expect(() => {
      rec(3000, () => {
        expect(flatten(deep as unknown[], true)).toEqual([])
      })
    }).not.toThrow()
    expect(() => {
      rec(3000, () => {
        expect(omit({ a: { b: 1 } }, ['a.b'])).toEqual({ a: {} })
      })
    }).not.toThrow()
  })
})
