import { KeyError } from '../globals/index.js'
import { compare, type Comparer } from '../operators/index.js'
import { MapCollection } from './abc.js'

const Delete = { delete: true as const }
const DeleteRange = () => Delete
const Break = { done: true as const }
const EmptyArray: never[] = []

export interface EditResult<V, R = unknown> {
  value?: V
  delete?: true
  done?: R
}

/**
 * Leaf nodes and base class for internals.
 * @private
 */
class BNode<K, V> {
  keys: K[]
  values: V[]
  children?: BNode<K, V>[]
  isShared?: boolean

  get isLeaf() {
    return this.children === undefined
  }

  isInternal(): this is BNodeInternal<K, V> {
    return this.children !== undefined
  }

  constructor(keys: K[] = [], values?: V[]) {
    this.keys = keys
    this.values = values ?? keys.map(() => undefined as V)
  }

  maxKey() {
    return this.keys[this.keys.length - 1]
  }

  indexOf(key: K, failXor: number, cmp: (a: K, b: K) => number) {
    const keys = this.keys
    let lo = 0
    let hi = keys.length
    let mid = hi >> 1
    while (lo < hi) {
      const c = cmp(keys[mid], key)
      if (c < 0) lo = mid + 1
      else if (c > 0) hi = mid
      else if (c === 0) return mid
      else {
        if (key === key) return keys.length
        else throw new KeyError(`BTree found an invalid key: ${String(key)}`)
      }
      mid = (lo + hi) >> 1
    }
    return mid ^ failXor
  }

  minKey(): K | undefined {
    return this.keys[0]
  }

  minPair(): [K, V] | undefined {
    if (this.keys.length === 0) return undefined
    return [this.keys[0], this.values[0]]
  }

  maxPair(): [K, V] | undefined {
    if (this.keys.length === 0) return undefined
    const lastIndex = this.keys.length - 1
    return [this.keys[lastIndex], this.values[lastIndex]]
  }

  clone(): BNode<K, V> {
    return new BNode<K, V>(this.keys.slice(0), this.values.slice(0))
  }

  greedyClone(): BNode<K, V> {
    return this.isShared ? this : this.clone()
  }

  get(key: K, defaultValue: V | undefined, tree: TreeState<K>): V | undefined {
    const i = this.indexOf(key, -1, tree.compare)
    return i < 0 ? defaultValue : this.values[i]
  }

  getPairOrNextLower(key: K, cmp: (a: K, b: K) => number, inclusive: boolean): [K, V] | undefined {
    const i = this.indexOf(key, -1, cmp)
    const indexOrLower = i < 0 ? ~i - 1 : inclusive ? i : i - 1
    if (indexOrLower >= 0) {
      return [this.keys[indexOrLower], this.values[indexOrLower]]
    }
    return undefined
  }

  getPairOrNextHigher(key: K, cmp: (a: K, b: K) => number, inclusive: boolean): [K, V] | undefined {
    const i = this.indexOf(key, -1, cmp)
    const indexOrHigher = i < 0 ? ~i : inclusive ? i : i + 1
    const keys = this.keys
    if (indexOrHigher < keys.length) {
      return [keys[indexOrHigher], this.values[indexOrHigher]]
    }
    return undefined
  }

  checkValid(depth: number, _tree: TreeState<K>, baseIndex: number): number {
    const kL = this.keys.length
    const vL = this.values.length
    assert(
      kL === vL,
      'keys/values length mismatch: depth',
      depth,
      'with lengths',
      kL,
      vL,
      'and baseIndex',
      baseIndex
    )
    assert(depth === 0 || kL > 0, 'empty leaf at depth', depth, 'and baseIndex', baseIndex)
    return kL
  }

  set(key: K, value: V, overwrite: boolean | undefined, tree: TreeState<K>): boolean | BNode<K, V> {
    let i = this.indexOf(key, -1, tree.compare)
    if (i < 0) {
      i = ~i
      tree.count++
      if (this.keys.length < tree.maxNodeSize) {
        return this.insertInLeaf(i, key, value)
      }
      const newRightSibling = this.splitOffRightSide()
      if (i > this.keys.length) {
        i -= this.keys.length
        newRightSibling.insertInLeaf(i, key, value)
      } else {
        this.insertInLeaf(i, key, value)
      }
      return newRightSibling
    }
    if (overwrite) {
      this.keys[i] = key
      this.values[i] = value
    }
    return false
  }

