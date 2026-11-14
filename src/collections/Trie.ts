import { itake } from '../itertools/index.js'
import { Collection } from './abc.js'

type TrieNode = {
  isWord?: boolean
} & { [key: string]: TrieNode }

function* traverse(root: TrieNode, prefix: string): Generator<string> {
  const stack: Array<[TrieNode, string]> = [[root, prefix]]
  while (stack.length) {
    const [node, path] = stack.pop()
    if (node.isWord) yield path
    for (const key of Object.keys(node).reverse()) {
      stack.push([node[key], path + key])
    }
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
  add(word: string): this {
    let current = this.root
    for (let i = 0; i < word.length; i++) {
      const c = word[i]
      if (!current[c]) current[c] = {}
      current = current[c]
    }
    if (!current.isWord) this.count++
    // Set as end of the word
    Object.defineProperty(current, 'isWord', {
      value: true,
      enumerable: false,
      writable: true
    })
    return this
  }

  /**
   * Removes the given string from the tree.
   * @param word The string to remove
   * @returns {boolean} Returns `true` if the string was found and removed.
   */
  remove(word: string): boolean {
    const node = this.findNode(word)
    if (!node?.isWord) return false
    node.isWord = false
    this.count--
    return true
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
   * @param {number} [limit] The number of results to return. Defaults to every result.
   */
  matches = function* (word: string, limit?: number): Generator<string> {
    const node = this.findNode(word)
    if (node) yield* itake(limit ?? Infinity, traverse(node, word))
  }

  /**
   * Returns `true` if the given string is found in the tree.
   * @param {string} word
   */
  contains(word: string): boolean {
    const node = this.findNode(word)
    return !!node?.isWord
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
  get size(): number {
    return this.count
  }
}
