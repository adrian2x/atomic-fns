import { withHookNesting } from '../internal/nesting.js'
import { protocol } from '../operators/index.js'
import { sameSetMembers, ValueCollection } from './abc.js'

interface TrieNode {
  /** The whole prefix this node stands for. A node without a word has at least two children. */
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
 */
export class Trie extends ValueCollection<string> {
  #root = newNode('')
  #count = 0
  #generation = 0

  constructor(words?: Iterable<string> | null) {
    super()
    if (words != null) {
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

  has(word: string): boolean {
    return this.#findWord(word) !== undefined
  }

  /**
   * Yield words that start with `prefix`, in child insertion order, at most `limit`. A fractional
   * limit truncates, zero or less yields nothing, and `null` means no limit.
   * @throws {TypeError} when `limit` is not a number or is `NaN`.
   */
  matches(prefix: string, limit: number | null = Infinity): IteratorObject<string> {
    const most = limit ?? Infinity
    if (typeof most !== 'number' || Number.isNaN(most)) {
      throw new TypeError('limit must be a number')
    }
    if (typeof prefix !== 'string' || most <= 0) return Iterator.from([])
    const start = this.#locate(prefix)
    if (!start) return Iterator.from([])
    return this.#walk(start).take(most)
  }

  *#walk(start: TrieNode): Generator<string> {
    const generation = this.#generation
    const stack: Iterator<TrieNode>[] = [[start].values()]
    while (stack.length > 0) {
      const next = stack[stack.length - 1].next()
      if (next.done) {
        stack.pop()
        continue
      }
      const node = next.value
      if (node.isWord) {
        yield node.path
        if (generation !== this.#generation) return
      }
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

  clear(): void {
    this.#root = newNode('')
    this.#count = 0
    this.#generation++
  }

  get size(): number {
    return this.#count
  }

  readonly [Symbol.toStringTag] = 'Trie';

  /** Set membership: same words regardless of insertion order. */
  override [protocol.equals](other: unknown): boolean {
    return withHookNesting(() => sameSetMembers(this, other, (c) => c.values()))
  }

  values(): IteratorObject<string> {
    return this.matches('', Infinity)
  }
}
