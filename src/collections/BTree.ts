import { arrayFromIterableMap } from '../internal/iterable.js'
import { withHookNesting } from '../internal/nesting.js'
import { compare, protocol, type Comparer } from '../operators/index.js'
import { MapCollection, sameSequenceItems } from './abc.js'
import { checkInvariants } from './internal.js'
import { clone } from './object.js'

/** Construction options for {@link BTree}. */
export interface BTreeOptions {
  /** Branching factor; integer in 8..1024. Default 64. */
  nodeCapacity?: number
}

/** Bounds for range methods. The start key is always inclusive. */
export interface RangeOptions {
  /** When true, the end key is included. Default false. */
  inclusiveEnd?: boolean
}

/**
 * Instruction returned from an {@link BTree.updateRange} callback.
 * Exactly one of `replace`, `remove`, or a bare `stop` may describe the action;
 * `stop` may also accompany `replace` or `remove` to end the walk after that entry.
 */
export type RangeUpdate<V> =
  { replace: V; stop?: true } | { remove: true; stop?: true } | { stop: true }

interface LeafNode<K, V> {
  readonly kind: 'leaf'
  owner: object
  keys: K[]
  values: V[]
}

interface BranchNode<K, V> {
  readonly kind: 'branch'
  owner: object
  children: TreeNode<K, V>[]
  maxKeys: K[]
  total: number
}

type TreeNode<K, V> = LeafNode<K, V> | BranchNode<K, V>

interface PathFrame<K, V> {
  node: BranchNode<K, V>
  index: number
}

function countOf<K, V>(n: TreeNode<K, V>): number {
  return n.kind === 'leaf' ? n.keys.length : n.total
}

function itemCount<K, V>(n: TreeNode<K, V>): number {
  return n.kind === 'leaf' ? n.keys.length : n.children.length
}

function readLastKey<K, V>(n: TreeNode<K, V>): { ok: true; key: K } | { ok: false } {
  if (n.kind === 'leaf') {
    if (n.keys.length === 0) return { ok: false }
    return { ok: true, key: n.keys[n.keys.length - 1] }
  }
  if (n.maxKeys.length === 0) return { ok: false }
  return { ok: true, key: n.maxKeys[n.maxKeys.length - 1] }
}

function emptyLeaf<K, V>(owner: object): LeafNode<K, V> {
  return { kind: 'leaf', owner, keys: [], values: [] }
}

function resolveNodeCapacity(arg: number | undefined): number {
  if (arg === undefined) return 64
  if (!Number.isInteger(arg) || arg < 8 || arg > 1024) {
    throw new RangeError('nodeCapacity must be an integer from 8 to 1024')
  }
  return arg
}

function resolveLimit(limit: number | undefined): number {
  if (limit === undefined || limit === Infinity) return Infinity
  if (!Number.isInteger(limit) || limit < 0) {
    throw new RangeError('limit must be a non-negative integer or Infinity')
  }
  return limit
}

/**
 * B+ tree map with order-statistic subtree counts and O(1) copy-on-write {@link BTree.clone}.
 * Keys are totally ordered by a comparator; values may be `undefined`, and so may keys when the
 * comparator orders `undefined` (the default {@link compare} does).
 *
 * A comparator must return a finite number for every pair it is asked to order. Subtracting
 * numbers fails for `Infinity` / `NaN` keys (`Infinity - x` is not finite); use {@link compare}
 * or a comparator that handles those values.
 *
 * Mutating while iterating never repeats a key and always terminates: after a structural change
 * the cursor re-seeks to the next key after the last yielded one.
 *
 * @template K, V
 */
export class BTree<K = unknown, V = unknown> extends MapCollection<K, V> {
  #root: TreeNode<K, V>
  #size = 0
  readonly #compareFn: Comparer<K>
  readonly #nodeCapacity: number
  readonly #minFill: number
  #token: object = {}
  #version = 0
  #frozen = false

  /**
   * @param entries Initial key-value pairs. Sorted unique input is bulk-loaded in linear time.
   * @param compareFn Key comparator. Defaults to {@link compare}.
   * @param options Construction options; see {@link BTreeOptions}.
   */
  constructor(
    entries?: Iterable<readonly [K, V]>,
    compareFn?: Comparer<K>,
    options?: BTreeOptions
  ) {
    super()
    this.#compareFn = compareFn ?? compare
    this.#nodeCapacity = resolveNodeCapacity(options?.nodeCapacity)
    this.#minFill = Math.floor(this.#nodeCapacity / 2)
    this.#root = emptyLeaf(this.#token)
    if (entries !== undefined) this.#bulkLoad(entries)
  }

