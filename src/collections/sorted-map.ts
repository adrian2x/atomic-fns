import { type Comparator, defaultCompare } from './internal/compare.ts'
import { registerSortedMapCheck } from './internal/invariants.ts'
import { arrayFromIterableMap } from './internal/iterable.ts'

const NODE_CAPACITY = 64
const MIN_FILL = 32

interface LeafNode<K, V> {
  readonly kind: 'leaf'
  owner: object
  keys: K[]
  values: V[] | undefined
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

/** A key position in a leaf, with the branch frames that lead to it from the root. */
interface Cursor<K, V> {
  branches: PathFrame<K, V>[]
  leaf: LeafNode<K, V>
  index: number
}

/** Where a seek lands: at `key` or past it in the walk's direction, or only past it when `exclusive`. */
interface SeekStart<K> {
  key: K
  exclusive: boolean
}

/** The step through key positions. */
type Direction = 1 | -1
const ASCENDING: Direction = 1
const DESCENDING: Direction = -1

function countOf<K, V>(n: TreeNode<K, V>): number {
  return n.kind === 'leaf' ? n.keys.length : n.total
}

function itemCount<K, V>(n: TreeNode<K, V>): number {
  return n.kind === 'leaf' ? n.keys.length : n.children.length
}

/** The largest key under `n`. Only an empty root leaf holds no key, and nothing asks it. */
function lastKeyOf<K, V>(n: TreeNode<K, V>): K {
  return n.kind === 'leaf' ? n.keys[n.keys.length - 1] : n.maxKeys[n.maxKeys.length - 1]
}

function emptyLeaf<K, V>(owner: object, keyOnly: boolean): LeafNode<K, V> {
  return { kind: 'leaf', owner, keys: [], values: keyOnly ? undefined : [] }
}

function valueAt<K, V>(leaf: LeafNode<K, V>, index: number): V {
  return leaf.values === undefined ? (true as V) : leaf.values[index]
}

export let createSetMap: <T>(
  values?: Iterable<T> | null,
  compareFn?: Comparator<T> | null
) => SortedMap<T, true>

export let insertIfAbsent: <K, V>(map: SortedMap<K, V>, key: K, value: V) => boolean

function isNonPrimitive(value: unknown): value is object {
  return Object(value) === value
}

function assertOptions(options: unknown): void {
  if (options !== undefined && !isNonPrimitive(options)) {
    throw new TypeError('options must be an object')
  }
}

/** A `-0` key is stored as `+0`, as `Map` does. */
function positiveZero<K>(key: K): K {
  return key === 0 ? (0 as K) : key
}

/** Columns rather than `[key, value]` boxes: a bulk load holds every item at once. */
function readEntries<K, V>(entries: Iterable<readonly [K, V]>): { keys: K[]; values: V[] } {
  const values: V[] = []
  const keys = arrayFromIterableMap(entries, (entry): K => {
    if (!isNonPrimitive(entry)) throw new TypeError('entries must be [key, value] pairs')
    const pair = entry as readonly [K, V]
    values.push(pair[1])
    return positiveZero(pair[0])
  })
  return { keys, values }
}

function resolveLimit(limit: number | undefined): number {
  if (limit === undefined || limit === Infinity) return Infinity
  if (typeof limit !== 'number') throw new TypeError('limit must be a number')
  if (!Number.isInteger(limit) || limit < 0) {
    throw new RangeError('limit must be a non-negative integer or Infinity')
  }
  return limit
}

/**
 * A map whose keys stay sorted, on a copy-on-write B+ tree with subtree counts. It has `Map`'s
 * method names and iterates in key order, adds order queries (`firstKey`, `lastKey`, `lower`,
 * `higher`, `floor`, `ceiling`), position queries (`at`, `rank`) and range operations
 * (`entriesBetween`, `updateRange`, `removeRange`), and clones in O(1): a clone shares nodes with
 * its source until either one writes. Keys the comparator calls equal are the
 * same key, and a `-0` key is stored as `+0`, as `Map` does. With the default comparator, keys are
 * numbers, bigints or strings: `NaN` throws `RangeError`, and `null`, `undefined` and other values
 * throw `TypeError`; pass a comparator to order them.
 *
 * The comparator must be pure, return a finite number for every pair, and return 0 for a key
 * compared with itself; every new key is checked, and a comparator that breaks these rules throws
 * `TypeError` and leaves the map unchanged. Subtracting numbers fails for `Infinity` and `NaN`
 * keys (`Infinity - x` is not finite); the default comparator handles every number but `NaN`.
 *
 * Under a strict total order, changing the map while iterating it never repeats a key: after a
 * structural change the cursor re-seeks to the key after the last one it yielded. The walk ends
 * unless the loop keeps inserting keys ahead of the cursor, as with `Map`.
 *
 * @example
 * ```ts
 * const scores = new SortedMap([
 *   ['carol', 7],
 *   ['alice', 9]
 * ])
 * scores.set('bob', 8)
 * ;[...scores.keys()] // ['alice', 'bob', 'carol']
 * scores.at(-1) // ['carol', 7]
 * scores.rank('bob') // 1
 * ```
 */
export class SortedMap<K = unknown, V = unknown> {
  #root: TreeNode<K, V>
  #size = 0
  readonly #compareFn: Comparator<K>
  #token: object = {}
  #version = 0
  #keyOnly = false

