import { protocol } from '../operators/index.js'
import { sameSetMembers, ValueCollection } from './abc.js'

interface TrieNode {
  children: Map<string, TrieNode>
  isWord: boolean
}

function newNode(): TrieNode {
  return { children: new Map(), isWord: false }
}

/**
 * Prefix tree for strings. Insertions, lookups and removals in O(s) for string length s.
 *
 * @see {@link https://en.wikipedia.org/wiki/Trie Trie}
 */
export class Trie extends ValueCollection<string> {
  #root: TrieNode = newNode()
  #count = 0

  constructor(words?: Iterable<string>) {
    super()
    if (words) {
      for (const word of words) {
        this.add(word)
      }
    }
  }

  /**
   * Add `word`. Non-strings throw. A duplicate is a no-op for size.
   * @throws {TypeError} when `word` is not a string.
   */
  add(word: string): this {
    if (typeof word !== 'string') throw new TypeError('Trie stores strings')
    let node = this.#root
    for (const c of word.split('')) {
      let next = node.children.get(c)
      if (!next) {
        next = newNode()
        node.children.set(c, next)
      }
      node = next
    }
    if (!node.isWord) {
      node.isWord = true
      this.#count++
    }
    return this
  }

  /**
   * Remove `word` if present (including `''`) and prune empty branches.
   * @returns `true` iff the word was present.
   */
  delete(word: string): boolean {
    if (typeof word !== 'string') return false
    const path: { node: TrieNode; char: string }[] = []
    let node = this.#root
    for (const c of word.split('')) {
      const next = node.children.get(c)
      if (!next) return false
      path.push({ node, char: c })
      node = next
    }
    if (!node.isWord) return false
    node.isWord = false
    this.#count--
    for (let i = path.length - 1; i >= 0; i--) {
      const { node: parent, char } = path[i]
      const child = parent.children.get(char)
      if (!child || child.isWord || child.children.size > 0) break
      parent.children.delete(char)
    }
    return true
  }

  has(word: string): boolean {
    if (typeof word !== 'string') return false
    const node = this.#findNode(word)
    return node?.isWord === true
  }

  /**
   * Yield words that start with `prefix`, in child insertion order, at most `limit`.
   */
  matches(prefix: string, limit = Infinity): IteratorObject<string> {
    if (typeof prefix !== 'string' || limit <= 0) return Iterator.from([])
    const start = this.#findNode(prefix)
    if (!start) return Iterator.from([])
    return Iterator.from(this.#walk(start, prefix)).take(limit)
  }

  *#walk(node: TrieNode, path: string): Generator<string> {
    if (node.isWord) yield path
    for (const [c, child] of node.children) {
      yield* this.#walk(child, path + c)
    }
  }

  #findNode(word: string): TrieNode | undefined {
    let node: TrieNode | undefined = this.#root
    for (const c of word.split('')) {
      node = node.children.get(c)
      if (!node) return undefined
    }
    return node
  }

  clear(): void {
    this.#root = newNode()
    this.#count = 0
  }

  get size(): number {
    return this.#count
  }

  readonly [Symbol.toStringTag] = 'Trie';

  /** Set membership: same words regardless of insertion order. */
  override [protocol.equals](other: unknown): boolean {
    return sameSetMembers(this, other, (c) => c.values())
  }

  values(): IteratorObject<string> {
    return this.matches('', Infinity)
  }
}