  get size(): number {
    return this.#size
  }

  /** Branching factor chosen at construction. */
  get nodeCapacity(): number {
    return this.#nodeCapacity
  }

  /** Leaf depth of the tree; 0 when the root is a leaf. */
  get height(): number {
    let h = 0
    let n = this.#root
    while (n.kind === 'branch') {
      h++
      n = n.children[0]
    }
    return h
  }

  get isFrozen(): boolean {
    return this.#frozen
  }

  readonly [Symbol.toStringTag] = 'BTree'

  protected override cloneFrom(entries: Iterable<[K, V]>): this {
    return Reflect.construct(this.constructor, [
      entries,
      this.#compareFn,
      { nodeCapacity: this.#nodeCapacity }
    ]) as this
  }

  /** Sequence equality: key order is part of meaning. */
  override [protocol.equals](other: unknown): boolean {
    return withHookNesting(() => sameSequenceItems(this, other, (c) => c.entries()))
  }

  /**
   * Shallow: O(1) copy-on-write. Deep: new tree with keys by reference and deep-cloned values.
   */
  override [protocol.clone](deep = false): this {
    return withHookNesting(() => {
      if (!deep) return this.clone() as this
      return this.cloneFrom([...this.entries()].map(([k, v]): [K, V] => [k, clone(v, true)]))
    })
  }

  clear(): void {
    this.#assertMutable()
    this.#root = emptyLeaf(this.#token)
    this.#size = 0
    this.#version++
  }

  get(key: K, defaultValue?: V): V | undefined {
    const found = this.#find(key)
    if (!found?.found) return defaultValue
    return found.leaf.values[found.pos]
  }

  /**
   * Insert or overwrite `key`. Replaces the stored key object as well as the value.
   * @returns `this`
   */
  set(key: K, value: V): this {
    this.#assertMutable()
    const { path, leaf, pos, found: hit } = this.#findForSet(key)
    const ownedLeaf = this.#ownPath(path, leaf)
    if (hit) {
      ownedLeaf.keys[pos] = key
      ownedLeaf.values[pos] = value
      this.#refreshSeparators(path, ownedLeaf)
      this.#version++
      return this
    }
    ownedLeaf.keys.splice(pos, 0, key)
    ownedLeaf.values.splice(pos, 0, value)
    this.#size++
    for (const frame of path) frame.node.total += 1
    this.#bubbleInsert(path, ownedLeaf)
    this.#version++
    return this
  }

  has(key: K): boolean {
    const found = this.#find(key)
    return found?.found === true
  }

  delete(key: K): boolean {
    this.#assertMutable()
    const found = this.#find(key)
    if (!found?.found) return false
    const { path, leaf, pos } = found
    const ownedLeaf = this.#ownPath(path, leaf)
    ownedLeaf.keys.splice(pos, 1)
    ownedLeaf.values.splice(pos, 1)
    this.#size--
    this.#bubbleDelete(path, ownedLeaf)
    this.#version++
    return true
  }

  /**
   * Entry at `index` (Array.prototype.at rules), or `undefined` out of range. O(log n), no
   * comparator calls.
   */
  at(index: number): [K, V] | undefined {
    let i = Math.trunc(index) || 0
    if (i < 0) i += this.#size
    if (i < 0 || i >= this.#size) return undefined
    let node = this.#root
    while (node.kind === 'branch') {
      let advanced = false
      for (const child of node.children) {
        const n = countOf(child)
        if (i < n) {
          node = child
          advanced = true
          break
        }
        i -= n
      }
      if (!advanced) return undefined
    }
    if (i >= node.keys.length) return undefined
    return [node.keys[i], node.values[i]]
  }

  /**
   * Entries in ascending key order.
   * @param from Optional lowest key to start at. Pass nothing to start at the minimum;
   * an explicit `undefined` is a real key and starts at `undefined`.
   */
  entries(...from: [lowestKey?: K]): IteratorObject<[K, V]> {
    const start = from.length > 0 ? { key: from[0] as K } : undefined
    return Iterator.from(this.#walk(true, start))
  }

  /**
   * Entries in descending key order.
   * @param from Optional highest key to start at. Pass nothing to start at the maximum;
   * an explicit `undefined` is a real key and starts at `undefined`.
   */
  entriesDescending(...from: [from?: K]): IteratorObject<[K, V]> {
    const start = from.length > 0 ? { key: from[0] as K } : undefined
    return Iterator.from(this.#walk(false, start))
  }

  keys(): IteratorObject<K> {
    return this.entries().map(([k]) => k)
  }

  values(): IteratorObject<V> {
    return this.entries().map(([, v]) => v)
  }

  /** Smallest key, or `undefined` when empty. */
  firstKey(): K | undefined {
    let n = this.#root
    while (n.kind === 'branch') {
      n = n.children[0]
    }
    return n.keys[0]
  }

  /** Largest key, or `undefined` when empty. */
  lastKey(): K | undefined {
    let n = this.#root
    while (n.kind === 'branch') {
      const last = n.children.at(-1)
      if (last === undefined) return undefined
      n = last
    }
    return n.keys.at(-1)
  }

  /** Least entry with key strictly greater than `key`, or undefined. */
  higher(key: K): [K, V] | undefined {
    return this.#bound(key, 'higher')
  }

  /** Greatest entry with key strictly less than `key`, or undefined. */
  lower(key: K): [K, V] | undefined {
    return this.#bound(key, 'lower')
  }

  /** Least entry with key greater than or equal to `key`, or undefined. */
  ceiling(key: K): [K, V] | undefined {
    return this.#bound(key, 'ceiling')
  }

  /** Greatest entry with key less than or equal to `key`, or undefined. */
  floor(key: K): [K, V] | undefined {
    return this.#bound(key, 'floor')
  }

  /**
   * Entries whose keys lie in `[from, to)` (or `[from, to]` when `inclusiveEnd` is true).
   * @param options.limit Cap on how many pairs to collect; default Infinity. Must be a
   * non-negative integer or Infinity.
   */
  entriesBetween(from: K, to: K, options?: RangeOptions & { limit?: number }): [K, V][] {
    const limit = resolveLimit(options?.limit)
    const inclusiveEnd = options?.inclusiveEnd === true
    if (limit === 0) return []
    if (this.#cmp(from, to) > 0) return []
    const out: [K, V][] = []
    for (const [k, v] of this.#walk(true, { key: from })) {
      const c = this.#cmp(k, to)
      if (inclusiveEnd ? c > 0 : c >= 0) break
      out.push([k, v])
      if (out.length >= limit) break
    }
    return out
  }

  /**
   * Insert or overwrite every pair from `entries`.
   * @returns Count of keys that were not already present.
   */
  setAll(entries: Iterable<readonly [K, V]>): number {
    return this.#atomic(() => {
      if (this.#size === 0) {
        this.#bulkLoad(entries)
        return this.#size
      }
      let added = 0
      for (const e of entries) {
        const key = e[0]
        const value = e[1]
        if (!this.has(key)) added++
        this.set(key, value)
      }
      return added
    })
  }

  /**
   * Walk entries in `[from, to)` (or `[from, to]` when `inclusiveEnd` is true), invoking
   * `visit` for each. Returning `false` from `visit` stops the walk.
   * @returns Number of entries visited (including a final entry that returned false).
   */
  visitRange(
    from: K,
    to: K,
    visit: (key: K, value: V, index: number) => unknown,
    options?: RangeOptions
  ): number {
    const inclusiveEnd = options?.inclusiveEnd === true
    let index = 0
    for (const [k, v] of this.#walk(true, { key: from })) {
      const c = this.#cmp(k, to)
      if (inclusiveEnd ? c > 0 : c >= 0) break
      const stop = visit(k, v, index)
      index++
      if (stop === false) break
    }
    return index
  }

  /**
   * Atomically update entries in `[from, to)` (or `[from, to]` when `inclusiveEnd` is true).
   * The callback returns a {@link RangeUpdate}, or `undefined` to leave the entry alone.
   * @returns Number of entries visited.
   */
  updateRange(
    from: K,
    to: K,
    update: (key: K, value: V, index: number) => RangeUpdate<V> | undefined,
    options?: RangeOptions
  ): number {
    return this.#atomic(() => {
      const inclusiveEnd = options?.inclusiveEnd === true
      let index = 0
      for (const [k, v] of this.#walk(true, { key: from })) {
        const c = this.#cmp(k, to)
        if (inclusiveEnd ? c > 0 : c >= 0) break
        const r = update(k, v, index)
        index++
        if (r === undefined) continue
        if ('replace' in r && 'remove' in r) {
          throw new TypeError('RangeUpdate cannot both replace and remove')
        }
        if ('remove' in r) this.delete(k)
        else if ('replace' in r) this.set(k, r.replace)
        if ('stop' in r && r.stop) break
      }
      return index
    })
  }

  /**
   * Delete every entry whose key lies in `[from, to)` (or `[from, to]` when `inclusiveEnd`
   * is true). Atomic: a failure leaves the tree unchanged.
   * @returns Number of entries removed.
   */
  removeRange(from: K, to: K, options?: RangeOptions): number {
    return this.#atomic(() => {
      const keys = this.entriesBetween(from, to, options).map(([k]) => k)
      let n = 0
      for (const k of keys) {
        if (this.delete(k)) n++
      }
      return n
    })
  }

  /**
   * Delete every listed key. Atomic: comparator failures leave the tree unchanged.
   * @returns Number of keys that were present and removed.
   */
  removeAll(keys: Iterable<K>): number {
    return this.#atomic(() => {
      const list = [...keys]
      for (const k of list) this.has(k)
      let n = 0
      for (const k of list) {
        if (this.delete(k)) n++
      }
      return n
    })
  }

  /** O(1) copy-on-write clone sharing structure until the first write on either side. */
  clone(): BTree<K, V> {
    const copy = new BTree<K, V>(undefined, this.#compareFn, {
      nodeCapacity: this.#nodeCapacity
    })
    copy.#root = this.#root
    copy.#size = this.#size
    this.#token = {}
    return copy
  }

  toArray(): [K, V][] {
    return [...this.entries()]
  }

  /**
   * Reject further mutators permanently (like `Object.freeze`).
   * @returns `this`
   */
  freeze(): this {
    this.#frozen = true
    return this
  }

  /**
   * Structural integrity check for tests.
   * @internal
   * @throws {Error} when an invariant fails
   */
  [checkInvariants](): void {
    const fail = (name: string): never => {
      throw new Error(`BTree invariant violated: ${name}`)
    }
    const depths = new Set<number>()
    const walk = (node: TreeNode<K, V>, depth: number, isRoot: boolean): number => {
      if (node.kind === 'leaf') {
        if (node.keys.length !== node.values.length) fail('leaf-arrays')
        depths.add(depth)
        if (
          !isRoot &&
          (node.keys.length < this.#minFill || node.keys.length > this.#nodeCapacity)
        ) {
          fail('fill')
        }
        if (isRoot && node.keys.length > this.#nodeCapacity) fail('fill')
        for (let i = 1; i < node.keys.length; i++) {
          if (!(this.#cmp(node.keys[i - 1], node.keys[i]) < 0)) fail('order')
        }
        return node.keys.length
      }
      if (node.maxKeys.length !== node.children.length) fail('separators')
      if (
        !isRoot &&
        (node.children.length < this.#minFill || node.children.length > this.#nodeCapacity)
      ) {
        fail('fill')
      }
      if (isRoot) {
        if (node.children.length > this.#nodeCapacity) fail('fill')
        if (node.children.length < 2) fail('fill')
      }
      let sum = 0
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i]
        const childCount = walk(child, depth + 1, false)
        sum += childCount
        const expected = readLastKey(child)
        const sep = node.maxKeys[i]
        if (!expected.ok || !Object.is(sep, expected.key)) fail('separators')
      }
      if (node.total !== sum) fail('totals')
      return sum
    }
    const rootCount = walk(this.#root, 0, true)
    if (rootCount !== this.#size) fail('totals')
    if (depths.size > 1) fail('depth')
    if (this.height !== (depths.values().next().value ?? 0)) fail('depth')
    if ((this.#size === 0) !== (this.#root.kind === 'leaf' && this.#root.keys.length === 0)) {
      fail('empty')
    }
  }

  #assertMutable(): void {
    if (this.#frozen) throw new TypeError('BTree is frozen')
  }

  #cmp(a: K, b: K): number {
    const r = this.#compareFn(a, b)
    if (typeof r !== 'number' || !Number.isFinite(r)) {
      throw new TypeError('comparator must return a finite number')
    }
    return r
  }

  #lowerBound(keys: readonly K[], key: K): number {
    let lo = 0
    let hi = keys.length
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (this.#cmp(keys[mid], key) < 0) lo = mid + 1
      else hi = mid
    }
    return lo
  }

  #upperBound(keys: readonly K[], key: K): number {
    let lo = 0
    let hi = keys.length
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (this.#cmp(keys[mid], key) <= 0) lo = mid + 1
      else hi = mid
    }
    return lo
  }

  #find(
    key: K
  ): { path: PathFrame<K, V>[]; leaf: LeafNode<K, V>; pos: number; found: boolean } | undefined {
    const path: PathFrame<K, V>[] = []
    let node = this.#root
    while (node.kind === 'branch') {
      const index = this.#lowerBound(node.maxKeys, key)
      if (index >= node.children.length) {
        return undefined
      }
      path.push({ node, index })
      node = node.children[index]
    }
    const pos = this.#lowerBound(node.keys, key)
    const found = pos < node.keys.length && this.#cmp(node.keys[pos], key) === 0
    return { path, leaf: node, pos, found }
  }

  #findForSet(key: K): {
    path: PathFrame<K, V>[]
    leaf: LeafNode<K, V>
    pos: number
    found: boolean
  } {
    const path: PathFrame<K, V>[] = []
    let node = this.#root
    while (node.kind === 'branch') {
      let index = this.#lowerBound(node.maxKeys, key)
      if (index >= node.children.length) index = node.children.length - 1
      path.push({ node, index })
      node = node.children[index]
    }
    const pos = this.#lowerBound(node.keys, key)
    const found = pos < node.keys.length && this.#cmp(node.keys[pos], key) === 0
    return { path, leaf: node, pos, found }
  }

  #own(node: TreeNode<K, V>): TreeNode<K, V> {
    if (node.owner === this.#token) return node
    if (node.kind === 'leaf') {
      return {
        kind: 'leaf',
        owner: this.#token,
        keys: node.keys.slice(),
        values: node.values.slice()
      }
    }
    return {
      kind: 'branch',
      owner: this.#token,
      children: node.children.slice(),
      maxKeys: node.maxKeys.slice(),
      total: node.total
    }
  }

  #ownPath(path: PathFrame<K, V>[], _leaf: LeafNode<K, V>): LeafNode<K, V> {
    let owned = this.#own(this.#root)
    this.#root = owned
    for (const frame of path) {
      if (owned.kind !== 'branch') break
      const ownedChild = this.#own(owned.children[frame.index])
      owned.children[frame.index] = ownedChild
      frame.node = owned
      owned = ownedChild
    }
    if (owned.kind === 'leaf') return owned
    return emptyLeaf(this.#token)
  }

  #refreshSeparators(path: PathFrame<K, V>[], leaf: LeafNode<K, V>): void {
    let child: TreeNode<K, V> = leaf
    for (let p = path.length - 1; p >= 0; p--) {
      const frame = path[p]
      const last = readLastKey(child)
      if (last.ok) frame.node.maxKeys[frame.index] = last.key
      child = frame.node
    }
  }

  #bubbleInsert(path: PathFrame<K, V>[], leaf: LeafNode<K, V>): void {
    let node: TreeNode<K, V> = leaf
    let pathIndex = path.length - 1
    while (itemCount(node) === this.#nodeCapacity + 1) {
      const mid = Math.ceil((this.#nodeCapacity + 1) / 2)
      let left: TreeNode<K, V>
      let right: TreeNode<K, V>
      if (node.kind === 'leaf') {
        left = {
          kind: 'leaf',
          owner: this.#token,
          keys: node.keys.slice(0, mid),
          values: node.values.slice(0, mid)
        }
        right = {
          kind: 'leaf',
          owner: this.#token,
          keys: node.keys.slice(mid),
          values: node.values.slice(mid)
        }
      } else {
        const leftChildren = node.children.slice(0, mid)
        const rightChildren = node.children.slice(mid)
        let leftTotal = 0
        for (const c of leftChildren) leftTotal += countOf(c)
        let rightTotal = 0
        for (const c of rightChildren) rightTotal += countOf(c)
        left = {
          kind: 'branch',
          owner: this.#token,
          children: leftChildren,
          maxKeys: node.maxKeys.slice(0, mid),
          total: leftTotal
        }
        right = {
          kind: 'branch',
          owner: this.#token,
          children: rightChildren,
          maxKeys: node.maxKeys.slice(mid),
          total: rightTotal
        }
      }
      if (pathIndex < 0) {
        const leftLast = readLastKey(left)
        const rightLast = readLastKey(right)
        if (!leftLast.ok || !rightLast.ok) return
        this.#root = {
          kind: 'branch',
          owner: this.#token,
          children: [left, right],
          maxKeys: [leftLast.key, rightLast.key],
          total: countOf(left) + countOf(right)
        }
        return
      }
      const frame = path[pathIndex]
      const parent = frame.node
      const i = frame.index
      parent.children[i] = left
      parent.children.splice(i + 1, 0, right)
      const leftLast = readLastKey(left)
      const rightLast = readLastKey(right)
      if (!leftLast.ok || !rightLast.ok) return
      parent.maxKeys[i] = leftLast.key
      parent.maxKeys.splice(i + 1, 0, rightLast.key)
      let sum = 0
      for (const c of parent.children) sum += countOf(c)
      parent.total = sum
      node = parent
      pathIndex--
    }
    this.#fixTotals(path)
  }

  #fixTotals(path: PathFrame<K, V>[]): void {
    for (let p = path.length - 1; p >= 0; p--) {
      const frame = path[p]
      let sum = 0
      for (const c of frame.node.children) sum += countOf(c)
      frame.node.total = sum
      const last = readLastKey(frame.node.children[frame.index])
      if (last.ok) frame.node.maxKeys[frame.index] = last.key
    }
  }

  #bubbleDelete(path: PathFrame<K, V>[], leaf: LeafNode<K, V>): void {
    for (const frame of path) {
      frame.node.total -= 1
    }
    const frames = path.slice()
    let node: TreeNode<K, V> = leaf
    while (frames.length > 0 && itemCount(node) < this.#minFill) {
      const frame = frames[frames.length - 1]
      const parent = frame.node
      const i = frame.index
      const j = i > 0 ? i - 1 : i + 1
      const sib = this.#own(parent.children[j])
      parent.children[j] = sib
      if (itemCount(sib) > this.#minFill) {
        if (j < i) {
          if (node.kind === 'leaf' && sib.kind === 'leaf') {
            const ki = sib.keys.length - 1
            if (ki < 0) break
            const k = sib.keys[ki]
            const v = sib.values[ki]
            sib.keys.length = ki
            sib.values.length = ki
            node.keys.unshift(k)
            node.values.unshift(v)
          } else if (node.kind === 'branch' && sib.kind === 'branch') {
            const ci = sib.children.length - 1
            if (ci < 0) break
            const moved = sib.children[ci]
            const movedKey = sib.maxKeys[ci]
            sib.children.length = ci
            sib.maxKeys.length = ci
            const movedCount = countOf(moved)
            sib.total -= movedCount
            node.children.unshift(moved)
            node.maxKeys.unshift(movedKey)
            node.total += movedCount
          }
        } else if (node.kind === 'leaf' && sib.kind === 'leaf') {
          if (sib.keys.length === 0) break
          const k = sib.keys[0]
          const v = sib.values[0]
          sib.keys.splice(0, 1)
          sib.values.splice(0, 1)
          node.keys.push(k)
          node.values.push(v)
        } else if (node.kind === 'branch' && sib.kind === 'branch') {
          if (sib.children.length === 0) break
          const moved = sib.children[0]
          const movedKey = sib.maxKeys[0]
          sib.children.splice(0, 1)
          sib.maxKeys.splice(0, 1)
          const movedCount = countOf(moved)
          sib.total -= movedCount
          node.children.push(moved)
          node.maxKeys.push(movedKey)
          node.total += movedCount
        }
        const leftIdx = Math.min(i, j)
        const rightIdx = Math.max(i, j)
        const leftLast = readLastKey(parent.children[leftIdx])
        if (leftLast.ok) parent.maxKeys[leftIdx] = leftLast.key
        const rightLast = readLastKey(parent.children[rightIdx])
        if (rightLast.ok) parent.maxKeys[rightIdx] = rightLast.key
        break
      }
      const leftIdx = Math.min(i, j)
      const rightIdx = Math.max(i, j)
      const leftRaw = parent.children[leftIdx]
      const rightRaw = parent.children[rightIdx]
      const left = this.#own(leftRaw)
      parent.children[leftIdx] = left
      if (left.kind === 'leaf' && rightRaw.kind === 'leaf') {
        left.keys.push(...rightRaw.keys)
        left.values.push(...rightRaw.values)
      } else if (left.kind === 'branch' && rightRaw.kind === 'branch') {
        left.children.push(...rightRaw.children)
        left.maxKeys.push(...rightRaw.maxKeys)
        left.total += rightRaw.total
      }
      parent.children.splice(rightIdx, 1)
      parent.maxKeys.splice(rightIdx, 1)
      const last = readLastKey(left)
      if (last.ok) parent.maxKeys[leftIdx] = last.key
      node = parent
      frames.pop()
    }
    while (this.#root.kind === 'branch' && this.#root.children.length === 1) {
      this.#root = this.#root.children[0]
      if (frames.length > 0) frames.shift()
    }
    let child: TreeNode<K, V> = node
    for (let p = frames.length - 1; p >= 0; p--) {
      const frame = frames[p]
      const last = readLastKey(child)
      if (last.ok) frame.node.maxKeys[frame.index] = last.key
      let sum = 0
      for (const c of frame.node.children) sum += countOf(c)
      frame.node.total = sum
      child = frame.node
    }
  }

  #bound(key: K, kind: 'higher' | 'lower' | 'ceiling' | 'floor'): [K, V] | undefined {
    if (kind === 'ceiling' || kind === 'higher') {
      let node = this.#root
      while (node.kind === 'branch') {
        const index =
          kind === 'ceiling'
            ? this.#lowerBound(node.maxKeys, key)
            : this.#upperBound(node.maxKeys, key)
        if (index >= node.children.length) return undefined
        node = node.children[index]
      }
      const pos =
        kind === 'ceiling' ? this.#lowerBound(node.keys, key) : this.#upperBound(node.keys, key)
      const k = node.keys[pos]
      const v = node.values[pos]
      if (pos >= node.keys.length) return undefined
      return [k, v]
    }
    // floor / lower
    let node = this.#root
    let fallback: TreeNode<K, V> | undefined
    while (node.kind === 'branch') {
      const index =
        kind === 'floor' ? this.#upperBound(node.maxKeys, key) : this.#lowerBound(node.maxKeys, key)
      if (index > 0) fallback = node.children[index - 1]
      if (index >= node.children.length) {
        node = node.children[node.children.length - 1]
        break
      }
      node = node.children[index]
    }
    while (node.kind === 'branch') {
      node = node.children[node.children.length - 1]
    }
    const pos =
      kind === 'floor' ? this.#upperBound(node.keys, key) - 1 : this.#lowerBound(node.keys, key) - 1
    if (pos >= 0 && pos < node.keys.length) {
      return [node.keys[pos], node.values[pos]]
    }
    if (fallback === undefined) return undefined
    let n = fallback
    while (n.kind === 'branch') {
      n = n.children[n.children.length - 1]
    }
    if (n.keys.length === 0) return undefined
    return [n.keys[n.keys.length - 1], n.values[n.values.length - 1]]
  }

  *#walk(forward: boolean, start: { key: K } | undefined): Generator<[K, V], void, undefined> {
    interface Cursor {
      branches: PathFrame<K, V>[]
      leaf: LeafNode<K, V>
      index: number
    }
    // `from` undefined means "no bound" (an explicit `undefined` key is wrapped as `{ key }`).
    const seek = (from: { key: K } | undefined, exclusive: boolean): Cursor | undefined => {
      if (this.#size === 0) return undefined
      const branches: PathFrame<K, V>[] = []
      let node: TreeNode<K, V> = this.#root
      if (from === undefined) {
        if (forward) {
          while (node.kind === 'branch') {
            branches.push({ node, index: 0 })
            node = node.children[0]
          }
          if (node.keys.length === 0) return undefined
          return { branches, leaf: node, index: 0 }
        }
        while (node.kind === 'branch') {
          const idx = node.children.length - 1
          branches.push({ node, index: idx })
          node = node.children[idx]
        }
        if (node.keys.length === 0) return undefined
        return { branches, leaf: node, index: node.keys.length - 1 }
      }
      const key = from.key
      if (forward) {
        while (node.kind === 'branch') {
          const index = exclusive
            ? this.#upperBound(node.maxKeys, key)
            : this.#lowerBound(node.maxKeys, key)
          if (index >= node.children.length) return undefined
          branches.push({ node, index })
          node = node.children[index]
        }
        const index = exclusive
          ? this.#upperBound(node.keys, key)
          : this.#lowerBound(node.keys, key)
        if (index >= node.keys.length) return undefined
        return { branches, leaf: node, index }
      }
      // reverse: last key <= key (or < if exclusive)
      let fallback: { branches: PathFrame<K, V>[]; node: TreeNode<K, V> } | undefined
      while (node.kind === 'branch') {
        const index = exclusive
          ? this.#lowerBound(node.maxKeys, key)
          : this.#upperBound(node.maxKeys, key)
        if (index > 0) {
          fallback = {
            branches: [...branches, { node, index: index - 1 }],
            node: node.children[index - 1]
          }
        }
        if (index >= node.children.length) {
          const idx = node.children.length - 1
          branches.push({ node, index: idx })
          node = node.children[idx]
          break
        }
        branches.push({ node, index })
        node = node.children[index]
      }
      while (node.kind === 'branch') {
        const idx = node.children.length - 1
        branches.push({ node, index: idx })
        node = node.children[idx]
      }
      const index = exclusive
        ? this.#lowerBound(node.keys, key) - 1
        : this.#upperBound(node.keys, key) - 1
      if (index >= 0) return { branches, leaf: node, index }
      if (fallback === undefined) return undefined
      let n = fallback.node
      const fb = fallback.branches
      while (n.kind === 'branch') {
        const idx = n.children.length - 1
        fb.push({ node: n, index: idx })
        n = n.children[idx]
      }
      if (n.keys.length === 0) return undefined
      return { branches: fb, leaf: n, index: n.keys.length - 1 }
    }

    let cursor = seek(start, false)

    const advance = (c: Cursor): Cursor | undefined => {
      if (forward) {
        if (c.index + 1 < c.leaf.keys.length) return { ...c, index: c.index + 1 }
        const branches = c.branches.slice()
        while (branches.length > 0) {
          const top = branches[branches.length - 1]
          if (top.index + 1 < top.node.children.length) {
            top.index++
            let node: TreeNode<K, V> = top.node.children[top.index]
            while (node.kind === 'branch') {
              branches.push({ node, index: 0 })
              node = node.children[0]
            }
            return { branches, leaf: node, index: 0 }
          }
          branches.pop()
        }
        return undefined
      }
      if (c.index > 0) return { ...c, index: c.index - 1 }
      const branches = c.branches.slice()
      while (branches.length > 0) {
        const top = branches[branches.length - 1]
        if (top.index > 0) {
          top.index--
          let node: TreeNode<K, V> = top.node.children[top.index]
          while (node.kind === 'branch') {
            const childIndex = node.children.length - 1
            branches.push({ node, index: childIndex })
            node = node.children[childIndex]
          }
          return { branches, leaf: node, index: node.keys.length - 1 }
        }
        branches.pop()
      }
      return undefined
    }

    while (cursor !== undefined) {
      if (cursor.index < 0 || cursor.index >= cursor.leaf.keys.length) return
      const k = cursor.leaf.keys[cursor.index]
      const v = cursor.leaf.values[cursor.index]
      const seenVersion = this.#version
      yield [k, v]
      cursor = this.#version === seenVersion ? advance(cursor) : seek({ key: k }, true)
    }
  }

  #atomic<T>(fn: () => T): T {
    this.#assertMutable()
    const snapshotRoot = this.#root
    const snapshotSize = this.#size
    this.#token = {}
    try {
      return fn()
    } catch (err) {
      this.#root = snapshotRoot
      this.#size = snapshotSize
      this.#version++
      throw err
    }
  }

  #bulkLoad(entries: Iterable<readonly [K, V]>): void {
    const items = arrayFromIterableMap(entries, (e): [K, V] => {
      const pair = e as readonly [K, V]
      return [pair[0], pair[1]]
    })
    if (items.length === 0) {
      this.#root = emptyLeaf(this.#token)
      this.#size = 0
      this.#version++
      return
    }
    let ascending = true
    for (let i = 1; i < items.length; i++) {
      const prev = items[i - 1]
      const cur = items[i]
      if (!(this.#cmp(prev[0], cur[0]) < 0)) {
        ascending = false
        break
      }
    }
    let unique = items
    if (!ascending) {
      unique = items.slice()
      unique.sort((a, b) => this.#cmp(a[0], b[0]))
      const collapsed: [K, V][] = []
      for (const pair of unique) {
        const last = collapsed.at(-1)
        if (last !== undefined && this.#cmp(last[0], pair[0]) === 0) {
          collapsed[collapsed.length - 1] = pair
        } else {
          collapsed.push(pair)
        }
      }
      unique = collapsed
    }
    const M = this.#nodeCapacity
    const n = unique.length
    const leafCount = Math.ceil(n / M)
    const leaves: LeafNode<K, V>[] = []
    if (leafCount === 0) {
      this.#root = emptyLeaf(this.#token)
      this.#size = 0
      this.#version++
      return
    }
    const base = Math.floor(n / leafCount)
    const extra = n % leafCount
    let offset = 0
    for (let i = 0; i < leafCount; i++) {
      const size = base + (i < extra ? 1 : 0)
      const chunk = unique.slice(offset, offset + size)
      offset += size
      leaves.push({
        kind: 'leaf',
        owner: this.#token,
        keys: chunk.map((p) => p[0]),
        values: chunk.map((p) => p[1])
      })
    }
    let level: TreeNode<K, V>[] = leaves
    while (level.length > 1) {
      const count = Math.ceil(level.length / M)
      const next: BranchNode<K, V>[] = []
      const bbase = Math.floor(level.length / count)
      const bextra = level.length % count
      let off = 0
      for (let i = 0; i < count; i++) {
        const size = bbase + (i < bextra ? 1 : 0)
        const children = level.slice(off, off + size)
        off += size
        const maxKeys: K[] = []
        let total = 0
        for (const c of children) {
          const last = readLastKey(c)
          if (last.ok) maxKeys.push(last.key)
          total += countOf(c)
        }
        next.push({
          kind: 'branch',
          owner: this.#token,
          children,
          maxKeys,
          total
        })
      }
      level = next
    }
    this.#root = level[0]
    this.#size = n
    this.#version++
  }
}