  static {
    registerSortedMapCheck((map) => (map as SortedMap<unknown, unknown>).#checkInvariants())
    createSetMap = <T>(values?: Iterable<T> | null, compareFn?: Comparator<T> | null) => {
      const keys =
        values == null
          ? undefined
          : arrayFromIterableMap<T>(values, (key) => positiveZero(key as T))
      const map = new SortedMap<T, true>(undefined, compareFn)
      map.#keyOnly = true
      map.#root = emptyLeaf(map.#token, true)
      if (keys !== undefined) map.#bulkLoad(keys, undefined)
      return map
    }
    insertIfAbsent = (map, key, value) => map.#set(key, value, false)
  }

  /**
   * Create a map holding `entries`. Sorted input loads in linear time; when keys repeat, the last
   * entry wins, as for `Map`.
   * @param entries Initial `[key, value]` pairs. `null` means none, as for `Map`.
   * @param compareFn Key comparator. Defaults to the primitive order (numbers, bigints and strings).
   * @throws {TypeError} when `entries` is not iterable or holds something that is not an entry,
   * or the comparator cannot order a key.
   */
  constructor(
    entries?: Iterable<readonly [K, V]> | null,
    compareFn?: ((a: K, b: K) => number) | null
  ) {
    this.#compareFn = compareFn ?? defaultCompare
    if (typeof this.#compareFn !== 'function') {
      throw new TypeError('comparator must be a function')
    }
    this.#root = emptyLeaf(this.#token, this.#keyOnly)
    if (entries != null) {
      const { keys, values } = readEntries(entries)
      this.#bulkLoad(keys, values)
    }
  }

  /** The number of entries. */
  get size(): number {
    return this.#size
  }

  /** `'SortedMap'`, for `Object.prototype.toString`. */
  get [Symbol.toStringTag](): string {
    return 'SortedMap'
  }

  /** Remove every entry. */
  clear(): void {
    this.#root = emptyLeaf(this.#token, this.#keyOnly)
    this.#size = 0
    this.#version++
  }

  /** The value for `key`, or `undefined` when it is absent. O(log n). */
  get(key: K): V | undefined {
    const { leaf, pos, found } = this.#locate(key)
    return found ? valueAt(leaf, pos) : undefined
  }

  /**
   * Insert or replace `key`. Replacing also stores the new key object. O(log n).
   * @returns `this`
   * @throws {TypeError} when the comparator cannot order `key`; the map is unchanged.
   */
  set(key: K, value: V): this {
    this.#set(key, value, true)
    return this
  }

  #set(key: K, value: V, replace: boolean): boolean {
    key = positiveZero(key)
    const { path, leaf, pos, found } = this.#locate(key)
    if (!found) this.#assertReflexive(key)
    if (found && !replace) return false
    const ownedLeaf = this.#ownPath(path, leaf)
    if (found) {
      ownedLeaf.keys[pos] = key
      if (ownedLeaf.values !== undefined) ownedLeaf.values[pos] = value
      this.#refreshSeparators(path)
    } else {
      ownedLeaf.keys.splice(pos, 0, key)
      ownedLeaf.values?.splice(pos, 0, value)
      this.#size++
      for (const frame of path) frame.node.total++
      this.#refreshSeparators(path)
      this.#splitOverfull(path, ownedLeaf)
    }
    this.#version++
    return !found
  }