  insertInLeaf(i: number, key: K, value: V) {
    this.keys.splice(i, 0, key)
    this.values.splice(i, 0, value)
    return true
  }

  takeFromRight(rhs: BNode<K, V>) {
    this.keys.push(rhs.keys[0])
    this.values.push(rhs.values[0])
    rhs.keys.splice(0, 1)
    rhs.values.splice(0, 1)
  }

  takeFromLeft(lhs: BNode<K, V>) {
    const ki = lhs.keys.length - 1
    this.keys.unshift(lhs.keys[ki])
    this.values.unshift(lhs.values[ki])
    lhs.keys.pop()
    lhs.values.pop()
  }

  splitOffRightSide(): BNode<K, V> {
    const half = this.keys.length >> 1
    const keys = this.keys.splice(half)
    const values = this.values.splice(half)
    return new BNode<K, V>(keys, values)
  }

  forRange(
    low: K,
    high: K,
    includeHigh: boolean | undefined,
    editMode: boolean,
    tree: TreeState<K>,
    count: number,
    onFound?: (k: K, v: V, counter: number) => EditResult<V> | undefined
  ): EditResult<V> | number {
    const cmp = tree.compare
    let iLow: number
    let iHigh: number
    if (high === low) {
      if (!includeHigh) return count
      iHigh = (iLow = this.indexOf(low, -1, cmp)) + 1
      if (iLow < 0) return count
    } else {
      iLow = this.indexOf(low, 0, cmp)
      iHigh = this.indexOf(high, -1, cmp)
      if (iHigh < 0) iHigh = ~iHigh
      else if (includeHigh) iHigh++
    }
    const keys = this.keys
    if (onFound !== undefined) {
      for (let i = iLow; i < iHigh; i++) {
        const key = keys[i]
        const result = onFound(key, this.values[i], count++)
        if (result !== undefined) {
          if (editMode) {
            if (key !== keys[i] || this.isShared) {
              throw new Error('BTree illegally changed or cloned in editRange')
            }
            if (result.delete) {
              this.keys.splice(i, 1)
              this.values.splice(i, 1)
              tree.count--
              i--
              iHigh--
            } else if ('value' in result) {
              this.values[i] = (result as { value: V }).value
            }
          }
          if (result.done !== undefined) return result
        }
      }
    } else count += iHigh - iLow
    return count
  }

  mergeSibling(rhs: BNode<K, V>, maxNodeSize: number): void
  mergeSibling(rhs: BNode<K, V>): void {
    this.keys.push(...rhs.keys)
    this.values.push(...rhs.values)
  }
}

function assert(exp: boolean, ...args: unknown[]) {
  if (!exp) {
    args.unshift('B+ tree')
    throw new Error(args.join(' '))
  }
}

function emptyRoot<K, V>(): BNode<K, V> {
  const n = new BNode<K, V>()
  n.isShared = true
  return n
}

/**
 * Mutable tree state shared with the nodes. Held in a `#` private field of {@link BTree}
 * so callers cannot reach or corrupt it.
 * @private
 */
interface TreeState<K> {
  count: number
  readonly maxNodeSize: number
  readonly compare: Comparer<K>
}

/**
 * B+ tree map. Keys are totally ordered by a comparator; values may be `undefined`,
 * and so may keys when the comparator orders `undefined` (the default {@link compare} does).
 *
 * Mutating the tree while iterating it (`entries`, `keys`, `values`, `entriesReversed`)
 * yields an unspecified order and may skip or repeat entries, but never throws or loops
 * forever: iteration always terminates.
 *
 * @template K, V
 */
export class BTree<K = unknown, V = unknown> extends MapCollection<K, V> {
  private root: BNode<K, V> = emptyRoot()
  readonly #state: TreeState<K>
  #frozen = false
  #version = 0

