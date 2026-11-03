import { describe, expect, expectTypeOf, it } from 'vitest'
import { BTree } from '../src/collections/BTree.js'
import { Deque } from '../src/collections/deque.js'
import { FrozenSet } from '../src/collections/frozenset.js'
import { Heap } from '../src/collections/Heap.js'
import { LRUCache } from '../src/collections/LRUCache.js'
import { SortedMap } from '../src/collections/SortedMap.js'
import { SortedSet } from '../src/collections/SortedSet.js'
import { SplayTree } from '../src/collections/SplayTree.js'
import { Trie } from '../src/collections/Trie.js'

const oldNames = [
  'contains',
  'remove',
  'append',
  'appendleft',
  'popleft',
  'add',
  'top',
  'at',
  'empty',
  'length',
  'reversed',
  'first'
] as const

type Migrated = {
  name: string
  create: () => object
  sample: unknown
  skipOld?: readonly string[]
}

const migrated: Migrated[] = [
  {
    name: 'FrozenSet',
    create: () => new FrozenSet([1, 2]),
    sample: 1,
    skipOld: ['add']
  },
  {
    name: 'Heap',
    create: () => {
      const h = new Heap<number>()
      h.push(1)
      h.push(2)
      return h
    },
    sample: 1
  },
  {
    name: 'LRUCache',
    create: () => new LRUCache(4).set(1, 'a').set(2, 'b'),
    sample: 1
  },
  {
    name: 'Trie',
    create: () => new Trie(['ab', 'ac']),
    sample: 'ab',
    skipOld: ['add']
  },
  {
    name: 'SplayTree',
    create: () => new SplayTree<number, string>().set(1, 'a').set(2, 'b'),
    sample: 1
  },
  {
    name: 'BTree',
    create: () => new BTree<number, string>().set(1, 'a').set(2, 'b'),
    sample: 1
  },
  {
    name: 'SortedMap',
    create: () => new SortedMap<number, string>().set(1, 'a').set(2, 'b'),
    sample: 1
  },
  {
    name: 'SortedSet',
    create: () => new SortedSet([1, 2]),
    sample: 1,
    skipOld: ['add']
  },
  {
    name: 'Deque',
    create: () => new Deque([1, 2]),
    sample: 1,
    skipOld: ['at']
  }
]

describe('SPEC-R75 collection protocol (M8 classes)', () => {
  for (const m of migrated) {
    describe(m.name, () => {
      it('spread works', () => {
        const x = m.create()
        expect(() => [...(x as Iterable<unknown>)]).not.toThrow()
        expect([...(x as Iterable<unknown>)].length).toBeGreaterThan(0)
      })

      it('toStringTag equals class name', () => {
        const x = m.create()
        expect(Object.prototype.toString.call(x)).toBe(`[object ${m.name}]`)
      })

      it('forEach visits entries', () => {
        const x = m.create() as {
          forEach: (cb: (...a: unknown[]) => void) => void
          size: number
        }
        let n = 0
        x.forEach(() => {
          n++
        })
        expect(n).toBe(x.size)
      })

      it('keys values entries are Iterators', () => {
        const x = m.create() as {
          keys: () => IteratorObject<unknown>
          values: () => IteratorObject<unknown>
          entries: () => IteratorObject<unknown>
        }
        expect(x.keys()).toBeInstanceOf(Iterator)
        expect(x.values()).toBeInstanceOf(Iterator)
        expect(x.entries()).toBeInstanceOf(Iterator)
        expect(typeof x.keys().map).toBe('function')
      })

      it('old 1.x names absent on prototype', () => {
        const proto = Object.getPrototypeOf(m.create())
        for (const name of oldNames) {
          if (m.skipOld?.includes(name)) continue
          expect(name in proto, `${m.name}.prototype.${name}`).toBe(false)
        }
      })
    })
  }

  it('SPEC-R75 FrozenSet.union with Set interoperates', () => {
    const out = new Set([1]).union(new FrozenSet([2]))
    expect([...out].sort()).toEqual([1, 2])
  })

  it('SPEC-R75 SortedSet.union with Set interoperates', () => {
    const out = new Set([1]).union(new SortedSet([2]))
    expect([...out].sort()).toEqual([1, 2])
  })

  it('SetCollection key types stay precise (SortedSet values; Deque indices)', () => {
    expectTypeOf(new SortedSet<number>().keys()).toEqualTypeOf<IteratorObject<number>>()
    expectTypeOf(new SortedSet<number>().entries()).toEqualTypeOf<
      IteratorObject<[number, number]>
    >()
    expectTypeOf(new Deque<string>().keys()).toEqualTypeOf<IteratorObject<number>>()
    expectTypeOf(new Deque<string>().entries()).toEqualTypeOf<IteratorObject<[number, string]>>()
  })

  it('SPEC-R75 Collection Mapping Sequence not exported from collections', async () => {
    const mod = await import('../src/collections/index.js')
    expect('Collection' in mod).toBe(false)
    expect('Sequence' in mod).toBe(false)
    expect('Mapping' in mod).toBe(false)
    expect('LegacyCollection' in mod).toBe(false)
    expect('LegacySequence' in mod).toBe(false)
    expect('LegacyMapping' in mod).toBe(false)
    expect('Container' in mod).toBe(false)
    expect('Equals' in mod).toBe(false)
    expect('Ordered' in mod).toBe(false)
    expect('Reversible' in mod).toBe(false)
    expect('SortedTree' in mod).toBe(false)
    expect('SetCollection' in mod).toBe(true)
    expect('MapCollection' in mod).toBe(true)
    expect('SortedMap' in mod).toBe(true)
    expect('SortedSet' in mod).toBe(true)
    expect('Deque' in mod).toBe(true)
  })
})