  /** Whether `key` is present. O(log n). */
  has(key: K): boolean {
    return this.#locate(key).found
  }

  /**
   * Remove `key`. O(log n).
   * @returns Whether it was present.
   */
  delete(key: K): boolean {
    const { path, leaf, pos, found } = this.#locate(key)
    if (!found) return false
    const ownedLeaf = this.#ownPath(path, leaf)
    ownedLeaf.keys.splice(pos, 1)
    ownedLeaf.values?.splice(pos, 1)
    this.#size--
    for (const frame of path) frame.node.total--
    this.#refreshSeparators(path)
    this.#mergeUnderfull(path, ownedLeaf)
    this.#version++
    return true
  }

  /**
   * The entry at `index` in key order, with `Array.prototype.at` rules (negative counts from the
   * end), or `undefined` out of range. O(log n), with no comparator calls.
   */
  at(index: number): [K, V] | undefined {
    let i = Math.trunc(index) || 0
    if (i < 0) i += this.#size
    if (i < 0 || i >= this.#size) return undefined
    let node = this.#root
    while (node.kind === 'branch') {
      let c = 0
      while (i >= countOf(node.children[c])) {
        i -= countOf(node.children[c])
        c++
      }
      node = node.children[c]
    }
    return [node.keys[i], valueAt(node, i)]
  }

  /**
   * `[key, value]` pairs in ascending key order.
   * @param lowestKey Start at the first key not below it. Omitted (or `undefined`) means the first
   * key.
   */
  entries(lowestKey?: K): IteratorObject<[K, V]> {
    const start = lowestKey === undefined ? undefined : { key: lowestKey, exclusive: false }
    return this.#walk(ASCENDING, start)
  }

  /**
   * `[key, value]` pairs in descending key order.
   * @param highestKey Start at the last key not above it. Omitted (or `undefined`) means the last
   * key.
   */
  entriesDescending(highestKey?: K): IteratorObject<[K, V]> {
    const start = highestKey === undefined ? undefined : { key: highestKey, exclusive: false }
    return this.#walk(DESCENDING, start)
  }

  /** The keys, in order. */
  keys(): IteratorObject<K> {
    return this.entries().map(([k]) => k)
  }

  /** The values, in key order. */
  values(): IteratorObject<V> {
    return this.entries().map(([, v]) => v)
  }

  /** Call `callback(value, key, map)` for each entry, in key order. */
  forEach(callback: (value: V, key: K, map: this) => void, thisArg?: unknown): void {
    for (const [k, v] of this.entries()) Reflect.apply(callback, thisArg, [v, k, this])
  }

  /** `[key, value]` pairs, in key order. */
  [Symbol.iterator](): IteratorObject<[K, V]> {
    return this.entries()
  }

  /**
   * How many keys sort before `key`: its index when present, else where it would go. O(log n).
   * @throws {TypeError} when the comparator cannot order `key`.
   */
  rank(key: K): number {
    let before = 0
    let node = this.#root
    while (node.kind === 'branch') {
      const index = this.#lowerBound(node.maxKeys, key)
      if (index >= node.children.length) return before + node.total
      for (let i = 0; i < index; i++) before += countOf(node.children[i])
      node = node.children[index]
    }
    return before + this.#lowerBound(node.keys, key)
  }

  /** The smallest key, or `undefined` when empty. */
  firstKey(): K | undefined {
    let n = this.#root
    while (n.kind === 'branch') n = n.children[0]
    return n.keys[0]
  }

  /** The largest key, or `undefined` when empty. */
  lastKey(): K | undefined {
    let n = this.#root
    while (n.kind === 'branch') n = n.children[n.children.length - 1]
    return n.keys.at(-1)
  }

  /** The entry with the least key above `key`, or `undefined`. */
  higher(key: K): [K, V] | undefined {
    return this.#entryAt(this.#seek(ASCENDING, { key, exclusive: true }))
  }

  /** The entry with the greatest key below `key`, or `undefined`. */
  lower(key: K): [K, V] | undefined {
    return this.#entryAt(this.#seek(DESCENDING, { key, exclusive: true }))
  }

  /** The entry with the least key at or above `key`, or `undefined`. */
  ceiling(key: K): [K, V] | undefined {
    return this.#entryAt(this.#seek(ASCENDING, { key, exclusive: false }))
  }

  /** The entry with the greatest key at or below `key`, or `undefined`. */
  floor(key: K): [K, V] | undefined {
    return this.#entryAt(this.#seek(DESCENDING, { key, exclusive: false }))
  }

  /**
   * The entries whose keys lie in `[from, to)`, or `[from, to]` with `inclusiveEnd`, in key order.
   * @param options `inclusiveEnd` includes `to` (default false); `limit` caps how many entries are
   * collected (a non-negative integer or `Infinity`, the default).
   * @throws {TypeError} when `limit` is not a number.
   * @throws {RangeError} when `limit` is negative or not an integer.
   * @example
   * ```ts
   * new SortedMap([[1, 'a'], [2, 'b'], [3, 'c']]).entriesBetween(1, 3) // [[1, 'a'], [2, 'b']]
   * ```
   */
  entriesBetween(from: K, to: K, options?: { inclusiveEnd?: boolean; limit?: number }): [K, V][] {
    assertOptions(options)
    const limit = resolveLimit(options?.limit)
    if (limit === 0) return []
    const out: [K, V][] = []
    for (const entry of this.#range(from, to, options?.inclusiveEnd === true)) {
      out.push(entry)
      if (out.length >= limit) break
    }
    return out
  }

  /**
   * Visit the entries whose keys lie in `[from, to)`, or `[from, to]` with `inclusiveEnd`, in key
   * order, and change them in one atomic step: if `update` or the comparator throws, the map is
   * left as it was. `update(value, key, map)` returns `{ replace: value }`, `{ remove: true }`,
   * either with `stop: true` to end after this entry, `{ stop: true }`, or `null`/`undefined` to
   * leave the entry alone.
   * @returns The number of entries visited.
   * @throws {TypeError} when `update` returns a primitive, an object with none of `replace`,
   * `remove` and `stop`, or both `replace` and a truthy `remove`.
   * @example
   * ```ts
   * const stock = new SortedMap([['apple', 3], ['pear', 0]])
   * stock.updateRange('a', 'z', (n) => (n === 0 ? { remove: true } : { replace: n - 1 }))
   * ;[...stock] // [['apple', 2]]
   * ```
   */
  updateRange(
    from: K,
    to: K,
    update: (
      value: V,
      key: K,
      map: this
    ) =>
      | { replace: V; stop?: true }
      | { remove: true; stop?: true }
      | { stop: true }
      | null
      | undefined,
    options?: { inclusiveEnd?: boolean }
  ): number {
    assertOptions(options)
    const range = this.#range(from, to, options?.inclusiveEnd === true)
    let next = range.next()
    // An empty range writes nothing, so it keeps the copy-on-write token and later writes in place.
    if (next.done === true) return 0
    return this.#atomic(() => {
      let visited = 0
      for (; next.done !== true; next = range.next()) {
        const [k, v] = next.value
        visited++
        const r = update(v, k, this)
        if (r == null) continue
        if (!isNonPrimitive(r)) {
          throw new TypeError('update must return an object, null or undefined')
        }
        if (!('replace' in r || 'remove' in r || 'stop' in r)) {
          throw new TypeError('update must return { replace }, { remove } or { stop }')
        }
        const remove = 'remove' in r && r.remove
        if (remove && 'replace' in r) {
          throw new TypeError('an update cannot both replace and remove')
        }
        if (remove) this.delete(k)
        else if ('replace' in r) this.set(k, r.replace)
        if ('stop' in r && r.stop) break
      }
      return visited
    })
  }

