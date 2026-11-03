import { describe, expect, it } from 'vitest'
import { FrozenSet } from '../src/collections/frozenset.js'
import { Heap } from '../src/collections/Heap.js'
import { LRUCache } from '../src/collections/LRUCache.js'
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

  it('SPEC-R75 Collection Mapping Sequence not exported from collections', async () => {
    const mod = await import('../src/collections/index.js')
    expect('Collection' in mod).toBe(false)
    expect('Sequence' in mod).toBe(false)
    expect('Mapping' in mod).toBe(false)
    expect('LegacyCollection' in mod).toBe(false)
    expect('SetCollection' in mod).toBe(true)
    expect('MapCollection' in mod).toBe(true)
  })
})
