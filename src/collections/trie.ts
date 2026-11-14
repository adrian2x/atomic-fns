import { requireIterable } from './internal/iterable.ts'

interface TrieNode {
  /** The whole prefix this node stands for. A non-root node without a word has at least two children. */
  readonly path: string
  parent?: TrieNode
  /** Children by the UTF-16 code unit that follows `path`. */
  children?: Map<number, TrieNode>
  isWord: boolean
}

function newNode(path: string): TrieNode {
  return { path, isWord: false }
}

function attach(parent: TrieNode, unit: number, child: TrieNode): TrieNode {
  child.parent = parent
  parent.children ??= new Map()
  parent.children.set(unit, child)
  return child
}

/** Where `a` and `b` first differ, given that they agree up to `from`. */
function sharedLength(a: string, b: string, from: number): number {
  const end = Math.min(a.length, b.length)
  let i = from
  while (i < end && a.charCodeAt(i) === b.charCodeAt(i)) i++
  return i
}

/** Drop or merge a node that no longer holds a word. Nodes keep their paths, so open walks stay valid. */
function prune(node: TrieNode): void {
  const { parent, children } = node
  if (parent === undefined || node.isWord) return
  const unit = node.path.charCodeAt(parent.path.length)
  if (children === undefined || children.size === 0) {
    parent.children?.delete(unit)
    prune(parent)
  } else if (children.size === 1) {
    const [only] = children.values()
    attach(parent, unit, only)
  }
}

/**
 * Prefix tree for strings, path-compressed: memory grows with the number of words, not their
 * length. Insertions, lookups and removals in O(s) for string length s. Prefixes compare by UTF-16
 * code unit, as `startsWith` does.
 *
 * @see {@link https://en.wikipedia.org/wiki/Radix_tree Radix tree}
 * @example
 * ```ts
 * const words = new Trie(['car', 'cart', 'cat'])
 * ;[...words.withPrefix('car')] // ['car', 'cart']
 * words.withPrefix('ca').take(1).toArray() // ['car']
 * words.has('ca') // false
 * ```
 */
export class Trie {
  #root = newNode('')
  #count = 0
  #generation = 0

  /**
   * Create a trie holding `words`.
   * @param words Initial words. `null` means none.
   * @throws {TypeError} when `words` is not iterable or holds a non-string.
   */
  constructor(words?: Iterable<string> | null) {
    for (const word of requireIterable<string>(words ?? [])) {
      this.add(word)
    }
  }

  /**
   * Add `word`. Non-strings throw. A duplicate is a no-op for size.
   * @throws {TypeError} when `word` is not a string.
   */
  add(word: string): this {
    if (typeof word !== 'string') throw new TypeError('Trie stores strings')
    let node = this.#root
    while (node.path.length < word.length) {
      const from = node.path.length
      const unit = word.charCodeAt(from)
      const child = node.children?.get(unit)
      if (child === undefined) {
        node = attach(node, unit, newNode(word))
        break
      }
      const shared = sharedLength(word, child.path, from)
      if (shared === child.path.length) {
        node = child
      } else {
        const middle = attach(node, unit, newNode(word.slice(0, shared)))
        attach(middle, child.path.charCodeAt(shared), child)
        node = middle
      }
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
    const node = this.#findWord(word)
    if (node === undefined) return false
    node.isWord = false
    this.#count--
    prune(node)
    return true
  }

  /** Whether `word` was added. A prefix of a word is not a word. */
  has(word: string): boolean {
    return this.#findWord(word) !== undefined
  }

  /**
   * Yield words that start with `prefix`, in child insertion order. The walk starts on the first
   * `next()`, so it sees words added before then. A `clear` ends the iterator, started or not. Use
   * `withPrefix(prefix).take(n)` for at most `n` words.
   * @throws {TypeError} when `prefix` is not a string.
   */
  withPrefix(prefix: string): IteratorObject<string> {
    if (typeof prefix !== 'string') throw new TypeError('prefix must be a string')
    return this.#walk(prefix, this.#generation)
  }

  *#walk(prefix: string, generation: number): Generator<string> {
    const start = this.#locate(prefix)
    if (start === undefined) return
    const stack: Iterator<TrieNode>[] = [[start].values()]
    while (stack.length > 0 && generation === this.#generation) {
      const next = stack[stack.length - 1].next()
      if (next.done) {
        stack.pop()
        continue
      }
      const node = next.value
      if (node.isWord) yield node.path
      if (node.children) stack.push(node.children.values())
    }
  }

  /** The topmost node whose path starts with `prefix`. */
  #locate(prefix: string): TrieNode | undefined {
    let node = this.#root
    while (node.path.length < prefix.length) {
      const from = node.path.length
      const child = node.children?.get(prefix.charCodeAt(from))
      if (!child) return undefined
      const shared = sharedLength(prefix, child.path, from)
      if (shared < prefix.length && shared < child.path.length) return undefined
      node = child
    }
    return node
  }

  #findWord(word: string): TrieNode | undefined {
    if (typeof word !== 'string') return undefined
    const node = this.#locate(word)
    return node?.isWord === true && node.path.length === word.length ? node : undefined
  }

  /** Remove every word, and end every iterator taken before. */
  clear(): void {
    this.#root = newNode('')
    this.#count = 0
    this.#generation++
  }

  /** The number of words. */
  get size(): number {
    return this.#count
  }

  /** `'Trie'`, for `Object.prototype.toString`. */
  get [Symbol.toStringTag](): string {
    return 'Trie'
  }

  /** Every word, in child insertion order. */
  values(): IteratorObject<string> {
    return this.withPrefix('')
  }

  /** Every word, as `Set.prototype.keys` gives them. */
  keys(): IteratorObject<string> {
    return this.values()
  }

  /** `[word, word]` pairs, as `Set.prototype.entries` gives them. */
  entries(): IteratorObject<[string, string]> {
    return this.values().map((w): [string, string] => [w, w])
  }

  /** Call `callback(word, word, trie)` for each word. */
  forEach(callback: (value: string, key: string, trie: this) => void, thisArg?: unknown): void {
    for (const w of this.values()) Reflect.apply(callback, thisArg, [w, w, this])
  }

  /** Every word, in child insertion order. */
  [Symbol.iterator](): IteratorObject<string> {
    return this.values()
  }
}
