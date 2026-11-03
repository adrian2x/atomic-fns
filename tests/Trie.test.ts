import { describe, it } from 'vitest'
import assert from 'assert'
import { Trie } from '../src/collections/Trie.js'

describe('Trie', () => {
  it('empty', () => {
    const tree = new Trie()
    assert(tree.empty())
    assert(tree.size === 0)
  })

  it('add', () => {
    const tree = new Trie()
    const words = ['cat', 'can', 'dog', 'dark', 'an']
    for (const w of words) {
      tree.add(w)
      assert(tree.contains(w))
    }
  })

  it('size', () => {
    const words = ['cat', 'can', 'dog', 'dark', 'an']
    const tree = new Trie(words)
    assert(tree.size === words.length)
  })

  it('contains', () => {
    const words = ['cat', 'can', 'dog', 'dark', 'an']
    const tree = new Trie(words)
    for (const w of words) {
      assert(tree.contains(w))
    }
  })

  it('matches', () => {
    const words = ['cat', 'can', 'dog', 'dark', 'dam', 'an']
    const tree = new Trie(words)
    assert.deepEqual([...tree.matches('ca')], ['cat', 'can'])
    assert.deepEqual([...tree.matches('da')], ['dark', 'dam'])
    assert.deepEqual([...tree.matches('d')], ['dog', 'dark', 'dam'])
  })

  it('remove', () => {
    const words = ['cat', 'can', 'dog', 'dark', 'an']
    const tree = new Trie(words)
    for (const w of words) {
      if (w.startsWith('c')) {
        assert(tree.remove(w))
        assert(tree.remove(w) === false)
        assert(!tree.contains(w))
      }
    }
    assert.deepEqual([...tree.matches('c')], [])
  })

  it('clear', () => {
    const words = ['cat', 'can', 'dog', 'dark', 'an']
    const tree = new Trie(words)
    assert(tree.size === words.length)
    tree.clear()
    assert(tree.size === 0)
  })
})
