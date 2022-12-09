import { Collection } from './abc.js'

type TrieNode = {
  isWord?: boolean
} & { [key: string]: TrieNode }

function* traverse(node: TrieNode, path: string, total = 20, count = 0) {
  if (node.isWord) {
    count++
    yield path
  }
  for (const key of Object.keys(node)) {
    yield* traverse(node[key], path + key, total, count)
  }
}

/**
 * A Trie is a tree for efficient storing and retrieval of strings such as words in a dictionary. They are useful for checking all the strings that have a common prefix.
 * Insertions, lookups and removals in `O(s)` where `s` is the search term.
 * @see {@link https://en.wikipedia.org/wiki/Trie Trie}
 */
export class Trie extends Collection {
  private root: TrieNode = {}
  private count = 0

  constructor(words?: string[]) {
    super()
    if (words) {
      for (const word of words) {
        this.add(word)
      }
    }
  }

  /**
   * Adds the given string to the tree.
   * @param word A string
   */
  add(word: string) {
    let current = this.root
    for (let i = 0; i < word.length; i++) {
      const c = word[i]
      if (!current[c]) current[c] = {}
      current = current[c]
    }
    // Set as end of the word
    Object.defineProperty(current, 'isWord', {
      value: true,
      enumerable: false,
      writable: true
    })
    this.count++
    return this
  }

  /**
   * Removes the given string from the tree.
   * @param word The string to remove
   * @returns {boolean} Returns `true` if the string was found and removed.
   */
  remove(word: string) {
    for (let i = 0, node = this.root; i < word.length && node; i++) {
      node = node[word[i]]
      if (i === word.length - 1 && node.isWord) {
        node.isWord = false
        this.count--
        return true
      }
    }
    return false
  }

  private findNode(word: string): TrieNode | undefined {
    let node = this.root
    for (let i = 0; i < word.length && node; i++) {
      const letter = word[i]
      node = node[letter]
    }
    return node
  }

  /**
   * Generates all results that start with the given string.
   * @param word A prefix string
   * @param {number} [limit=20] The number of results to return.
   */
  matches = function* (word: string, limit = 20) {
    const node = this.findNode(word)
    if (node) {
      yield* traverse(node, word, limit)
    }
  }

  /**
   * Returns `true` if the given string is found in the tree.
   * @param {string} word
   */
  contains(word: string) {
    const node = this.findNode(word)
    return node?.isWord
  }

  /**
   * Removes all strings from the tree.
   */
  clear() {
    this.root = {}
    this.count = 0
  }

  /**
   * Returns the total number of strings in the tree.
   */
  get size() {
    return this.count
  }
}