  /**
   * Remove the entries whose keys lie in `[from, to)`, or `[from, to]` with `inclusiveEnd`, in one
   * atomic step: a comparator that throws leaves the map unchanged.
   * @returns The number of entries removed.
   * @example
   * ```ts
   * const log = new SortedMap([[1, 'a'], [5, 'b'], [9, 'c']])
   * log.removeRange(0, 5, { inclusiveEnd: true }) // 2
   * ```
   */
  removeRange(from: K, to: K, options?: { inclusiveEnd?: boolean }): number {
    return this.updateRange(from, to, () => ({ remove: true }), options)
  }

  /**
   * A copy in O(1): the two maps share nodes until either one writes, which copies only the path
   * it changes. The copy keeps the class and comparator.
   * @throws {TypeError} when a subclass constructor does not pass `(entries, compareFn)`
   * on to `SortedMap`.
   */
  clone(): this {
    const copy = Reflect.construct(this.constructor, [undefined, this.#compareFn]) as this
    if (copy.#compareFn !== this.#compareFn) {
      throw new TypeError(
        'clone needs the constructor to pass (entries, compareFn) on to SortedMap'
      )
    }
    copy.#root = this.#root
    copy.#size = this.#size
    copy.#keyOnly = this.#keyOnly
    this.#token = {}
    return copy
  }

  #checkInvariants(): void {
    const fail = (name: string): never => {
      throw new Error(`SortedMap invariant violated: ${name}`)
    }
    const depths = new Set<number>()
    const walk = (node: TreeNode<K, V>, depth: number, isRoot: boolean): number => {
      const count = itemCount(node)
      if (count > NODE_CAPACITY || (!isRoot && count < MIN_FILL)) fail('fill')
      if (node.kind === 'leaf') {
        if (this.#keyOnly ? node.values !== undefined : node.keys.length !== node.values?.length)
          fail('leaf-arrays')
        depths.add(depth)
        for (let i = 1; i < node.keys.length; i++) {
          if (!(this.#cmp(node.keys[i - 1], node.keys[i]) < 0)) fail('order')
        }
        return node.keys.length
      }
      if (isRoot && count < 2) fail('fill')
      if (node.maxKeys.length !== node.children.length) fail('separators')
      let sum = 0
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i]
        sum += walk(child, depth + 1, false)
        if (!Object.is(node.maxKeys[i], lastKeyOf(child))) fail('separators')
      }
      if (node.total !== sum) fail('totals')
      return sum
    }
    const rootCount = walk(this.#root, 0, true)
    if (rootCount !== this.#size) fail('totals')
    if (depths.size > 1) fail('depth')
    let height = 0
    for (let n = this.#root; n.kind === 'branch'; n = n.children[0]) height++
    if (height !== (depths.values().next().value ?? 0)) fail('depth')
    if ((this.#size === 0) !== (this.#root.kind === 'leaf' && this.#root.keys.length === 0)) {
      fail('empty')
    }
  }

  #cmp(a: K, b: K): number {
    const r = this.#compareFn(a, b)
    if (typeof r !== 'number' || !Number.isFinite(r)) {
      throw new TypeError('comparator must return a finite number')
    }
    return r
  }

  #assertReflexive(key: K): void {
    if (this.#cmp(key, key) !== 0) {
      throw new TypeError('comparator must return 0 for a key compared with itself')
    }
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

  /** The leaf where `key` is or would go, the position in it, and the branch frames above it. */
  #locate(key: K): { path: PathFrame<K, V>[]; leaf: LeafNode<K, V>; pos: number; found: boolean } {
    const path: PathFrame<K, V>[] = []
    let node = this.#root
    while (node.kind === 'branch') {
      // A key above every separator goes at the end of the last child.
      const index = Math.min(this.#lowerBound(node.maxKeys, key), node.children.length - 1)
      path.push({ node, index })
      node = node.children[index]
    }
    const pos = this.#lowerBound(node.keys, key)
    const found = pos < node.keys.length && this.#cmp(node.keys[pos], key) === 0
    return { path, leaf: node, pos, found }
  }

  /** `node` itself when this map owns it, else a copy this map owns. */
  #own<N extends TreeNode<K, V>>(node: N): N {
    if (node.owner === this.#token) return node
    const copy: TreeNode<K, V> =
      node.kind === 'leaf'
        ? {
            kind: 'leaf',
            owner: this.#token,
            keys: node.keys.slice(),
            values: node.values?.slice()
          }
        : {
            kind: 'branch',
            owner: this.#token,
            children: node.children.slice(),
            maxKeys: node.maxKeys.slice(),
            total: node.total
          }
    return copy as N
  }

  /** Put `node` where `parent` points, or at the root when there is no parent. */
  #link<N extends TreeNode<K, V>>(parent: PathFrame<K, V> | undefined, node: N): N {
    if (parent === undefined) this.#root = node
    else parent.node.children[parent.index] = node
    return node
  }

  /** Own every node from the root down to `leaf`, pointing `path` at the owned branches. */
  #ownPath(path: PathFrame<K, V>[], leaf: LeafNode<K, V>): LeafNode<K, V> {
    let parent: PathFrame<K, V> | undefined
    for (const frame of path) {
      frame.node = this.#link(parent, this.#own(frame.node))
      parent = frame
    }
    return this.#link(parent, this.#own(leaf))
  }

  /** Set each separator on `path` to the last key of the child it leads to. */
  #refreshSeparators(path: PathFrame<K, V>[]): void {
    for (let depth = path.length - 1; depth >= 0; depth--) {
      const { node, index } = path[depth]
      node.maxKeys[index] = lastKeyOf(node.children[index])
    }
  }

  /** Move the upper half of an over-full `node` into a new right sibling, and return it. */
  #splitOff(node: TreeNode<K, V>): TreeNode<K, V> {
    const mid = Math.ceil(itemCount(node) / 2)
    if (node.kind === 'leaf') {
      return {
        kind: 'leaf',
        owner: this.#token,
        keys: node.keys.splice(mid),
        values: node.values?.splice(mid)
      }
    }
    const children = node.children.splice(mid)
    let total = 0
    for (const child of children) total += countOf(child)
    node.total -= total
    return {
      kind: 'branch',
      owner: this.#token,
      children,
      maxKeys: node.maxKeys.splice(mid),
      total
    }
  }

  /** Split `leaf` and then each ancestor on `path` while it holds more than the capacity. */
  #splitOverfull(path: PathFrame<K, V>[], leaf: LeafNode<K, V>): void {
    let node: TreeNode<K, V> = leaf
    for (let depth = path.length - 1; itemCount(node) > NODE_CAPACITY; depth--) {
      const right = this.#splitOff(node)
      if (depth < 0) {
        this.#root = {
          kind: 'branch',
          owner: this.#token,
          children: [node, right],
          maxKeys: [lastKeyOf(node), lastKeyOf(right)],
          total: countOf(node) + countOf(right)
        }
        return
      }
      const { node: parent, index } = path[depth]
      parent.children.splice(index + 1, 0, right)
      parent.maxKeys[index] = lastKeyOf(node)
      parent.maxKeys.splice(index + 1, 0, lastKeyOf(right))
      node = parent
    }
  }

  /**
   * Refill `leaf` and then each ancestor on `path` while it holds less than the minimum fill, by
   * borrowing one item from a sibling that can spare it or else merging with that sibling.
   */
  #mergeUnderfull(path: PathFrame<K, V>[], leaf: LeafNode<K, V>): void {
    let node: TreeNode<K, V> = leaf
    for (let depth = path.length - 1; depth >= 0 && itemCount(node) < MIN_FILL; depth--) {
      const { node: parent, index: i } = path[depth]
      const j = i > 0 ? i - 1 : i + 1
      const sibling = this.#own(parent.children[j])
      parent.children[j] = sibling
      const leftIndex = Math.min(i, j)
      if (itemCount(sibling) > MIN_FILL) {
        this.#borrow(node, sibling, j < i ? DESCENDING : ASCENDING)
        parent.maxKeys[leftIndex] = lastKeyOf(parent.children[leftIndex])
        return
      }
      this.#merge(parent.children[leftIndex], parent.children[leftIndex + 1])
      parent.children.splice(leftIndex + 1, 1)
      parent.maxKeys.splice(leftIndex, 1)
      node = parent
    }
    if (this.#root.kind === 'branch' && this.#root.children.length === 1) {
      this.#root = this.#root.children[0]
    }
  }

  /**
   * Move one item into `node` from `sibling`, a node at the same depth: the sibling's last item
   * when it sits before `node` (`DESCENDING`), else its first.
   */
  #borrow(node: TreeNode<K, V>, sibling: TreeNode<K, V>, from: Direction): void {
    const at = from === DESCENDING ? -1 : 0
    if (node.kind === 'leaf') {
      const donor = sibling as LeafNode<K, V>
      const keys = donor.keys.splice(at, 1)
      const values = donor.values?.splice(at, 1)
      if (from === DESCENDING) {
        node.keys.unshift(...keys)
        if (values !== undefined) node.values?.unshift(...values)
      } else {
        node.keys.push(...keys)
        if (values !== undefined) node.values?.push(...values)
      }
      return
    }
    const donor = sibling as BranchNode<K, V>
    const children = donor.children.splice(at, 1)
    const maxKeys = donor.maxKeys.splice(at, 1)
    const moved = countOf(children[0])
    donor.total -= moved
    node.total += moved
    if (from === DESCENDING) {
      node.children.unshift(...children)
      node.maxKeys.unshift(...maxKeys)
    } else {
      node.children.push(...children)
      node.maxKeys.push(...maxKeys)
    }
  }

  /** Append the items of `right` to `left`, its sibling at the same depth. */
  #merge(left: TreeNode<K, V>, right: TreeNode<K, V>): void {
    if (left.kind === 'leaf') {
      const from = right as LeafNode<K, V>
      left.keys.push(...from.keys)
      if (from.values !== undefined) left.values?.push(...from.values)
      return
    }
    const from = right as BranchNode<K, V>
    left.children.push(...from.children)
    left.maxKeys.push(...from.maxKeys)
    left.total += from.total
  }

  #entryAt(cursor: Cursor<K, V> | undefined): [K, V] | undefined {
    if (cursor === undefined) return undefined
    return [cursor.leaf.keys[cursor.index], valueAt(cursor.leaf, cursor.index)]
  }

  /** Descend from `node` to its first key (`ASCENDING`) or its last, pushing frames on `branches`. */
  #edge(node: TreeNode<K, V>, branches: PathFrame<K, V>[], direction: Direction): Cursor<K, V> {
    while (node.kind === 'branch') {
      const index = direction === ASCENDING ? 0 : node.children.length - 1
      branches.push({ node, index })
      node = node.children[index]
    }
    return { branches, leaf: node, index: direction === ASCENDING ? 0 : node.keys.length - 1 }
  }

  /** The key position after `cursor` in `direction`, or `undefined` past the end. */
  #step(cursor: Cursor<K, V>, direction: Direction): Cursor<K, V> | undefined {
    const index = cursor.index + direction
    if (index >= 0 && index < cursor.leaf.keys.length) return { ...cursor, index }
    const branches = cursor.branches.slice()
    while (branches.length > 0) {
      const top = branches[branches.length - 1]
      const next = top.index + direction
      if (next >= 0 && next < top.node.children.length) {
        branches[branches.length - 1] = { node: top.node, index: next }
        return this.#edge(top.node.children[next], branches, direction)
      }
      branches.pop()
    }
    return undefined
  }

  /**
   * The first key position in `direction` from `start`: ascending, the least key at or above
   * `start.key`; descending, the greatest key at or below it; above or below only when `exclusive`.
   * With no `start`, the first or last key.
   */
  #seek(direction: Direction, start: SeekStart<K> | undefined): Cursor<K, V> | undefined {
    if (this.#size === 0) return undefined
    const branches: PathFrame<K, V>[] = []
    if (start === undefined) return this.#edge(this.#root, branches, direction)
    const { key, exclusive } = start
    // Ascending-exclusive and descending-inclusive split the keys after those equal to `key`.
    const afterEqual = (direction === ASCENDING) === exclusive
    const split = (keys: readonly K[]) =>
      afterEqual ? this.#upperBound(keys, key) : this.#lowerBound(keys, key)
    let node = this.#root
    while (node.kind === 'branch') {
      const index = Math.min(split(node.maxKeys), node.children.length - 1)
      branches.push({ node, index })
      node = node.children[index]
    }
    const at = split(node.keys)
    const index = direction === ASCENDING ? at : at - 1
    if (index >= 0 && index < node.keys.length) return { branches, leaf: node, index }
    // The answer, if any, is the nearest key of the next leaf in `direction`.
    const edge = direction === ASCENDING ? node.keys.length - 1 : 0
    return this.#step({ branches, leaf: node, index: edge }, direction)
  }

  *#walk(direction: Direction, start: SeekStart<K> | undefined): Generator<[K, V], void, unknown> {
    let cursor = this.#seek(direction, start)
    while (cursor !== undefined) {
      const k = cursor.leaf.keys[cursor.index]
      const v = valueAt(cursor.leaf, cursor.index)
      const seenVersion = this.#version
      yield [k, v]
      cursor =
        this.#version === seenVersion
          ? this.#step(cursor, direction)
          : this.#seek(direction, { key: k, exclusive: true })
    }
  }

  /** The entries from `from` up to `to`, in key order; it re-seeks after the map changes. */
  *#range(from: K, to: K, inclusiveEnd: boolean): Generator<[K, V], void, unknown> {
    if (this.#cmp(from, to) > 0) return
    for (const entry of this.#walk(ASCENDING, { key: from, exclusive: false })) {
      const c = this.#cmp(entry[0], to)
      if (inclusiveEnd ? c > 0 : c >= 0) return
      yield entry
    }
  }

  #atomic<T>(fn: () => T): T {
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

  #bulkLoad(keys: K[], values: V[] | undefined): void {
    for (const key of keys) this.#assertReflexive(key)
    const alreadySorted = keys.every((key, i) => i === 0 || this.#cmp(keys[i - 1], key) < 0)
    const sorted = alreadySorted ? { keys, values } : this.#sortedColumns(keys, values)
    const n = sorted.keys.length
    const leafCount = Math.max(1, Math.ceil(n / NODE_CAPACITY))
    const leaves: LeafNode<K, V>[] = []
    const base = Math.floor(n / leafCount)
    const extra = n % leafCount
    let offset = 0
    for (let i = 0; i < leafCount; i++) {
      const end = offset + base + (i < extra ? 1 : 0)
      leaves.push({
        kind: 'leaf',
        owner: this.#token,
        keys: sorted.keys.slice(offset, end),
        values: sorted.values?.slice(offset, end)
      })
      offset = end
    }
    let level: TreeNode<K, V>[] = leaves
    while (level.length > 1) {
      const count = Math.ceil(level.length / NODE_CAPACITY)
      const next: BranchNode<K, V>[] = []
      const bbase = Math.floor(level.length / count)
      const bextra = level.length % count
      let off = 0
      for (let i = 0; i < count; i++) {
        const size = bbase + (i < bextra ? 1 : 0)
        const children = level.slice(off, off + size)
        off += size
        let total = 0
        for (const c of children) total += countOf(c)
        next.push({
          kind: 'branch',
          owner: this.#token,
          children,
          maxKeys: children.map(lastKeyOf),
          total
        })
      }
      level = next
    }
    this.#root = level[0]
    this.#size = n
  }

  #sortedColumns(keys: K[], values: V[] | undefined): { keys: K[]; values: V[] | undefined } {
    const order = keys.map((_, i) => i).sort((a, b) => this.#cmp(keys[a], keys[b]))
    const sorted: { keys: K[]; values: V[] | undefined } = {
      keys: [],
      values: values === undefined ? undefined : []
    }
    for (const i of order) {
      const last = sorted.keys.length - 1
      const slot = last >= 0 && this.#cmp(sorted.keys[last], keys[i]) === 0 ? last : last + 1
      if (slot === last && values === undefined) continue
      sorted.keys[slot] = keys[i]
      if (sorted.values !== undefined && values !== undefined) sorted.values[slot] = values[i]
    }
    return sorted
  }
}
