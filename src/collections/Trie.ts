import { SetCollection } from './abc.js'

type TrieNode = {
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
export class Trie extends SetCollection<string> {
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
    for (let i = 0; i < word.length; i++) {
      const c = word[i]
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
    for (let i = 0; i < word.length; i++) {
      const c = word[i]
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
    return node !== undefined && node.isWord
  }

  /**
   * Yield words that start with `prefix`, in child insertion order, at most `limit`.
   */
  matches(prefix: string, limit = Infinity): IteratorObject<string> {
    return Iterator.from(this.#matchGen(prefix, limit))
  }

  *#matchGen(prefix: string, limit: number): Generator<string> {
    if (typeof prefix !== 'string' || limit <= 0) return
    const start = this.#findNode(prefix)
    if (!start) return
    let yielded = 0
    const stack: { node: TrieNode; path: string }[] = [{ node: start, path: prefix }]
    while (stack.length > 0 && yielded < limit) {
      const { node, path } = stack.pop()!
      if (node.isWord) {
        yield path
        yielded++
        if (yielded >= limit) return
      }
      const children = [...node.children.entries()].reverse()
      for (const [c, child] of children) {
        stack.push({ node: child, path: path + c })
      }
    }
  }

  #findNode(word: string): TrieNode | undefined {
    let node: TrieNode | undefined = this.#root
    for (let i = 0; i < word.length; i++) {
      node = node.children.get(word[i])
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

  get [Symbol.toStringTag](): string {
    return 'Trie'
  }

  values(): IteratorObject<string> {
    return this.matches('', Infinity)
  }
}
