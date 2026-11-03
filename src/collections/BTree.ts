import { KeyError } from '../globals/index.js'
import { compare, type Comparer } from '../operators/index.js'
import { MapCollection } from './abc.js'

const Delete = { delete: true as const }
const DeleteRange = () => Delete
const Break = { done: true as const }
const EmptyArray: never[] = []

export type EditResult<V, R = unknown> = { value?: V; delete?: true; done?: R }

/**
 * Leaf nodes and base class for internals.
 * Based on the `sorted-btree` implementation by David Piepgrass (MIT License).
 * @private
 */
class BNode<K, V> {
  keys: K[]
  values: V[]
  children?: Array<BNode<K, V>>
  isShared?: boolean

  get isLeaf() {
    return this.children === undefined
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
        else throw new KeyError(`BTree found an invalid key: ${key}`)
      }
      mid = (lo + hi) >> 1
    }
    return mid ^ failXor
  }

  minKey(): K | undefined {
    return this.keys[0]
  }

  minPair(reusedArray: [K, V]): [K, V] | undefined {
    if (this.keys.length === 0) return undefined
    reusedArray[0] = this.keys[0]
    reusedArray[1] = this.values[0]
    return reusedArray
  }

  maxPair(reusedArray: [K, V]): [K, V] | undefined {
    if (this.keys.length === 0) return undefined
    const lastIndex = this.keys.length - 1
    reusedArray[0] = this.keys[lastIndex]
    reusedArray[1] = this.values[lastIndex]
    return reusedArray
  }

  clone(): BNode<K, V> {
    return new BNode<K, V>(this.keys.slice(0), this.values.slice(0))
  }

  greedyClone(force?: boolean): BNode<K, V> {
    return this.isShared && !force ? this : this.clone()
  }

  get(key: K, defaultValue: V | undefined, tree: BTree<K, V>): V | undefined {
    const i = this.indexOf(key, -1, tree._compare)
    return i < 0 ? defaultValue : this.values[i]
  }

  getPairOrNextLower(
    key: K,
    cmp: (a: K, b: K) => number,
    inclusive: boolean,
    reusedArray: [K, V]
  ): [K, V] | undefined {
    const i = this.indexOf(key, -1, cmp)
    const indexOrLower = i < 0 ? ~i - 1 : inclusive ? i : i - 1
    if (indexOrLower >= 0) {
      reusedArray[0] = this.keys[indexOrLower]
      reusedArray[1] = this.values[indexOrLower]
      return reusedArray
    }
    return undefined
  }

  getPairOrNextHigher(
    key: K,
    cmp: (a: K, b: K) => number,
    inclusive: boolean,
    reusedArray: [K, V]
  ): [K, V] | undefined {
    const i = this.indexOf(key, -1, cmp)
    const indexOrHigher = i < 0 ? ~i : inclusive ? i : i + 1
    const keys = this.keys
    if (indexOrHigher < keys.length) {
      reusedArray[0] = keys[indexOrHigher]
      reusedArray[1] = this.values[indexOrHigher]
      return reusedArray
    }
    return undefined
  }

  checkValid(depth: number, _tree: BTree<K, V>, baseIndex: number): number {
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

  set(key: K, value: V, overwrite: boolean | undefined, tree: BTree<K, V>): boolean | BNode<K, V> {
    let i = this.indexOf(key, -1, tree._compare)
    if (i < 0) {
      i = ~i
      tree.count++
      if (this.keys.length < tree._maxNodeSize) {
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
    tree: BTree<K, V>,
    count: number,
    onFound?: (k: K, v: V, counter: number) => EditResult<V> | undefined
  ): EditResult<V> | number {
    const cmp = tree._compare
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

  mergeSibling(rhs: BNode<K, V>, maxNodeSize: number) {
    void maxNodeSize
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
 * B+ tree map. Keys are totally ordered by a comparator; values may be `undefined`.
 *
 * @template K, V
 */
export class BTree<K = unknown, V = unknown> extends MapCollection<K, V> {
  private root: BNode<K, V> = emptyRoot()
  count = 0
  _maxNodeSize: number
  _compare: Comparer<K>
  #frozen = false

  /**
   * @param entries Initial key-value pairs.
   * @param compareFn Key comparator. Defaults to {@link compare}.
   * @param maxNodeSize Branching factor in 4..256 (clamped). Default 64.
   */
  constructor(entries?: Iterable<[K, V]>, compareFn?: Comparer<K>, maxNodeSize = 64) {
    super()
    this._maxNodeSize = maxNodeSize >= 4 ? Math.min(maxNodeSize, 256) : 64
    this._compare = compareFn ?? compare
    if (entries) this.setPairs(entries)
  }

  get size(): number {
    return this.count
  }

  get [Symbol.toStringTag](): string {
    return 'BTree'
  }

  get isFrozen(): boolean {
    return this.#frozen
  }

  #checkMutable(): void {
    if (this.#frozen) throw new TypeError('BTree is frozen')
  }

  clear(): void {
    this.#checkMutable()
    this.root = emptyRoot()
    this.count = 0
  }

  get(key: K, defaultValue?: V): V | undefined {
    return this.root.get(key, defaultValue, this)
  }

  /**
   * Insert or overwrite `key`. Replaces the stored key object as well as the value.
   * @returns `this`
   */
  set(key: K, value: V): this {
    this.#checkMutable()
    if (this.root.isShared) this.root = this.root.clone()
    const result = this.root.set(key, value, true, this)
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

  entries(lowestKey?: K): IteratorObject<[K, V]> {
    return Iterator.from(this.#entriesForward(lowestKey))
  }

  entriesReversed(highestKey?: K): IteratorObject<[K, V]> {
    return Iterator.from(this.#entriesBackward(highestKey))
  }

  *#entriesForward(lowestKey?: K): Generator<[K, V], void, undefined> {
    const info = this.findPath(lowestKey)
    if (info === undefined) return
    const { nodequeue, nodeindex } = info
    let { leaf } = info
    let i = lowestKey === undefined ? -1 : leaf.indexOf(lowestKey, 0, this._compare) - 1
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
        const parent = nodequeue[level][nodeindex[level]] as BNodeInternal<K, V>
        nodequeue[level - 1] = parent.children
        nodeindex[level - 1] = 0
      }
      leaf = nodequeue[0][nodeindex[0]]
      i = -1
    }
  }

  *#entriesBackward(highestKey?: K): Generator<[K, V], void, undefined> {
    let startKey = highestKey
    let skipHighest = false
    if (startKey === undefined) {
      startKey = this.maxKey()
      if (startKey === undefined) return
    } else {
      skipHighest = false
    }
    const path = this.findPath(startKey) ?? this.findPath(this.maxKey())
    if (path === undefined) return
    const { nodequeue, nodeindex } = path
    let { leaf } = path
    let i = leaf.indexOf(startKey, 0, this._compare)
    if (!skipHighest && i < leaf.keys.length && this._compare(leaf.keys[i], startKey) <= 0) i++
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
        const parent = nodequeue[level][nodeindex[level]] as BNodeInternal<K, V>
        nodequeue[level - 1] = parent.children
        nodeindex[level - 1] = nodequeue[level - 1].length - 1
      }
      leaf = nodequeue[0][nodeindex[0]]
      i = leaf.keys.length
    }
  }

  private findPath(
    key?: K
  ): { nodequeue: Array<Array<BNode<K, V>>>; nodeindex: number[]; leaf: BNode<K, V> } | undefined {
    let nextnode = this.root
    let nodequeue: Array<Array<BNode<K, V>>>
    let nodeindex: number[]

    if (nextnode.isLeaf) {
      nodequeue = EmptyArray
      nodeindex = EmptyArray
    } else {
      nodequeue = []
      nodeindex = []
      for (let d = 0; !nextnode.isLeaf; d++) {
        nodequeue[d] = (nextnode as BNodeInternal<K, V>).children
        nodeindex[d] = key === undefined ? 0 : nextnode.indexOf(key, 0, this._compare)
        if (nodeindex[d] >= nodequeue[d].length) return undefined
        nextnode = nodequeue[d][nodeindex[d]]
      }
      nodequeue.reverse()
      nodeindex.reverse()
    }
    return { nodequeue, nodeindex, leaf: nextnode }
  }

  keys(firstKey?: K): IteratorObject<K> {
    return this.entries(firstKey).map(([k]) => k)
  }

  values(firstKey?: K): IteratorObject<V> {
    return this.entries(firstKey).map(([, v]) => v)
  }

  minKey(): K | undefined {
    return this.root.minKey()
  }

  maxKey(): K | undefined {
    return this.root.maxKey()
  }

  get maxNodeSize(): number {
    return this._maxNodeSize
  }

  clone(force = false): BTree<K, V> {
    const result = new BTree<K, V>(undefined, this._compare, this._maxNodeSize)
    result.root = this.root.greedyClone(force)
    result.count = this.count
    return result
  }

  toArray(): Array<[K, V]> {
    const min = this.minKey()
    const max = this.maxKey()
    if (min !== undefined && max !== undefined) return this.getRange(min, max, true)
    return []
  }

  toString(): string {
    return this.toArray().toString()
  }

  /**
   * Least entry with key strictly greater than `key`, or undefined.
   * When `key` is undefined, returns the minimum pair.
   */
  higher(key?: K, reusedArray?: [K, V]): [K, V] | undefined {
    const buf: [K, V] = reusedArray ?? ([undefined as K, undefined as V] as [K, V])
    if (key === undefined) return this.root.minPair(buf)
    return this.root.getPairOrNextHigher(key, this._compare, false, buf)
  }

  /**
   * Greatest entry with key strictly less than `key`, or undefined.
   * When `key` is undefined, returns the maximum pair.
   */
  lower(key?: K, reusedArray?: [K, V]): [K, V] | undefined {
    const buf: [K, V] = reusedArray ?? ([undefined as K, undefined as V] as [K, V])
    if (key === undefined) return this.root.maxPair(buf)
    return this.root.getPairOrNextLower(key, this._compare, false, buf)
  }

  floor(key: K, reusedArray?: [K, V]): [K, V] | undefined {
    const buf: [K, V] = reusedArray ?? ([undefined as K, undefined as V] as [K, V])
    return this.root.getPairOrNextLower(key, this._compare, true, buf)
  }

  ceiling(key: K, reusedArray?: [K, V]): [K, V] | undefined {
    const buf: [K, V] = reusedArray ?? ([undefined as K, undefined as V] as [K, V])
    return this.root.getPairOrNextHigher(key, this._compare, true, buf)
  }

  /**
   * @param maxLength Stop after this many pairs. `maxLength <= 0` returns `[]`.
   */
  getRange(low: K, high: K, includeHigh?: boolean, maxLength: number = 0x3ffffff): Array<[K, V]> {
    if (maxLength <= 0) return []
    const results: Array<[K, V]> = []
    this.root.forRange(low, high, includeHigh, false, this, 0, (k, v) => {
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
    const r = this.root.forRange(low, high, includeHigh, false, this, initialCounter || 0, onFound)
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
    let root = this.root
    if (root.isShared) this.root = root = root.clone()
    try {
      const r = root.forRange(low, high, includeHigh, true, this, initialCounter || 0, onFound)
      return typeof r === 'number' ? r : (r.done as R)
    } finally {
      let isShared = false
      while (root.keys.length <= 1 && !root.isLeaf) {
        isShared = isShared || !!root.isShared
        const internal = root as BNodeInternal<K, V>
        this.root = root = root.keys.length === 0 ? emptyRoot() : internal.children[0]
      }
      if (isShared) root.isShared = true
    }
  }

  deleteRange(low: K, high: K, includeHigh: boolean): number {
    return this.editRange(low, high, includeHigh, DeleteRange) as number
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
      node = node.isLeaf ? undefined : (node as BNodeInternal<K, V>).children[0]
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
    const size = this.root.checkValid(0, this, 0)
    assert(size === this.count, 'size mismatch', size, this.count)
  }
}

class BNodeInternal<K, V> extends BNode<K, V> {
  declare children: Array<BNode<K, V>>

  constructor(children: Array<BNode<K, V>>, keys?: K[]) {
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
    for (let i = 0; i < children.length; i++) children[i].isShared = true
    return new BNodeInternal<K, V>(children, this.keys.slice(0))
  }

  override greedyClone(force?: boolean): BNode<K, V> {
    if (this.isShared && !force) return this
    const nu = new BNodeInternal<K, V>(this.children.slice(0), this.keys.slice(0))
    for (let i = 0; i < nu.children.length; i++) nu.children[i] = nu.children[i].greedyClone(force)
    return nu
  }

  override minKey() {
    return this.children[0].minKey()
  }

  override minPair(reusedArray: [K, V]): [K, V] | undefined {
    return this.children[0].minPair(reusedArray)
  }

  override maxPair(reusedArray: [K, V]): [K, V] | undefined {
    return this.children[this.children.length - 1].maxPair(reusedArray)
  }

  override get(key: K, defaultValue: V | undefined, tree: BTree<K, V>): V | undefined {
    const i = this.indexOf(key, 0, tree._compare)
    const children = this.children
    return i < children.length ? children[i].get(key, defaultValue, tree) : defaultValue
  }

  override getPairOrNextLower(
    key: K,
    cmp: (a: K, b: K) => number,
    inclusive: boolean,
    reusedArray: [K, V]
  ): [K, V] | undefined {
    const i = this.indexOf(key, 0, cmp)
    const children = this.children
    if (i >= children.length) return this.maxPair(reusedArray)
    const result = children[i].getPairOrNextLower(key, cmp, inclusive, reusedArray)
    if (result === undefined && i > 0) return children[i - 1].maxPair(reusedArray)
    return result
  }

  override getPairOrNextHigher(
    key: K,
    cmp: (a: K, b: K) => number,
    inclusive: boolean,
    reusedArray: [K, V]
  ): [K, V] | undefined {
    const i = this.indexOf(key, 0, cmp)
    const children = this.children
    const length = children.length
    if (i >= length) return undefined
    const result = children[i].getPairOrNextHigher(key, cmp, inclusive, reusedArray)
    if (result === undefined && i < length - 1) return children[i + 1].minPair(reusedArray)
    return result
  }

  override checkValid(depth: number, tree: BTree<K, V>, baseIndex: number): number {
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
      if (!(i === 0 || tree._compare(k[i - 1], k[i]) < 0)) {
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
    tree: BTree<K, V>
  ): boolean | BNodeInternal<K, V> {
    const c = this.children
    const max = tree._maxNodeSize
    const cmp = tree._compare
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
        (other = c[i + 1]) !== undefined &&
        other.keys.length < max &&
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
    const r = rhs as BNodeInternal<K, V>
    this.keys.push(r.keys[0])
    this.children.push(r.children[0])
    r.keys.splice(0, 1)
    r.children.splice(0, 1)
  }

  override takeFromLeft(lhs: BNode<K, V>) {
    const l = lhs as BNodeInternal<K, V>
    const ki = l.keys.length - 1
    this.keys.unshift(l.keys[ki])
    this.children.unshift(l.children[ki])
    l.keys.pop()
    l.children.pop()
  }

  override forRange(
    low: K,
    high: K,
    includeHigh: boolean | undefined,
    editMode: boolean,
    tree: BTree<K, V>,
    count: number,
    onFound?: (k: K, v: V, counter: number) => EditResult<V> | undefined
  ): EditResult<V> | number {
    const cmp = tree._compare
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
        const half = tree._maxNodeSize >> 1
        if (iLow > 0) iLow--
        for (i = iHigh; i >= iLow; i--) {
          if (children[i].keys.length <= half) {
            if (children[i].keys.length !== 0) {
              this.tryMerge(i, tree._maxNodeSize)
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
    const oldLength = this.keys.length
    this.keys.push(...rhs.keys)
    const rhsChildren = (rhs as BNodeInternal<K, V>).children
    this.children.push(...rhsChildren)

    if (rhs.isShared && !this.isShared) {
      for (let i = 0; i < rhsChildren.length; i++) rhsChildren[i].isShared = true
    }

    this.tryMerge(oldLength - 1, maxNodeSize)
  }
}
