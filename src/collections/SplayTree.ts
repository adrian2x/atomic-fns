import { withHookNesting } from '../internal/nesting.js'
import type { Comparer } from '../operators/index.js'
import { compare, protocol } from '../operators/index.js'
import { MapCollection, sameEntrySequence } from './abc.js'

class Node<K, V> {
  key: K
  value: V
  left?: Node<K, V>
  right?: Node<K, V>

  constructor(key: K, value: V) {
    this.key = key
    this.value = value
  }
}

/**
 * A splay tree is a self-balancing binary search tree with the additional property that recently
 * accessed elements are quick to access again. Insertion, look-up and removal in O(log n)
 * amortized time.
 *
 * Iterators capture a structural version; splaying bumps it. A stale iterator re-seeks by splaying
 * its last yielded key's successor (O(log n) amortized), so an abandoned iterator can never disable
 * splaying.
 *
 * @see {@link https://en.wikipedia.org/wiki/Splay_tree Splay tree}
 * @see {@link https://web.archive.org/web/20220930173835/http://www14.in.tum.de/personen/albers/papers/ipl02.pdf Randomized Splay Trees}
 * @template K, V
 */
export class SplayTree<K, V = unknown> extends MapCollection<K, V> {
  #root?: Node<K, V>
  readonly #cmp: Comparer<K>
  readonly #p: number
  #size = 0
  #version = 0

  /**
   * @param compareFn Key comparator. Defaults to {@link compare}.
   * @param p Probability of splaying on a read. Must be in `[0, 1]`. With `0`, reads never reshape
   * the tree, so they lose the amortized bound: on a tree built from sorted keys each read is O(n).
   * @throws {RangeError} when `p` is outside `[0, 1]`.
   */
  constructor(compareFn?: Comparer<K>, p = 0.5) {
    super()
    if (!(p >= 0 && p <= 1)) {
      throw new RangeError('p must be in [0, 1]')
    }
    this.#cmp = compareFn ?? compare
    this.#p = p
  }

  get size(): number {
    return this.#size
  }

