import { describe, expect, it } from 'vitest'
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
})
