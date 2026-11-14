import { type Comparator, defaultCompare } from './internal/compare.ts'
import { requireIterable } from './internal/iterable.ts'

/** The child links of a node, or of the header that collects the left and right trees in a splay. */
interface Links<K, V> {
  left?: Node<K, V>
  right?: Node<K, V>
}

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
 * An ordered map on a splay tree, a self-adjusting binary search tree that moves what you read to
 * the root, so recently used keys are quick to reach again. Insertion, lookup and removal take
 * O(log n) amortized time. It has `Map`'s method names, iterates in key order, and treats keys the
 * comparator calls equal as the same key. `get` and `has` splay with probability 0.5 (a randomized
 * splay tree); `firstKey`, `lastKey`, `lower`, `higher` and iterator re-seeks always splay. With
 * the default comparator, keys are numbers, bigints or strings: `NaN` throws `RangeError`, and
 * `null`, `undefined` and other values throw `TypeError`; pass a comparator to order them. A
 * comparator that returns anything but a finite number throws `TypeError`, and a comparator that
 * throws leaves every entry in place.
 *
 * Iterators capture a structural version; splaying bumps it. A stale iterator re-seeks by splaying
 * its last yielded key's successor (O(log n) amortized), and an iterator left open holds nothing
 * that later reads or writes wait on.
 *
 * @see {@link https://en.wikipedia.org/wiki/Splay_tree Splay tree}
 * @see {@link https://web.archive.org/web/20220930173835/http://www14.in.tum.de/personen/albers/papers/ipl02.pdf Randomized Splay Trees}
 * @example
 * ```ts
 * const tree = new SplayTree([
 *   [3, 'c'],
 *   [1, 'a']
 * ])
 * tree.set(2, 'b')
 * ;[...tree.keys()] // [1, 2, 3]
 * tree.lower(2) // [1, 'a']
 * ```
 */
export class SplayTree<K, V = unknown> {
  #root?: Node<K, V>
  readonly #compareFn: Comparator<K>
  #size = 0
  #version = 0

  /**
   * Create a tree holding `entries`, inserted in order.
   * @param entries Initial `[key, value]` pairs. `null` means none, as for `Map`.
   * @param compareFn Key comparator. Defaults to the primitive order (numbers, bigints and strings).
   * @throws {TypeError} when `entries` is not iterable or holds something that is not an entry.
   */
  constructor(
    entries?: Iterable<readonly [K, V]> | null,
    compareFn?: ((a: K, b: K) => number) | null
  ) {
    this.#compareFn = compareFn ?? defaultCompare
    if (entries == null) return
    for (const entry of requireIterable<readonly [K, V]>(entries)) {
      if (Object(entry) !== entry) throw new TypeError('entries must be [key, value] pairs')
      this.set(entry[0], entry[1])
    }
  }

  /** The number of entries. */
  get size(): number {
    return this.#size
  }

  /** `'SplayTree'`, for `Object.prototype.toString`. */
  get [Symbol.toStringTag](): string {
    return 'SplayTree'
  }

  /** The value for `key`, or `undefined`. May splay the key to the root. */
  get(key: K): V | undefined {
    return this.#lookup(key)?.value
  }

  /** Whether `key` is present. May splay the key to the root. */
  has(key: K): boolean {
    return this.#lookup(key) !== undefined
  }

  /**
   * Insert or replace `key`, splaying it to the root.
   * @returns `this`
   */
  set(key: K, value: V): this {
    if (!this.#root) {
      this.#cmp(key, key)
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

  /**
   * Remove `key`.
   * @returns Whether it was present.
   */
  delete(key: K): boolean {
    if (!this.#root) return false
    this.splay(key)
    if (this.#cmp(key, this.#root.key) !== 0) return false
    if (!this.#root.left) {
      this.#root = this.#root.right
    } else {
      const max = this.#splayMax(this.#root.left)
      max.right = this.#root.right
      this.#root = max
    }
    this.#size--
    return true
  }

  /** Remove every entry. */
  clear(): void {
    this.#root = undefined
    this.#size = 0
    this.#version++
  }

  /** The smallest key, or `undefined` when empty. Splays it to the root. */
  firstKey(): K | undefined {
    if (!this.#root) return undefined
    let n = this.#root
    while (n.left) n = n.left
    const key = n.key
    this.splay(key)
    return key
  }

  /** The largest key, or `undefined` when empty. Splays it to the root. */
  lastKey(): K | undefined {
    if (!this.#root) return undefined
    let n = this.#root
    while (n.right) n = n.right
    const key = n.key
    this.splay(key)
    return key
  }

  /** The entry with the greatest key below `key`, or `undefined`. Splays it to the root. */
  lower(key: K): [K, V] | undefined {
    if (!this.#root) return undefined
    this.splay(key)
    if (this.#cmp(this.#root.key, key) < 0) return [this.#root.key, this.#root.value]
    let n = this.#root.left
    if (!n) return undefined
    while (n.right) n = n.right
    this.splay(n.key)
    return [n.key, n.value]
  }

  /** The entry with the least key above `key`, or `undefined`. Splays it to the root. */
  higher(key: K): [K, V] | undefined {
    if (!this.#root) return undefined
    this.splay(key)
    if (this.#cmp(this.#root.key, key) > 0) return [this.#root.key, this.#root.value]
    let n = this.#root.right
    if (!n) return undefined
    while (n.left) n = n.left
    this.splay(n.key)
    return [n.key, n.value]
  }

  /**
   * Top-down splay of `key` (Sleator and Tarjan). Bumps the structural version so open
   * iterators re-seek from their last key. A comparator that throws leaves every entry in place.
   * @see {@link https://doi.org/10.1145%2F3828.3835 Self-Adjusting Binary Search Trees}
   */
  splay(key: K): void {
    if (!this.#root) return

    const stub: Links<K, V> = {}
    let left: Links<K, V> = stub
    let right: Links<K, V> = stub

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

  /** The keys, in order. */
  keys(): IteratorObject<K> {
    return this.#inorder().map((n) => n.key)
  }

  /** The values, in key order. */
  values(): IteratorObject<V> {
    return this.#inorder().map((n) => n.value)
  }

  /** `[key, value]` pairs, in key order. */
  entries(): IteratorObject<[K, V]> {
    return this.#inorder().map((n) => [n.key, n.value])
  }

  /** Call `callback(value, key, tree)` for each entry, in key order. */
  forEach(callback: (value: V, key: K, tree: this) => void, thisArg?: unknown): void {
    for (const [k, v] of this.entries()) Reflect.apply(callback, thisArg, [v, k, this])
  }

  /** `[key, value]` pairs, in key order. */
  [Symbol.iterator](): IteratorObject<[K, V]> {
    return this.entries()
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

  /**
   * Top-down splay of the largest key in the subtree at `root`, returning the new subtree root,
   * which has no right child. It follows right links only and never calls the comparator, so it
   * cannot throw while `delete` holds a detached subtree.
   */
  #splayMax(root: Node<K, V>): Node<K, V> {
    const stub: Links<K, V> = {}
    let left: Links<K, V> = stub
    while (root.right) {
      const tmp = root.right
      root.right = tmp.left
      tmp.left = root
      root = tmp
      if (!root.right) break
      left.right = root
      left = root
      root = root.right
    }
    left.right = root.left
    root.left = stub.right
    return root
  }

  #lookup(key: K): Node<K, V> | undefined {
    if (!this.#root) return undefined
    if (Math.random() < 0.5) {
      this.splay(key)
      return this.#cmp(key, this.#root.key) === 0 ? this.#root : undefined
    }
    return this.#find(key)
  }

  #cmp(a: K, b: K): number {
    const rank = this.#compareFn(a, b)
    if (typeof rank !== 'number' || !Number.isFinite(rank)) {
      throw new TypeError('comparator must return a finite number')
    }
    return rank
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
