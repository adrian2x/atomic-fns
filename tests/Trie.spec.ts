import assert from 'assert'
import { Trie } from '../src/collections/Trie.js'

describe('Trie', () => {
  it('empty', () => {
    let tree = new Trie()
    assert(tree.empty())
    assert(tree.size === 0)
  })

  it('add', () => {
    let tree = new Trie()
    let words = ['cat', 'can', 'dog', 'dark', 'an']
    for (const w of words) {
      tree.add(w)
      assert(tree.contains(w))
    }
  })

  it('size', () => {
    let words = ['cat', 'can', 'dog', 'dark', 'an']
    let tree = new Trie(words)
    assert(tree.size === words.length)
  })

  it('contains', () => {
    let words = ['cat', 'can', 'dog', 'dark', 'an']
    let tree = new Trie(words)
    for (const w of words) {
      assert(tree.contains(w))
    }
  })

  it('matches', () => {
    let words = ['cat', 'can', 'dog', 'dark', 'dam', 'an']
    let tree = new Trie(words)
    assert.deepEqual([...tree.matches('ca')], ['cat', 'can'])
    assert.deepEqual([...tree.matches('da')], ['dark', 'dam'])
    assert.deepEqual([...tree.matches('d')], ['dog', 'dark', 'dam'])
  })

  it('remove', () => {
    let words = ['cat', 'can', 'dog', 'dark', 'an']
    let tree = new Trie(words)
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
    let words = ['cat', 'can', 'dog', 'dark', 'an']
    let tree = new Trie(words)
    assert(tree.size === words.length)
    tree.clear()
    assert(tree.size === 0)
  })
})
