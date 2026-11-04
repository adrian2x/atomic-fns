import { afterEach, describe, expect, it, vi } from 'vitest'
import { Trie } from '../src/collections/Trie.js'

describe('Trie', () => {
  it('SPEC-R81 empty', () => {
    const tree = new Trie()
    expect(tree.size).toBe(0)
    expect(tree.has('')).toBe(false)
  })

  it('SPEC-R81 add and has', () => {
    const tree = new Trie()
    const words = ['cat', 'can', 'dog', 'dark', 'an']
    for (const w of words) {
      tree.add(w)
      expect(tree.has(w)).toBe(true)
    }
    expect(tree.has('ca')).toBe(false)
  })

  it('SPEC-R81 constructor loads words', () => {
    const words = ['cat', 'can', 'dog', 'dark', 'an']
    const tree = new Trie(words)
    expect(tree.size).toBe(words.length)
    for (const w of words) expect(tree.has(w)).toBe(true)
  })

  it('SPEC-R81 duplicate add keeps size 1', () => {
    const tree = new Trie()
    tree.add('x')
    tree.add('x')
    expect(tree.size).toBe(1)
    expect(tree.has('x')).toBe(true)
  })

  it('SPEC-R81 matches yields insertion order with limit', () => {
    const words = ['cat', 'can', 'dog', 'dark', 'dam', 'an']
    const tree = new Trie(words)
    expect([...tree.matches('ca')]).toEqual(['cat', 'can'])
    expect([...tree.matches('da')]).toEqual(['dark', 'dam'])
    expect([...tree.matches('d')]).toEqual(['dog', 'dark', 'dam'])
    const many = new Trie()
    for (let i = 0; i < 30; i++) many.add('a' + String(i).padStart(2, '0'))
    expect([...many.matches('a', 5)]).toHaveLength(5)
  })

  it('SPEC-R81 delete missing returns false and prune keeps siblings', () => {
    const tree = new Trie(['ab'])
    expect(tree.delete('ac')).toBe(false)
    expect(tree.has('ab')).toBe(true)
    const words = ['cat', 'can', 'dog', 'dark', 'an']
    const t2 = new Trie(words)
    for (const w of words) {
      if (w.startsWith('c')) {
        expect(t2.delete(w)).toBe(true)
        expect(t2.delete(w)).toBe(false)
        expect(t2.has(w)).toBe(false)
      }
    }
    expect([...t2.matches('c')]).toEqual([])
  })

  it('SPEC-R81 add and delete empty string', () => {
    const tree = new Trie()
    tree.add('')
    expect(tree.size).toBe(1)
    expect(tree.has('')).toBe(true)
    expect(tree.delete('')).toBe(true)
    expect(tree.has('')).toBe(false)
    expect(tree.size).toBe(0)
    expect(tree.delete('')).toBe(false)
  })

  it('SPEC-R81 Map-node insertion order for matches', () => {
    const tree = new Trie()
    tree.add('ba')
    tree.add('bc')
    tree.add('bb')
    expect([...tree.matches('b')]).toEqual(['ba', 'bc', 'bb'])
  })

  it('SPEC-R81 200k-char word', () => {
    const word = 'x'.repeat(200_000)
    const tree = new Trie()
    tree.add(word)
    expect(tree.size).toBe(1)
    expect(tree.has(word)).toBe(true)
    expect(tree.has(word + 'y')).toBe(false)
    expect(tree.delete(word)).toBe(true)
    expect(tree.size).toBe(0)
  })

  it('100k-char word values and matches without stack overflow', () => {
    const word = 'a'.repeat(100_000)
    const tree = new Trie([word])
    expect([...tree.values()]).toEqual([word])
    expect([...tree.matches(word.slice(0, 10))]).toEqual([word])
  })

  it('SPEC-R81 non-string add throws TypeError', () => {
    const tree = new Trie()
    expect(() => tree.add(1 as unknown as string)).toThrow(TypeError)
    expect(() => tree.add(1 as unknown as string)).toThrow('Trie stores strings')
  })

  it('SPEC-R81 clear empties', () => {
    const tree = new Trie(['cat', 'can', 'dog', 'dark', 'an'])
    expect(tree.size).toBe(5)
    tree.clear()
    expect(tree.size).toBe(0)
    expect([...tree.matches('')]).toEqual([])
  })

  it('SPEC-R81 values iterates all words', () => {
    const words = ['cat', 'can', 'dog']
    const tree = new Trie(words)
    expect([...tree.values()].sort()).toEqual([...words].sort())
  })

  it('SPEC-R81 toStringTag is Trie', () => {
    expect(Object.prototype.toString.call(new Trie())).toBe('[object Trie]')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('a long word costs a few nodes, not one per character', () => {
    let maps = 0
    class CountingMap<K, V> extends Map<K, V> {
      constructor(entries?: Iterable<readonly [K, V]> | null) {
        super(entries)
        maps++
      }
    }
    vi.stubGlobal('Map', CountingMap)
    const word = 'a'.repeat(100_000)

    const tree = new Trie([word, `${word}b`, word.slice(1)])

    expect(tree.size).toBe(3)
    expect(maps).toBeLessThan(8)
  })

  it('deleting a word merges the path it split', () => {
    let maps = 0
    class CountingMap<K, V> extends Map<K, V> {
      constructor(entries?: Iterable<readonly [K, V]> | null) {
        super(entries)
        maps++
      }
    }
    vi.stubGlobal('Map', CountingMap)
    const tree = new Trie(['abcd', 'abcx'])
    tree.delete('abcx')
    maps = 0

    tree.add('abcy')

    expect(maps).toBe(1)
    expect([...tree]).toEqual(['abcd', 'abcy'])
  })

  it('finds words and prefixes inside a compressed path', () => {
    const words = ['romane', 'romanus', 'romulus', 'rubens', 'ruber', 'rubicon', 'rubicundus']
    const tree = new Trie(words)
    expect([...tree]).toEqual(words)
    expect(tree.has('roman')).toBe(false)
    expect(tree.has('romanes')).toBe(false)
    expect([...tree.matches('rom')]).toEqual(['romane', 'romanus', 'romulus'])
    expect([...tree.matches('rubic')]).toEqual(['rubicon', 'rubicundus'])
    expect([...tree.matches('rubico')]).toEqual(['rubicon'])
    expect([...tree.matches('romx')]).toEqual([])
    expect([...tree.matches('romanes')]).toEqual([])

    tree.add('roman')
    expect([...tree.matches('roman')]).toEqual(['roman', 'romane', 'romanus'])
    expect(tree.delete('romane')).toBe(true)
    expect(tree.delete('romanus')).toBe(true)
    expect(tree.delete('rom')).toBe(false)
    expect([...tree.matches('rom')]).toEqual(['roman', 'romulus'])
    expect(tree.delete('roman')).toBe(true)
    expect(tree.has('romulus')).toBe(true)
    expect(tree.size).toBe(5)
  })

  it('agrees with startsWith over surrogate halves and random edits', () => {
    const alphabet = ['a', 'b', '\ud83d', '\ude00']
    let seed = 12345
    const next = (n: number): number => {
      seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff
      return (seed >>> 8) % n
    }
    const word = (): string =>
      Array.from({ length: next(6) }, () => alphabet[next(alphabet.length)]).join('')
    const tree = new Trie()
    const model = new Set<string>()
    for (let step = 0; step < 20_000; step++) {
      const text = word()
      if (next(2) === 0) {
        tree.add(text)
        model.add(text)
      } else {
        expect(tree.delete(text)).toBe(model.delete(text))
      }
      expect(tree.has(text)).toBe(model.has(text))
      const prefix = word()
      const expected = [...model].filter((w) => w.startsWith(prefix)).sort()
      expect([...tree.matches(prefix)].sort()).toEqual(expected)
      expect(tree.size).toBe(model.size)
    }
  })

  it('iteration survives deletes that merge paths and ends on clear', () => {
    const merged = new Trie(['abc', 'abd', 'abe'])
    const visited: string[] = []
    for (const word of merged) {
      visited.push(word)
      merged.delete(word)
    }
    expect(visited).toEqual(['abc', 'abd', 'abe'])
    expect(merged.size).toBe(0)

    const later = new Trie(['abc', 'abd', 'ax'])
    const seen: string[] = []
    for (const word of later) {
      seen.push(word)
      if (word === 'abc') later.delete('abc')
    }
    expect(seen).toEqual(['abc', 'abd', 'ax'])

    const cleared = new Trie(['a', 'b', 'c'])
    const first: string[] = []
    for (const word of cleared) {
      first.push(word)
      cleared.clear()
    }
    expect(first).toEqual(['a'])
  })

  it('constructor rejects every non-iterable', () => {
    expect(() => new Trie(0 as unknown as string[])).toThrow(TypeError)
    expect(() => new Trie(false as unknown as string[])).toThrow(TypeError)
    expect(() => new Trie(1 as unknown as string[])).toThrow(TypeError)
    expect(new Trie(null).size).toBe(0)
    expect(new Trie('').size).toBe(0)
  })

  it('matches takes a number limit, and null means no limit', () => {
    const tree = new Trie(['a', 'ab', 'ac'])
    expect([...tree.matches('a', null)]).toEqual(['a', 'ab', 'ac'])
    expect([...tree.matches('a', 0)]).toEqual([])
    expect([...tree.matches('a', -1)]).toEqual([])
    expect([...tree.matches('a', 1.5)]).toEqual(['a'])
    const notNumbers = [NaN, 'x', '2'] as number[]
    for (const limit of notNumbers) {
      expect(() => tree.matches('a', limit)).toThrow(new TypeError('limit must be a number'))
    }
  })
})
