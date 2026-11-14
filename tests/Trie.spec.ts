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

  it('remove returns false for an absent word', () => {
    let tree = new Trie(['cat'])
    assert(tree.remove('cab') === false)
    assert(tree.remove('cats') === false)
    assert(tree.remove('ca') === false)
    assert(tree.remove('dog') === false)
    assert(new Trie().remove('a') === false)
    assert(tree.size === 1)
    assert(tree.contains('cat'))
  })

  it('remove the empty string', () => {
    let tree = new Trie(['', 'a'])
    assert(tree.contains(''))
    assert(tree.remove(''))
    assert(!tree.contains(''))
    assert(tree.remove('') === false)
    assert(tree.size === 1)
  })

  it('matches a word of 1e5 letters', () => {
    let word = 'a'.repeat(1e5)
    let tree = new Trie([word])
    assert.deepEqual([...tree.matches('')], [word])
  })

  it('matches keeps prefix order', () => {
    let tree = new Trie(['b', 'ba', 'a', 'bc', 'bab', 'bb'])
    assert.deepEqual([...tree.matches('')], ['b', 'ba', 'bab', 'bc', 'bb', 'a'])
  })

  it('size counts a repeated word once', () => {
    let tree = new Trie(['a', 'a'])
    tree.add('a')
    assert(tree.size === 1)
    assert(tree.remove('a'))
    assert(tree.size === 0)
    assert(tree.empty())
    tree.add('a')
    assert(tree.size === 1)
  })

  it('contains returns a boolean', () => {
    let tree = new Trie(['cat'])
    assert(tree.contains('cat') === true)
    assert(tree.contains('ca') === false)
    assert(tree.contains('dog') === false)
    assert(new Trie().contains('') === false)
  })

  it('matches honors the limit', () => {
    let words = ['a', 'ab', 'abc', 'abd']
    let tree = new Trie(words)
    assert.deepEqual([...tree.matches('a', 2)], ['a', 'ab'])
    assert.deepEqual([...tree.matches('a', 0)], [])
    assert.deepEqual([...tree.matches('a', -1)], [])
    assert.deepEqual([...tree.matches('a', 100)], words)
  })

  it('matches without a limit returns every word', () => {
    let words = Array.from({ length: 25 }, (_, i) => `w${String.fromCharCode(97 + i)}`)
    let tree = new Trie(words)
    assert.deepEqual([...tree.matches('w')], words)
    assert.deepEqual([...tree.matches('w', null)], words)
  })

  it('cannot reach Object.prototype', () => {
    const trie = new Trie(JSON.parse('[["__proto__", "polluted"]]'))
    assert(({} as any).polluted === undefined)
    assert(trie.size === 1)

    trie.add(JSON.parse('["a", "__proto__", "polluted"]'))
    assert(({} as any).polluted === undefined)

    trie.clear()
    trie.add(JSON.parse('["__proto__", "polluted"]'))
    assert(({} as any).polluted === undefined)
    delete (Object.prototype as any).polluted
  })
})
