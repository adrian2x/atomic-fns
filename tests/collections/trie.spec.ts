import { describe, expect, it } from 'vitest'
import { Trie } from '../../src/collections/index.ts'

describe('Trie', () => {
  it('empty', () => {
    const tree = new Trie()
    expect(tree.size).toBe(0)
    expect(tree.has('')).toBe(false)
  })

  it('constructor loads words', () => {
    const words = ['cat', 'can', 'dog', 'dark', 'an']
    const tree = new Trie(words)
    expect(tree.size).toBe(words.length)
    for (const w of words) expect(tree.has(w)).toBe(true)
    expect(tree.has('ca')).toBe(false)
  })

  it('duplicate add keeps size 1', () => {
    const tree = new Trie()
    tree.add('x')
    tree.add('x')
    expect(tree.size).toBe(1)
    expect(tree.has('x')).toBe(true)
  })

  it('withPrefix yields words in prefix, then child insertion, order', () => {
    const tree = new Trie(['cat', 'can', 'dog', 'dark', 'dam', 'an'])
    expect([...tree.withPrefix('ca')]).toEqual(['cat', 'can'])
    expect([...tree.withPrefix('da')]).toEqual(['dark', 'dam'])
    expect([...tree.withPrefix('d')]).toEqual(['dog', 'dark', 'dam'])

    const nested = new Trie(['b', 'ba', 'a', 'bc', 'bab', 'bb'])
    expect([...nested.withPrefix('')]).toEqual(['b', 'ba', 'bab', 'bc', 'bb', 'a'])
    expect(nested.withPrefix('b').take(2).toArray()).toEqual(['b', 'ba'])
  })

  it('delete of an absent word returns false and changes nothing', () => {
    const tree = new Trie(['cat'])
    expect(tree.delete('cab')).toBe(false)
    expect(tree.delete('cats')).toBe(false)
    expect(tree.delete('ca')).toBe(false)
    expect(tree.delete('dog')).toBe(false)
    expect(new Trie().delete('a')).toBe(false)
    expect(tree.size).toBe(1)
    expect(tree.has('cat')).toBe(true)
  })

  it('deleting words prunes their branch and keeps siblings', () => {
    const tree = new Trie(['ab'])
    tree.add('ac')
    expect(tree.delete('ac')).toBe(true)
    expect(tree.has('ab')).toBe(true)

    const words = ['cat', 'can', 'dog', 'dark', 'an']
    const t2 = new Trie(words)
    for (const w of ['cat', 'can']) {
      expect(t2.delete(w)).toBe(true)
      expect(t2.delete(w)).toBe(false)
      expect(t2.has(w)).toBe(false)
    }
    expect([...t2.withPrefix('c')]).toEqual([])
    expect([...t2]).toEqual(['dog', 'dark', 'an'])
  })

  it('the empty string is a word like any other', () => {
    const tree = new Trie()
    tree.add('')
    expect(tree.size).toBe(1)
    expect(tree.has('')).toBe(true)
    expect(tree.delete('')).toBe(true)
    expect(tree.has('')).toBe(false)
    expect(tree.size).toBe(0)
    expect(tree.delete('')).toBe(false)
  })

  it('200k-char word', () => {
    const word = 'x'.repeat(200_000)
    const tree = new Trie()
    tree.add(word)
    expect(tree.size).toBe(1)
    expect(tree.has(word)).toBe(true)
    expect(tree.has(`${word}y`)).toBe(false)
    expect(tree.delete(word)).toBe(true)
    expect(tree.size).toBe(0)
  })

  it('100k-char word values and withPrefix without stack overflow', () => {
    const word = 'a'.repeat(100_000)
    const tree = new Trie([word])
    expect([...tree.values()]).toEqual([word])
    expect([...tree.withPrefix(word.slice(0, 10))]).toEqual([word])
    tree.add(`${word}b`)
    tree.add(word.slice(1))
    expect(tree.size).toBe(3)
  })

  it('non-string add throws TypeError', () => {
    const tree = new Trie()
    expect(() => tree.add(1 as unknown as string)).toThrow(new TypeError('Trie stores strings'))
    expect(() => tree.add([] as unknown as string)).toThrow(new TypeError('Trie stores strings'))
    expect(tree.size).toBe(0)
    expect(tree.has('')).toBe(false)
  })

  it('has and delete of a non-string return false', () => {
    const tree = new Trie(['cat', 'aaa'])
    const lookalike = { length: 3, charCodeAt: () => 97 }
    for (const value of [['cat'], 1, undefined, lookalike]) {
      expect(tree.has(value as unknown as string)).toBe(false)
      expect(tree.delete(value as unknown as string)).toBe(false)
    }
    expect(tree.size).toBe(2)
  })

  it('withPrefix of a non-string throws TypeError', () => {
    const tree = new Trie(['a'])
    for (const value of [undefined, null, ['a'], 1]) {
      expect(() => tree.withPrefix(value as unknown as string)).toThrow(
        new TypeError('prefix must be a string')
      )
    }
  })

  it('clear removes every word', () => {
    const tree = new Trie(['cat', 'can', 'dog', 'dark', 'an'])
    expect(tree.size).toBe(5)
    tree.clear()
    expect(tree.size).toBe(0)
    expect([...tree.withPrefix('')]).toEqual([])
  })

  it('toStringTag is Trie', () => {
    expect(Object.prototype.toString.call(new Trie())).toBe('[object Trie]')
    expect(Reflect.ownKeys(new Trie())).toEqual([])
  })

  it('keeps sibling words after deleting and adding a shared prefix', () => {
    const tree = new Trie(['abcd', 'abcx'])
    tree.delete('abcx')

    tree.add('abcy')

    expect([...tree]).toStrictEqual(['abcd', 'abcy'])
  })

  it('finds words and prefixes inside a compressed path', () => {
    const words = ['romane', 'romanus', 'romulus', 'rubens', 'ruber', 'rubicon', 'rubicundus']
    const tree = new Trie(words)
    expect([...tree]).toEqual(words)
    expect(tree.has('roman')).toBe(false)
    expect(tree.has('romanes')).toBe(false)
    expect([...tree.withPrefix('rom')]).toEqual(['romane', 'romanus', 'romulus'])
    expect([...tree.withPrefix('rubic')]).toEqual(['rubicon', 'rubicundus'])
    expect([...tree.withPrefix('rubico')]).toEqual(['rubicon'])
    expect([...tree.withPrefix('romx')]).toEqual([])
    expect([...tree.withPrefix('romanes')]).toEqual([])

    tree.add('roman')
    expect([...tree.withPrefix('roman')]).toEqual(['roman', 'romane', 'romanus'])
    expect(tree.delete('romane')).toBe(true)
    expect(tree.delete('romanus')).toBe(true)
    expect(tree.delete('rom')).toBe(false)
    expect([...tree.withPrefix('rom')]).toEqual(['roman', 'romulus'])
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
    for (let step = 0; step < 2_000; step++) {
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
      expect([...tree.withPrefix(prefix)].sort()).toEqual(expected)
      expect(tree.size).toBe(model.size)
    }
  })

  it('iteration survives deletes that merge paths', () => {
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
  })

  it('clear ends open iterators, started or not', () => {
    const cleared = new Trie(['a', 'b', 'c'])
    const first: string[] = []
    for (const word of cleared) {
      first.push(word)
      cleared.clear()
    }
    expect(first).toEqual(['a'])

    const unstarted = new Trie(['a', 'b'])
    const words = unstarted.withPrefix('')
    const values = unstarted.values()
    unstarted.clear()
    unstarted.add('a')
    expect([...words]).toEqual([])
    expect([...values]).toEqual([])
  })

  it('an unstarted withPrefix sees words added or deleted before it is read', () => {
    const split = new Trie(['abc'])
    const afterSplit = split.withPrefix('ab')
    split.add('abd')
    expect([...afterSplit]).toEqual(['abc', 'abd'])

    const shared = new Trie(['abc', 'abd'])
    const afterAdd = shared.withPrefix('ab')
    shared.add('abe')
    expect([...afterAdd]).toEqual(['abc', 'abd', 'abe'])

    const replaced = new Trie(['abc'])
    const afterReplace = replaced.withPrefix('ab')
    replaced.delete('abc')
    replaced.add('abx')
    expect([...afterReplace]).toEqual(['abx'])

    const empty = new Trie(['x'])
    const beforeAny = empty.withPrefix('ab')
    empty.add('abc')
    expect([...beforeAny]).toEqual(['abc'])
  })

  it('constructor rejects every non-iterable', () => {
    for (const value of [0, false, 1, {}]) {
      expect(() => new Trie(value as unknown as string[])).toThrow(
        new TypeError('expected an iterable')
      )
    }
    expect(new Trie(null).size).toBe(0)
    expect(new Trie('').size).toBe(0)
  })

  it('stores __proto__ and constructor as plain words', () => {
    const trie = new Trie(['__proto__', 'constructor'])
    expect(trie.size).toBe(2)
    expect(trie.has('__proto__')).toBe(true)
    expect(trie.has('toString')).toBe(false)
  })

  it('iterates like a Set of words', () => {
    const tree = new Trie(['b', 'a'])
    expect([...tree]).toEqual(['b', 'a'])
    expect([...tree.values()]).toEqual(['b', 'a'])
    expect([...tree.keys()]).toEqual(['b', 'a'])
    expect([...tree.entries()]).toEqual([
      ['b', 'b'],
      ['a', 'a']
    ])
    const seen: unknown[] = []
    tree.forEach(function (this: unknown, value, key, t) {
      seen.push([value, key, t === tree, this])
    }, 'ctx')
    expect(seen).toEqual([
      ['b', 'b', true, 'ctx'],
      ['a', 'a', true, 'ctx']
    ])
  })
})
