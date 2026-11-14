/**
 * Iteration over objects, arrays, strings, maps, sets and other iterables.
 * Sorted containers, trees, heaps, deques, caches, tries and bisect.
 * @module collections
 */
export { entries, includes, isEmpty, keys, size, values } from './entries.ts'
export {
  countBy,
  groupBy,
  keyBy,
  maxBy,
  meanBy,
  minBy,
  orderBy,
  partition,
  type SortKey,
  type SortOrder,
  sortBy,
  sumBy
} from './group.ts'
export {
  type CollectionReducer,
  every,
  filter,
  find,
  findLast,
  flatMap,
  forEach,
  forEachRight,
  map,
  reduce,
  reduceRight,
  reject,
  some
} from './iterate.ts'
export type { Collection, CollectionCallback, CollectionKey, CollectionValue } from './shape.ts'
export { binarySearch, bisect, bisectLeft, bisectRight, insort, insortLeft } from './bisect.ts'
export { Deque } from './deque.ts'
export { FrozenSet } from './frozen-set.ts'
export { Heap } from './heap.ts'
export { LRUCache } from './lru-cache.ts'
export { SortedMap } from './sorted-map.ts'
export { SortedSet } from './sorted-set.ts'
export { SplayTree } from './splay-tree.ts'
export { Trie } from './trie.ts'