  /**
   * @param entries Initial key-value pairs.
   * @param compareFn Key comparator. Defaults to {@link compare}.
   * @param maxNodeSize Branching factor in 4..256 (clamped). Default 64.
   */
  constructor(entries?: Iterable<[K, V]>, compareFn?: Comparer<K>, maxNodeSize = 64) {
    super()
    this.#state = {
      count: 0,
      maxNodeSize: maxNodeSize >= 4 ? Math.min(maxNodeSize, 256) : 64,
      compare: compareFn ?? compare
    }
    if (entries) this.setPairs(entries)
  }

  get size(): number {
    return this.#state.count
  }

  protected override cloneFrom(entries: Iterable<[K, V]>): this {
    return new BTree(entries, this.#state.compare, this.#state.maxNodeSize) as this
  }

  readonly [Symbol.toStringTag] = 'BTree'

  get isFrozen(): boolean {
    return this.#frozen
  }

  #checkMutable(): void {
    if (this.#frozen) throw new TypeError('BTree is frozen')
  }

  clear(): void {
    this.#checkMutable()
    this.root = emptyRoot()
    this.#state.count = 0
    this.#version++
  }

  get(key: K, defaultValue?: V): V | undefined {
    return this.root.get(key, defaultValue, this.#state)
  }

  /**
   * Insert or overwrite `key`. Replaces the stored key object as well as the value.
   * @returns `this`
   */
  set(key: K, value: V): this {
    this.#checkMutable()
    this.#version++
    if (this.root.isShared) this.root = this.root.clone()
    const result = this.root.set(key, value, true, this.#state)
    if (result !== true && result !== false) {
      this.root = new BNodeInternal<K, V>([this.root, result])
    }
    return this
  }

  has(key: K): boolean {
    return this.forRange(key, key, true) !== 0
  }

  delete(key: K): boolean {
    return this.editRange(key, key, true, DeleteRange) !== 0
  }

  /**
   * Entries in ascending key order.
   * @param from Optional lowest key to start at. Pass nothing to start at the minimum;
   * an explicit `undefined` is a real key and starts at `undefined`.
   */
  entries(...from: [lowestKey?: K]): IteratorObject<[K, V]> {
    return Iterator.from(this.#entriesForward(from))
  }

  /**
   * Entries in descending key order.
   * @param from Optional highest key to start at. Pass nothing to start at the maximum;
   * an explicit `undefined` is a real key and starts at `undefined`.
   */
  entriesReversed(...from: [highestKey?: K]): IteratorObject<[K, V]> {
    return Iterator.from(this.#entriesBackward(from))
  }

  /**
   * Walks forward, re-seeking from the last yielded key whenever the tree was mutated
   * since the previous step, so a stale path is never followed.
   */
  *#entriesForward(from: readonly [K?]): Generator<[K, V], void, undefined> {
    let start = from
    let reseeked = false
    let lastKey: K | undefined
    for (;;) {
      const version = this.#version
      let mutated = false
      for (const entry of this.#scanForward(start)) {
        if (reseeked) {
          if (this.#state.compare(entry[0], lastKey as K) <= 0) continue
          reseeked = false
        }
        lastKey = entry[0]
        yield entry
        if (this.#version !== version) {
          mutated = true
          break
        }
      }
      if (!mutated) return
      start = [lastKey]
      reseeked = true
    }
  }

  /**
   * Mirror of `#entriesForward` for descending order.
   */
  *#entriesBackward(from: readonly [K?]): Generator<[K, V], void, undefined> {
    let start = from
    let reseeked = false
    let lastKey: K | undefined
    for (;;) {
      const version = this.#version
      let mutated = false
      for (const entry of this.#scanBackward(start)) {
        if (reseeked) {
          if (this.#state.compare(entry[0], lastKey as K) >= 0) continue
          reseeked = false
        }
        lastKey = entry[0]
        yield entry
        if (this.#version !== version) {
          mutated = true
          break
        }
      }
      if (!mutated) return
      start = [lastKey]
      reseeked = true
    }
  }

  *#scanForward(from: readonly [K?]): Generator<[K, V], void, undefined> {
    const info = this.findPath(from)
    if (info === undefined) return
    const { nodequeue, nodeindex } = info
    let { leaf } = info
    let i = from.length === 0 ? -1 : leaf.indexOf(from[0] as K, 0, this.#state.compare) - 1
    for (;;) {
      if (++i < leaf.keys.length) {
        yield [leaf.keys[i], leaf.values[i]]
        continue
      }
      let level = -1
      for (;;) {
        if (++level >= nodequeue.length) return
        if (++nodeindex[level] < nodequeue[level].length) break
      }
      for (; level > 0; level--) {
        const parent = nodequeue[level][nodeindex[level]]
        if (!parent.isInternal()) return
        nodequeue[level - 1] = parent.children
        nodeindex[level - 1] = 0
      }
      leaf = nodequeue[0][nodeindex[0]]
      i = -1
    }
  }

  *#scanBackward(from: readonly [K?]): Generator<[K, V], void, undefined> {
    if (this.#state.count === 0) return
    const maxKey = this.maxKey() as K
    const startKey = from.length === 0 ? maxKey : (from[0] as K)
    const path = this.findPath([startKey]) ?? this.findPath([maxKey])
    if (path === undefined) return
    const { nodequeue, nodeindex } = path
    let { leaf } = path
    let i = leaf.indexOf(startKey, 0, this.#state.compare)
    if (i < leaf.keys.length && this.#state.compare(leaf.keys[i], startKey) <= 0) i++
    for (;;) {
      if (--i >= 0) {
        yield [leaf.keys[i], leaf.values[i]]
        continue
      }
      let level = -1
      for (;;) {
        if (++level >= nodequeue.length) return
        if (--nodeindex[level] >= 0) break
      }
      for (; level > 0; level--) {
        const parent = nodequeue[level][nodeindex[level]]
        if (!parent.isInternal()) return
        nodequeue[level - 1] = parent.children
        nodeindex[level - 1] = nodequeue[level - 1].length - 1
      }
      leaf = nodequeue[0][nodeindex[0]]
      i = leaf.keys.length
    }
  }

  private findPath(
    from: readonly [K?]
  ): { nodequeue: BNode<K, V>[][]; nodeindex: number[]; leaf: BNode<K, V> } | undefined {
    let nextnode = this.root
    let nodequeue: BNode<K, V>[][]
    let nodeindex: number[]

    if (!nextnode.isInternal()) {
      nodequeue = EmptyArray
      nodeindex = EmptyArray
    } else {
      nodequeue = []
      nodeindex = []
      for (let d = 0; nextnode.isInternal(); d++) {
        nodequeue[d] = nextnode.children
        nodeindex[d] =
          from.length === 0 ? 0 : nextnode.indexOf(from[0] as K, 0, this.#state.compare)
        if (nodeindex[d] >= nodequeue[d].length) return undefined
        nextnode = nodequeue[d][nodeindex[d]]
      }
      nodequeue.reverse()
      nodeindex.reverse()
    }
    return { nodequeue, nodeindex, leaf: nextnode }
  }

  keys(...from: [firstKey?: K]): IteratorObject<K> {
    return this.entries(...from).map(([k]) => k)
  }

  values(...from: [firstKey?: K]): IteratorObject<V> {
    return this.entries(...from).map(([, v]) => v)
  }

  minKey(): K | undefined {
    return this.root.minKey()
  }

  maxKey(): K | undefined {
    return this.root.maxKey()
  }

  get maxNodeSize(): number {
    return this.#state.maxNodeSize
  }

  clone(): BTree<K, V> {
    const result = new BTree<K, V>(undefined, this.#state.compare, this.#state.maxNodeSize)
    result.root = this.root.greedyClone()
    result.#state.count = this.#state.count
    return result
  }

  toArray(): [K, V][] {
    return [...this.entries()]
  }

  toString(): string {
    return this.toArray().toString()
  }

  /**
   * Least entry with key strictly greater than `key`, or undefined.
   */
  higher(key: K): [K, V] | undefined {
    return this.root.getPairOrNextHigher(key, this.#state.compare, false)
  }

  /**
   * Greatest entry with key strictly less than `key`, or undefined.
   */
  lower(key: K): [K, V] | undefined {
    return this.root.getPairOrNextLower(key, this.#state.compare, false)
  }

  floor(key: K): [K, V] | undefined {
    return this.root.getPairOrNextLower(key, this.#state.compare, true)
  }

  ceiling(key: K): [K, V] | undefined {
    return this.root.getPairOrNextHigher(key, this.#state.compare, true)
  }

  /**
   * @param maxLength Stop after this many pairs. `maxLength <= 0` returns `[]`.
   */
  getRange(low: K, high: K, includeHigh?: boolean, maxLength = 0x3ffffff): [K, V][] {
    if (maxLength <= 0) return []
    const results: [K, V][] = []
    this.root.forRange(low, high, includeHigh, false, this.#state, 0, (k, v) => {
      results.push([k, v])
      return results.length >= maxLength ? Break : undefined
    })
    return results
  }

  /**
   * @returns Number of keys that were not already present.
   */
  setPairs(entries: Iterable<[K, V]>): number {
    this.#checkMutable()
    let added = 0
    for (const [k, v] of entries) {
      if (!this.has(k)) added++
      this.set(k, v)
    }
    return added
  }

  forRange<R = number>(
    low: K,
    high: K,
    includeHigh: boolean,
    onFound?: (k: K, v: V, counter: number) => EditResult<V, R> | undefined,
    initialCounter?: number
  ): R | number {
    const r = this.root.forRange(
      low,
      high,
      includeHigh,
      false,
      this.#state,
      initialCounter ?? 0,
      onFound
    )
    return typeof r === 'number' ? r : (r.done as R)
  }

  editRange<R = V>(
    low: K,
    high: K,
    includeHigh: boolean,
    onFound: (k: K, v: V, counter: number) => EditResult<V, R> | undefined,
    initialCounter?: number
  ): R | number {
    this.#checkMutable()
    this.#version++
    let root = this.root
    if (root.isShared) this.root = root = root.clone()
    try {
      const r = root.forRange(
        low,
        high,
        includeHigh,
        true,
        this.#state,
        initialCounter ?? 0,
        onFound
      )
      return typeof r === 'number' ? r : (r.done as R)
    } finally {
      let isShared = false
      while (root.keys.length <= 1 && root.isInternal()) {
        isShared = isShared || !!root.isShared
        this.root = root = root.keys.length === 0 ? emptyRoot() : root.children[0]
      }
      if (isShared) root.isShared = true
    }
  }

  deleteRange(low: K, high: K, includeHigh: boolean): number {
    return this.editRange<number>(low, high, includeHigh, DeleteRange)
  }

  deleteKeys(keys: Iterable<K>): number {
    let r = 0
    for (const key of keys) if (this.delete(key)) r++
    return r
  }

  get height(): number {
    let node: BNode<K, V> | undefined = this.root
    let height = -1
    while (node) {
      height++
      node = node.isInternal() ? node.children[0] : undefined
    }
    return height
  }

  /**
   * Prevent mutators until {@link unfreeze}.
   */
  freeze(): this {
    this.#frozen = true
    return this
  }

  /**
   * Clear the frozen flag set by {@link freeze}.
   */
  unfreeze(): this {
    this.#frozen = false
    return this
  }

  /**
   * Structural integrity check for tests. Not part of the public collections export.
   */
  __checkValid(): void {
    const size = this.root.checkValid(0, this.#state, 0)
    assert(size === this.#state.count, 'size mismatch', size, this.#state.count)
  }
}

class BNodeInternal<K, V> extends BNode<K, V> {
  declare children: BNode<K, V>[]

  constructor(children: BNode<K, V>[], keys?: K[]) {
    let ks = keys
    if (!ks) {
      ks = []
      for (let i = 0; i < children.length; i++) ks[i] = children[i].maxKey()
    }
    super(ks, [])
    this.children = children
  }

  override clone(): BNode<K, V> {
    const children = this.children.slice(0)
    for (const child of children) child.isShared = true
    return new BNodeInternal<K, V>(children, this.keys.slice(0))
  }

  override greedyClone(): BNode<K, V> {
    if (this.isShared) return this
    const nu = new BNodeInternal<K, V>(this.children.slice(0), this.keys.slice(0))
    for (let i = 0; i < nu.children.length; i++) nu.children[i] = nu.children[i].greedyClone()
    return nu
  }

  override minKey() {
    return this.children[0].minKey()
  }

  override minPair(): [K, V] | undefined {
    return this.children[0].minPair()
  }

  override maxPair(): [K, V] | undefined {
    return this.children[this.children.length - 1].maxPair()
  }

  override get(key: K, defaultValue: V | undefined, tree: TreeState<K>): V | undefined {
    const i = this.indexOf(key, 0, tree.compare)
    const children = this.children
    return i < children.length ? children[i].get(key, defaultValue, tree) : defaultValue
  }

  override getPairOrNextLower(
    key: K,
    cmp: (a: K, b: K) => number,
    inclusive: boolean
  ): [K, V] | undefined {
    const i = this.indexOf(key, 0, cmp)
    const children = this.children
    if (i >= children.length) return this.maxPair()
    const result = children[i].getPairOrNextLower(key, cmp, inclusive)
    if (result === undefined && i > 0) return children[i - 1].maxPair()
    return result
  }

  override getPairOrNextHigher(
    key: K,
    cmp: (a: K, b: K) => number,
    inclusive: boolean
  ): [K, V] | undefined {
    const i = this.indexOf(key, 0, cmp)
    const children = this.children
    const length = children.length
    if (i >= length) return undefined
    const result = children[i].getPairOrNextHigher(key, cmp, inclusive)
    if (result === undefined && i < length - 1) return children[i + 1].minPair()
    return result
  }

  override checkValid(depth: number, tree: TreeState<K>, baseIndex: number): number {
    const kL = this.keys.length
    const cL = this.children.length
    assert(
      kL === cL,
      'keys/children length mismatch: depth',
      depth,
      'lengths',
      kL,
      cL,
      'baseIndex',
      baseIndex
    )
    assert(
      kL > 1 || depth > 0,
      'internal node has length',
      kL,
      'at depth',
      depth,
      'baseIndex',
      baseIndex
    )
    let size = 0
    const c = this.children
    const k = this.keys
    let childSize = 0
    for (let i = 0; i < cL; i++) {
      size += c[i].checkValid(depth + 1, tree, baseIndex + size)
      childSize += c[i].keys.length
      assert(size >= childSize, 'wtf', baseIndex)
      assert(
        i === 0 || c[i - 1].constructor === c[i].constructor,
        'type mismatch, baseIndex:',
        baseIndex
      )
      if (c[i].maxKey() !== k[i]) {
        assert(
          false,
          'keys[',
          i,
          '] =',
          k[i],
          'is wrong, should be ',
          c[i].maxKey(),
          'at depth',
          depth,
          'baseIndex',
          baseIndex
        )
      }
      if (!(i === 0 || tree.compare(k[i - 1], k[i]) < 0)) {
        assert(false, 'sort violation at depth', depth, 'index', i, 'keys', k[i - 1], k[i])
      }
    }
    const toofew = childSize === 0
    if (toofew || childSize > tree.maxNodeSize * cL) {
      assert(
        false,
        toofew ? 'too few' : 'too many',
        'children (',
        childSize,
        size,
        ') at depth',
        depth,
        'maxNodeSize:',
        tree.maxNodeSize,
        'children.length:',
        cL,
        'baseIndex:',
        baseIndex
      )
    }
    return size
  }

  override set(
    key: K,
    value: V,
    overwrite: boolean | undefined,
    tree: TreeState<K>
  ): boolean | BNodeInternal<K, V> {
    const c = this.children
    const max = tree.maxNodeSize
    const cmp = tree.compare
    let i = Math.min(this.indexOf(key, 0, cmp), c.length - 1)
    let child = c[i]

    if (child.isShared) c[i] = child = child.clone()
    if (child.keys.length >= max) {
      let other: BNode<K, V>
      if (i > 0 && (other = c[i - 1]).keys.length < max && cmp(child.keys[0], key) < 0) {
        if (other.isShared) c[i - 1] = other = other.clone()
        other.takeFromRight(child)
        this.keys[i - 1] = other.maxKey()
      } else if (
        i + 1 < c.length &&
        (other = c[i + 1]).keys.length < max &&
        cmp(child.maxKey(), key) < 0
      ) {
        if (other.isShared) c[i + 1] = other = other.clone()
        other.takeFromLeft(child)
        this.keys[i] = c[i].maxKey()
      }
    }

    const result = child.set(key, value, overwrite, tree)
    if (result === false) return false
    this.keys[i] = child.maxKey()
    if (result === true) return true

    if (this.keys.length < max) {
      this.insert(i + 1, result)
      return true
    }
    const newRightSibling = this.splitOffRightSide()
    if (cmp(result.maxKey(), this.maxKey()) > 0) {
      i -= this.keys.length
      newRightSibling.insert(i + 1, result)
    } else {
      this.insert(i + 1, result)
    }
    return newRightSibling
  }

  insert(i: number, child: BNode<K, V>) {
    this.children.splice(i, 0, child)
    this.keys.splice(i, 0, child.maxKey())
  }

  override splitOffRightSide() {
    const half = this.children.length >> 1
    return new BNodeInternal<K, V>(this.children.splice(half), this.keys.splice(half))
  }

  override takeFromRight(rhs: BNode<K, V>) {
    if (!rhs.isInternal()) {
      assert(false, 'sibling type mismatch')
      return
    }
    this.keys.push(rhs.keys[0])
    this.children.push(rhs.children[0])
    rhs.keys.splice(0, 1)
    rhs.children.splice(0, 1)
  }

  override takeFromLeft(lhs: BNode<K, V>) {
    if (!lhs.isInternal()) {
      assert(false, 'sibling type mismatch')
      return
    }
    const ki = lhs.keys.length - 1
    this.keys.unshift(lhs.keys[ki])
    this.children.unshift(lhs.children[ki])
    lhs.keys.pop()
    lhs.children.pop()
  }

  override forRange(
    low: K,
    high: K,
    includeHigh: boolean | undefined,
    editMode: boolean,
    tree: TreeState<K>,
    count: number,
    onFound?: (k: K, v: V, counter: number) => EditResult<V> | undefined
  ): EditResult<V> | number {
    const cmp = tree.compare
    const keys = this.keys
    const children = this.children
    let iLow = this.indexOf(low, 0, cmp)
    let i = iLow
    const iHigh = Math.min(high === low ? iLow : this.indexOf(high, 0, cmp), keys.length - 1)
    if (!editMode) {
      for (; i <= iHigh; i++) {
        const result = children[i].forRange(low, high, includeHigh, editMode, tree, count, onFound)
        if (typeof result !== 'number') return result
        count = result
      }
    } else if (i <= iHigh) {
      try {
        for (; i <= iHigh; i++) {
          if (children[i].isShared) children[i] = children[i].clone()
          const result = children[i].forRange(
            low,
            high,
            includeHigh,
            editMode,
            tree,
            count,
            onFound
          )
          keys[i] = children[i].maxKey()
          if (typeof result !== 'number') return result
          count = result
        }
      } finally {
        const half = tree.maxNodeSize >> 1
        if (iLow > 0) iLow--
        for (i = iHigh; i >= iLow; i--) {
          if (children[i].keys.length <= half) {
            if (children[i].keys.length !== 0) {
              this.tryMerge(i, tree.maxNodeSize)
            } else {
              keys.splice(i, 1)
              children.splice(i, 1)
            }
          }
        }
        if (children.length !== 0 && children[0].keys.length === 0) assert(false, 'emptiness bug')
      }
    }
    return count
  }

  tryMerge(i: number, maxSize: number): boolean {
    const children = this.children
    if (i >= 0 && i + 1 < children.length) {
      if (children[i].keys.length + children[i + 1].keys.length <= maxSize) {
        if (children[i].isShared) children[i] = children[i].clone()
        children[i].mergeSibling(children[i + 1], maxSize)
        children.splice(i + 1, 1)
        this.keys.splice(i + 1, 1)
        this.keys[i] = children[i].maxKey()
        return true
      }
    }
    return false
  }

  override mergeSibling(rhs: BNode<K, V>, maxNodeSize: number) {
    if (!rhs.isInternal()) {
      assert(false, 'sibling type mismatch')
      return
    }
    const oldLength = this.keys.length
    this.keys.push(...rhs.keys)
    const rhsChildren = rhs.children
    this.children.push(...rhsChildren)

    if (rhs.isShared && !this.isShared) {
      for (const child of rhsChildren) child.isShared = true
    }

    this.tryMerge(oldLength - 1, maxNodeSize)
  }
}