  protected override cloneFrom(entries: Iterable<[K, V]>): this {
    const copy = Reflect.construct(this.constructor, [this.#cmp, this.#p]) as this
    for (const [k, v] of entries) copy.set(k, v)
    return copy
  }

  /** Sequence equality: key order is part of meaning (like SortedMap). */
  override [protocol.equals](other: unknown): boolean {
    return withHookNesting(() => sameEntrySequence(this, other, (c) => c.entries()))
  }

  readonly [Symbol.toStringTag] = 'SplayTree'

  /**
   * Tree height via iterative BFS. Empty and single-node trees are `0`.
   */
  get height(): number {
    if (!this.#root) return 0
    let h = 0
    let level: Node<K, V>[] = [this.#root]
    for (;;) {
      const next: Node<K, V>[] = []
      for (const n of level) {
        if (n.left) next.push(n.left)
        if (n.right) next.push(n.right)
      }
      if (next.length === 0) return h
      h++
      level = next
    }
  }

  get(key: K): V | undefined {
    if (!this.#root) return undefined
    if (Math.random() < this.#p) {
      this.splay(key)
      return this.#cmp(key, this.#root.key) === 0 ? this.#root.value : undefined
    }
    return this.#find(key)?.value
  }

  has(key: K): boolean {
    if (!this.#root) return false
    if (Math.random() < this.#p) {
      this.splay(key)
      return this.#cmp(key, this.#root.key) === 0
    }
    return this.#find(key) !== undefined
  }

  set(key: K, value: V): this {
    if (!this.#root) {
      this.#root = new Node(key, value)
      this.#size = 1
      this.#version++
      return this
    }
    this.splay(key)
    const rank = this.#cmp(key, this.#root.key)
    if (rank === 0) {
      this.#root.value = value
      return this
    }
    const node = new Node(key, value)
    if (rank > 0) {
      node.left = this.#root
      node.right = this.#root.right
      this.#root.right = undefined
    } else {
      node.right = this.#root
      node.left = this.#root.left
      this.#root.left = undefined
    }
    this.#root = node
    this.#size++
    return this
  }

  delete(key: K): boolean {
    if (!this.#root) return false
    this.splay(key)
    if (this.#cmp(key, this.#root.key) !== 0) return false
    if (!this.#root.left) {
      this.#root = this.#root.right
    } else {
      const right = this.#root.right
      this.#root = this.#root.left
      this.splay(key)
      this.#root.right = right
    }
    this.#size--
    return true
  }

  clear(): void {
    this.#root = undefined
    this.#size = 0
    this.#version++
  }

  /**
   * Minimum key. Splays the found node.
   */
  min(): K | undefined {
    if (!this.#root) return undefined
    let n = this.#root
    while (n.left) n = n.left
    const key = n.key
    this.splay(key)
    return key
  }

  /**
   * Maximum key. Splays the found node.
   */
  max(): K | undefined {
    if (!this.#root) return undefined
    let n = this.#root
    while (n.right) n = n.right
    const key = n.key
    this.splay(key)
    return key
  }

  /**
   * Greatest key strictly less than `key`, or `undefined`. Splays the found node.
   */
  lower(key: K): K | undefined {
    if (!this.#root) return undefined
    this.splay(key)
    if (this.#cmp(this.#root.key, key) < 0) return this.#root.key
    let n = this.#root.left
    if (!n) return undefined
    while (n.right) n = n.right
    this.splay(n.key)
    return n.key
  }

  /**
   * Least key strictly greater than `key`, or `undefined`. Splays the found node.
   */
  higher(key: K): K | undefined {
    if (!this.#root) return undefined
    this.splay(key)
    if (this.#cmp(this.#root.key, key) > 0) return this.#root.key
    let n = this.#root.right
    if (!n) return undefined
    while (n.left) n = n.left
    this.splay(n.key)
    return n.key
  }

  /**
   * Top-down splay of `key` (Sleator and Tarjan). Bumps the structural version so open
   * iterators re-seek from their last key. A comparator that throws leaves every entry in place.
   * @see {@link https://doi.org/10.1145%2F3828.3835 Self-Adjusting Binary Search Trees}
   */
  splay(key: K): void {
    if (!this.#root) return

    let left: Node<K, V>
    let right: Node<K, V>
    const stub = (left = right = new Node(null as K, null as V))

    let root = this.#root

    try {
      for (;;) {
        const rank = this.#cmp(key, root.key)
        if (rank < 0) {
          if (!root.left) break
          if (this.#cmp(key, root.left.key) < 0) {
            const tmp = root.left
            root.left = tmp.right
            tmp.right = root
            root = tmp
            if (!root.left) break
          }
          right.left = root
          right = root
          root = root.left
        } else if (rank > 0) {
          if (!root.right) break
          if (this.#cmp(key, root.right.key) > 0) {
            const tmp = root.right
            root.right = tmp.left
            tmp.left = root
            root = tmp
            if (!root.right) break
          }
          left.right = root
          left = root
          root = root.right
        } else {
          break
        }
      }
    } finally {
      left.right = root.left
      right.left = root.right
      root.left = stub.right
      root.right = stub.left
      this.#root = root
      this.#version++
    }
  }

  keys(): IteratorObject<K> {
    return this.#inorder().map((n) => n.key)
  }

  values(): IteratorObject<V> {
    return this.#inorder().map((n) => n.value)
  }

  entries(): IteratorObject<[K, V]> {
    return this.#inorder().map((n) => [n.key, n.value])
  }

  *#inorder(): Generator<Node<K, V>, void, undefined> {
    let version = this.#version
    let lastKey: K | undefined
    let haveLast = false
    const stack: Node<K, V>[] = []
    let n: Node<K, V> | undefined = this.#root

    // Splaying or mutating restructures the tree, so the stack is stale. Splay the successor of
    // the last yielded key to the root: a plain descent would pay O(height) at every step.
    const reseek = (): void => {
      stack.length = 0
      n = haveLast ? undefined : this.#root
      if (haveLast) {
        this.higher(lastKey as K)
        const root = this.#root
        if (root && this.#cmp(root.key, lastKey as K) > 0) stack.push(root)
      }
      version = this.#version
    }

    for (;;) {
      if (version !== this.#version) reseek()
      while (n) {
        stack.push(n)
        n = n.left
      }
      const current = stack.pop()
      if (current === undefined) return
      lastKey = current.key
      haveLast = true
      n = current.right
      yield current
    }
  }

  #find(key: K): Node<K, V> | undefined {
    let n = this.#root
    while (n) {
      const c = this.#cmp(key, n.key)
      if (c === 0) return n
      n = c < 0 ? n.left : n.right
    }
    return undefined
  }
}
